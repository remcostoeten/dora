//! Main-app side of the DuckDB helper transport.
//!
//! A single long-lived helper child serves every DuckDB connection. Requests
//! are multiplexed over its stdin/stdout by a monotonic `id`; a background
//! reader task fans responses back to per-request channels. Each logical
//! connection is an [`IpcDuckDbConn`] holding the shared process handle and its
//! `conn_id`.

use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};

use async_trait::async_trait;
use dashmap::DashMap;
use tokio::io::BufReader;
use tokio::process::{ChildStdin, Command};
use tokio::sync::{mpsc, Mutex};

use crate::{
    database::{
        duckdb::{
            file_source::DataFileSourceEntry, import_files::ImportFilesIntoDuckDbResult,
            save_session::SaveDataFileSessionResult,
        },
        duckdb_backend::{BoxedDuckDbConn, DuckDbConn},
        maintenance::{DumpResult, SoftDeleteResult, TruncateResult},
        parser::ParsedStatement,
        services::mutation::MutationResult,
        types::{DatabaseSchema, ExecSender},
    },
    Error,
};

use super::framing::{read_frame, write_frame};
use super::proto::{ConnId, Request, RequestFrame, RespPayload, ResponseFrame, ResponseMsg};

/// A spawned helper process plus its request multiplexer.
struct HelperProcess {
    stdin: Mutex<ChildStdin>,
    pending: DashMap<u64, mpsc::UnboundedSender<ResponseMsg>>,
    next_id: AtomicU64,
    alive: std::sync::atomic::AtomicBool,
    _child: tokio::sync::Mutex<tokio::process::Child>,
}

impl HelperProcess {
    fn spawn() -> Result<Arc<HelperProcess>, Error> {
        let path = helper_binary_path()?;
        let mut child = Command::new(&path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                Error::Internal(format!(
                    "failed to spawn DuckDB helper at {}: {e}",
                    path.display()
                ))
            })?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| Error::Internal("helper stdin missing".into()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| Error::Internal("helper stdout missing".into()))?;

        let proc = Arc::new(HelperProcess {
            stdin: Mutex::new(stdin),
            pending: DashMap::new(),
            next_id: AtomicU64::new(1),
            alive: std::sync::atomic::AtomicBool::new(true),
            _child: tokio::sync::Mutex::new(child),
        });

        let reader_proc = proc.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            loop {
                match read_frame::<_, ResponseFrame>(&mut reader).await {
                    Ok(Some(frame)) => {
                        // `Done` is terminal: forward it, then drop the pending
                        // entry so the map doesn't grow one slot per request.
                        let terminal = matches!(frame.msg, ResponseMsg::Done(_));
                        if let Some(tx) = reader_proc.pending.get(&frame.id) {
                            let _ = tx.send(frame.msg);
                        }
                        if terminal {
                            reader_proc.pending.remove(&frame.id);
                        }
                    }
                    Ok(None) => break,
                    Err(e) => {
                        log::error!("DuckDB helper read error: {e}");
                        break;
                    }
                }
            }
            reader_proc.fail_all();
        });

        Ok(proc)
    }

    /// Mark the process dead and drop all pending channels so in-flight requests
    /// observe a closed receiver and surface a connection error.
    fn fail_all(&self) {
        self.alive.store(false, Ordering::SeqCst);
        self.pending.clear();
    }

    fn is_alive(&self) -> bool {
        self.alive.load(Ordering::SeqCst)
    }

    async fn send(&self, req: Request) -> Result<mpsc::UnboundedReceiver<ResponseMsg>, Error> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = mpsc::unbounded_channel();
        self.pending.insert(id, tx);
        let frame = RequestFrame { id, req };
        let mut stdin = self.stdin.lock().await;
        if let Err(e) = write_frame(&mut *stdin, &frame).await {
            self.pending.remove(&id);
            self.fail_all();
            return Err(Error::Internal(format!("helper write failed: {e}")));
        }
        Ok(rx)
    }

    /// Issue a non-streaming request and await its single terminal payload.
    async fn request(&self, req: Request) -> Result<RespPayload, Error> {
        let mut rx = self.send(req).await?;
        match rx.recv().await {
            Some(ResponseMsg::Done(Ok(payload))) => Ok(payload),
            Some(ResponseMsg::Done(Err(e))) => Err(e.into()),
            Some(ResponseMsg::Event(_)) => Err(Error::Internal(
                "unexpected stream event for unary request".into(),
            )),
            None => Err(Error::Internal("DuckDB helper closed connection".into())),
        }
    }
}

/// Process-wide lazily-spawned helper. Respawned on demand if it has died.
static MANAGER: OnceLock<Mutex<Option<Arc<HelperProcess>>>> = OnceLock::new();

async fn get_or_spawn() -> Result<Arc<HelperProcess>, Error> {
    let slot = MANAGER.get_or_init(|| Mutex::new(None));
    let mut guard = slot.lock().await;
    if let Some(proc) = guard.as_ref() {
        if proc.is_alive() {
            return Ok(proc.clone());
        }
    }
    let proc = HelperProcess::spawn()?;
    *guard = Some(proc.clone());
    Ok(proc)
}

