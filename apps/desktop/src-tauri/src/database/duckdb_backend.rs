//! Process-agnostic handle to a single DuckDB connection.
//!
//! Today the only implementation runs DuckDB in-process. The helper-process
//! work (see `docs/duckdb-helper-process.md`) adds an IPC implementation so the
//! main binary no longer links the DuckDB engine — it is downloaded on first
//! use and driven through a small sidecar.
//!
//! Every method takes and returns serde-serialisable types so the exact same
//! surface works unchanged over a pipe. This mirrors the existing
//! `DatabaseAdapter` (read), `WriteAdapter`, and `WatchAdapter` surfaces plus
//! the DuckDB-only operations (counts, file-source registration, import,
//! session materialisation, and the two ad-hoc raw queries).

use std::sync::Arc;
#[cfg(feature = "duckdb-engine")]
use std::sync::Mutex;

use async_trait::async_trait;

#[cfg(feature = "duckdb-engine")]
use crate::database::adapter::{
    read::{DatabaseAdapter, DuckDbAdapter},
    watch::WatchAdapter,
    write::WriteAdapter,
};
use crate::{
    database::{
        duckdb::{
            file_source::DataFileSourceEntry, import_files::ImportFilesIntoDuckDbResult,
            save_session::SaveDataFileSessionResult,
        },
        maintenance::{DumpResult, SoftDeleteResult, TruncateResult},
        parser::ParsedStatement,
        services::mutation::MutationResult,
        types::{DatabaseSchema, ExecSender},
    },
    Error,
};

/// Shared handle to one DuckDB connection. Cheap to clone (`Arc`).
pub type BoxedDuckDbConn = Arc<dyn DuckDbConn>;

/// One DuckDB connection's full operation surface, independent of whether the
/// engine runs in this process or in the helper.
#[async_trait]
pub trait DuckDbConn: Send + Sync + std::fmt::Debug {
    // ---- read / query ----

    /// Run a parsed statement, streaming `QueryExecEvent`s (TypesResolved →
    /// Page(s of 50) → Finished) through `sender`. Mirrors
    /// `DatabaseAdapter::execute_query`.
    async fn execute_query(&self, stmt: ParsedStatement, sender: &ExecSender)
        -> Result<(), Error>;

    /// Full schema introspection (tables, columns, indexes, foreign keys,
    /// views). Mirrors `DatabaseAdapter::get_schema`.
    async fn get_schema(&self) -> Result<DatabaseSchema, Error>;

    /// Whether the underlying connection is live.
    fn is_connected(&self) -> bool;

    /// Column names + JSON rows for ad-hoc internal callers that bypass the
    /// streaming page protocol (`fetch_duckdb_data`, seeding previews).
    async fn query_raw(
        &self,
        sql: String,
    ) -> Result<(Vec<String>, Vec<Vec<serde_json::Value>>), Error>;

    /// Parameterless statement execution returning the affected row count
    /// (seeding inserts).
    async fn execute_raw(&self, sql: String) -> Result<usize, Error>;

    // ---- write (mirrors WriteAdapter) ----

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

    async fn get_blob_bytes(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
    ) -> Result<Vec<u8>, Error>;

    // ---- watch ----

    /// Stable hash of a table's rows for live-monitor change detection. Mirrors
    /// `WatchAdapter::poll_table_hash` with owned args (pipe-friendly).
    async fn poll_table_hash(
        &self,
        table: String,
        schema: Option<String>,
    ) -> Result<u64, Error>;

    // ---- metadata ----

    /// Table count + estimated row count (`duckdb_tables()`).
    async fn get_counts(&self) -> Result<(u32, u64), Error>;

    // ---- data-file sources / import / save ----

    /// Register CSV/Parquet/JSON files as read-only views, reporting per-source
    /// status.
    async fn register_sources(
        &self,
        sources: Vec<String>,
    ) -> Result<Vec<DataFileSourceEntry>, Error>;

