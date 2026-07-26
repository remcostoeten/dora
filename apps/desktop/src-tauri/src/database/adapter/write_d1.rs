//! Cloudflare D1 write adapter.
//!
//! D1 is the SQLite dialect over an HTTP transport. The SQL this builds mirrors
//! `write_libsql.rs` (identifier quoting, `?` placeholders), but every statement
//! is executed via `D1Http::query`, which autocommits each call — D1 has no
//! interactive transactions, so `execute_batch` runs statements sequentially
//! rather than wrapping them in `BEGIN/COMMIT`.

use async_trait::async_trait;
use serde_json::Value;

use super::grid_sql;
use super::read::D1Adapter;
use super::write::WriteAdapter;
use crate::database::maintenance::{DumpResult, SoftDeleteResult, TruncateResult};
use crate::database::services::mutation::MutationResult;
use crate::Error;

/// Runs a single statement over HTTP and returns the rows it produced (empty for
/// writes) plus the `changes` counter from `meta`.
async fn run(
    adapter: &D1Adapter,
    sql: &str,
    params: Vec<Value>,
) -> Result<(Vec<crate::database::d1::D1Row>, usize), Error> {
    let result_sets = adapter.http().query(sql, params).await?;
    match result_sets.into_iter().next() {
        Some(set) => {
            let changes = set.meta.changes as usize;
            Ok((set.results, changes))
        }
        None => Ok((Vec::new(), 0)),
    }
}

#[async_trait]
impl WriteAdapter for D1Adapter {
    async fn insert_row(
        &self,
        table: String,
        _schema: Option<String>,
        row_data: serde_json::Map<String, serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        if row_data.is_empty() {
            return Ok(MutationResult {
                success: false,
                affected_rows: 0,
                message: Some("No data to insert".to_string()),
            });
        }

        let query = grid_sql::insert_row_sql(&table, row_data.keys().map(String::as_str));
        let params: Vec<Value> = row_data.values().cloned().collect();

        let (_rows, changes) = run(self, &query, params).await?;
        Ok(MutationResult {
            success: true,
            affected_rows: changes.max(1),
            message: Some("Inserted 1 row".to_string()),
        })
    }

    async fn update_cell(
        &self,
        table: String,
        _schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
        new_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        let query = grid_sql::update_cell_sql(&table, &column, &pk_column);
        let (_rows, changes) = run(self, &query, vec![new_value, pk_value]).await?;
        Ok(MutationResult {
            success: changes > 0,
            affected_rows: changes,
            message: if changes > 0 {
                Some(format!("Updated {} row(s)", changes))
            } else {
                Some("No rows were updated".to_string())
            },
        })
    }

    async fn delete_rows(
        &self,
        table: String,
        _schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        if pk_values.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No rows to delete".to_string()),
            });
        }

        let query = grid_sql::delete_rows_sql(&table, &pk_column, pk_values.len());
        let (_rows, changes) = run(self, &query, pk_values).await?;
        Ok(MutationResult {
            success: changes > 0,
            affected_rows: changes,
            message: Some(format!("Deleted {} row(s)", changes)),
        })
    }

    async fn duplicate_row(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        let query = grid_sql::select_row_sql(&table, &pk_column);
        let (rows, _changes) = run(self, &query, vec![pk_value]).await?;
        let row = rows.into_iter().next().ok_or_else(|| {
            Error::Any(anyhow::anyhow!(
                "No row found in \"{}\" where {} matches the provided primary key",
                table,
                pk_column
            ))
        })?;

        let mut data = serde_json::Map::new();
        for (name, value) in row.0 {
            data.insert(name, value);
        }
        data.remove(&pk_column);

        if data.is_empty() {
            return Err(Error::Any(anyhow::anyhow!(
                "Cannot duplicate row because only the primary key column is available"
            )));
        }

        self.insert_row(table, schema, data).await
    }

    async fn truncate_table(
        &self,
        table: String,
        _schema: Option<String>,
        _cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        // SQLite/D1 has no TRUNCATE; an unfiltered DELETE is the equivalent.
        let query = grid_sql::delete_all_sql(&table);
        let (_rows, changes) = run(self, &query, Vec::new()).await?;
        Ok(TruncateResult {
            success: true,
            affected_rows: changes,
            tables_truncated: vec![table],
            message: Some(format!("Deleted {} row(s)", changes)),
        })
    }

    async fn truncate_database(
        &self,
        _schema: Option<String>,
        _confirm: bool,
    ) -> Result<TruncateResult, Error> {
        Err(Error::NotImplemented(
            "WriteAdapter::truncate_database for Cloudflare D1",
        ))
    }

    async fn soft_delete_rows(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_values: Vec<serde_json::Value>,
        _soft_delete_column: Option<String>,
    ) -> Result<SoftDeleteResult, Error> {
        Err(Error::NotImplemented(
            "WriteAdapter::soft_delete_rows for Cloudflare D1",
        ))
    }

    async fn undo_soft_delete(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_values: Vec<serde_json::Value>,
        _soft_delete_column: String,
    ) -> Result<MutationResult, Error> {
        Err(Error::NotImplemented(
            "WriteAdapter::undo_soft_delete for Cloudflare D1",
        ))
    }

    async fn dump_database(&self, _output_path: String) -> Result<DumpResult, Error> {
        Err(Error::NotImplemented(
            "WriteAdapter::dump_database for Cloudflare D1",
        ))
    }

    async fn execute_batch(&self, statements: Vec<String>) -> Result<MutationResult, Error> {
        if statements.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No statements to execute".to_string()),
            });
        }

        // D1 autocommits each /query call, so there is no interactive
        // transaction to wrap the batch in — run each statement in order.
        let mut affected_rows = 0usize;
        for stmt in &statements {
            let (_rows, changes) = run(self, stmt, Vec::new()).await?;
            affected_rows += changes;
        }

        Ok(MutationResult {
            success: true,
            affected_rows,
            message: Some(format!("Executed {} statements", statements.len())),
        })
    }
}
