use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
};

use anyhow::Context;
use duckdb::Connection;

use crate::{
    database::types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, IndexInfo, TableInfo},
    Error,
};

pub async fn get_database_schema(conn: Arc<Mutex<Connection>>) -> Result<DatabaseSchema, Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = conn
            .lock()
            .map_err(|_| Error::Internal("DuckDB connection mutex poisoned".into()))?;

        // duckdb_schemas() flags every schema as internal (incl. `main`), so
        // use information_schema scoped to the current catalog instead.
        let mut schemas_stmt = conn.prepare(
            "SELECT schema_name FROM information_schema.schemata \
             WHERE catalog_name = current_database() \
             AND schema_name NOT IN ('information_schema', 'pg_catalog')",
        )?;
        let schemas: Vec<String> = schemas_stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;

        let mut tables_stmt = conn.prepare(
            "SELECT schema_name, table_name, estimated_size \
             FROM duckdb_tables() WHERE NOT internal \
             ORDER BY schema_name, table_name",
        )?;
        let table_refs: Vec<(String, String, Option<i64>)> = tables_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        // One pass each over duckdb_constraints()/duckdb_indexes(), grouped in
        // Rust — a per-table WHERE-filtered query would rescan the catalog for
        // every table.
        let mut fk_by_table = all_foreign_keys(&conn).unwrap_or_default();
        let mut indexes_by_table = all_indexes(&conn).unwrap_or_default();

        let mut tables = Vec::new();
        let mut unique_columns_set = HashSet::new();

        for (schema_name, table_name, estimated_size) in table_refs {
            let qualified = format!(
                "\"{}\".\"{}\"",
                schema_name.replace('"', "\"\""),
                table_name.replace('"', "\"\"")
            );

            // PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
            let pragma_query = format!("PRAGMA table_info('{}')", qualified.replace('\'', "''"));
            let mut col_stmt = conn
                .prepare(&pragma_query)
                .context("Failed to prepare PRAGMA table_info query")?;

            let col_rows: Vec<(String, String, bool, Option<String>, bool)> = col_stmt
                .query_map([], |row| {
                    let column_name: String = row.get(1)?;
                    let data_type: String = row.get(2)?;
                    let not_null: bool = row.get(3)?;
                    let default_value: Option<String> = row.get(4)?;
                    let pk: bool = row.get(5)?;
                    Ok((column_name, data_type, !not_null, default_value, pk))
                })?
                .collect::<Result<Vec<_>, _>>()?;

            let fk_map = fk_by_table
                .remove(&(schema_name.clone(), table_name.clone()))
                .unwrap_or_default();

            let indexes = indexes_by_table
                .remove(&(schema_name.clone(), table_name.clone()))
                .unwrap_or_default();

            let mut columns = Vec::new();
            let mut primary_key_columns = Vec::new();

            for (column_name, data_type, is_nullable, default_value, is_primary_key) in col_rows {
                unique_columns_set.insert(column_name.clone());

                if is_primary_key {
                    primary_key_columns.push(column_name.clone());
                }

                // DuckDB has no AUTOINCREMENT; sequences via nextval() are the equivalent
                let is_auto_increment = default_value
                    .as_deref()
                    .map(|d| d.contains("nextval"))
                    .unwrap_or(false);

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
                schema: schema_name,
                columns,
                primary_key_columns,
                row_count_estimate: estimated_size.map(|c| c as u64),
                indexes,
            });
        }

        // Views (incl. file-source views over CSV/Parquet/JSON) surface as
        // read-only tables so the data viewer and schema sidebar list them.
        let mut views_stmt = conn.prepare(
            "SELECT schema_name, view_name FROM duckdb_views() \
             WHERE NOT internal ORDER BY schema_name, view_name",
        )?;
        let view_refs: Vec<(String, String)> = views_stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        for (schema_name, view_name) in view_refs {
            let qualified = format!(
                "\"{}\".\"{}\"",
                schema_name.replace('"', "\"\""),
                view_name.replace('"', "\"\"")
            );
            let pragma_query = format!("PRAGMA table_info('{}')", qualified.replace('\'', "''"));
            let Ok(mut col_stmt) = conn.prepare(&pragma_query) else {
                continue;
            };
            let col_rows: Vec<(String, String, bool, Option<String>)> = col_stmt
                .query_map([], |row| {
                    let column_name: String = row.get(1)?;
                    let data_type: String = row.get(2)?;
                    let not_null: bool = row.get(3)?;
                    let default_value: Option<String> = row.get(4)?;
                    Ok((column_name, data_type, !not_null, default_value))
                })
                .and_then(|rows| rows.collect::<Result<Vec<_>, _>>())
                .unwrap_or_default();

            let mut columns = Vec::new();
            for (column_name, data_type, is_nullable, default_value) in col_rows {
                unique_columns_set.insert(column_name.clone());
                columns.push(ColumnInfo {
                    name: column_name,
                    data_type,
                    is_nullable,
                    default_value,
                    is_primary_key: false,
                    is_auto_increment: false,
                    foreign_key: None,
                    allowed_values: None,
                });
            }

            tables.push(TableInfo {
                name: view_name,
                schema: schema_name,
                columns,
                primary_key_columns: Vec::new(),
                row_count_estimate: None,
                indexes: Vec::new(),
            });
        }

        let unique_columns = unique_columns_set.into_iter().collect();

        Ok(DatabaseSchema {
            tables,
            schemas,
            unique_columns,
        }) as Result<_, Error>
    })
    .await?
}