    /// Import files into physical `main` tables.
    async fn import_files(
        &self,
        file_paths: Vec<String>,
    ) -> Result<ImportFilesIntoDuckDbResult, Error>;

    /// Materialise the active data-file views into a destination `.duckdb` file.
    async fn materialize_data_file_session(
        &self,
        entries: Vec<DataFileSourceEntry>,
        destination_path: String,
        overwrite: bool,
    ) -> Result<SaveDataFileSessionResult, Error>;
}

/// In-process `DuckDbConn`: the engine runs in this process, linked via the
/// `duckdb` crate. This is compiled only into the helper-side engine build.
#[cfg(feature = "duckdb-engine")]
pub struct InProcessDuckDbConn {
    connection: Arc<Mutex<duckdb::Connection>>,
    /// True for file-source (CSV/Parquet/JSON view) connections, which refuse
    /// mutations.
    read_only: bool,
}

#[cfg(feature = "duckdb-engine")]
impl std::fmt::Debug for InProcessDuckDbConn {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("InProcessDuckDbConn")
            .field("read_only", &self.read_only)
            .finish_non_exhaustive()
    }
}

#[cfg(feature = "duckdb-engine")]
impl InProcessDuckDbConn {
    pub fn new(connection: duckdb::Connection, read_only: bool) -> Self {
        Self {
            connection: Arc::new(Mutex::new(connection)),
            read_only,
        }
    }

    fn adapter(&self) -> DuckDbAdapter {
        DuckDbAdapter::new_with_read_only(self.connection.clone(), self.read_only)
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, duckdb::Connection>, Error> {
        self.connection
            .lock()
            .map_err(|_| Error::Internal("DuckDB connection mutex poisoned".into()))
    }
}

#[cfg(feature = "duckdb-engine")]
#[async_trait]
impl DuckDbConn for InProcessDuckDbConn {
    async fn execute_query(
        &self,
        stmt: ParsedStatement,
        sender: &ExecSender,
    ) -> Result<(), Error> {
        self.adapter().execute_query(stmt, sender).await
    }

    async fn get_schema(&self) -> Result<DatabaseSchema, Error> {
        self.adapter().get_schema().await
    }

    fn is_connected(&self) -> bool {
        self.connection.lock().is_ok()
    }

    async fn query_raw(
        &self,
        sql: String,
    ) -> Result<(Vec<String>, Vec<Vec<serde_json::Value>>), Error> {
        let conn = self.lock()?;
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query([])?;
        let columns: Vec<String> = rows.as_ref().map(|s| s.column_names()).unwrap_or_default();
        let mut data = Vec::new();
        while let Some(row) = rows.next()? {
            let values: Vec<serde_json::Value> = (0..columns.len())
                .map(|i| {
                    row.get_ref(i)
                        .map(crate::database::duckdb::row_writer::value_ref_to_json)
                        .unwrap_or(serde_json::Value::Null)
                })
                .collect();
            data.push(values);
        }
        Ok((columns, data))
    }

    async fn execute_raw(&self, sql: String) -> Result<usize, Error> {
        let conn = self.lock()?;
        conn.execute(&sql, []).map_err(Into::into)
    }

    async fn insert_row(
        &self,
        table: String,
        schema: Option<String>,
        row_data: serde_json::Map<String, serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        self.adapter().insert_row(table, schema, row_data).await
    }

    async fn update_cell(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
        new_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        self.adapter()
            .update_cell(table, schema, pk_column, pk_value, column, new_value)
            .await
    }

    async fn delete_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        self.adapter()
            .delete_rows(table, schema, pk_column, pk_values)
            .await
    }

    async fn duplicate_row(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        self.adapter()
            .duplicate_row(table, schema, pk_column, pk_value)
            .await
    }

    async fn truncate_table(
        &self,
        table: String,
        schema: Option<String>,
        cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        self.adapter().truncate_table(table, schema, cascade).await
    }

