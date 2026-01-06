use serde::Serialize;

use crate::database::types::DatabaseSchema;
use crate::Error;

/// Result of a soft delete operation
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct SoftDeleteResult {
    pub success: bool,
    pub affected_rows: usize,
    pub message: Option<String>,
    /// Unix timestamp when deletion happened (for undo window)
    pub deleted_at: i64,
    /// How many seconds the undo window lasts
    pub undo_window_seconds: u32,
}

/// Result of a truncate operation
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct TruncateResult {
    pub success: bool,
    pub affected_rows: usize,
    pub tables_truncated: Vec<String>,
    pub message: Option<String>,
}

/// Result of a database dump operation
#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct DumpResult {
    pub success: bool,
    pub file_path: String,
    pub size_bytes: u64,
    pub tables_dumped: u32,
    pub rows_dumped: u64,
    pub message: Option<String>,
}

// =============================================================================
// Soft Delete Implementation
// =============================================================================

/// Check if a table has a soft delete column (deleted_at, is_deleted, etc.)
pub fn find_soft_delete_column(columns: &[String]) -> Option<String> {
    let soft_delete_columns = ["deleted_at", "deleted", "is_deleted", "removed_at", "archived_at"];
    
    for col in columns {
        let col_lower = col.to_lowercase();
        for pattern in &soft_delete_columns {
            if col_lower == *pattern {
                return Some(col.clone());
            }
        }
    }
    None
}

/// Perform soft delete on PostgreSQL
pub async fn soft_delete_postgres(
    client: &tokio_postgres::Client,
    table_name: &str,
    schema_name: Option<&str>,
    primary_key_column: &str,
    primary_key_values: &[serde_json::Value],
    soft_delete_column: &str,
) -> Result<SoftDeleteResult, Error> {
    if primary_key_values.is_empty() {
        return Ok(SoftDeleteResult {
            success: true,
            affected_rows: 0,
            message: Some("No rows to soft delete".to_string()),
            deleted_at: chrono::Utc::now().timestamp(),
            undo_window_seconds: 30,
        });
    }

    let schema_prefix = schema_name
        .map(|s| format!("\"{}\".", s))
        .unwrap_or_default();
    
    // Build parameterized query
    let placeholders: Vec<String> = (1..=primary_key_values.len())
        .map(|i| format!("${}", i))
        .collect();
    
    let query = format!(
        "UPDATE {}\"{table_name}\" SET \"{soft_delete_column}\" = NOW() WHERE \"{primary_key_column}\" IN ({}) AND \"{soft_delete_column}\" IS NULL",
        schema_prefix,
        placeholders.join(", ")
    );

    // Convert values to params
    let params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> = primary_key_values
        .iter()
        .map(|v| crate::database::commands::json_to_pg_param(v))
        .collect();
    let params_ref: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params
        .iter()
        .map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync))
        .collect();

    let affected = client.execute(&query, &params_ref[..]).await
        .map_err(|e| Error::Any(anyhow::anyhow!("Soft delete failed: {}", e)))?;

    let deleted_at = chrono::Utc::now().timestamp();
    
    Ok(SoftDeleteResult {
        success: affected > 0,
        affected_rows: affected as usize,
        message: Some(format!("Soft deleted {} row(s)", affected)),
        deleted_at,
        undo_window_seconds: 30,
    })
}

/// Perform soft delete on SQLite
pub fn soft_delete_sqlite(
    conn: &rusqlite::Connection,
    table_name: &str,
    primary_key_column: &str,
    primary_key_values: &[serde_json::Value],
    soft_delete_column: &str,
) -> Result<SoftDeleteResult, Error> {
    if primary_key_values.is_empty() {
        return Ok(SoftDeleteResult {
            success: true,
            affected_rows: 0,
            message: Some("No rows to soft delete".to_string()),
            deleted_at: chrono::Utc::now().timestamp(),
            undo_window_seconds: 30,
        });
    }

    let placeholders: Vec<&str> = primary_key_values.iter().map(|_| "?").collect();
    let now = chrono::Utc::now().timestamp();
    
    let query = format!(
        "UPDATE \"{table_name}\" SET \"{soft_delete_column}\" = ? WHERE \"{primary_key_column}\" IN ({}) AND \"{soft_delete_column}\" IS NULL",
        placeholders.join(", ")
    );

    let mut params: Vec<rusqlite::types::Value> = vec![rusqlite::types::Value::Integer(now)];
    params.extend(primary_key_values.iter().map(crate::database::commands::json_to_sqlite_value));
    let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();

    let affected = conn.execute(&query, params_ref.as_slice())
        .map_err(|e| Error::Any(anyhow::anyhow!("Soft delete failed: {}", e)))?;

    Ok(SoftDeleteResult {
        success: affected > 0,
        affected_rows: affected,
        message: Some(format!("Soft deleted {} row(s)", affected)),
        deleted_at: now,
        undo_window_seconds: 30,
    })
}

