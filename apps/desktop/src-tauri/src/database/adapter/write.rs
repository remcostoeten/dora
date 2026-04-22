//! Per-driver write trait.
//!
//! Stub implementations in this module return `Error::NotImplemented`. Real
//! bodies land in Phase 5b by porting logic from
//! `database/services/mutation.rs` and `database/maintenance.rs`. Once all
//! four drivers implement `WriteAdapter`, the match-on-engine branches in
//! `MutationService` and the `maintenance` module collapse into
//! `adapter.insert_row(...).await` etc.

use async_trait::async_trait;

use super::read::{LibSqlAdapter, MySqlAdapter, PostgresAdapter, SqliteAdapter};
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
///
/// Method signatures intentionally mirror `MutationService` / `maintenance`
/// functions so Phase 5b can port bodies with minimal rewriting.
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
}

// -----------------------------------------------------------------------------
// Stub impls — Phase 5a scaffold. Real bodies in Phase 5b.
// -----------------------------------------------------------------------------

fn not_impl<T>(method: &'static str) -> Result<T, Error> {
    Err(Error::NotImplemented(method))
}

macro_rules! write_adapter_stub {
    ($ty:ty) => {
        #[async_trait]
        impl WriteAdapter for $ty {
            async fn insert_row(
                &self,
                _table: String,
                _schema: Option<String>,
                _row_data: serde_json::Map<String, serde_json::Value>,
            ) -> Result<MutationResult, Error> {
                not_impl("WriteAdapter::insert_row")
            }

            async fn update_cell(
                &self,
                _table: String,
                _schema: Option<String>,
                _pk_column: String,
                _pk_value: serde_json::Value,
                _column: String,
                _new_value: serde_json::Value,
            ) -> Result<MutationResult, Error> {
                not_impl("WriteAdapter::update_cell")
            }

            async fn delete_rows(
                &self,
                _table: String,
                _schema: Option<String>,
                _pk_column: String,
                _pk_values: Vec<serde_json::Value>,
            ) -> Result<MutationResult, Error> {
                not_impl("WriteAdapter::delete_rows")
            }

            async fn duplicate_row(
                &self,
                _table: String,
                _schema: Option<String>,
                _pk_column: String,
                _pk_value: serde_json::Value,
            ) -> Result<MutationResult, Error> {
                not_impl("WriteAdapter::duplicate_row")
            }

            async fn truncate_table(
                &self,
                _table: String,
                _schema: Option<String>,
                _cascade: Option<bool>,
            ) -> Result<TruncateResult, Error> {
                not_impl("WriteAdapter::truncate_table")
            }

            async fn truncate_database(
                &self,
                _schema: Option<String>,
                _confirm: bool,
            ) -> Result<TruncateResult, Error> {
                not_impl("WriteAdapter::truncate_database")
            }

            async fn soft_delete_rows(
                &self,
                _table: String,
                _schema: Option<String>,
                _pk_column: String,
                _pk_values: Vec<serde_json::Value>,
                _soft_delete_column: Option<String>,
            ) -> Result<SoftDeleteResult, Error> {
                not_impl("WriteAdapter::soft_delete_rows")
            }

            async fn undo_soft_delete(
                &self,
                _table: String,
                _schema: Option<String>,
                _pk_column: String,
                _pk_values: Vec<serde_json::Value>,
                _soft_delete_column: String,
            ) -> Result<MutationResult, Error> {
                not_impl("WriteAdapter::undo_soft_delete")
            }

            async fn dump_database(&self, _output_path: String) -> Result<DumpResult, Error> {
                not_impl("WriteAdapter::dump_database")
            }

            async fn execute_batch(
                &self,
                _statements: Vec<String>,
            ) -> Result<MutationResult, Error> {
                not_impl("WriteAdapter::execute_batch")
            }
        }
    };
}

write_adapter_stub!(PostgresAdapter);
write_adapter_stub!(MySqlAdapter);
write_adapter_stub!(SqliteAdapter);
write_adapter_stub!(LibSqlAdapter);