/// DuckDB only exposes foreign-key details through `duckdb_constraints()`'s
/// `constraint_text` (e.g. `FOREIGN KEY (a) REFERENCES other(b)`), so we parse
/// the text. Composite keys map column-by-column.
fn all_foreign_keys(
    conn: &Connection,
) -> Result<HashMap<(String, String), HashMap<String, ForeignKeyInfo>>, Error> {
    let mut stmt = conn.prepare(
        "SELECT schema_name, table_name, constraint_text FROM duckdb_constraints() \
         WHERE constraint_type = 'FOREIGN KEY'",
    )?;

    let rows: Vec<(String, String, String)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get::<_, String>(2)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut map: HashMap<(String, String), HashMap<String, ForeignKeyInfo>> = HashMap::new();
    for (schema_name, table_name, text) in rows {
        if let Some((from_columns, referenced_table, to_columns)) = parse_fk_constraint(&text) {
            let table_map = map.entry((schema_name, table_name)).or_default();
            for (from, to) in from_columns.into_iter().zip(to_columns) {
                table_map.insert(
                    from,
                    ForeignKeyInfo {
                        referenced_table: referenced_table.clone(),
                        referenced_column: to,
                        referenced_schema: String::new(),
                    },
                );
            }
        }
    }

    Ok(map)
}

/// Parses `FOREIGN KEY (a, b) REFERENCES tbl(x, y)` into its parts.
fn parse_fk_constraint(text: &str) -> Option<(Vec<String>, String, Vec<String>)> {
    let rest = text.trim().strip_prefix("FOREIGN KEY")?.trim_start();
    let (from_part, rest) = read_parenthesized(rest)?;
    let rest = rest.trim_start().strip_prefix("REFERENCES")?.trim_start();

    let open = rest.find('(')?;
    let referenced_table = rest[..open].trim().trim_matches('"').to_string();
    let (to_part, _) = read_parenthesized(rest[open..].trim_start())?;

    let split = |s: &str| {
        s.split(',')
            .map(|c| c.trim().trim_matches('"').to_string())
            .filter(|c| !c.is_empty())
            .collect::<Vec<_>>()
    };

    Some((split(&from_part), referenced_table, split(&to_part)))
}

fn read_parenthesized(s: &str) -> Option<(String, &str)> {
    let s = s.strip_prefix('(')?;
    let close = s.find(')')?;
    Some((s[..close].to_string(), &s[close + 1..]))
}