fn helper_binary_path() -> Result<PathBuf, Error> {
    if let Some(p) = std::env::var_os("DORA_DUCKDB_HELPER") {
        return Ok(PathBuf::from(p));
    }
    let exe = std::env::current_exe()
        .map_err(|e| Error::Internal(format!("cannot resolve current exe: {e}")))?;
    let dir = exe
        .parent()
        .ok_or_else(|| Error::Internal("current exe has no parent dir".into()))?;
    let name = if cfg!(windows) {
        "duckdb_helper.exe"
    } else {
        "duckdb_helper"
    };
    let candidates = [dir.join("binaries").join(name), dir.join(name)];
    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(Error::Internal(format!(
        "DuckDB helper binary not found near {} (set DORA_DUCKDB_HELPER to override)",
        dir.display()
    )))
}

/// Open a DuckDB connection in the helper and return a handle plus the
/// registered data-file-source entries.
pub async fn open(
    db_path: String,
    file_sources: Vec<String>,
) -> Result<(BoxedDuckDbConn, Vec<DataFileSourceEntry>), Error> {
    let proc = get_or_spawn().await?;
    let payload = proc
        .request(Request::Open {
            db_path,
            file_sources,
        })
        .await?;
    match payload {
        RespPayload::Opened { conn_id, entries } => {
            let conn: BoxedDuckDbConn = Arc::new(IpcDuckDbConn {
                proc,
                conn_id,
            });
            Ok((conn, entries))
        }
        other => Err(unexpected(other)),
    }
}

fn unexpected(p: RespPayload) -> Error {
    Error::Internal(format!("unexpected helper response: {p:?}"))
}

/// One DuckDB connection served by the helper process.
pub struct IpcDuckDbConn {
    proc: Arc<HelperProcess>,
    conn_id: ConnId,
}

impl std::fmt::Debug for IpcDuckDbConn {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("IpcDuckDbConn")
            .field("conn_id", &self.conn_id)
            .finish_non_exhaustive()
    }
}

impl Drop for IpcDuckDbConn {
    fn drop(&mut self) {
        if !self.proc.is_alive() {
            return;
        }
        // Best-effort close. `tokio::spawn` panics outside a runtime (e.g. drop
        // during shutdown), so only schedule it when one is active — a leaked
        // helper-side connection is harmless and reclaimed when the helper exits.
        let Ok(handle) = tokio::runtime::Handle::try_current() else {
            return;
        };
        let proc = self.proc.clone();
        let conn_id = self.conn_id;
        handle.spawn(async move {
            let _ = proc.send(Request::Close { conn_id }).await;
        });
    }
}

#[async_trait]
impl DuckDbConn for IpcDuckDbConn {
    async fn execute_query(
        &self,
        stmt: ParsedStatement,
        sender: &ExecSender,
    ) -> Result<(), Error> {
        let mut rx = self
            .proc
            .send(Request::ExecuteQuery {
                conn_id: self.conn_id,
                stmt,
            })
            .await?;
        loop {
            match rx.recv().await {
                Some(ResponseMsg::Event(ev)) => {
                    if sender.send(ev.into()).is_err() {
                        return Err(Error::Internal(
                            "query event receiver dropped".into(),
                        ));
                    }
                }
                Some(ResponseMsg::Done(Ok(_))) => return Ok(()),
                Some(ResponseMsg::Done(Err(e))) => return Err(e.into()),
                None => return Err(Error::Internal("DuckDB helper closed connection".into())),
            }
        }
    }

    async fn get_schema(&self) -> Result<DatabaseSchema, Error> {
        match self
            .proc
            .request(Request::GetSchema {
                conn_id: self.conn_id,
            })
            .await?
        {
            RespPayload::Schema(s) => Ok(s),
            other => Err(unexpected(other)),
        }
    }

    fn is_connected(&self) -> bool {
        self.proc.is_alive()
    }

    async fn query_raw(
        &self,
        sql: String,
    ) -> Result<(Vec<String>, Vec<Vec<serde_json::Value>>), Error> {
        match self
            .proc
            .request(Request::QueryRaw {
                conn_id: self.conn_id,
                sql,
            })
            .await?
        {
            RespPayload::QueryRaw { columns, rows } => Ok((columns, rows)),
            other => Err(unexpected(other)),
        }
    }

    async fn execute_raw(&self, sql: String) -> Result<usize, Error> {
        match self
            .proc
            .request(Request::ExecRaw {
                conn_id: self.conn_id,
                sql,
            })
            .await?
        {
            RespPayload::ExecRaw { affected } => Ok(affected),
            other => Err(unexpected(other)),
        }
    }

    async fn insert_row(
        &self,
        table: String,
        schema: Option<String>,
        row_data: serde_json::Map<String, serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        self.mutation(Request::InsertRow {
            conn_id: self.conn_id,
            table,
            schema,
            row_data,
        })
        .await
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
        self.mutation(Request::UpdateCell {
            conn_id: self.conn_id,
            table,
            schema,
            pk_column,
            pk_value,
            column,
            new_value,
        })
        .await
    }

