use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
};

use anyhow::Context;
use rusqlite::Connection;

use crate::{
    database::types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, TableInfo},
    Error,
};

pub async fn get_database_schema(conn: Arc<Mutex<Connection>>) -> Result<DatabaseSchema, Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = conn.lock().unwrap();

        // Get all table names
        let mut tables_stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )?;
        let table_names: Vec<String> = tables_stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;

        let mut tables = Vec::new();
        let mut unique_columns_set = HashSet::new();

        for table_name in table_names {
            // Get column info including primary key status
            // PRAGMA table_info returns: cid, name, type, notnull, dflt_value, pk
            let pragma_query = format!("PRAGMA table_info('{}')", table_name);
            let mut col_stmt = conn
                .prepare(&pragma_query)
                .context("Failed to prepare PRAGMA table_info query")?;

            let col_rows = col_stmt.query_map([], |row| {
                let column_name: String = row.get(1)?;
                let data_type: String = row.get(2)?;
                let not_null: bool = row.get::<_, i32>(3)? != 0;
                let default_value: Option<String> = row.get(4)?;
                let pk: i32 = row.get(5)?; // pk > 0 means it's part of the primary key

                Ok((column_name, data_type, !not_null, default_value, pk > 0))
            })?;

            // Get foreign keys for this table
            let fk_query = format!("PRAGMA foreign_key_list('{}')", table_name);
            let mut fk_stmt = conn
                .prepare(&fk_query)
                .context("Failed to prepare PRAGMA foreign_key_list query")?;

            // foreign_key_list returns: id, seq, table, from, to, on_update, on_delete, match
            let fk_map: HashMap<String, ForeignKeyInfo> = fk_stmt
                .query_map([], |row| {
                    let from_column: String = row.get(3)?;
                    let ref_table: String = row.get(2)?;
                    let ref_column: String = row.get(4)?;
                    Ok((from_column, ref_table, ref_column))
                })?
                .filter_map(|r| r.ok())
                .map(|(from, ref_table, ref_column)| {
                    (
                        from,
                        ForeignKeyInfo {
                            referenced_table: ref_table,
                            referenced_column: ref_column,
                            referenced_schema: String::new(), // SQLite doesn't have schemas
                        },
                    )
                })
                .collect();

            // Get row count estimate
            let count_query = format!("SELECT COUNT(*) FROM \"{}\"", table_name);
            let row_count: Option<u64> = conn
                .query_row(&count_query, [], |row| row.get::<_, i64>(0))
                .ok()
                .map(|c| c as u64);

            // Check if this table has AUTOINCREMENT by examining sqlite_master
            // AUTOINCREMENT only works with INTEGER PRIMARY KEY
            let autoincrement_query = format!(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='{}'",
                table_name
            );
            let table_sql: String = conn
                .query_row(&autoincrement_query, [], |row| row.get(0))
                .unwrap_or_default();
            let has_autoincrement = table_sql.to_uppercase().contains("AUTOINCREMENT");

            let mut columns = Vec::new();
            let mut primary_key_columns = Vec::new();

            for col_result in col_rows {
                let (column_name, data_type, is_nullable, default_value, is_primary_key) =
                    col_result?;

                unique_columns_set.insert(column_name.clone());

                if is_primary_key {
                    primary_key_columns.push(column_name.clone());
                }

                // Detect auto-increment: INTEGER PRIMARY KEY with AUTOINCREMENT or ROWID alias
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
                });
            }

            tables.push(TableInfo {
                name: table_name,
                schema: String::new(), // SQLite doesn't have schemas
                columns,
                primary_key_columns,
                row_count_estimate: row_count,
            });
        }

        let unique_columns = unique_columns_set.into_iter().collect();

        Ok(DatabaseSchema {
            tables,
            schemas: vec![],
            unique_columns,
        }) as Result<_, Error>
    })
    .await?
}
