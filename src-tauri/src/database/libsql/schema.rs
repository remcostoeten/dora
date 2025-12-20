//! Schema introspection for libSQL databases
//!
//! LibSQL is SQLite-compatible, so we use similar PRAGMA queries.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::database::types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, TableInfo};
use crate::Error;

/// Get the database schema from a libSQL connection
pub async fn get_database_schema(conn: Arc<libsql::Connection>) -> Result<DatabaseSchema, Error> {
    let mut tables = Vec::new();
    let mut unique_columns: HashMap<String, HashSet<String>> = HashMap::new();

    // Get all tables
    let table_names = get_table_names(&conn).await?;

    for table_name in table_names {
        let (columns, pk_columns) = get_table_columns(&conn, &table_name).await?;
        let row_count = get_row_count(&conn, &table_name).await.unwrap_or(None);

        // Track unique columns (primary keys are unique)
        let mut unique_cols = HashSet::new();
        for col in &columns {
            if col.is_primary_key {
                unique_cols.insert(col.name.clone());
            }
        }
        if !unique_cols.is_empty() {
            unique_columns.insert(table_name.clone(), unique_cols);
        }

        tables.push(TableInfo {
            name: table_name,
            schema: String::new(), // SQLite/libSQL doesn't have schemas
            columns,
            primary_key_columns: pk_columns,
            row_count_estimate: row_count,
        });
    }

    Ok(DatabaseSchema {
        tables,
        schemas: vec![String::new()],
        unique_columns,
    })
}

/// Get list of table names from the database
async fn get_table_names(conn: &Arc<libsql::Connection>) -> Result<Vec<String>, Error> {
    let mut tables = Vec::new();

    let mut rows = conn
        .query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            (),
        )
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to query tables: {}", e)))?;

    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to fetch table row: {}", e)))?
    {
        let name: String = row
            .get(0)
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get table name: {}", e)))?;
        tables.push(name);
    }

    Ok(tables)
}

/// Get column information for a table
async fn get_table_columns(
    conn: &Arc<libsql::Connection>,
    table_name: &str,
) -> Result<(Vec<ColumnInfo>, Vec<String>), Error> {
    let mut columns = Vec::new();
    let mut pk_columns = Vec::new();

    // Get table info using PRAGMA
    let query = format!("PRAGMA table_info(\"{}\")", table_name);
    let mut rows = conn
        .query(&query, ())
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get table info: {}", e)))?;

    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to fetch column row: {}", e)))?
    {
        let name: String = row
            .get(1)
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get column name: {}", e)))?;
        let data_type: String = row.get(2).unwrap_or("TEXT".to_string());
        let not_null: i64 = row.get(3).unwrap_or(0);
        let default_value: Option<String> = row.get(4).ok();
        let pk: i64 = row.get(5).unwrap_or(0);

        let is_primary_key = pk > 0;
        if is_primary_key {
            pk_columns.push(name.clone());
        }

        // Check for auto-increment (INTEGER PRIMARY KEY is auto-increment in SQLite)
        let is_auto_increment =
            is_primary_key && data_type.to_uppercase() == "INTEGER" && pk_columns.len() == 1;

        columns.push(ColumnInfo {
            name,
            data_type,
            is_nullable: not_null == 0,
            default_value,
            is_primary_key,
            is_auto_increment,
            foreign_key: None, // We'll fill this separately
        });
    }

    // Get foreign key information
    let fk_map = get_foreign_keys(conn, table_name).await?;
    for column in &mut columns {
        if let Some(fk) = fk_map.get(&column.name) {
            column.foreign_key = Some(fk.clone());
        }
    }

    Ok((columns, pk_columns))
}

/// Get foreign key relationships for a table
async fn get_foreign_keys(
    conn: &Arc<libsql::Connection>,
    table_name: &str,
) -> Result<HashMap<String, ForeignKeyInfo>, Error> {
    let mut fk_map = HashMap::new();

    let query = format!("PRAGMA foreign_key_list(\"{}\")", table_name);
    let mut rows = conn
        .query(&query, ())
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get foreign keys: {}", e)))?;

    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to fetch FK row: {}", e)))?
    {
        // PRAGMA foreign_key_list returns: id, seq, table, from, to, on_update, on_delete, match
        let referenced_table: String = row
            .get(2)
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get referenced table: {}", e)))?;
        let from_column: String = row
            .get(3)
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get from column: {}", e)))?;
        let referenced_column: String = row
            .get(4)
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get to column: {}", e)))?;

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

/// Get estimated row count for a table
async fn get_row_count(
    conn: &Arc<libsql::Connection>,
    table_name: &str,
) -> Result<Option<i64>, Error> {
    let query = format!("SELECT COUNT(*) FROM \"{}\"", table_name);
    let mut rows = conn
        .query(&query, ())
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get row count: {}", e)))?;

    if let Some(row) = rows
        .next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to fetch count row: {}", e)))?
    {
        let count: i64 = row.get(0).unwrap_or(0);
        Ok(Some(count))
    } else {
        Ok(None)
    }
}
