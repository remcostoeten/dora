use std::path::Path;

use mysql_async::prelude::Queryable;
use mysql_async::{Pool, Row};
use serde::{Deserialize, Serialize};
use tokio_postgres::Client;

use crate::Error;

/// Database-level metadata information
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct DatabaseMetadata {
    /// Total size of the database in bytes
    pub size_bytes: u64,
    /// Database creation timestamp (if available)
    pub created_at: Option<i64>,
    /// Last modification timestamp (if available)
    pub last_updated: Option<i64>,
    /// Total number of rows across all tables
    pub row_count_total: u64,
    /// Number of tables in the database
    pub table_count: u32,
    /// Database host or file path
    pub host: String,
    /// Database name
    pub database_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MySqlConnectionTarget {
    pub host: String,
    pub port: u16,
    pub database_name: Option<String>,
}

/// Get metadata for a PostgreSQL database
pub async fn get_postgres_metadata(
    client: &Client,
    connection_string: &str,
) -> Result<DatabaseMetadata, Error> {
    // Get database size
    let size_query = r#"
        SELECT pg_database_size(current_database())
    "#;
    let size_row = client
        .query_one(size_query, &[])
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get database size: {}", e)))?;
    let size_bytes: i64 = size_row.get(0);

    // Get database name
    let name_query = r#"SELECT current_database()"#;
    let name_row = client
        .query_one(name_query, &[])
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get database name: {}", e)))?;
    let database_name: String = name_row.get(0);

    // Get total row count and table count from pg_stat
    let stats_query = r#"
        SELECT 
            COUNT(*)::int as table_count,
            COALESCE(SUM(n_live_tup), 0)::bigint as row_count
        FROM pg_stat_user_tables
    "#;
    let stats_row = client
        .query_one(stats_query, &[])
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get table stats: {}", e)))?;
    let table_count: i32 = stats_row.get(0);
    let row_count_total: i64 = stats_row.get(1);

    // Get last activity time from pg_stat_activity or pg_stat_database
    let activity_query = r#"
        SELECT 
            EXTRACT(EPOCH FROM stats_reset)::bigint as last_reset,
            EXTRACT(EPOCH FROM now())::bigint as now
        FROM pg_stat_database 
        WHERE datname = current_database()
    "#;
    let activity_row = client
        .query_opt(activity_query, &[])
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get activity stats: {}", e)))?;

    let last_updated = activity_row.and_then(|r| r.get::<_, Option<i64>>(0));

    // Extract host from connection string (simplified)
    let host = extract_host_from_connection_string(connection_string);

    Ok(DatabaseMetadata {
        size_bytes: size_bytes as u64,
        created_at: None, // PostgreSQL doesn't easily expose creation date
        last_updated,
        row_count_total: row_count_total as u64,
        table_count: table_count as u32,
        host,
        database_name: Some(database_name),
    })
}

/// Get metadata for a SQLite database
pub fn get_sqlite_metadata(db_path: &str) -> Result<DatabaseMetadata, Error> {
    let path = Path::new(db_path);

    // Get file metadata
    let file_meta = std::fs::metadata(path)
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get file metadata: {}", e)))?;

    let size_bytes = file_meta.len();

    // Get creation and modification times
    let created_at = file_meta
        .created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    let last_updated = file_meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64);

    // For table/row counts, we need to query the database
    // This will be done separately since we need a connection

    Ok(DatabaseMetadata {
        size_bytes,
        created_at,
        last_updated,
        row_count_total: 0, // Will be filled in by caller
        table_count: 0,     // Will be filled in by caller
        host: db_path.to_string(),
        database_name: path
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string()),
    })
}

