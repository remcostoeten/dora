use mysql_async::prelude::Queryable;
use mysql_async::{Params, Pool, Row, Value as MysqlValue};
use serde::{Deserialize, Serialize};

use crate::database::services::schema_export;
use crate::database::types::DatabaseSchema;
use crate::Error;

/// Result of a soft delete operation
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct TruncateResult {
    pub success: bool,
    pub affected_rows: usize,
    pub tables_truncated: Vec<String>,
    pub message: Option<String>,
}

/// Result of a database dump operation
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
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
    let soft_delete_columns = [
        "deleted_at",
        "deleted",
        "is_deleted",
        "removed_at",
        "archived_at",
    ];

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

    let qualified_table = crate::database::ident::qualified_ansi(schema_name, table_name);

    // Build parameterized query
    let placeholders: Vec<String> = (1..=primary_key_values.len())
        .map(|i| format!("${}", i))
        .collect();

    let query = format!(
        "UPDATE {} SET {sd} = NOW() WHERE {pk} IN ({}) AND {sd} IS NULL",
        qualified_table,
        placeholders.join(", "),
        sd = quote_ansi(soft_delete_column),
        pk = quote_ansi(primary_key_column),
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

    let affected = client
        .execute(&query, &params_ref[..])
        .await
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
    params.extend(
        primary_key_values
            .iter()
            .map(crate::database::commands::json_to_sqlite_value),
    );
    let params_ref: Vec<&dyn rusqlite::ToSql> =
        params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();

    let affected = conn
        .execute(&query, params_ref.as_slice())
        .map_err(|e| Error::Any(anyhow::anyhow!("Soft delete failed: {}", e)))?;

    Ok(SoftDeleteResult {
        success: affected > 0,
        affected_rows: affected,
        message: Some(format!("Soft deleted {} row(s)", affected)),
        deleted_at: now,
        undo_window_seconds: 30,
    })
}

