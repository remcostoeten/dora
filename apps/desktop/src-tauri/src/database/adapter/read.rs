//! Database adapter trait for generic database operations.
//!
//! This module provides a trait-based abstraction over different database backends
//! (PostgreSQL, SQLite, and future libSQL). This enables:
//! - Easy addition of new database types without modifying existing code
//! - Better testability through mock implementations
//! - Separation of concerns between query execution and database-specific details

use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use tokio_postgres::Client as PgClient;

use crate::{
    database::{
        dialect::{MySqlDialect, PgDialect},
        parser::ParsedStatement,
        types::{DatabaseSchema, ExecSender},
    },
    Error,
};

/// A trait for database adapters that can execute queries and retrieve schemas.
///
/// Implementations of this trait provide database-specific logic for:
/// - Parsing SQL statements according to the database dialect
/// - Executing queries and sending results via channels
/// - Retrieving database schema information
///
/// # Example
///
/// ```ignore
/// let adapter = PostgresAdapter::new(client, use_simple_query, dialect);
/// let statements = adapter.parse_statements("SELECT * FROM users")?;
/// adapter.execute_query(statements[0], &sender).await?;
/// ```
#[async_trait]
pub trait DatabaseAdapter: Send + Sync {
    /// Parse a SQL query string into individual statements.
    ///
    /// The parser should use the appropriate dialect for the database type.
    fn parse_statements(&self, query: &str) -> Result<Vec<ParsedStatement>, Error>;

    /// Execute a single parsed statement.
    ///
    /// Results are sent via the provided sender channel. This allows for
    /// streaming results as they become available.
    async fn execute_query(&self, stmt: ParsedStatement, sender: &ExecSender) -> Result<(), Error>;

    /// Retrieve the database schema including all tables, columns, and metadata.
    async fn get_schema(&self) -> Result<DatabaseSchema, Error>;

    /// Check if the database connection is still active.
    fn is_connected(&self) -> bool;

    /// Get the database type identifier for logging and display purposes.
    fn database_type(&self) -> DatabaseType;
}

/// Enum representing supported database types.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DatabaseType {
    Postgres,
    MySQL,
    SQLite,
    DuckDB,
    LibSQL,
}

impl std::fmt::Display for DatabaseType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DatabaseType::Postgres => write!(f, "PostgreSQL"),
            DatabaseType::MySQL => write!(f, "MySQL"),
            DatabaseType::SQLite => write!(f, "SQLite"),
            DatabaseType::DuckDB => write!(f, "DuckDB"),
            DatabaseType::LibSQL => write!(f, "libSQL"),
        }
    }
}

/// PostgreSQL adapter implementation.
pub struct PostgresAdapter {
    client: Arc<PgClient>,
    use_simple_query: bool,
    /// Runtime dialect (vanilla unless CockroachDB detected). Threaded into
    /// schema introspection and the row writer; vanilla-only behaviour for now.
    dialect: PgDialect,
}

impl PostgresAdapter {
    pub fn new(client: Arc<PgClient>, use_simple_query: bool, dialect: PgDialect) -> Self {
        Self {
            client,
            use_simple_query,
            dialect,
        }
    }

    pub fn client(&self) -> &PgClient {
        &self.client
    }

    pub fn dialect(&self) -> PgDialect {
        self.dialect
    }
}

#[async_trait]
impl DatabaseAdapter for PostgresAdapter {
    fn parse_statements(&self, query: &str) -> Result<Vec<ParsedStatement>, Error> {
        crate::database::postgres::parser::parse_statements(query).map_err(Into::into)
    }

    async fn execute_query(&self, stmt: ParsedStatement, sender: &ExecSender) -> Result<(), Error> {
        crate::database::postgres::execute::execute_query(
            &self.client,
            stmt,
            sender,
            self.use_simple_query,
            self.dialect,
        )
        .await
    }

    async fn get_schema(&self) -> Result<DatabaseSchema, Error> {
        crate::database::postgres::schema::get_database_schema(&self.client, self.dialect).await
    }

    fn is_connected(&self) -> bool {
        !self.client.is_closed()
    }

