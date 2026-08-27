//! Schema introspection for libSQL databases.
//!
//! libSQL is SQLite-compatible, so the primary path runs the four collapsed
//! introspection queries (pragma table-valued functions embedded in plain
//! SELECTs — a constant number of round trips, which matters against remote
//! Turso where the old per-table PRAGMA loop cost ~4 network RTTs per table).
//! sqld's statement parser has historically been picky about PRAGMAs, so if
//! the collapsed queries are rejected the legacy per-table path runs instead.
//! Row counts are filled in by the background row-count refresher.

use std::collections::HashMap;
use std::sync::Arc;

use crate::database::sqlite_introspection::{
    assemble, CollapsedQueries, RawColumn, RawForeignKey, RawIndexColumn, RawTable,
};
use crate::database::types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, IndexInfo, TableInfo};
use crate::Error;

pub async fn get_database_schema(conn: Arc<libsql::Connection>) -> Result<DatabaseSchema, Error> {
    match collapsed_introspect(&conn).await {
        Ok(schema) => Ok(schema),
        Err(err) => {
            log::warn!(
                "Collapsed libSQL introspection failed, falling back to per-table PRAGMAs: {}",
                err
            );
            legacy_introspect(&conn).await
        }
    }
}

async fn query_rows(conn: &libsql::Connection, sql: &str) -> Result<Vec<libsql::Row>, Error> {
    let mut rows = conn
        .query(sql, ())
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("libSQL introspection query failed: {}", e)))?;
    let mut collected = Vec::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("libSQL introspection row failed: {}", e)))?
    {
        collected.push(row);
    }
    Ok(collected)
}

/// Public so the live sqld test can call the collapsed path directly and fail
/// loudly if the server rejects it (the production entry silently falls back).
pub async fn collapsed_introspect(conn: &libsql::Connection) -> Result<DatabaseSchema, Error> {
    let raw_tables: Vec<RawTable> = query_rows(conn, CollapsedQueries::TABLES)
        .await?
        .into_iter()
        .filter_map(|row| {
            Some(RawTable {
                name: row.get::<String>(0).ok()?,
                create_sql: row
                    .get::<Option<String>>(1)
                    .ok()
                    .flatten()
                    .unwrap_or_default(),
            })
        })
        .collect();

    let raw_columns: Vec<RawColumn> = query_rows(conn, CollapsedQueries::COLUMNS)
        .await?
        .into_iter()
        .filter_map(|row| {
            Some(RawColumn {
                table: row.get::<String>(0).ok()?,
                name: row.get::<String>(1).ok()?,
                data_type: row.get::<String>(2).unwrap_or_else(|_| "TEXT".to_string()),
                not_null: row.get::<i64>(3).unwrap_or(0) != 0,
                default_value: row.get::<Option<String>>(4).ok().flatten(),
                is_primary_key: row.get::<i64>(5).unwrap_or(0) > 0,
            })
        })
        .collect();

    let raw_foreign_keys: Vec<RawForeignKey> = query_rows(conn, CollapsedQueries::FOREIGN_KEYS)
        .await?
        .into_iter()
        .filter_map(|row| {
            Some(RawForeignKey {
                table: row.get::<String>(0).ok()?,
                referenced_table: row.get::<String>(1).ok()?,
                from_column: row.get::<String>(2).ok()?,
                referenced_column: row.get::<String>(3).ok()?,
            })
        })
        .collect();

    let raw_index_columns: Vec<RawIndexColumn> = query_rows(conn, CollapsedQueries::INDEXES)
        .await?
        .into_iter()
        .filter_map(|row| {
            Some(RawIndexColumn {
                table: row.get::<String>(0).ok()?,
                index: row.get::<String>(1).ok()?,
                is_unique: row.get::<i64>(2).unwrap_or(0) != 0,
                column: row.get::<Option<String>>(3).ok().flatten(),
            })
        })
        .collect();

    Ok(assemble(
        raw_tables,
        raw_columns,
        raw_foreign_keys,
        raw_index_columns,
    ))
}

