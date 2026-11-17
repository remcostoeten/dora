//! Per-driver write trait.
//!
//! Phase 5b: Real implementations ported from `database/services/mutation.rs`
//! and `database/maintenance.rs`. Each driver's impl lives in its own submodule
//! (`write_postgres.rs`, `write_sqlite.rs`, `write_mysql.rs`, `write_libsql.rs`).

use async_trait::async_trait;

use crate::{
    database::{
        maintenance::{DumpResult, SoftDeleteResult, TruncateResult},
        services::mutation::{CellUpdate, MutationResult},
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

    /// Applies many cell writes in one call. The default issues them
    /// concurrently with no rollback, so a failure can leave part of the batch
    /// applied; adapters that own a single connection override it to wrap the
    /// batch in a transaction.
    async fn update_cells(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        cells: Vec<CellUpdate>,
    ) -> Result<MutationResult, Error> {
        update_cells_concurrently(self, table, schema, pk_column, cells).await
    }

    /// Inserts many rows in one call, with the same contract as
    /// [`WriteAdapter::update_cells`].
    async fn insert_rows(
        &self,
        table: String,
        schema: Option<String>,
        rows: Vec<serde_json::Map<String, serde_json::Value>>,
    ) -> Result<MutationResult, Error> {
        insert_rows_concurrently(self, table, schema, rows).await
    }

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

    /// Copies many rows in one call, each inside the database. The default
    /// stops at the first failure with no rollback; adapters that own a single
    /// connection override it to wrap the batch in a transaction.
    async fn duplicate_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        duplicate_rows_in_order(self, table, schema, pk_column, pk_values).await
    }

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

pub(super) async fn duplicate_rows_in_order<A: WriteAdapter + ?Sized>(
    adapter: &A,
    table: String,
    schema: Option<String>,
    pk_column: String,
    pk_values: Vec<serde_json::Value>,
) -> Result<MutationResult, Error> {
    let mut copied = 0usize;
    for pk_value in pk_values {
        copied += adapter
            .duplicate_row(table.clone(), schema.clone(), pk_column.clone(), pk_value)
            .await?
            .affected_rows;
    }
    Ok(MutationResult {
        success: copied > 0,
        affected_rows: copied,
        message: Some(format!("Inserted {} row(s)", copied)),
    })
}

/// Turns the row count of an in-database row copy into the command result.
pub(super) fn duplicate_outcome(
    rows: usize,
    table: &str,
    pk_column: &str,
) -> Result<MutationResult, Error> {
    if rows == 0 {
        return Err(Error::Any(anyhow::anyhow!(
            "No row found in \"{}\" where {} matches the provided primary key",
            table,
            pk_column
        )));
    }
    Ok(MutationResult {
        success: true,
        affected_rows: rows,
        message: Some(format!("Inserted {} row(s)", rows)),
    })
}

pub(super) fn require_copyable_columns(columns: &[String]) -> Result<(), Error> {
    if columns.is_empty() {
        return Err(Error::Any(anyhow::anyhow!(
            "Cannot duplicate row because only the primary key column is available"
        )));
    }
    Ok(())
}

pub(super) async fn update_cells_concurrently<A: WriteAdapter + ?Sized>(
    adapter: &A,
    table: String,
    schema: Option<String>,
    pk_column: String,
    cells: Vec<CellUpdate>,
) -> Result<MutationResult, Error> {
    let results = futures_util::future::try_join_all(cells.into_iter().map(|cell| {
        adapter.update_cell(
            table.clone(),
            schema.clone(),
            pk_column.clone(),
            cell.primary_key_value,
            cell.column_name,
            cell.new_value,
        )
    }))
    .await?;
    Ok(batch_result("Updated", &results))
}

pub(super) async fn insert_rows_concurrently<A: WriteAdapter + ?Sized>(
    adapter: &A,
    table: String,
    schema: Option<String>,
    rows: Vec<serde_json::Map<String, serde_json::Value>>,
) -> Result<MutationResult, Error> {
    let results = futures_util::future::try_join_all(
        rows.into_iter()
            .map(|row| adapter.insert_row(table.clone(), schema.clone(), row)),
    )
    .await?;
    Ok(batch_result("Inserted", &results))
}

fn batch_result(verb: &str, results: &[MutationResult]) -> MutationResult {
    let affected = results.iter().map(|result| result.affected_rows).sum();
    MutationResult {
        success: affected > 0,
        affected_rows: affected,
        message: Some(format!("{} {} row(s)", verb, affected)),
    }
}

// -----------------------------------------------------------------------------
// Factory — mirrors `adapter_from_client` in read.rs
// -----------------------------------------------------------------------------

pub type BoxedWriteAdapter = Box<dyn WriteAdapter>;

pub fn write_adapter_from_client(
    client: &crate::database::types::DatabaseClient,
) -> BoxedWriteAdapter {
    use super::read::{
        D1Adapter, LibSqlAdapter, MySqlAdapter, PostgresAdapter, PosthogAdapter, SqliteAdapter,
    };

    match client {
        crate::database::types::DatabaseClient::Postgres {
            client,
            use_simple_query,
            dialect,
            ..
        } => Box::new(PostgresAdapter::new(
            client.clone(),
            *use_simple_query,
            *dialect,
        )),
        crate::database::types::DatabaseClient::MySQL { pool, dialect } => {
            Box::new(MySqlAdapter::new(pool.clone(), *dialect))
        }
        crate::database::types::DatabaseClient::SQLite { connection } => {
            Box::new(SqliteAdapter::new(connection.clone()))
        }
        crate::database::types::DatabaseClient::DuckDB { connection, .. } => Box::new(
            crate::database::adapter::DuckDbConnAdapter::new(connection.clone()),
        ),
        crate::database::types::DatabaseClient::LibSQL { connection } => {
            Box::new(LibSqlAdapter::new(connection.clone()))
        }
        crate::database::types::DatabaseClient::D1 { http } => {
            Box::new(D1Adapter::new(http.clone()))
        }
        crate::database::types::DatabaseClient::Posthog { http } => {
            Box::new(PosthogAdapter::new(http.clone()))
        }
    }
}
