//! D1 schema introspection over HTTP.
//!
//! D1 is the SQLite dialect, but every statement is an HTTPS round trip, so
//! the old per-table PRAGMA loop cost `1 + tables × (4 + indexes)` requests —
//! seconds of pure latency on any real schema. The primary path batches the
//! PRAGMAs into multi-statement scripts (the `/query` endpoint returns one
//! result set per statement, positionally), bringing introspection down to a
//! constant 2–3 requests. If the response arity ever disagrees with the script
//! (a gateway change), the legacy per-table path runs instead. Row counts are
//! filled in by the background row-count refresher.

use std::collections::{HashMap, HashSet};

use serde_json::Value;

use crate::database::d1::{D1Http, D1ResultSet, D1Row};
use crate::database::sqlite_introspection::{
    assemble, RawColumn, RawForeignKey, RawIndexColumn, RawTable,
};
use crate::database::types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, IndexInfo, TableInfo};
use crate::Error;

/// Tables per multi-statement introspection request (3 statements per table).
const TABLES_PER_REQUEST: usize = 40;
/// Indexes per multi-statement `index_info` request.
const INDEXES_PER_REQUEST: usize = 100;

/// Reads a cell as a string, tolerating that D1 returns native JSON (a name may
/// arrive as a JSON string, a number as a JSON number, etc.).
fn cell_string(row: &D1Row, column: &str) -> Option<String> {
    match row.get(column)? {
        Value::String(s) => Some(s.clone()),
        Value::Null => None,
        other => Some(other.to_string()),
    }
}

/// Reads a cell as an integer (PRAGMA flags come back as JSON numbers).
fn cell_int(row: &D1Row, column: &str) -> i64 {
    match row.get(column) {
        Some(Value::Number(n)) => n.as_i64().unwrap_or(0),
        Some(Value::String(s)) => s.parse().unwrap_or(0),
        Some(Value::Bool(b)) => *b as i64,
        _ => 0,
    }
}

/// Escapes a name for interpolation inside a single-quoted PRAGMA argument.
fn quote_pragma_arg(name: &str) -> String {
    name.replace('\'', "''")
}

/// Runs a single statement and returns its rows (introspection statements never
/// take params).
async fn rows(http: &D1Http, sql: &str) -> Result<Vec<D1Row>, Error> {
    let result_sets = http.query(sql, Vec::new()).await?;
    Ok(result_sets
        .into_iter()
        .next()
        .map(|set| set.results)
        .unwrap_or_default())
}

pub async fn get_database_schema(http: &D1Http) -> Result<DatabaseSchema, Error> {
    match batched_introspect(http).await {
        Ok(schema) => Ok(schema),
        Err(err) => {
            log::warn!(
                "Batched D1 introspection failed, falling back to per-table PRAGMAs: {}",
                err
            );
            legacy_introspect(http).await
        }
    }
}