/// Undo soft delete (restore rows within undo window)
pub async fn undo_soft_delete_postgres(
    client: &tokio_postgres::Client,
    table_name: &str,
    schema_name: Option<&str>,
    primary_key_column: &str,
    primary_key_values: &[serde_json::Value],
    soft_delete_column: &str,
) -> Result<usize, Error> {
    if primary_key_values.is_empty() {
        return Ok(0);
    }

    let schema_prefix = schema_name
        .map(|s| format!("\"{}\".", s))
        .unwrap_or_default();
    
    let placeholders: Vec<String> = (1..=primary_key_values.len())
        .map(|i| format!("${}", i))
        .collect();
    
    let query = format!(
        "UPDATE {}\"{table_name}\" SET \"{soft_delete_column}\" = NULL WHERE \"{primary_key_column}\" IN ({})",
        schema_prefix,
        placeholders.join(", ")
    );

    let params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> = primary_key_values
        .iter()
        .map(|v| crate::database::commands::json_to_pg_param(v))
        .collect();
    let params_ref: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params
        .iter()
        .map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync))
        .collect();

    let affected = client.execute(&query, &params_ref[..]).await
        .map_err(|e| Error::Any(anyhow::anyhow!("Undo soft delete failed: {}", e)))?;

    Ok(affected as usize)
}

// =============================================================================
// Truncate Implementation
// =============================================================================

/// Truncate a single table (PostgreSQL)
pub async fn truncate_table_postgres(
    client: &tokio_postgres::Client,
    table_name: &str,
    schema_name: Option<&str>,
    cascade: bool,
) -> Result<TruncateResult, Error> {
    let schema_prefix = schema_name
        .map(|s| format!("\"{}\".", s))
        .unwrap_or_default();
    
    let cascade_clause = if cascade { " CASCADE" } else { "" };
    
    // Get row count before truncate
    let count_query = format!("SELECT COUNT(*) FROM {}\"{}\"", schema_prefix, table_name);
    let row_count: i64 = client.query_one(&count_query, &[]).await
        .map(|r| r.get(0))
        .unwrap_or(0);

    let query = format!("TRUNCATE TABLE {}\"{}\"{}",schema_prefix, table_name, cascade_clause);
    
    client.execute(&query, &[]).await
        .map_err(|e| Error::Any(anyhow::anyhow!("Truncate failed: {}", e)))?;

    Ok(TruncateResult {
        success: true,
        affected_rows: row_count as usize,
        tables_truncated: vec![table_name.to_string()],
        message: Some(format!("Truncated table '{}', removed {} rows", table_name, row_count)),
    })
}

/// Truncate a single table (SQLite) - uses DELETE since SQLite has no TRUNCATE
pub fn truncate_table_sqlite(
    conn: &rusqlite::Connection,
    table_name: &str,
) -> Result<TruncateResult, Error> {
    // Get row count before delete
    let row_count: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM \"{}\"", table_name),
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    conn.execute(&format!("DELETE FROM \"{}\"", table_name), [])
        .map_err(|e| Error::Any(anyhow::anyhow!("Truncate failed: {}", e)))?;
    
    // Reset autoincrement counter
    let _ = conn.execute(
        "DELETE FROM sqlite_sequence WHERE name = ?",
        [table_name],
    );

    Ok(TruncateResult {
        success: true,
        affected_rows: row_count as usize,
        tables_truncated: vec![table_name.to_string()],
        message: Some(format!("Truncated table '{}', removed {} rows", table_name, row_count)),
    })
}

/// Truncate all tables in the database (DANGEROUS!)
pub async fn truncate_database_postgres(
    client: &tokio_postgres::Client,
    schema_name: Option<&str>,
    confirm: bool,
) -> Result<TruncateResult, Error> {
    if !confirm {
        return Err(Error::Any(anyhow::anyhow!(
            "Truncate database requires explicit confirmation"
        )));
    }

    let schema = schema_name.unwrap_or("public");
    
    // Get all table names
    let tables_query = format!(
        "SELECT tablename FROM pg_tables WHERE schemaname = '{}'",
        schema
    );
    let rows = client.query(&tables_query, &[]).await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to list tables: {}", e)))?;
    
    let tables: Vec<String> = rows.iter().map(|r| r.get(0)).collect();
    
    if tables.is_empty() {
        return Ok(TruncateResult {
            success: true,
            affected_rows: 0,
            tables_truncated: vec![],
            message: Some("No tables to truncate".to_string()),
        });
    }

    // Truncate all tables at once with CASCADE
    let table_list = tables.iter()
        .map(|t| format!("\"{}\".\"{}\"", schema, t))
        .collect::<Vec<_>>()
        .join(", ");
    
    let query = format!("TRUNCATE TABLE {} CASCADE", table_list);
    
    client.execute(&query, &[]).await
        .map_err(|e| Error::Any(anyhow::anyhow!("Truncate database failed: {}", e)))?;

    Ok(TruncateResult {
        success: true,
        affected_rows: 0, // Unknown after bulk truncate
        tables_truncated: tables,
        message: Some("All tables truncated successfully".to_string()),
    })
}