/// Get table and row counts from SQLite connection
pub fn get_sqlite_counts(conn: &rusqlite::Connection) -> Result<(u32, u64), Error> {
    // Get table count
    let table_count: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get table count: {}", e)))?;

    // Get total row count by iterating tables
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to prepare table list query: {}", e)))?;

    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to query tables: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    let mut total_rows: u64 = 0;
    for table in tables {
        let count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", table), [], |row| {
                row.get(0)
            })
            .unwrap_or(0);
        total_rows += count as u64;
    }

    Ok((table_count, total_rows))
}

/// Get metadata for a LibSQL database
pub async fn get_libsql_metadata(
    conn: &libsql::Connection,
    url: &str,
) -> Result<DatabaseMetadata, Error> {
    // LibSQL remote connections don't have file-based metadata
    // For local files, we could check the path

    let is_remote = url.starts_with("libsql://") || url.starts_with("https://");

    if is_remote {
        // For remote LibSQL/Turso, we can only get table/row counts
        let (table_count, row_count_total) = get_libsql_counts(conn).await?;

        Ok(DatabaseMetadata {
            size_bytes: 0, // Not available for remote
            created_at: None,
            last_updated: None,
            row_count_total,
            table_count,
            host: url.to_string(),
            database_name: None,
        })
    } else {
        // Local file - get file metadata
        let mut meta = get_sqlite_metadata(url)?;
        let (table_count, row_count_total) = get_libsql_counts(conn).await?;
        meta.table_count = table_count;
        meta.row_count_total = row_count_total;
        Ok(meta)
    }
}

/// Get table and row counts from LibSQL connection
pub async fn get_libsql_counts(conn: &libsql::Connection) -> Result<(u32, u64), Error> {
    // Get table count
    let mut rows = conn
        .query(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            (),
        )
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get table count: {}", e)))?;

    let table_count: u32 = if let Some(row) = rows
        .next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to fetch row: {}", e)))?
    {
        row.get::<i64>(0).unwrap_or(0) as u32
    } else {
        0
    };

    // Get table names
    let mut rows = conn
        .query(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            (),
        )
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to query tables: {}", e)))?;

    let mut tables: Vec<String> = Vec::new();
    while let Some(row) = rows
        .next()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to fetch table name: {}", e)))?
    {
        if let Ok(name) = row.get::<String>(0) {
            tables.push(name);
        }
    }

    // Count rows in each table
    let mut total_rows: u64 = 0;
    for table in tables {
        let query = format!("SELECT COUNT(*) FROM \"{}\"", table);
        let mut rows = conn
            .query(&query, ())
            .await
            .unwrap_or_else(|_| panic!("Failed to count rows in {}", table));

        if let Ok(Some(row)) = rows.next().await {
            let count: i64 = row.get(0).unwrap_or(0);
            total_rows += count as u64;
        }
    }

    Ok((table_count, total_rows))
}

/// Extract host from PostgreSQL connection string
fn extract_host_from_connection_string(conn_str: &str) -> String {
    // Handle postgres://user:pass@host:port/db format
    if let Some(at_pos) = conn_str.find('@') {
        let after_at = &conn_str[at_pos + 1..];
        if let Some(slash_pos) = after_at.find('/') {
            return after_at[..slash_pos].to_string();
        }
        return after_at.to_string();
    }

    // Handle key=value format
    for part in conn_str.split_whitespace() {
        if part.starts_with("host=") {
            return part[5..].to_string();
        }
    }

    "localhost".to_string()
}

