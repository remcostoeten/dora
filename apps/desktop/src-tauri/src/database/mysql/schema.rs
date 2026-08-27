use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use mysql_async::prelude::Queryable;
use mysql_async::{Pool, Row, Value as MysqlValue};

use crate::{
    database::{
        dialect::MySqlDialect,
        types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, IndexInfo, TableInfo},
    },
    Error,
};

/// Introspect the schema for a MySQL-wire connection.
///
/// The catalog query strings come from `dialect.introspection()`: vanilla MySQL
/// uses the canonical queries, MariaDB clones them and overrides only divergent
/// ones. This mirrors the Postgres/Cockroach seam in `postgres/schema.rs`.
pub async fn get_database_schema(
    pool: Arc<Pool>,
    dialect: MySqlDialect,
) -> Result<DatabaseSchema, Error> {
    let queries = dialect.introspection();

    // The four catalog queries scope themselves to the connection's default
    // schema via `DATABASE()` (see dialect.rs), so no `SELECT DATABASE()`
    // round trip precedes them. mysql_async cannot multiplex one connection,
    // so two pooled connections run two serial chains concurrently:
    // columns → row counts on one, foreign keys → indexes on the other. The
    // second handshake overlaps the first chain's queries.
    let (columns_chain, fk_chain) =
        tokio::join!(
            async {
                let mut conn = pool
                    .get_conn()
                    .await
                    .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;
                let column_rows: Vec<Row> = conn
                    .query(queries.columns)
                    .await
                    .map_err(|e| Error::Any(anyhow::anyhow!("Failed to query columns: {}", e)))?;
                let count_rows: Vec<Row> = conn.query(queries.row_counts).await.map_err(|e| {
                    Error::Any(anyhow::anyhow!("Failed to query row counts: {}", e))
                })?;
                Ok::<_, Error>((column_rows, count_rows))
            },
            async {
                let mut conn = pool
                    .get_conn()
                    .await
                    .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;
                let fk_rows: Vec<Row> = conn.query(queries.foreign_keys).await.map_err(|e| {
                    Error::Any(anyhow::anyhow!("Failed to query foreign keys: {}", e))
                })?;
                let index_rows: Vec<Row> = conn
                    .query(queries.indexes)
                    .await
                    .map_err(|e| Error::Any(anyhow::anyhow!("Failed to query indexes: {}", e)))?;
                Ok::<_, Error>((fk_rows, index_rows))
            },
        );
    let (column_rows, count_rows) = columns_chain?;
    let (fk_rows, index_rows) = fk_chain?;

    // An empty catalog usually means no default schema was selected in the
    // connection string; surface that instead of a silently empty sidebar.
    if column_rows.is_empty() {
        let mut conn = pool
            .get_conn()
            .await
            .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;
        let current_db: Option<String> = conn
            .query_first("SELECT DATABASE()")
            .await
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get current database: {}", e)))?;
        if current_db.unwrap_or_default().is_empty() {
            return Err(Error::Any(anyhow::anyhow!("No database selected")));
        }
    }

    let mut fk_map: HashMap<(String, String, String), ForeignKeyInfo> = HashMap::new();
    for row in &fk_rows {
        let schema: String = mysql_get_string(row, 0);
        let table: String = mysql_get_string(row, 1);
        let column: String = mysql_get_string(row, 2);
        let ref_schema: String = mysql_get_string(row, 3);
        let ref_table: String = mysql_get_string(row, 4);
        let ref_column: String = mysql_get_string(row, 5);

        fk_map.insert(
            (schema, table, column),
            ForeignKeyInfo {
                referenced_schema: ref_schema,
                referenced_table: ref_table,
                referenced_column: ref_column,
            },
        );
    }

    // Group columns per index
    let mut index_builder: HashMap<(String, String, String), (bool, Vec<String>)> = HashMap::new();
    for row in &index_rows {
        let schema: String = mysql_get_string(row, 0);
        let table: String = mysql_get_string(row, 1);
        let index_name: String = mysql_get_string(row, 2);
        let non_unique: i64 = mysql_get_i64(row, 3);
        let col_name: String = mysql_get_string(row, 4);

        let entry = index_builder
            .entry((schema, table, index_name))
            .or_insert_with(|| (non_unique == 0, Vec::new()));
        entry.1.push(col_name);
    }

    let mut index_map: HashMap<(String, String), Vec<IndexInfo>> = HashMap::new();
    for ((schema, table, index_name), (is_unique, column_names)) in index_builder {
        let is_primary = index_name == "PRIMARY";
        index_map
            .entry((schema, table))
            .or_default()
            .push(IndexInfo {
                name: index_name,
                column_names,
                is_unique,
                is_primary,
            });
    }

    // -- row count estimates ------------------------------------------------
    let mut count_map: HashMap<(String, String), u64> = HashMap::new();
    for row in &count_rows {
        let schema: String = mysql_get_string(row, 0);
        let table: String = mysql_get_string(row, 1);
        let count: i64 = mysql_get_i64(row, 2);
        count_map.insert((schema, table), count.max(0) as u64);
    }

    // -- assemble tables ----------------------------------------------------
    let mut tables_map: HashMap<(String, String), TableInfo> = HashMap::new();
    let mut schemas_set = HashSet::new();
    let mut unique_columns_set = HashSet::new();

    for row in &column_rows {
        let schema: String = mysql_get_string(row, 0);
        let table_name: String = mysql_get_string(row, 1);
        let column_name: String = mysql_get_string(row, 2);
        let data_type: String = mysql_get_string(row, 3);
        let is_nullable: bool = mysql_get_i64(row, 4) != 0;
        let default_value: Option<String> = mysql_get_opt_string(row, 5);
        let is_primary_key: bool = mysql_get_i64(row, 6) != 0;
        let is_auto_increment: bool = mysql_get_i64(row, 7) != 0;

        schemas_set.insert(schema.clone());
        unique_columns_set.insert(column_name.clone());

        let table_key = (schema.clone(), table_name.clone());

        let table_info = tables_map.entry(table_key.clone()).or_insert_with(|| {
            let row_count = count_map.get(&table_key).copied();
            let indexes = index_map.remove(&table_key).unwrap_or_default();

            TableInfo {
                name: table_name.clone(),
                schema: schema.clone(),
                columns: Vec::new(),
                primary_key_columns: Vec::new(),
                row_count_estimate: row_count,
                indexes,
            }
        });

        if is_primary_key {
            let col = column_name.clone();
            if !table_info.primary_key_columns.contains(&col) {
                table_info.primary_key_columns.push(col);
            }
        }

        let foreign_key = fk_map
            .get(&(schema, table_name, column_name.clone()))
            .cloned();

        let allowed_values = parse_mysql_enum_values(&data_type);

        table_info.columns.push(ColumnInfo {
            name: column_name,
            data_type,
            is_nullable,
            default_value,
            is_primary_key,
            is_auto_increment,
            foreign_key,
            allowed_values,
        });
    }

    let tables = tables_map.into_values().collect();
    let schemas = schemas_set.into_iter().collect();
    let unique_columns = unique_columns_set.into_iter().collect();

    Ok(DatabaseSchema {
        tables,
        schemas,
        unique_columns,
    })
}