// =============================================================================
// Database Dump Implementation
// =============================================================================

/// Dump database to SQL file
pub async fn dump_database_postgres(
    client: &tokio_postgres::Client,
    schema: &DatabaseSchema,
    output_path: &str,
) -> Result<DumpResult, Error> {
    use std::io::Write;
    
    let mut file = std::fs::File::create(output_path)
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to create dump file: {}", e)))?;
    
    writeln!(file, "-- Database dump generated at {}", chrono::Utc::now().to_rfc3339())
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to write to dump file: {}", e)))?;
    writeln!(file, "-- Tables: {}\n", schema.tables.len())
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to write to dump file: {}", e)))?;

    let mut total_rows: u64 = 0;
    
    for table in &schema.tables {
        writeln!(file, "\n-- Table: {}.{}", table.schema, table.name)
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to write to dump file: {}", e)))?;
        
        // Export table data as INSERT statements
        let query = format!(
            "SELECT * FROM \"{}\".\"{}\"",
            table.schema, table.name
        );
        
        let rows = client.query(&query, &[]).await.unwrap_or_default();
        let columns: Vec<String> = table.columns.iter().map(|c| c.name.clone()).collect();
        
        for row in &rows {
            let mut values = Vec::new();
            for (i, _col) in columns.iter().enumerate() {
                let value = format_pg_value_for_sql(row, i);
                values.push(value);
            }
            
            writeln!(
                file,
                "INSERT INTO \"{}\".\"{}\" ({}) VALUES ({});",
                table.schema,
                table.name,
                columns.iter().map(|c| format!("\"{}\"", c)).collect::<Vec<_>>().join(", "),
                values.join(", ")
            ).map_err(|e| Error::Any(anyhow::anyhow!("Failed to write to dump file: {}", e)))?;
            
            total_rows += 1;
        }
    }

    let file_size = std::fs::metadata(output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(DumpResult {
        success: true,
        file_path: output_path.to_string(),
        size_bytes: file_size,
        tables_dumped: schema.tables.len() as u32,
        rows_dumped: total_rows,
        message: Some(format!(
            "Dumped {} tables, {} rows to {}",
            schema.tables.len(),
            total_rows,
            output_path
        )),
    })
}

/// Dump SQLite database (simple file copy + VACUUM INTO)
pub fn dump_database_sqlite(
    conn: &rusqlite::Connection,
    output_path: &str,
) -> Result<DumpResult, Error> {
    // Use VACUUM INTO for a clean copy
    conn.execute(&format!("VACUUM INTO '{}'", output_path), [])
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to dump database: {}", e)))?;

    let file_size = std::fs::metadata(output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // Get counts
    let table_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    Ok(DumpResult {
        success: true,
        file_path: output_path.to_string(),
        size_bytes: file_size,
        tables_dumped: table_count as u32,
        rows_dumped: 0, // Not tracked for file copy
        message: Some(format!("Database dumped to {}", output_path)),
    })
}

// Helper to format PostgreSQL values for SQL output
fn format_pg_value_for_sql(row: &tokio_postgres::Row, idx: usize) -> String {
    // Try different types
    if let Ok(v) = row.try_get::<_, Option<i64>>(idx) {
        return v.map(|n| n.to_string()).unwrap_or_else(|| "NULL".to_string());
    }
    if let Ok(v) = row.try_get::<_, Option<f64>>(idx) {
        return v.map(|n| n.to_string()).unwrap_or_else(|| "NULL".to_string());
    }
    if let Ok(v) = row.try_get::<_, Option<bool>>(idx) {
        return v.map(|b| if b { "TRUE" } else { "FALSE" }.to_string())
            .unwrap_or_else(|| "NULL".to_string());
    }
    if let Ok(v) = row.try_get::<_, Option<String>>(idx) {
        return v.map(|s| format!("'{}'", s.replace('\'', "''")))
            .unwrap_or_else(|| "NULL".to_string());
    }
    "NULL".to_string()
}