/// Get metadata for a MySQL database
pub async fn get_mysql_metadata(
    pool: &Pool,
    connection_string: &str,
) -> Result<DatabaseMetadata, Error> {
    let mut metadata = build_mysql_metadata_fallback(connection_string);

    let mut conn = match pool.get_conn().await {
        Ok(conn) => conn,
        Err(err) => {
            log::warn!("Failed to acquire MySQL connection for metadata: {}", err);
            return Ok(metadata);
        }
    };

    let schema_name = match conn.query_first::<String, _>("SELECT DATABASE()").await {
        Ok(Some(name)) if !name.is_empty() => {
            metadata.database_name = Some(name.clone());
            name
        }
        Ok(_) => metadata.database_name.clone().unwrap_or_default(),
        Err(err) => {
            log::warn!("Failed to resolve MySQL database name: {}", err);
            metadata.database_name.clone().unwrap_or_default()
        }
    };

    if schema_name.is_empty() {
        return Ok(metadata);
    }

    let escaped_schema = escape_mysql_literal(&schema_name);

    let counts_query = format!(
        "SELECT \
            COALESCE(SUM(data_length + index_length), 0) AS size_bytes, \
            COALESCE(SUM(table_rows), 0) AS row_count_total, \
            COUNT(*) AS table_count \
        FROM information_schema.TABLES \
        WHERE table_schema = '{}' AND table_type = 'BASE TABLE'",
        escaped_schema
    );

    match conn.query_first::<Row, _>(counts_query).await {
        Ok(Some(row)) => {
            if let Some(size_bytes) = row.get::<u64, _>(0) {
                metadata.size_bytes = size_bytes;
            }
            if let Some(row_count_total) = row.get::<u64, _>(1) {
                metadata.row_count_total = row_count_total;
            }
            if let Some(table_count) = row.get::<u64, _>(2) {
                metadata.table_count = table_count as u32;
            }
        }
        Ok(None) => {}
        Err(err) => {
            log::warn!(
                "Failed to query MySQL size/table metadata for {}: {}",
                schema_name,
                err
            );
        }
    }

    let timing_query = format!(
        "SELECT \
            UNIX_TIMESTAMP(MIN(create_time)) AS created_at, \
            UNIX_TIMESTAMP(MAX(update_time)) AS last_updated \
        FROM information_schema.TABLES \
        WHERE table_schema = '{}' AND table_type = 'BASE TABLE'",
        escaped_schema
    );

    match conn.query_first::<Row, _>(timing_query).await {
        Ok(Some(row)) => {
            metadata.created_at = row.get::<i64, _>(0);
            metadata.last_updated = row.get::<i64, _>(1);
        }
        Ok(None) => {}
        Err(err) => {
            log::warn!(
                "Failed to query MySQL timing metadata for {}: {}",
                schema_name,
                err
            );
        }
    }

    Ok(metadata)
}

pub fn parse_mysql_connection_target(conn_str: &str) -> MySqlConnectionTarget {
    if let Ok(url) = url::Url::parse(conn_str) {
        MySqlConnectionTarget {
            host: url.host_str().unwrap_or("localhost").to_string(),
            port: url.port().unwrap_or(3306),
            database_name: url
                .path_segments()
                .and_then(|mut segments| segments.next())
                .filter(|segment| !segment.is_empty())
                .map(String::from),
        }
    } else {
        let mut host = "localhost".to_string();
        let mut port = 3306;
        let mut database_name = None;

        for part in conn_str.split(|c: char| c.is_whitespace() || c == ';') {
            let Some((key, value)) = part.split_once('=') else {
                continue;
            };

            let key = key.trim().to_ascii_lowercase();
            let value = value.trim().trim_matches('"').trim_matches('\'');

            match key.as_str() {
                "host" => host = value.to_string(),
                "port" => port = value.parse().unwrap_or(3306),
                "database" | "db" | "dbname" => database_name = Some(value.to_string()),
                _ => {}
            }
        }

        MySqlConnectionTarget {
            host,
            port,
            database_name,
        }
    }
}

pub fn build_mysql_metadata_fallback(connection_string: &str) -> DatabaseMetadata {
    let target = parse_mysql_connection_target(connection_string);

    DatabaseMetadata {
        size_bytes: 0,
        created_at: None,
        last_updated: None,
        row_count_total: 0,
        table_count: 0,
        host: target.host,
        database_name: target.database_name,
    }
}

fn escape_mysql_literal(value: &str) -> String {
    value.replace('\'', "''")
}
