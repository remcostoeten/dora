//! Per-driver write trait.
//!
//! Phase 5b: Real implementations ported from `database/services/mutation.rs`
//! and `database/maintenance.rs`. Each driver's impl lives in its own submodule
//! (`write_postgres.rs`, `write_sqlite.rs`, `write_mysql.rs`, `write_libsql.rs`).

use async_trait::async_trait;

use crate::{
    database::{
        maintenance::{DumpResult, SoftDeleteResult, TruncateResult},
        services::mutation::MutationResult,
    },
    Error,
};

/// Write-half of a driver adapter. Every method maps 1:1 to a Tauri command
/// in `database/commands/mutation.rs` minus the `connection_id` parameter —
/// the adapter already owns the driver handle.
#[async_trait]
pub trait WriteAdapter: Send + Sync {
    async fn insert_row(
        &self,
        table: String,
        schema: Option<String>,
        row_data: serde_json::Map<String, serde_json::Value>,
    ) -> Result<MutationResult, Error>;

    async fn update_cell(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
        new_value: serde_json::Value,
    ) -> Result<MutationResult, Error>;

    async fn delete_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error>;

    async fn duplicate_row(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
    ) -> Result<MutationResult, Error>;

    async fn truncate_table(
        &self,
        table: String,
        schema: Option<String>,
        cascade: Option<bool>,
    ) -> Result<TruncateResult, Error>;

    async fn truncate_database(
        &self,
        schema: Option<String>,
        confirm: bool,
    ) -> Result<TruncateResult, Error>;

    async fn soft_delete_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
        soft_delete_column: Option<String>,
    ) -> Result<SoftDeleteResult, Error>;

    async fn undo_soft_delete(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
        soft_delete_column: String,
    ) -> Result<MutationResult, Error>;

    async fn dump_database(&self, output_path: String) -> Result<DumpResult, Error>;

    async fn execute_batch(&self, statements: Vec<String>) -> Result<MutationResult, Error>;

    /// Re-select a single binary cell and return its raw bytes.
    ///
    /// The data grid renders blobs as a display string (`describe_blob`), which
    /// discards the original bytes; "Copy as base64" / "Save to file" need them
    /// back. The cell is addressed by primary key, reusing the same parameter
    /// binding as the other write methods so the lookup is injection-safe.
    ///
    /// Drivers without a meaningful binary type (or not yet wired) return
    /// [`Error::NotImplemented`].
    async fn get_blob_bytes(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_value: serde_json::Value,
        _column: String,
    ) -> Result<Vec<u8>, Error> {
        Err(Error::NotImplemented("WriteAdapter::get_blob_bytes"))
    }
}

// -----------------------------------------------------------------------------
// Factory — mirrors `adapter_from_client` in read.rs
// -----------------------------------------------------------------------------

pub type BoxedWriteAdapter = Box<dyn WriteAdapter>;

pub fn write_adapter_from_client(
    client: &crate::database::types::DatabaseClient,
) -> BoxedWriteAdapter {
    use super::read::{DuckDbAdapter, LibSqlAdapter, MySqlAdapter, PostgresAdapter, SqliteAdapter};

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
        crate::database::types::DatabaseClient::DuckDB {
            connection,
            read_only,
        } => Box::new(DuckDbAdapter::new_with_read_only(
            connection.clone(),
            *read_only,
        )),
        crate::database::types::DatabaseClient::LibSQL { connection } => {
            Box::new(LibSqlAdapter::new(connection.clone()))
        }
    }
}