/// The pre-collapse per-table introspection, kept as the fallback for sqld
/// deployments that reject the pragma table-valued functions.
async fn legacy_introspect(conn: &Arc<libsql::Connection>) -> Result<DatabaseSchema, Error> {
    let mut tables = Vec::new();
    let mut unique_columns = std::collections::HashSet::new();

    let table_names = get_table_names(conn).await?;

    for table_name in table_names {
        let (columns, pk_columns) = get_table_columns(conn, &table_name).await?;
        let indexes = get_table_indexes(conn, &table_name)
            .await
            .unwrap_or_default();

        for col in &columns {
            unique_columns.insert(col.name.clone());
        }

        tables.push(TableInfo {
            name: table_name,
            schema: String::new(),
            columns,
            primary_key_columns: pk_columns,
            indexes,
            row_count_estimate: None,
        });
    }

    Ok(DatabaseSchema {
        tables,
        schemas: vec![],
        unique_columns: unique_columns.into_iter().collect(),
    })
}

async fn get_table_names(conn: &Arc<libsql::Connection>) -> Result<Vec<String>, Error> {
    let rows = query_rows(
        conn,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|row| row.get::<String>(0).ok())
        .collect())
}

async fn get_table_columns(
    conn: &Arc<libsql::Connection>,
    table_name: &str,
) -> Result<(Vec<ColumnInfo>, Vec<String>), Error> {
    let mut columns = Vec::new();
    let mut pk_columns = Vec::new();

    let query = format!("PRAGMA table_info(\"{}\")", table_name.replace('"', "\"\""));
    for row in query_rows(conn, &query).await? {
        let Ok(name) = row.get::<String>(1) else {
            continue;
        };
        let data_type: String = row.get(2).unwrap_or("TEXT".to_string());
        let not_null: i64 = row.get(3).unwrap_or(0);
        let default_value: Option<String> = row.get(4).ok();
        let pk: i64 = row.get(5).unwrap_or(0);

        let is_primary_key = pk > 0;
        if is_primary_key {
            pk_columns.push(name.clone());
        }

        let is_auto_increment =
            is_primary_key && data_type.to_uppercase() == "INTEGER" && pk_columns.len() == 1;

        columns.push(ColumnInfo {
            name,
            data_type,
            is_nullable: not_null == 0,
            default_value,
            is_primary_key,
            is_auto_increment,
            foreign_key: None,
            allowed_values: None,
        });
    }

    let fk_map = get_foreign_keys(conn, table_name).await?;
    for column in &mut columns {
        if let Some(fk) = fk_map.get(&column.name) {
            column.foreign_key = Some(fk.clone());
        }
    }

    Ok((columns, pk_columns))
}

async fn get_foreign_keys(
    conn: &Arc<libsql::Connection>,
    table_name: &str,
) -> Result<HashMap<String, ForeignKeyInfo>, Error> {
    let mut fk_map = HashMap::new();

    let query = format!(
        "PRAGMA foreign_key_list(\"{}\")",
        table_name.replace('"', "\"\"")
    );
    for row in query_rows(conn, &query).await? {
        let (Ok(referenced_table), Ok(from_column), Ok(referenced_column)) = (
            row.get::<String>(2),
            row.get::<String>(3),
            row.get::<String>(4),
        ) else {
            continue;
        };
        fk_map.insert(
            from_column,
            ForeignKeyInfo {
                referenced_table,
                referenced_column,
                referenced_schema: String::new(),
            },
        );
    }

    Ok(fk_map)
}

async fn get_table_indexes(
    conn: &Arc<libsql::Connection>,
    table_name: &str,
) -> Result<Vec<IndexInfo>, Error> {
    let mut indexes = Vec::new();

    let query = format!("PRAGMA index_list(\"{}\")", table_name.replace('"', "\"\""));
    for row in query_rows(conn, &query).await? {
        let name: String = row.get(1).unwrap_or_default();
        let is_unique: i64 = row.get(2).unwrap_or(0);

        let info_query = format!("PRAGMA index_info(\"{}\")", name.replace('"', "\"\""));
        let column_names: Vec<String> = query_rows(conn, &info_query)
            .await
            .unwrap_or_default()
            .into_iter()
            .filter_map(|info_row| info_row.get::<String>(2).ok())
            .filter(|col| !col.is_empty())
            .collect();

        indexes.push(IndexInfo {
            name,
            column_names,
            is_unique: is_unique != 0,
            is_primary: false,
        });
    }

    Ok(indexes)
}