    async fn delete_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        self.mutation(Request::DeleteRows {
            conn_id: self.conn_id,
            table,
            schema,
            pk_column,
            pk_values,
        })
        .await
    }

    async fn duplicate_row(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        self.mutation(Request::DuplicateRow {
            conn_id: self.conn_id,
            table,
            schema,
            pk_column,
            pk_value,
        })
        .await
    }

    async fn truncate_table(
        &self,
        table: String,
        schema: Option<String>,
        cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        match self
            .proc
            .request(Request::TruncateTable {
                conn_id: self.conn_id,
                table,
                schema,
                cascade,
            })
            .await?
        {
            RespPayload::Truncate(r) => Ok(r),
            other => Err(unexpected(other)),
        }
    }

    async fn truncate_database(
        &self,
        schema: Option<String>,
        confirm: bool,
    ) -> Result<TruncateResult, Error> {
        match self
            .proc
            .request(Request::TruncateDatabase {
                conn_id: self.conn_id,
                schema,
                confirm,
            })
            .await?
        {
            RespPayload::Truncate(r) => Ok(r),
            other => Err(unexpected(other)),
        }
    }

    async fn soft_delete_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
        soft_delete_column: Option<String>,
    ) -> Result<SoftDeleteResult, Error> {
        match self
            .proc
            .request(Request::SoftDeleteRows {
                conn_id: self.conn_id,
                table,
                schema,
                pk_column,
                pk_values,
                soft_delete_column,
            })
            .await?
        {
            RespPayload::SoftDelete(r) => Ok(r),
            other => Err(unexpected(other)),
        }
    }

    async fn undo_soft_delete(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
        soft_delete_column: String,
    ) -> Result<MutationResult, Error> {
        self.mutation(Request::UndoSoftDelete {
            conn_id: self.conn_id,
            table,
            schema,
            pk_column,
            pk_values,
            soft_delete_column,
        })
        .await
    }

    async fn dump_database(&self, output_path: String) -> Result<DumpResult, Error> {
        match self
            .proc
            .request(Request::DumpDatabase {
                conn_id: self.conn_id,
                output_path,
            })
            .await?
        {
            RespPayload::Dump(r) => Ok(r),
            other => Err(unexpected(other)),
        }
    }

    async fn execute_batch(&self, statements: Vec<String>) -> Result<MutationResult, Error> {
        self.mutation(Request::ExecuteBatch {
            conn_id: self.conn_id,
            statements,
        })
        .await
    }

    async fn get_blob_bytes(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
    ) -> Result<Vec<u8>, Error> {
        match self
            .proc
            .request(Request::GetBlobBytes {
                conn_id: self.conn_id,
                table,
                schema,
                pk_column,
                pk_value,
                column,
            })
            .await?
        {
            RespPayload::Blob(b) => Ok(b),
            other => Err(unexpected(other)),
        }
    }

    async fn poll_table_hash(
        &self,
        table: String,
        schema: Option<String>,
    ) -> Result<u64, Error> {
        match self
            .proc
            .request(Request::PollTableHash {
                conn_id: self.conn_id,
                table,
                schema,
            })
            .await?
        {
            RespPayload::Hash(h) => Ok(h),
            other => Err(unexpected(other)),
        }
    }

    async fn get_counts(&self) -> Result<(u32, u64), Error> {
        match self
            .proc
            .request(Request::GetCounts {
                conn_id: self.conn_id,
            })
            .await?
        {
            RespPayload::Counts { tables, rows } => Ok((tables, rows)),
            other => Err(unexpected(other)),
        }
    }

    async fn register_sources(
        &self,
        sources: Vec<String>,
    ) -> Result<Vec<DataFileSourceEntry>, Error> {
        match self
            .proc
            .request(Request::RegisterSources {
                conn_id: self.conn_id,
                sources,
            })
            .await?
        {
            RespPayload::Sources(s) => Ok(s),
            other => Err(unexpected(other)),
        }
    }

    async fn import_files(
        &self,
        file_paths: Vec<String>,
    ) -> Result<ImportFilesIntoDuckDbResult, Error> {
        match self
            .proc
            .request(Request::ImportFiles {
                conn_id: self.conn_id,
                file_paths,
            })
            .await?
        {
            RespPayload::Import(r) => Ok(r),
            other => Err(unexpected(other)),
        }
    }

    async fn materialize_data_file_session(
        &self,
        entries: Vec<DataFileSourceEntry>,
        destination_path: String,
        overwrite: bool,
    ) -> Result<SaveDataFileSessionResult, Error> {
        match self
            .proc
            .request(Request::MaterializeDataFileSession {
                conn_id: self.conn_id,
                entries,
                destination_path,
                overwrite,
            })
            .await?
        {
            RespPayload::Materialize(r) => Ok(r),
            other => Err(unexpected(other)),
        }
    }
}

impl IpcDuckDbConn {
    async fn mutation(&self, req: Request) -> Result<MutationResult, Error> {
        match self.proc.request(req).await? {
            RespPayload::Mutation(r) => Ok(r),
            other => Err(unexpected(other)),
        }
    }
}
