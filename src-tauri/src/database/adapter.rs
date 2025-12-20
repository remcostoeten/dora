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
/// let adapter = PostgresAdapter::new(client);
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
    SQLite,
    LibSQL,
}

impl std::fmt::Display for DatabaseType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DatabaseType::Postgres => write!(f, "PostgreSQL"),
            DatabaseType::SQLite => write!(f, "SQLite"),
            DatabaseType::LibSQL => write!(f, "libSQL"),
        }
    }
}

/// PostgreSQL adapter implementation.
pub struct PostgresAdapter {
    client: Arc<PgClient>,
}

impl PostgresAdapter {
    pub fn new(client: Arc<PgClient>) -> Self {
        Self { client }
    }

    pub fn client(&self) -> &PgClient {
        &self.client
    }
}

#[async_trait]
impl DatabaseAdapter for PostgresAdapter {
    fn parse_statements(&self, query: &str) -> Result<Vec<ParsedStatement>, Error> {
        crate::database::postgres::parser::parse_statements(query).map_err(Into::into)
    }

    async fn execute_query(&self, stmt: ParsedStatement, sender: &ExecSender) -> Result<(), Error> {
        crate::database::postgres::execute::execute_query(&self.client, stmt, sender).await
    }

    async fn get_schema(&self) -> Result<DatabaseSchema, Error> {
        crate::database::postgres::schema::get_database_schema(&self.client).await
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
            let conn = conn.lock().unwrap();
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

/// A boxed database adapter for use in dynamic contexts.
pub type BoxedAdapter = Box<dyn DatabaseAdapter>;

/// Create an adapter from a DatabaseClient enum.
///
/// This is a convenience function for transitioning from the old enum-based
/// approach to the new trait-based approach.
pub fn adapter_from_client(client: &crate::database::types::DatabaseClient) -> BoxedAdapter {
    match client {
        crate::database::types::DatabaseClient::Postgres { client } => {
            Box::new(PostgresAdapter::new(client.clone()))
        }
        crate::database::types::DatabaseClient::SQLite { connection } => {
            Box::new(SqliteAdapter::new(connection.clone()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_type_display() {
        assert_eq!(DatabaseType::Postgres.to_string(), "PostgreSQL");
        assert_eq!(DatabaseType::SQLite.to_string(), "SQLite");
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