    fn database_type(&self) -> DatabaseType {
        DatabaseType::Postgres
    }
}

/// SQLite adapter implementation.
pub struct SqliteAdapter {
    connection: Arc<Mutex<rusqlite::Connection>>,
}

impl SqliteAdapter {
    pub fn new(connection: Arc<Mutex<rusqlite::Connection>>) -> Self {
        Self { connection }
    }

    pub fn connection(&self) -> &Arc<Mutex<rusqlite::Connection>> {
        &self.connection
    }
}

#[async_trait]
impl DatabaseAdapter for SqliteAdapter {
    fn parse_statements(&self, query: &str) -> Result<Vec<ParsedStatement>, Error> {
        crate::database::sqlite::parser::parse_statements(query).map_err(Into::into)
    }

    async fn execute_query(&self, stmt: ParsedStatement, sender: &ExecSender) -> Result<(), Error> {
        // SQLite operations are blocking, so we use spawn_blocking
        let conn = self.connection.clone();
        let sender = sender.clone();

        tauri::async_runtime::spawn_blocking(move || {
            let conn = conn.lock().expect("Mutex poisoned");
            crate::database::sqlite::execute::execute_query(&conn, stmt, &sender)
        })
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("SQLite execution task failed: {}", e)))?
    }

    async fn get_schema(&self) -> Result<DatabaseSchema, Error> {
        crate::database::sqlite::schema::get_database_schema(self.connection.clone()).await
    }

    fn is_connected(&self) -> bool {
        // SQLite connections are always "connected" if the file exists
        self.connection.lock().is_ok()
    }

    fn database_type(&self) -> DatabaseType {
        DatabaseType::SQLite
    }
}

/// DuckDB adapter implementation.
pub struct DuckDbAdapter {
    connection: Arc<Mutex<duckdb::Connection>>,
    /// True for file-source connections (CSV/Parquet/JSON views): the write
    /// path refuses mutations with a friendly error.
    read_only: bool,
}

impl DuckDbAdapter {
    pub fn new(connection: Arc<Mutex<duckdb::Connection>>) -> Self {
        Self {
            connection,
            read_only: false,
        }
    }

    pub fn new_with_read_only(connection: Arc<Mutex<duckdb::Connection>>, read_only: bool) -> Self {
        Self {
            connection,
            read_only,
        }
    }

    pub fn connection(&self) -> &Arc<Mutex<duckdb::Connection>> {
        &self.connection
    }

    pub fn is_read_only(&self) -> bool {
        self.read_only
    }
}

#[async_trait]
impl DatabaseAdapter for DuckDbAdapter {
    fn parse_statements(&self, query: &str) -> Result<Vec<ParsedStatement>, Error> {
        crate::database::duckdb::parser::parse_statements(query).map_err(Into::into)
    }

    async fn execute_query(&self, stmt: ParsedStatement, sender: &ExecSender) -> Result<(), Error> {
        // DuckDB operations are blocking, so we use spawn_blocking
        let conn = self.connection.clone();
        let sender = sender.clone();

        tauri::async_runtime::spawn_blocking(move || {
            let conn = conn.lock().expect("Mutex poisoned");
            crate::database::duckdb::execute::execute_query(&conn, stmt, &sender)
        })
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("DuckDB execution task failed: {}", e)))?
    }

    async fn get_schema(&self) -> Result<DatabaseSchema, Error> {
        crate::database::duckdb::schema::get_database_schema(self.connection.clone()).await
    }

    fn is_connected(&self) -> bool {
        self.connection.lock().is_ok()
    }

    fn database_type(&self) -> DatabaseType {
        DatabaseType::DuckDB
    }
}

pub struct LibSqlAdapter {
    connection: Arc<libsql::Connection>,
}

impl LibSqlAdapter {
    pub fn new(connection: Arc<libsql::Connection>) -> Self {
        Self { connection }
    }

    pub fn connection(&self) -> &Arc<libsql::Connection> {
        &self.connection
    }
}

