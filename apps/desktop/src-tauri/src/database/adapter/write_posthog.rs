//! PostHog write adapter — read-only.
//!
//! PostHog is an analytics data source browsed over the HogQL Query API; the
//! studio can never mutate it. Every `WriteAdapter` method therefore returns a
//! friendly read-only error. The UI also gates writes off via
//! `source_caps().is_readonly`, so these are a backstop that keeps the
//! `write_adapter_from_client` factory's exhaustive match total.

use async_trait::async_trait;

use super::read::PosthogAdapter;
use super::write::WriteAdapter;
use crate::database::maintenance::{DumpResult, SoftDeleteResult, TruncateResult};
use crate::database::services::mutation::MutationResult;
use crate::Error;

fn read_only<T>() -> Result<T, Error> {
    Err(Error::Any(anyhow::anyhow!(
        "PostHog is a read-only data source — it can be browsed and queried but not modified."
    )))
}

#[async_trait]
impl WriteAdapter for PosthogAdapter {
    async fn insert_row(
        &self,
        _table: String,
        _schema: Option<String>,
        _row_data: serde_json::Map<String, serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        read_only()
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
        read_only()
    }

    async fn delete_rows(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        read_only()
    }

    async fn duplicate_row(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        read_only()
    }

    async fn truncate_table(
        &self,
        _table: String,
        _schema: Option<String>,
        _cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        read_only()
    }

    async fn truncate_database(
        &self,
        _schema: Option<String>,
        _confirm: bool,
    ) -> Result<TruncateResult, Error> {
        read_only()
    }

    async fn soft_delete_rows(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_values: Vec<serde_json::Value>,
        _soft_delete_column: Option<String>,
    ) -> Result<SoftDeleteResult, Error> {
        read_only()
    }

    async fn undo_soft_delete(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_values: Vec<serde_json::Value>,
        _soft_delete_column: String,
    ) -> Result<MutationResult, Error> {
        read_only()
    }

    async fn dump_database(&self, _output_path: String) -> Result<DumpResult, Error> {
        read_only()
    }

    async fn execute_batch(&self, _statements: Vec<String>) -> Result<MutationResult, Error> {
        read_only()
    }
}