// -- helpers to extract values from mysql_async::Row without panicking ------

fn mysql_get_string(row: &Row, idx: usize) -> String {
    match row.as_ref(idx) {
        Some(MysqlValue::Bytes(b)) => String::from_utf8_lossy(b).into_owned(),
        Some(MysqlValue::NULL) | None => String::new(),
        Some(other) => format!("{:?}", other),
    }
}

fn mysql_get_opt_string(row: &Row, idx: usize) -> Option<String> {
    match row.as_ref(idx) {
        Some(MysqlValue::Bytes(b)) => Some(String::from_utf8_lossy(b).into_owned()),
        Some(MysqlValue::NULL) | None => None,
        Some(other) => Some(format!("{:?}", other)),
    }
}

fn mysql_get_i64(row: &Row, idx: usize) -> i64 {
    match row.as_ref(idx) {
        Some(MysqlValue::Int(i)) => *i,
        Some(MysqlValue::UInt(u)) => *u as i64,
        Some(MysqlValue::Bytes(b)) => String::from_utf8_lossy(b).parse().unwrap_or(0),
        _ => 0,
    }
}

/// Extract the member list from a MySQL `ENUM(...)` column type.
///
/// `information_schema.COLUMNS.COLUMN_TYPE` spells an enum out in full, e.g.
/// `enum('info','success','warning','danger')`, so the allowed values are read
/// straight off the type. Returns `None` for any non-enum type. (MySQL `SET`
/// columns accept comma-joined combinations rather than a single value, so they
/// are intentionally not surfaced as a single-choice list.) Embedded quotes use
/// MySQL's doubled-quote escaping (`''`).
fn parse_mysql_enum_values(column_type: &str) -> Option<Vec<String>> {
    let lower = column_type.trim_start().to_ascii_lowercase();
    if !lower.starts_with("enum(") {
        return None;
    }

    let mut values = Vec::new();
    let chars: Vec<char> = column_type.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] != '\'' {
            i += 1;
            continue;
        }
        i += 1;
        let mut literal = String::new();
        while i < chars.len() {
            if chars[i] == '\'' {
                if i + 1 < chars.len() && chars[i + 1] == '\'' {
                    literal.push('\'');
                    i += 2;
                    continue;
                }
                i += 1;
                break;
            }
            literal.push(chars[i]);
            i += 1;
        }
        values.push(literal);
    }

    if values.is_empty() {
        None
    } else {
        Some(values)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_enum_column_type() {
        assert_eq!(
            parse_mysql_enum_values("enum('info','success','warning','danger')"),
            Some(vec![
                "info".to_string(),
                "success".to_string(),
                "warning".to_string(),
                "danger".to_string(),
            ])
        );
    }

    #[test]
    fn handles_doubled_quote_escaping() {
        assert_eq!(
            parse_mysql_enum_values("enum('it''s','ok')"),
            Some(vec!["it's".to_string(), "ok".to_string()])
        );
    }

    #[test]
    fn ignores_non_enum_types() {
        assert_eq!(parse_mysql_enum_values("varchar(255)"), None);
        assert_eq!(parse_mysql_enum_values("set('a','b')"), None);
        assert_eq!(parse_mysql_enum_values("int"), None);
    }
}