/// Perform soft delete on MySQL
pub async fn soft_delete_mysql(
    pool: &Pool,
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

    let qualified_table = mysql_qualified_table_name(table_name, schema_name);
    let placeholders = std::iter::repeat_n("?", primary_key_values.len())
        .collect::<Vec<_>>()
        .join(", ");
    let deleted_at = chrono::Utc::now().timestamp();

    let query = format!(
        "UPDATE {qualified_table} SET {} = ? WHERE {} IN ({}) AND {} IS NULL",
        mysql_quote_identifier(soft_delete_column),
        mysql_quote_identifier(primary_key_column),
        placeholders,
        mysql_quote_identifier(soft_delete_column)
    );

    let mut params = Vec::with_capacity(primary_key_values.len() + 1);
    params.push(MysqlValue::Int(deleted_at));
    params.extend(primary_key_values.iter().map(json_to_mysql_value));

    let mut conn = pool
        .get_conn()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;
    conn.exec_drop(query, Params::Positional(params))
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Soft delete failed: {}", e)))?;

    let affected = conn.affected_rows() as usize;

    Ok(SoftDeleteResult {
        success: affected > 0,
        affected_rows: affected,
        message: Some(format!("Soft deleted {} row(s)", affected)),
        deleted_at,
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

    let qualified_table = crate::database::ident::qualified_ansi(schema_name, table_name);

    let placeholders: Vec<String> = (1..=primary_key_values.len())
        .map(|i| format!("${}", i))
        .collect();

    let query = format!(
        "UPDATE {} SET {} = NULL WHERE {} IN ({})",
        qualified_table,
        quote_ansi(soft_delete_column),
        quote_ansi(primary_key_column),
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

    let affected = client
        .execute(&query, &params_ref[..])
        .await
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
    let qualified_table = crate::database::ident::qualified_ansi(schema_name, table_name);

    let cascade_clause = if cascade { " CASCADE" } else { "" };

    // Get row count before truncate
    let count_query = format!("SELECT COUNT(*) FROM {}", qualified_table);
    let row_count: i64 = client
        .query_one(&count_query, &[])
        .await
        .map(|r| r.get(0))
        .unwrap_or(0);

    let query = format!("TRUNCATE TABLE {}{}", qualified_table, cascade_clause);

    client
        .execute(&query, &[])
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Truncate failed: {}", e)))?;

    Ok(TruncateResult {
        success: true,
        affected_rows: row_count as usize,
        tables_truncated: vec![table_name.to_string()],
        message: Some(format!(
            "Truncated table '{}', removed {} rows",
            table_name, row_count
        )),
    })
}

/// Truncate a single table (SQLite) - uses DELETE since SQLite has no TRUNCATE
pub fn truncate_table_sqlite(
    conn: &rusqlite::Connection,
    table_name: &str,
) -> Result<TruncateResult, Error> {
    // Get row count before delete
    let row_count: i64 = conn
        .query_row(
            &format!("SELECT COUNT(*) FROM {}", quote_ansi(table_name)),
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(&format!("DELETE FROM {}", quote_ansi(table_name)), [])
        .map_err(|e| Error::Any(anyhow::anyhow!("Truncate failed: {}", e)))?;

    // Reset autoincrement counter
    let _ = conn.execute("DELETE FROM sqlite_sequence WHERE name = ?", [table_name]);

    Ok(TruncateResult {
        success: true,
        affected_rows: row_count as usize,
        tables_truncated: vec![table_name.to_string()],
        message: Some(format!(
            "Truncated table '{}', removed {} rows",
            table_name, row_count
        )),
    })
}

/// Truncate a single table (MySQL)
pub async fn truncate_table_mysql(
    pool: &Pool,
    table_name: &str,
    schema_name: Option<&str>,
) -> Result<TruncateResult, Error> {
    let qualified_table = mysql_qualified_table_name(table_name, schema_name);
    let count_query = format!("SELECT COUNT(*) FROM {}", qualified_table);

    let mut conn = pool
        .get_conn()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;
    let row_count = conn
        .query_first::<u64, _>(count_query)
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to count rows: {}", e)))?
        .unwrap_or(0);

    conn.query_drop(format!("TRUNCATE TABLE {}", qualified_table))
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Truncate failed: {}", e)))?;

    Ok(TruncateResult {
        success: true,
        affected_rows: row_count as usize,
        tables_truncated: vec![table_name.to_string()],
        message: Some(format!(
            "Truncated table '{}', removed {} rows",
            table_name, row_count
        )),
    })
}

/// Perform soft delete on LibSQL
pub async fn soft_delete_libsql(
    conn: &libsql::Connection,
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
        "UPDATE {} SET {sd} = ? WHERE {pk} IN ({}) AND {sd} IS NULL",
        quote_ansi(table_name),
        placeholders.join(", "),
        sd = quote_ansi(soft_delete_column),
        pk = quote_ansi(primary_key_column),
    );

    let mut params: Vec<libsql::Value> = vec![libsql::Value::Integer(now)];
    params.extend(primary_key_values.iter().map(|value| match value {
        serde_json::Value::Null => libsql::Value::Null,
        serde_json::Value::Bool(b) => libsql::Value::Integer(if *b { 1 } else { 0 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                libsql::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                libsql::Value::Real(f)
            } else {
                libsql::Value::Text(n.to_string())
            }
        }
        serde_json::Value::String(s) => libsql::Value::Text(s.clone()),
        _ => libsql::Value::Text(value.to_string()),
    }));

    let affected = conn
        .execute(&query, params)
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Soft delete failed: {}", e)))?;

    Ok(SoftDeleteResult {
        success: affected > 0,
        affected_rows: affected as usize,
        message: Some(format!("Soft deleted {} row(s)", affected)),
        deleted_at: now,
        undo_window_seconds: 30,
    })
}

/// Truncate a single table (LibSQL) - uses DELETE since LibSQL has no TRUNCATE
pub async fn truncate_table_libsql(
    conn: &libsql::Connection,
    table_name: &str,
) -> Result<TruncateResult, Error> {
    let count_query = format!("SELECT COUNT(*) FROM {}", quote_ansi(table_name));
    let mut rows = conn
        .query(&count_query, ())
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to count rows: {}", e)))?;

    let row_count: i64 = if let Some(row) = rows.next().await.ok().flatten() {
        row.get::<i64>(0).unwrap_or(0)
    } else {
        0
    };

    conn.execute(&format!("DELETE FROM {}", quote_ansi(table_name)), ())
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Truncate failed: {}", e)))?;

    Ok(TruncateResult {
        success: true,
        affected_rows: row_count as usize,
        tables_truncated: vec![table_name.to_string()],
        message: Some(format!(
            "Truncated table '{}', removed {} rows",
            table_name, row_count
        )),
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
    let rows = client
        .query(&tables_query, &[])
        .await
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
    let table_list = tables
        .iter()
        .map(|t| crate::database::ident::qualified_ansi(Some(schema), t))
        .collect::<Vec<_>>()
        .join(", ");

    let query = format!("TRUNCATE TABLE {} CASCADE", table_list);

    client
        .execute(&query, &[])
        .await
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

fn write_dump<W: std::io::Write>(
    out: &mut W,
    write: impl FnOnce(&mut W) -> std::io::Result<()>,
) -> Result<(), Error> {
    write(out).map_err(|e| Error::Any(anyhow::anyhow!("Failed to write to dump file: {}", e)))
}

fn finish_dump<W: std::io::Write>(
    mut file: std::io::BufWriter<W>,
    output_path: &str,
    tables_dumped: u32,
    rows_dumped: u64,
) -> Result<DumpResult, Error> {
    use std::io::Write;

    file.flush()
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to flush dump file: {}", e)))?;
    drop(file);

    let size_bytes = std::fs::metadata(output_path).map(|m| m.len()).unwrap_or(0);

    Ok(DumpResult {
        success: true,
        file_path: output_path.to_string(),
        size_bytes,
        tables_dumped,
        rows_dumped,
        message: Some(format!(
            "Dumped {} tables, {} rows to {}",
            tables_dumped, rows_dumped, output_path
        )),
    })
}

/// ANSI string literal: only the quote character is special, which holds for
/// PostgreSQL with `standard_conforming_strings` on and for SQLite.
fn quote_sql_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

/// MySQL treats the backslash as an escape character inside string literals.
fn quote_mysql_literal(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "''"))
}

/// Introspection reads `information_schema.columns.data_type`, which collapses
/// every array to `ARRAY`, every enum to `USER-DEFINED`, and drops length and
/// precision. A dump has to recreate the column exactly, so the types are read
/// back from `pg_catalog` as `format_type` renders them.
async fn resolve_pg_column_types(
    client: &tokio_postgres::Client,
    schema: &DatabaseSchema,
) -> Result<DatabaseSchema, Error> {
    use std::collections::HashMap;

    let rows = client
        .query(
            "SELECT n.nspname, c.relname, a.attname, format_type(a.atttypid, a.atttypmod) \
             FROM pg_catalog.pg_attribute a \
             JOIN pg_catalog.pg_class c ON c.oid = a.attrelid \
             JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace \
             WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p')",
            &[],
        )
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to read column types: {}", e)))?;

    let mut types: HashMap<(String, String, String), String> = HashMap::new();
    for row in &rows {
        types.insert((row.get(0), row.get(1), row.get(2)), row.get(3));
    }

    let mut resolved = schema.clone();
    for table in &mut resolved.tables {
        for column in &mut table.columns {
            let key = (
                table.schema.clone(),
                table.name.clone(),
                column.name.clone(),
            );
            if let Some(data_type) = types.get(&key) {
                column.data_type = data_type.clone();
            }
        }
    }

    Ok(resolved)
}

/// Enum types the dumped columns are declared with, as `(qualified name,
/// labels)` in declaration order — a column typed by one cannot be created
/// without it. Takes the schema whose column types have already been resolved
/// through `format_type`, since that is what names the enum.
async fn read_pg_enum_types(
    client: &tokio_postgres::Client,
    schema: &DatabaseSchema,
) -> Result<Vec<(String, Vec<String>)>, Error> {
    use std::collections::HashSet;

    let declared: HashSet<String> = schema
        .tables
        .iter()
        .flat_map(|table| table.columns.iter())
        .map(|column| column.data_type.trim_end_matches("[]").to_string())
        .collect();

    let mut namespaces: Vec<String> = schema
        .tables
        .iter()
        .map(|table| {
            if table.schema.is_empty() {
                "public".to_string()
            } else {
                table.schema.clone()
            }
        })
        .collect();
    namespaces.sort();
    namespaces.dedup();

    let rows = client
        .query(
            "SELECT n.nspname, t.typname, e.enumlabel \
             FROM pg_catalog.pg_type t \
             JOIN pg_catalog.pg_enum e ON e.enumtypid = t.oid \
             JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace \
             WHERE n.nspname = ANY($1) \
             ORDER BY n.nspname, t.typname, e.enumsortorder",
            &[&namespaces],
        )
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to read enum types: {}", e)))?;

    let mut enums: Vec<(String, Vec<String>)> = Vec::new();
    for row in &rows {
        let namespace: String = row.get(0);
        let type_name: String = row.get(1);
        let label: String = row.get(2);
        if !declared.contains(&type_name)
            && !declared.contains(&format!("{}.{}", namespace, type_name))
        {
            continue;
        }
        let qualified = if namespace == "public" {
            quote_ansi(&type_name)
        } else {
            crate::database::ident::qualified_ansi(Some(&namespace), &type_name)
        };

        match enums.last_mut() {
            Some((name, labels)) if *name == qualified => labels.push(label),
            _ => enums.push((qualified, vec![label])),
        }
    }

    Ok(enums)
}

/// Dump a PostgreSQL database to a self-contained, re-importable `.sql` file:
/// schemas, `CREATE TABLE`, every row as an `INSERT`, then foreign keys and
/// sequence positions.
pub async fn dump_database_postgres(
    client: &tokio_postgres::Client,
    schema: &DatabaseSchema,
    output_path: &str,
) -> Result<DumpResult, Error> {
    use std::io::Write;

    let file = std::fs::File::create(output_path)
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to create dump file: {}", e)))?;
    let mut file = std::io::BufWriter::new(file);

    let typed_schema = resolve_pg_column_types(client, schema).await?;
    let (creates, foreign_keys) =
        schema_export::generate_ddl_parts(&typed_schema, schema_export::ExportDialect::PostgreSQL);
    let enum_types = read_pg_enum_types(client, &typed_schema).await?;

    write_dump(&mut file, |out| {
        writeln!(
            out,
            "-- PostgreSQL database dump generated by Dora at {}",
            chrono::Utc::now().to_rfc3339()
        )?;
        writeln!(out, "-- Tables: {}", schema.tables.len())?;
        writeln!(out, "\nSET standard_conforming_strings = on;")?;
        writeln!(out, "BEGIN;\n")?;

        let mut namespaces: Vec<&str> = schema
            .tables
            .iter()
            .map(|table| table.schema.as_str())
            .filter(|name| !name.is_empty() && *name != "public")
            .collect();
        namespaces.sort_unstable();
        namespaces.dedup();
        for namespace in namespaces {
            writeln!(
                out,
                "CREATE SCHEMA IF NOT EXISTS {};",
                quote_ansi(namespace)
            )?;
        }

        for (name, labels) in &enum_types {
            let labels = labels
                .iter()
                .map(|label| quote_sql_literal(label))
                .collect::<Vec<_>>()
                .join(", ");
            writeln!(out, "CREATE TYPE {} AS ENUM ({});", name, labels)?;
        }

        for create in &creates {
            writeln!(out, "\n{}", create)?;
        }
        Ok(())
    })?;

    let mut total_rows: u64 = 0;

    for table in &schema.tables {
        let qualified = crate::database::ident::qualified_ansi(Some(&table.schema), &table.name);
        let column_list = table
            .columns
            .iter()
            .map(|column| quote_ansi(&column.name))
            .collect::<Vec<_>>()
            .join(", ");

        // Every value comes back as text so no Postgres type is silently
        // dropped; the literals are coerced back to the column type on insert.
        let select_list = table
            .columns
            .iter()
            .map(|column| format!("{}::text", quote_ansi(&column.name)))
            .collect::<Vec<_>>()
            .join(", ");

        write_dump(&mut file, |out| writeln!(out, "\n-- Data: {}", qualified))?;

        let rows = client
            .query(&format!("SELECT {} FROM {}", select_list, qualified), &[])
            .await
            .map_err(|e| {
                Error::Any(anyhow::anyhow!(
                    "Failed to read rows from {}: {}",
                    qualified,
                    e
                ))
            })?;

        for row in &rows {
            let values = (0..table.columns.len())
                .map(|index| match row.get::<_, Option<String>>(index) {
                    Some(value) => quote_sql_literal(&value),
                    None => "NULL".to_string(),
                })
                .collect::<Vec<_>>()
                .join(", ");

            write_dump(&mut file, |out| {
                writeln!(
                    out,
                    "INSERT INTO {} ({}) VALUES ({});",
                    qualified, column_list, values
                )
            })?;

            total_rows += 1;
        }
    }

    write_dump(&mut file, |out| {
        if !foreign_keys.is_empty() {
            writeln!(out, "\n-- Foreign key constraints")?;
            for foreign_key in &foreign_keys {
                writeln!(out, "{}", foreign_key)?;
            }
        }

        let sequence_resets: Vec<String> = schema
            .tables
            .iter()
            .flat_map(|table| {
                let qualified =
                    crate::database::ident::qualified_ansi(Some(&table.schema), &table.name);
                table
                    .columns
                    .iter()
                    .filter(|column| column.is_auto_increment)
                    .map(move |column| {
                        let quoted = quote_ansi(&column.name);
                        format!(
                            "SELECT setval(pg_get_serial_sequence({}, {}), COALESCE((SELECT MAX({}) FROM {}), 1), (SELECT MAX({}) FROM {}) IS NOT NULL) WHERE pg_get_serial_sequence({}, {}) IS NOT NULL;",
                            quote_sql_literal(&qualified),
                            quote_sql_literal(&column.name),
                            quoted,
                            qualified,
                            quoted,
                            qualified,
                            quote_sql_literal(&qualified),
                            quote_sql_literal(&column.name),
                        )
                    })
                    .collect::<Vec<_>>()
            })
            .collect();

        if !sequence_resets.is_empty() {
            writeln!(out, "\n-- Sequence positions")?;
            for reset in sequence_resets {
                writeln!(out, "{}", reset)?;
            }
        }

        writeln!(out, "\nCOMMIT;")
    })?;

    finish_dump(file, output_path, schema.tables.len() as u32, total_rows)
}

/// Dump SQLite database (simple file copy + VACUUM INTO)
pub fn dump_database_sqlite(
    conn: &rusqlite::Connection,
    output_path: &str,
) -> Result<DumpResult, Error> {
    // Use VACUUM INTO for a clean copy
    conn.execute(&format!("VACUUM INTO '{}'", output_path), [])
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to dump database: {}", e)))?;

    let file_size = std::fs::metadata(output_path).map(|m| m.len()).unwrap_or(0);

    // Get counts
    let table_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(DumpResult {
        success: true,
        file_path: output_path.to_string(),
        size_bytes: file_size,
        tables_dumped: table_count as u32,
        rows_dumped: 0, // Not tracked for file copy
        message: Some(format!("Database dumped to {}", output_path)),
    })
}

/// Dump a libSQL/Turso database to a re-importable `.sql` file. The DDL comes
/// from `sqlite_master`, so it is the database's own definitions rather than a
/// reconstruction.
pub async fn dump_database_libsql(
    conn: &libsql::Connection,
    schema: &DatabaseSchema,
    output_path: &str,
) -> Result<DumpResult, Error> {
    use std::io::Write;

    let file = std::fs::File::create(output_path)
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to create dump file: {}", e)))?;
    let mut file = std::io::BufWriter::new(file);

    let mut definitions = conn
        .query(
            "SELECT sql FROM sqlite_master \
             WHERE type IN ('table', 'index', 'view', 'trigger') \
             AND sql IS NOT NULL AND name NOT LIKE 'sqlite_%' \
             ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'view' THEN 2 ELSE 3 END",
            (),
        )
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to read schema definitions: {}", e)))?;

    write_dump(&mut file, |out| {
        writeln!(
            out,
            "-- libSQL database dump generated by Dora at {}",
            chrono::Utc::now().to_rfc3339()
        )?;
        writeln!(out, "-- Tables: {}", schema.tables.len())?;
        writeln!(out, "\nPRAGMA foreign_keys = OFF;")?;
        writeln!(out, "BEGIN TRANSACTION;")
    })?;

    while let Some(row) = definitions
        .next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to read schema definitions: {}", e)))?
    {
        let definition: String = row
            .get(0)
            .map_err(|e| Error::Any(anyhow::anyhow!("Failed to read schema definition: {}", e)))?;
        write_dump(&mut file, |out| writeln!(out, "\n{};", definition))?;
    }

    let mut total_rows: u64 = 0;

    for table in &schema.tables {
        let quoted_table = quote_ansi(&table.name);
        let column_list = table
            .columns
            .iter()
            .map(|column| quote_ansi(&column.name))
            .collect::<Vec<_>>()
            .join(", ");

        write_dump(&mut file, |out| writeln!(out, "\n-- Data: {}", table.name))?;

        let mut rows = conn
            .query(&format!("SELECT * FROM {}", quoted_table), ())
            .await
            .map_err(|e| {
                Error::Any(anyhow::anyhow!(
                    "Failed to query table {}: {}",
                    table.name,
                    e
                ))
            })?;

        while let Some(row) = rows.next().await.map_err(|e| {
            Error::Any(anyhow::anyhow!(
                "Failed to read rows from {}: {}",
                table.name,
                e
            ))
        })? {
            let values = (0..table.columns.len())
                .map(|index| format_libsql_value_for_sql(&row, index as i32))
                .collect::<Vec<_>>()
                .join(", ");

            write_dump(&mut file, |out| {
                writeln!(
                    out,
                    "INSERT INTO {} ({}) VALUES ({});",
                    quoted_table, column_list, values
                )
            })?;

            total_rows += 1;
        }
    }

    write_dump(&mut file, |out| {
        writeln!(out, "\nCOMMIT;")?;
        writeln!(out, "PRAGMA foreign_keys = ON;")
    })?;

    finish_dump(file, output_path, schema.tables.len() as u32, total_rows)
}

pub async fn dump_database_mysql(
    pool: &Pool,
    schema: &DatabaseSchema,
    output_path: &str,
) -> Result<DumpResult, Error> {
    use std::io::Write;

    let file = std::fs::File::create(output_path)
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to create dump file: {}", e)))?;
    let mut file = std::io::BufWriter::new(file);

    let mut conn = pool
        .get_conn()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;
    let mut total_rows = 0u64;

    write_dump(&mut file, |out| {
        writeln!(
            out,
            "-- MySQL database dump generated by Dora at {}",
            chrono::Utc::now().to_rfc3339()
        )?;
        writeln!(out, "-- Tables: {}", schema.tables.len())?;
        writeln!(out, "\nSET FOREIGN_KEY_CHECKS = 0;")
    })?;

    for table in &schema.tables {
        let qualified_table = mysql_qualified_table_name(
            &table.name,
            if table.schema.is_empty() {
                None
            } else {
                Some(table.schema.as_str())
            },
        );
        let create_row: Option<Row> = conn
            .query_first(format!("SHOW CREATE TABLE {}", qualified_table))
            .await
            .map_err(|e| {
                Error::Any(anyhow::anyhow!(
                    "Failed to read DDL for {}: {}",
                    table.name,
                    e
                ))
            })?;
        let create_sql = create_row
            .and_then(|row| row.get::<String, usize>(1))
            .ok_or_else(|| Error::Any(anyhow::anyhow!("No DDL returned for {}", table.name)))?;

        write_dump(&mut file, |out| {
            writeln!(out, "\n-- Table: {}", qualified_table)?;
            writeln!(out, "{};", create_sql)
        })?;

        let query = format!("SELECT * FROM {}", qualified_table);

        let mut result = conn.query_iter(query).await.map_err(|e| {
            Error::Any(anyhow::anyhow!(
                "Failed to query table {}: {}",
                table.name,
                e
            ))
        })?;

        let column_names = result
            .columns_ref()
            .iter()
            .map(|column| mysql_quote_identifier(column.name_str().as_ref()))
            .collect::<Vec<_>>()
            .join(", ");

        let rows = result.collect::<Row>().await.map_err(|e| {
            Error::Any(anyhow::anyhow!(
                "Failed to collect rows for {}: {}",
                table.name,
                e
            ))
        })?;

        // `SHOW CREATE TABLE` emits an unqualified name, so the inserts stay
        // unqualified too and the dump restores into whichever database is
        // selected at import time.
        let insert_table = mysql_quote_identifier(&table.name);

        for row in rows {
            let values = row
                .unwrap()
                .into_iter()
                .map(|value| format_mysql_value_for_sql(&value))
                .collect::<Vec<_>>()
                .join(", ");

            write_dump(&mut file, |out| {
                writeln!(
                    out,
                    "INSERT INTO {} ({}) VALUES ({});",
                    insert_table, column_names, values
                )
            })?;

            total_rows += 1;
        }
    }

    write_dump(&mut file, |out| {
        writeln!(out, "\nSET FOREIGN_KEY_CHECKS = 1;")
    })?;

    finish_dump(file, output_path, schema.tables.len() as u32, total_rows)
}

use crate::database::ident::quote_ansi;
use crate::database::ident::quote_mysql as mysql_quote_identifier;

fn mysql_qualified_table_name(table_name: &str, schema_name: Option<&str>) -> String {
    match schema_name {
        Some(schema_name) if !schema_name.is_empty() => format!(
            "{}.{}",
            mysql_quote_identifier(schema_name),
            mysql_quote_identifier(table_name)
        ),
        _ => mysql_quote_identifier(table_name),
    }
}

fn json_to_mysql_value(value: &serde_json::Value) -> MysqlValue {
    match value {
        serde_json::Value::Null => MysqlValue::NULL,
        serde_json::Value::Bool(value) => MysqlValue::Int(if *value { 1 } else { 0 }),
        serde_json::Value::Number(value) => {
            if let Some(value) = value.as_i64() {
                MysqlValue::Int(value)
            } else if let Some(value) = value.as_u64() {
                MysqlValue::UInt(value)
            } else if let Some(value) = value.as_f64() {
                MysqlValue::Double(value)
            } else {
                MysqlValue::Bytes(value.to_string().into_bytes())
            }
        }
        serde_json::Value::String(value) => MysqlValue::Bytes(value.clone().into_bytes()),
        other => MysqlValue::Bytes(other.to_string().into_bytes()),
    }
}

fn format_mysql_value_for_sql(value: &MysqlValue) -> String {
    match value {
        MysqlValue::NULL => "NULL".to_string(),
        MysqlValue::Bytes(bytes) => match std::str::from_utf8(bytes) {
            Ok(text) => quote_mysql_literal(text),
            Err(_) => format!("0x{}", hex_encode(bytes)),
        },
        MysqlValue::Int(value) => value.to_string(),
        MysqlValue::UInt(value) => value.to_string(),
        MysqlValue::Float(value) => value.to_string(),
        MysqlValue::Double(value) => value.to_string(),
        MysqlValue::Date(year, month, day, hour, minute, second, micros) => format!(
            "'{:04}-{:02}-{:02} {:02}:{:02}:{:02}.{:06}'",
            year, month, day, hour, minute, second, micros
        ),
        MysqlValue::Time(negative, days, hours, minutes, seconds, micros) => format!(
            "'{}{} {:02}:{:02}:{:02}.{:06}'",
            if *negative { "-" } else { "" },
            days,
            hours,
            minutes,
            seconds,
            micros
        ),
    }
}

fn format_libsql_value_for_sql(row: &libsql::Row, idx: i32) -> String {
    use libsql::Value;

    match row.get_value(idx) {
        Ok(Value::Null) | Err(_) => "NULL".to_string(),
        Ok(Value::Integer(value)) => value.to_string(),
        Ok(Value::Real(value)) => value.to_string(),
        Ok(Value::Text(value)) => quote_sql_literal(&value),
        Ok(Value::Blob(bytes)) => format!("x'{}'", hex_encode(&bytes)),
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().fold(String::new(), |mut out, byte| {
        use std::fmt::Write;
        let _ = write!(out, "{:02x}", byte);
        out
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mysql_identifier_quoting_handles_schema_and_escapes() {
        assert_eq!(mysql_quote_identifier("users"), "`users`");
        assert_eq!(mysql_quote_identifier("user`data"), "`user``data`");
        assert_eq!(
            mysql_qualified_table_name("users", Some("tenant-db")),
            "`tenant-db`.`users`"
        );
        assert_eq!(mysql_qualified_table_name("users", None), "`users`");
    }

    #[test]
    fn mysql_json_conversion_handles_scalar_values() {
        assert!(matches!(
            json_to_mysql_value(&serde_json::Value::Null),
            MysqlValue::NULL
        ));
        assert!(matches!(
            json_to_mysql_value(&serde_json::json!(true)),
            MysqlValue::Int(1)
        ));
        assert!(matches!(
            json_to_mysql_value(&serde_json::json!(123_u64)),
            MysqlValue::Int(123)
        ));
        assert!(matches!(
            json_to_mysql_value(&serde_json::json!(9223372036854775808_u64)),
            MysqlValue::UInt(9223372036854775808)
        ));
        assert!(matches!(
            json_to_mysql_value(&serde_json::json!("hello")),
            MysqlValue::Bytes(_)
        ));
    }

    #[test]
    fn mysql_sql_formatting_escapes_strings() {
        let formatted = format_mysql_value_for_sql(&MysqlValue::Bytes(b"o'reilly\\path".to_vec()));
        assert_eq!(formatted, "'o''reilly\\\\path'");
    }

    #[test]
    fn mysql_sql_formatting_keeps_binary_as_hex() {
        let formatted = format_mysql_value_for_sql(&MysqlValue::Bytes(vec![0x00, 0xff, 0x10]));
        assert_eq!(formatted, "0x00ff10");
    }

    #[test]
    fn ansi_literals_only_escape_the_quote() {
        assert_eq!(quote_sql_literal("o'reilly"), "'o''reilly'");
        assert_eq!(quote_sql_literal("c:\\tmp"), "'c:\\tmp'");
        assert_eq!(quote_sql_literal("{1,2}"), "'{1,2}'");
    }

    #[test]
    fn ddl_parts_keep_foreign_keys_out_of_create_table() {
        use crate::database::types::{ColumnInfo, ForeignKeyInfo, TableInfo};

        let schema = DatabaseSchema {
            tables: vec![TableInfo {
                name: "posts".to_string(),
                schema: "public".to_string(),
                columns: vec![ColumnInfo {
                    name: "author_id".to_string(),
                    data_type: "integer".to_string(),
                    is_nullable: false,
                    default_value: None,
                    is_primary_key: false,
                    is_auto_increment: false,
                    foreign_key: Some(ForeignKeyInfo {
                        referenced_schema: "public".to_string(),
                        referenced_table: "users".to_string(),
                        referenced_column: "id".to_string(),
                    }),
                    allowed_values: None,
                }],
                primary_key_columns: vec![],
                indexes: vec![],
                row_count_estimate: None,
            }],
            schemas: vec!["public".to_string()],
            unique_columns: vec![],
        };

        let (creates, foreign_keys) =
            schema_export::generate_ddl_parts(&schema, schema_export::ExportDialect::PostgreSQL);

        assert_eq!(creates.len(), 1);
        assert!(creates[0].starts_with("CREATE TABLE \"posts\""));
        assert!(!creates[0].contains("REFERENCES"));
        assert_eq!(foreign_keys.len(), 1);
        assert!(foreign_keys[0].contains("REFERENCES \"users\"(\"id\")"));
    }
}