async fn batched_introspect(http: &D1Http) -> Result<DatabaseSchema, Error> {
    let table_rows = rows(
        http,
        "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .await?;
    let raw_tables: Vec<RawTable> = table_rows
        .iter()
        .filter_map(|row| {
            Some(RawTable {
                name: cell_string(row, "name")?,
                create_sql: cell_string(row, "sql").unwrap_or_default(),
            })
        })
        .collect();

    let mut raw_columns = Vec::new();
    let mut raw_foreign_keys = Vec::new();
    // (table, index, unique), in response order, for the index_info pass.
    let mut index_list: Vec<(String, String, bool)> = Vec::new();

    for chunk in raw_tables.chunks(TABLES_PER_REQUEST) {
        let script = chunk
            .iter()
            .map(|table| {
                let name = quote_pragma_arg(&table.name);
                format!(
                    "PRAGMA table_info('{name}'); PRAGMA foreign_key_list('{name}'); PRAGMA index_list('{name}')"
                )
            })
            .collect::<Vec<_>>()
            .join("; ");

        let result_sets = http.query(&script, Vec::new()).await?;
        if result_sets.len() != chunk.len() * 3 {
            return Err(Error::Any(anyhow::anyhow!(
                "D1 multi-statement introspection returned {} result sets for {} statements",
                result_sets.len(),
                chunk.len() * 3
            )));
        }

        for (table, sets) in chunk.iter().zip(result_sets.chunks(3)) {
            collect_table_sets(
                &table.name,
                sets,
                &mut raw_columns,
                &mut raw_foreign_keys,
                &mut index_list,
            );
        }
    }

    let mut raw_index_columns: Vec<RawIndexColumn> = Vec::new();
    for chunk in index_list.chunks(INDEXES_PER_REQUEST) {
        let script = chunk
            .iter()
            .map(|(_, index, _)| format!("PRAGMA index_info('{}')", quote_pragma_arg(index)))
            .collect::<Vec<_>>()
            .join("; ");

        let result_sets = http.query(&script, Vec::new()).await?;
        if result_sets.len() != chunk.len() {
            return Err(Error::Any(anyhow::anyhow!(
                "D1 index_info returned {} result sets for {} statements",
                result_sets.len(),
                chunk.len()
            )));
        }

        for ((table, index, is_unique), set) in chunk.iter().zip(result_sets) {
            if set.results.is_empty() {
                raw_index_columns.push(RawIndexColumn {
                    table: table.clone(),
                    index: index.clone(),
                    is_unique: *is_unique,
                    column: None,
                });
                continue;
            }
            for row in &set.results {
                raw_index_columns.push(RawIndexColumn {
                    table: table.clone(),
                    index: index.clone(),
                    is_unique: *is_unique,
                    column: cell_string(row, "name"),
                });
            }
        }
    }

    Ok(assemble(
        raw_tables,
        raw_columns,
        raw_foreign_keys,
        raw_index_columns,
    ))
}

/// Decodes one table's `[table_info, foreign_key_list, index_list]` result-set
/// triple into the shared raw shapes.
fn collect_table_sets(
    table: &str,
    sets: &[D1ResultSet],
    raw_columns: &mut Vec<RawColumn>,
    raw_foreign_keys: &mut Vec<RawForeignKey>,
    index_list: &mut Vec<(String, String, bool)>,
) {
    if let Some(columns_set) = sets.first() {
        for row in &columns_set.results {
            let Some(name) = cell_string(row, "name") else {
                continue;
            };
            raw_columns.push(RawColumn {
                table: table.to_string(),
                name,
                data_type: cell_string(row, "type").unwrap_or_default(),
                not_null: cell_int(row, "notnull") != 0,
                default_value: cell_string(row, "dflt_value"),
                is_primary_key: cell_int(row, "pk") > 0,
            });
        }
    }
    if let Some(fk_set) = sets.get(1) {
        for row in &fk_set.results {
            let (Some(from), Some(ref_table), Some(ref_column)) = (
                cell_string(row, "from"),
                cell_string(row, "table"),
                cell_string(row, "to"),
            ) else {
                continue;
            };
            raw_foreign_keys.push(RawForeignKey {
                table: table.to_string(),
                from_column: from,
                referenced_table: ref_table,
                referenced_column: ref_column,
            });
        }
    }
    if let Some(index_set) = sets.get(2) {
        for row in &index_set.results {
            let Some(name) = cell_string(row, "name") else {
                continue;
            };
            index_list.push((table.to_string(), name, cell_int(row, "unique") != 0));
        }
    }
}

/// The pre-batching per-table introspection, kept as the fallback when the
/// multi-statement response shape is unexpected.
async fn legacy_introspect(http: &D1Http) -> Result<DatabaseSchema, Error> {
    let table_rows = rows(
        http,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .await?;
    let table_names: Vec<String> = table_rows
        .iter()
        .filter_map(|row| cell_string(row, "name"))
        .collect();

    let mut tables = Vec::new();
    let mut unique_columns_set = HashSet::new();

    for table_name in table_names {
        let arg = quote_pragma_arg(&table_name);
        // PRAGMA table_info: cid, name, type, notnull, dflt_value, pk
        let col_rows = rows(http, &format!("PRAGMA table_info('{arg}')")).await?;

        // PRAGMA foreign_key_list: id, seq, table, from, to, on_update, on_delete, match
        let fk_rows = rows(http, &format!("PRAGMA foreign_key_list('{arg}')")).await?;
        let fk_map: HashMap<String, ForeignKeyInfo> = fk_rows
            .iter()
            .filter_map(|row| {
                let from = cell_string(row, "from")?;
                let ref_table = cell_string(row, "table")?;
                let ref_column = cell_string(row, "to")?;
                Some((
                    from,
                    ForeignKeyInfo {
                        referenced_table: ref_table,
                        referenced_column: ref_column,
                        referenced_schema: String::new(),
                    },
                ))
            })
            .collect();

        // Indexes: index_list (seq, name, unique, origin, partial) → index_info.
        let mut indexes = Vec::new();
        let index_rows = rows(http, &format!("PRAGMA index_list('{arg}')")).await?;
        for index_row in &index_rows {
            let Some(name) = cell_string(index_row, "name") else {
                continue;
            };
            let is_unique = cell_int(index_row, "unique") != 0;
            let info_rows = rows(
                http,
                &format!("PRAGMA index_info('{}')", quote_pragma_arg(&name)),
            )
            .await?;
            let column_names: Vec<String> = info_rows
                .iter()
                .filter_map(|row| cell_string(row, "name"))
                .collect();
            indexes.push(IndexInfo {
                name,
                column_names,
                is_unique,
                is_primary: false,
            });
        }

        // AUTOINCREMENT only applies to INTEGER PRIMARY KEY; detect it from the
        // table's CREATE SQL, like the SQLite reader.
        let create_sql = rows(
            http,
            &format!("SELECT sql FROM sqlite_master WHERE type='table' AND name='{arg}'"),
        )
        .await?
        .first()
        .and_then(|row| cell_string(row, "sql"))
        .unwrap_or_default();
        let has_autoincrement = create_sql.to_uppercase().contains("AUTOINCREMENT");

        let mut columns = Vec::new();
        let mut primary_key_columns = Vec::new();

        for col_row in &col_rows {
            let Some(column_name) = cell_string(col_row, "name") else {
                continue;
            };
            let data_type = cell_string(col_row, "type").unwrap_or_default();
            let is_nullable = cell_int(col_row, "notnull") == 0;
            let default_value = cell_string(col_row, "dflt_value");
            let is_primary_key = cell_int(col_row, "pk") > 0;

            unique_columns_set.insert(column_name.clone());
            if is_primary_key {
                primary_key_columns.push(column_name.clone());
            }
            let is_auto_increment = is_primary_key
                && data_type.to_uppercase() == "INTEGER"
                && (has_autoincrement || primary_key_columns.len() == 1);
            let foreign_key = fk_map.get(&column_name).cloned();

            columns.push(ColumnInfo {
                name: column_name,
                data_type,
                is_nullable,
                default_value,
                is_primary_key,
                is_auto_increment,
                foreign_key,
                allowed_values: None,
            });
        }

        tables.push(TableInfo {
            name: table_name,
            schema: String::new(),
            columns,
            primary_key_columns,
            row_count_estimate: None,
            indexes,
        });
    }

    Ok(DatabaseSchema {
        tables,
        schemas: vec![],
        unique_columns: unique_columns_set.into_iter().collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn result_set(json: &str) -> D1ResultSet {
        serde_json::from_str(json).expect("result set should deserialize")
    }

    #[test]
    fn reads_table_info_row_fields() {
        // A PRAGMA table_info row, as D1 returns it (object keyed by column).
        let set = result_set(
            r#"{ "results": [
                { "cid": 0, "name": "id", "type": "INTEGER", "notnull": 1, "dflt_value": null, "pk": 1 },
                { "cid": 1, "name": "email", "type": "TEXT", "notnull": 0, "dflt_value": null, "pk": 0 }
            ], "meta": {} }"#,
        );
        let id = &set.results[0];
        assert_eq!(cell_string(id, "name").as_deref(), Some("id"));
        assert_eq!(cell_string(id, "type").as_deref(), Some("INTEGER"));
        assert_eq!(cell_int(id, "notnull"), 1);
        assert_eq!(cell_int(id, "pk"), 1);

        let email = &set.results[1];
        assert_eq!(cell_int(email, "notnull"), 0);
        assert_eq!(cell_int(email, "pk"), 0);
        assert!(cell_string(email, "dflt_value").is_none());
    }

    #[test]
    fn reads_foreign_key_list_fields() {
        let set = result_set(
            r#"{ "results": [
                { "id": 0, "seq": 0, "table": "users", "from": "user_id", "to": "id" }
            ], "meta": {} }"#,
        );
        let row = &set.results[0];
        assert_eq!(cell_string(row, "from").as_deref(), Some("user_id"));
        assert_eq!(cell_string(row, "table").as_deref(), Some("users"));
        assert_eq!(cell_string(row, "to").as_deref(), Some("id"));
    }

    #[test]
    fn cell_int_tolerates_string_and_bool() {
        let set = result_set(r#"{ "results": [ { "a": "5", "b": true, "c": 9 } ], "meta": {} }"#);
        let row = &set.results[0];
        assert_eq!(cell_int(row, "a"), 5);
        assert_eq!(cell_int(row, "b"), 1);
        assert_eq!(cell_int(row, "c"), 9);
    }

    #[test]
    fn collect_table_sets_maps_the_positional_triple() {
        let columns = result_set(
            r#"{ "results": [
                { "cid": 0, "name": "id", "type": "INTEGER", "notnull": 1, "dflt_value": null, "pk": 1 },
                { "cid": 1, "name": "user_id", "type": "INTEGER", "notnull": 0, "dflt_value": null, "pk": 0 }
            ], "meta": {} }"#,
        );
        let fks = result_set(
            r#"{ "results": [
                { "id": 0, "seq": 0, "table": "users", "from": "user_id", "to": "id" }
            ], "meta": {} }"#,
        );
        let indexes = result_set(
            r#"{ "results": [
                { "seq": 0, "name": "posts_user", "unique": 1, "origin": "c", "partial": 0 }
            ], "meta": {} }"#,
        );

        let mut raw_columns = Vec::new();
        let mut raw_fks = Vec::new();
        let mut index_list = Vec::new();
        collect_table_sets(
            "posts",
            &[columns, fks, indexes],
            &mut raw_columns,
            &mut raw_fks,
            &mut index_list,
        );

        assert_eq!(raw_columns.len(), 2);
        assert!(raw_columns[0].is_primary_key);
        assert_eq!(raw_fks.len(), 1);
        assert_eq!(raw_fks[0].referenced_table, "users");
        assert_eq!(
            index_list,
            vec![("posts".to_string(), "posts_user".to_string(), true)]
        );
    }

    #[test]
    fn quote_pragma_arg_escapes_single_quotes() {
        assert_eq!(quote_pragma_arg("we'ird"), "we''ird");
    }
}