    async fn truncate_database(
        &self,
        schema: Option<String>,
        confirm: bool,
    ) -> Result<TruncateResult, Error> {
        self.adapter().truncate_database(schema, confirm).await
    }

    async fn soft_delete_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
        soft_delete_column: Option<String>,
    ) -> Result<SoftDeleteResult, Error> {
        self.adapter()
            .soft_delete_rows(table, schema, pk_column, pk_values, soft_delete_column)
            .await
    }

    async fn undo_soft_delete(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
        soft_delete_column: String,
    ) -> Result<MutationResult, Error> {
        self.adapter()
            .undo_soft_delete(table, schema, pk_column, pk_values, soft_delete_column)
            .await
    }

    async fn dump_database(&self, output_path: String) -> Result<DumpResult, Error> {
        self.adapter().dump_database(output_path).await
    }

    async fn execute_batch(&self, statements: Vec<String>) -> Result<MutationResult, Error> {
        self.adapter().execute_batch(statements).await
    }

    async fn get_blob_bytes(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
    ) -> Result<Vec<u8>, Error> {
        self.adapter()
            .get_blob_bytes(table, schema, pk_column, pk_value, column)
            .await
    }

    async fn poll_table_hash(
        &self,
        table: String,
        schema: Option<String>,
    ) -> Result<u64, Error> {
        self.adapter()
            .poll_table_hash(&table, schema.as_deref())
            .await
    }

    async fn get_counts(&self) -> Result<(u32, u64), Error> {
        let conn = self.lock()?;
        crate::database::metadata::get_duckdb_counts(&conn)
    }

    async fn register_sources(
        &self,
        sources: Vec<String>,
    ) -> Result<Vec<DataFileSourceEntry>, Error> {
        let conn = self.lock()?;
        Ok(crate::database::duckdb::file_source::register_sources(
            &conn, &sources,
        ))
    }

    async fn import_files(
        &self,
        file_paths: Vec<String>,
    ) -> Result<ImportFilesIntoDuckDbResult, Error> {
        let conn = self.lock()?;
        crate::database::duckdb::import_files::import_files_into_duckdb(&conn, &file_paths)
            .map_err(Error::InvalidInput)
    }

    async fn materialize_data_file_session(
        &self,
        entries: Vec<DataFileSourceEntry>,
        destination_path: String,
        overwrite: bool,
    ) -> Result<SaveDataFileSessionResult, Error> {
        let conn = self.lock()?;
        crate::database::duckdb::save_session::materialize_data_file_session(
            &conn,
            &entries,
            &destination_path,
            overwrite,
        )
        .map_err(Error::InvalidInput)
    }
}

/// Open a DuckDB connection in this process and register any data-file sources.
/// Shared by the in-process backend path (`build_duckdb_backend`) and the
/// helper process's `Open` handler so both produce identical state.
#[cfg(feature = "duckdb-engine")]
pub fn open_in_process(
    db_path: &str,
    file_sources: &[String],
) -> Result<(BoxedDuckDbConn, Vec<DataFileSourceEntry>), Error> {
    let conn = if file_sources.is_empty() {
        duckdb::Connection::open(db_path)
    } else {
        duckdb::Connection::open_in_memory()
    }
    .map_err(|e| Error::ConnectionFailed(e.to_string()))?;

    let registration = if file_sources.is_empty() {
        Vec::new()
    } else {
        crate::database::duckdb::file_source::register_sources(&conn, file_sources)
    };

    let handle: BoxedDuckDbConn =
        Arc::new(InProcessDuckDbConn::new(conn, !file_sources.is_empty()));
    Ok((handle, registration))
}

/// Build a DuckDB connection handle through the helper process. Returns the
/// handle plus the registered data-file-source entries.
pub async fn build_duckdb_backend(
    db_path: &str,
    file_sources: &[String],
) -> Result<(BoxedDuckDbConn, Vec<DataFileSourceEntry>), Error> {
    crate::database::duckdb_ipc::client::open(db_path.to_string(), file_sources.to_vec()).await
}