fn all_indexes(conn: &Connection) -> Result<HashMap<(String, String), Vec<IndexInfo>>, Error> {
    let mut stmt = conn.prepare(
        "SELECT schema_name, table_name, index_name, is_unique, is_primary, expressions \
         FROM duckdb_indexes()",
    )?;

    let rows: Vec<(String, String, String, bool, bool, Option<String>)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut map: HashMap<(String, String), Vec<IndexInfo>> = HashMap::new();
    for (schema_name, table_name, name, is_unique, is_primary, expressions) in rows {
        map.entry((schema_name, table_name))
            .or_default()
            .push(IndexInfo {
                name,
                column_names: expressions
                    .map(|e| {
                        e.trim_matches(['[', ']'])
                            .split(',')
                            .map(|c| c.trim().trim_matches(['\'', '"']).to_string())
                            .filter(|c| !c.is_empty())
                            .collect()
                    })
                    .unwrap_or_default(),
                is_unique,
                is_primary,
            });
    }

    Ok(map)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> Arc<Mutex<Connection>> {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, age INTEGER);
             CREATE TABLE orders (
                 id INTEGER PRIMARY KEY,
                 user_id INTEGER REFERENCES users(id),
                 total DOUBLE
             );
             CREATE INDEX idx_users_email ON users(email);
             INSERT INTO users VALUES (1, 'a@b.c', 30);",
        )
        .unwrap();
        Arc::new(Mutex::new(conn))
    }

    #[tokio::test]
    async fn introspects_tables_columns_and_pks() {
        let schema = get_database_schema(setup()).await.unwrap();

        assert_eq!(schema.tables.len(), 2);
        assert!(schema.schemas.contains(&"main".to_string()));

        let users = schema.tables.iter().find(|t| t.name == "users").unwrap();
        assert_eq!(users.schema, "main");
        assert_eq!(users.primary_key_columns, vec!["id"]);
        assert_eq!(users.columns.len(), 3);

        let email = users.columns.iter().find(|c| c.name == "email").unwrap();
        assert!(!email.is_nullable);
        assert!(!email.is_primary_key);
    }

    #[tokio::test]
    async fn introspects_foreign_keys() {
        let schema = get_database_schema(setup()).await.unwrap();

        let orders = schema.tables.iter().find(|t| t.name == "orders").unwrap();
        let user_id = orders.columns.iter().find(|c| c.name == "user_id").unwrap();
        let fk = user_id.foreign_key.as_ref().expect("user_id has FK");
        assert_eq!(fk.referenced_table, "users");
        assert_eq!(fk.referenced_column, "id");
    }

    #[tokio::test]
    async fn introspects_views_as_tables() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE base (id INTEGER, label TEXT);
             INSERT INTO base VALUES (1, 'x');
             CREATE VIEW v_labels AS SELECT label FROM base;",
        )
        .unwrap();
        let schema = get_database_schema(Arc::new(Mutex::new(conn)))
            .await
            .unwrap();

        let view = schema
            .tables
            .iter()
            .find(|t| t.name == "v_labels")
            .expect("view should be listed");
        assert_eq!(view.columns.len(), 1);
        assert_eq!(view.columns[0].name, "label");
        assert!(view.primary_key_columns.is_empty());
    }

    #[test]
    fn parses_fk_constraint_text() {
        let (from, table, to) =
            parse_fk_constraint("FOREIGN KEY (user_id) REFERENCES users(id)").unwrap();
        assert_eq!(from, vec!["user_id"]);
        assert_eq!(table, "users");
        assert_eq!(to, vec!["id"]);

        let (from, table, to) =
            parse_fk_constraint("FOREIGN KEY (a, b) REFERENCES \"other\"(x, y)").unwrap();
        assert_eq!(from, vec!["a", "b"]);
        assert_eq!(table, "other");
        assert_eq!(to, vec!["x", "y"]);

        assert!(parse_fk_constraint("PRIMARY KEY(id)").is_none());
    }
}