#[async_trait]
impl DatabaseAdapter for LibSqlAdapter {
    fn parse_statements(&self, query: &str) -> Result<Vec<ParsedStatement>, Error> {
        crate::database::libsql::parser::parse_statements(query).map_err(Into::into)
    }

    async fn execute_query(&self, stmt: ParsedStatement, sender: &ExecSender) -> Result<(), Error> {
        crate::database::libsql::execute::execute_query(&self.connection, stmt, sender).await
    }

    async fn get_schema(&self) -> Result<DatabaseSchema, Error> {
        crate::database::libsql::schema::get_database_schema(self.connection.clone()).await
    }

    fn is_connected(&self) -> bool {
        true
    }

    fn database_type(&self) -> DatabaseType {
        DatabaseType::LibSQL
    }
}

pub struct MySqlAdapter {
    pool: Arc<mysql_async::Pool>,
    /// Runtime dialect (vanilla unless MariaDB detected). Vanilla-only today.
    dialect: MySqlDialect,
}

impl MySqlAdapter {
    pub fn new(pool: Arc<mysql_async::Pool>, dialect: MySqlDialect) -> Self {
        Self { pool, dialect }
    }

    pub fn pool(&self) -> &mysql_async::Pool {
        &self.pool
    }

    pub fn dialect(&self) -> MySqlDialect {
        self.dialect
    }
}

#[async_trait]
impl DatabaseAdapter for MySqlAdapter {
    fn parse_statements(&self, query: &str) -> Result<Vec<ParsedStatement>, Error> {
        crate::database::mysql::parser::parse_statements(query).map_err(Into::into)
    }

    async fn execute_query(&self, stmt: ParsedStatement, sender: &ExecSender) -> Result<(), Error> {
        crate::database::mysql::execute::execute_query(&self.pool, stmt, sender).await
    }

    async fn get_schema(&self) -> Result<DatabaseSchema, Error> {
        crate::database::mysql::schema::get_database_schema(self.pool.clone(), self.dialect).await
    }

    fn is_connected(&self) -> bool {
        true
    }

    fn database_type(&self) -> DatabaseType {
        DatabaseType::MySQL
    }
}

pub type BoxedAdapter = Box<dyn DatabaseAdapter>;

pub fn adapter_from_client(client: &crate::database::types::DatabaseClient) -> BoxedAdapter {
    match client {
        crate::database::types::DatabaseClient::Postgres {
            client,
            use_simple_query,
            dialect,
        } => Box::new(PostgresAdapter::new(client.clone(), *use_simple_query, *dialect)),
        crate::database::types::DatabaseClient::MySQL { pool, dialect } => {
            Box::new(MySqlAdapter::new(pool.clone(), *dialect))
        }
        crate::database::types::DatabaseClient::SQLite { connection } => {
            Box::new(SqliteAdapter::new(connection.clone()))
        }
        crate::database::types::DatabaseClient::DuckDB { connection, .. } => {
            Box::new(DuckDbAdapter::new(connection.clone()))
        }
        crate::database::types::DatabaseClient::LibSQL { connection } => {
            Box::new(LibSqlAdapter::new(connection.clone()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_type_display() {
        assert_eq!(DatabaseType::Postgres.to_string(), "PostgreSQL");
        assert_eq!(DatabaseType::MySQL.to_string(), "MySQL");
        assert_eq!(DatabaseType::SQLite.to_string(), "SQLite");
        assert_eq!(DatabaseType::DuckDB.to_string(), "DuckDB");
        assert_eq!(DatabaseType::LibSQL.to_string(), "libSQL");
    }

    #[tokio::test]
    async fn test_sqlite_adapter_parse() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let adapter = SqliteAdapter::new(Arc::new(Mutex::new(conn)));

        let statements = adapter.parse_statements("SELECT 1; SELECT 2").unwrap();
        assert_eq!(statements.len(), 2);
        assert!(statements[0].returns_values);
        assert!(statements[1].returns_values);
    }

    #[tokio::test]
    async fn test_sqlite_adapter_is_connected() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let adapter = SqliteAdapter::new(Arc::new(Mutex::new(conn)));
        assert!(adapter.is_connected());
    }
}
