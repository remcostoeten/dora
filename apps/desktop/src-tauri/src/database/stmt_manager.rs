use std::{
    sync::{
        atomic::{AtomicU8, AtomicUsize, Ordering},
        Arc, RwLock,
    },
    time::Duration,
};

use anyhow::Context;
use serde_json::value::RawValue;
use tauri::async_runtime::{spawn, spawn_blocking, JoinHandle};
use tokio::sync::{oneshot, watch};
use tokio_postgres::{config::SslMode, NoTls};
use uuid::Uuid;

use dashmap::DashMap;

use crate::database::postgres::connect::no_verify_tls;

use crate::{
    database::{
        mysql,
        parser::ParsedStatement,
        postgres, sqlite,
        types::{
            channel, DatabaseClient, ExecSender, Page, QueryEvent, QueryId, QueryStatus,
            StatementInfo, StatementResult,
        },
        QueryExecEvent,
    },
    Error,
};

/// Logs the outcome of an executor task and makes sure a failure reaches the
/// statement. A `Cancelled` error here is benign: it means the results
/// channel's consumer was aborted (cancellation or a superseding query), so the
/// executor's send failed. Those are logged at debug to avoid noisy error-level
/// "channel closed" spam on every query cancel.
///
/// Several executors (MySQL, libSQL) return their error with `?` and never send
/// `Finished`, which left the statement `Running` until the caller's 30 second
/// give-up hid the real message. The error is sent here instead. An executor
/// that did report its own failure already ended the listener with that first
/// `Finished`, so this second one is never read.
fn report_query_exec_outcome(engine: &str, result: Result<(), Error>, sender: &ExecSender) {
    let Err(err) = result else {
        return;
    };
    if matches!(err, Error::Cancelled) {
        log::debug!(
            "{} query stopped: results consumer dropped (cancelled)",
            engine
        );
        return;
    }

    log::error!("Error executing {} query: {}", engine, err);
    let _ = sender.send(QueryExecEvent::Finished {
        elapsed_ms: 0,
        affected_rows: 0,
        error: Some(err.to_string()),
    });
}

/// Row-result storage for a statement. Only row-returning statements (a SELECT,
/// a `… RETURNING` DML, etc.) carry pages and columns; everything else carries
/// no row data, so those fields cannot be touched for it. Replaces a former
/// `returns_values: bool` that left page/column state representable for
/// statements that never produce rows.
enum ExecResult {
    /// The statement streams rows back: collected pages, received-row count, and
    /// the resolved column metadata.
    Rows {
        pages: RwLock<Vec<Page>>,
        rows_received: RwLock<usize>,
        columns: RwLock<Option<Box<RawValue>>>,
    },
    /// The statement returns no rows (DML/DDL without `RETURNING`); only the
    /// shared `rows_affected` on `ExecState` is meaningful.
    NoRows,
}

/// Everything needed to cancel a running Postgres/CockroachDB statement on the
/// server. Aborting the local executor future only drops our end of the socket;
/// the backend keeps executing the (possibly expensive) query. A real cancel
/// opens a fresh short-lived connection and issues a `CancelRequest`, so we hold
/// the `CancelToken` plus the SSL mode needed to reconnect the same way the live
/// connection did.
struct PgCancel {
    token: tokio_postgres::CancelToken,
    ssl_mode: tokio_postgres::config::SslMode,
}

/// The storage/state for an individual statement being executed
struct ExecState {
    started: std::time::Instant,
    connection_id: Uuid,
    status: AtomicU8,
    error: RwLock<Option<String>>,
    result: ExecResult,
    rows_affected: RwLock<Option<usize>>,
    sqlite_interrupt_handle: RwLock<Option<rusqlite::InterruptHandle>>,
    pg_cancel: RwLock<Option<PgCancel>>,
    event_channel: Option<tauri::ipc::Channel<QueryEvent>>,
    /// Flips to `true` once the statement is `Completed` or `Error`, so a
    /// caller can sleep until then instead of polling the status.
    finished: watch::Sender<bool>,
}

impl ExecState {
    fn is_finished(&self) -> bool {
        let status = self.status.load(Ordering::Relaxed);
        status == QueryStatus::Completed as u8 || status == QueryStatus::Error as u8
    }

    /// Moves the statement to its terminal state and wakes every waiter. The
    /// first outcome wins: a cancellation is never overwritten by a late
    /// executor event, and a finished statement is never re-marked. Returns
    /// whether this call was the one that finished it.
    fn finish(&self, outcome: Result<usize, String>) -> bool {
        // The error lock doubles as the transition lock, so two finishers
        // cannot interleave their writes.
        let mut error = self.error.write().expect("RwLock poisoned");
        if self.is_finished() {
            return false;
        }

        match outcome {
            Ok(affected_rows) => {
                *self.rows_affected.write().expect("RwLock poisoned") = Some(affected_rows);
                self.status
                    .store(QueryStatus::Completed as u8, Ordering::Relaxed);
            }
            Err(message) => {
                *error = Some(message);
                self.status
                    .store(QueryStatus::Error as u8, Ordering::Relaxed);
            }
        }
        drop(error);

        crate::database::perf_metrics::record("query_total", self.started, self.connection_id);
        self.finished.send_replace(true);
        true
    }

    fn info(&self) -> StatementInfo {
        let (returns_values, first_page, page_count, rows_received) = match &self.result {
            ExecResult::Rows {
                pages,
                rows_received,
                ..
            } => {
                let pages = pages.read().expect("RwLock poisoned");
                (
                    true,
                    pages.first().cloned(),
                    pages.len(),
                    *rows_received.read().expect("RwLock poisoned"),
                )
            }
            ExecResult::NoRows => (false, None, 0, 0),
        };

        StatementInfo {
            returns_values,
            status: self.status.load(Ordering::Relaxed).into(),
            first_page,
            affected_rows: *self.rows_affected.read().expect("RwLock poisoned"),
            page_count,
            rows_received,
            error: self.error.read().expect("RwLock poisoned").clone(),
        }
    }

    fn columns(&self) -> Option<Box<RawValue>> {
        match &self.result {
            ExecResult::Rows { columns, .. } => columns.read().expect("RwLock poisoned").clone(),
            ExecResult::NoRows => None,
        }
    }
}

/// Signals the database engine itself to stop a running statement: interrupts
/// SQLite, and for Postgres/CockroachDB issues a real `CancelRequest` over a
/// fresh connection — aborting the executor future alone only drops our
/// socket while the server keeps running the (possibly expensive) query.
/// Best-effort and fire-and-forget; the caller still aborts the executor.
fn signal_engine_cancel(entry: &ExecState) {
    if let Some(handle) = entry
        .sqlite_interrupt_handle
        .read()
        .expect("RwLock poisoned")
        .as_ref()
    {
        handle.interrupt();
    }

    if let Some(pg) = entry.pg_cancel.read().expect("RwLock poisoned").as_ref() {
        let token = pg.token.clone();
        let ssl_mode = pg.ssl_mode;
        spawn(async move {
            // Mirror the SSL strategy `postgres::connect::connect` uses so the
            // cancel connection negotiates the same way the live one did
            // (encrypt-only, no cert verification, which is enough for a
            // single control message).
            let outcome = match ssl_mode {
                SslMode::Require | SslMode::Prefer => token.cancel_query(no_verify_tls()).await,
                _ => token.cancel_query(NoTls).await,
            };
            if let Err(err) = outcome {
                log::warn!("Postgres cancel request failed: {err}");
            }
        });
    }
}

/// How many finished statements to keep addressable before the oldest are
/// reaped. Submissions no longer wipe the map, so this is what bounds memory;
/// it must stay comfortably above the largest batch a single view issues (the
/// analytics dashboard fires six at once) so a caller can never have its own
/// results pruned out from under it while it is still polling.
const MAX_RETAINED_QUERIES: usize = 64;

/// Error recorded for a statement whose executor went away without reporting
/// an outcome.
const EXECUTOR_STOPPED_MESSAGE: &str = "Query failed: the executor stopped before it finished";

/// Executes and keeps track of the execution of queries.
pub struct StatementManager {
    queries: DashMap<QueryId, Arc<ExecState>>,
    execution_handles: DashMap<QueryId, JoinHandle<()>>,
    listener_handles: DashMap<QueryId, tokio::task::JoinHandle<()>>,
    /// Hands out globally unique `QueryId`s. Statement ids used to restart from
    /// `0` on every submission, so two concurrent submissions both got id `0`
    /// and each overwrote the other's results.
    next_id: AtomicUsize,
}

impl std::fmt::Debug for StatementManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "StatementManager")
    }
}

#[allow(clippy::new_without_default)]
impl StatementManager {
    pub fn new() -> Self {
        Self {
            queries: DashMap::new(),
            execution_handles: DashMap::new(),
            listener_handles: DashMap::new(),
            next_id: AtomicUsize::new(0),
        }
    }

    /// Cancels all currently running queries, marking them as errors and aborting their listener tasks.
    pub fn cancel_active_queries(&self) {
        let active_ids: Vec<QueryId> = self
            .queries
            .iter()
            .filter(|entry| {
                let status = entry.status.load(Ordering::Relaxed);
                status == QueryStatus::Running as u8 || status == QueryStatus::Pending as u8
            })
            .map(|entry| *entry.key())
            .collect();

        self.cancel_queries(&active_ids);

        self.execution_handles.clear();
        self.listener_handles.clear();
    }

    /// Cancels only the given statements, so one SQL-console tab can cancel its
    /// own query without killing queries running in other tabs.
    pub fn cancel_queries(&self, query_ids: &[QueryId]) {
        let started = std::time::Instant::now();
        for query_id in query_ids {
            let Some(entry) = self.queries.get(query_id) else {
                continue;
            };
            // Marked before the engine is signalled: an interrupted executor
            // reports its own error, and that must not replace this one.
            if !entry.finish(Err("Query cancelled".to_string())) {
                continue;
            }

            crate::database::perf_metrics::record("query_cancel", started, entry.connection_id);
            signal_engine_cancel(&entry);

            if let Some((_, handle)) = self.execution_handles.remove(query_id) {
                handle.abort();
            }

            if let Some(channel) = &entry.event_channel {
                let _ = channel.send(QueryEvent::Error {
                    query_id: *query_id,
                    message: "Query cancelled".to_string(),
                });
            }

            if let Some((_, handle)) = self.listener_handles.remove(query_id) {
                handle.abort();
            }
        }
    }

    pub fn cancel_connection_queries(&self, connection_id: Uuid) {
        let query_ids = self
            .queries
            .iter()
            .filter(|entry| entry.connection_id == connection_id)
            .map(|entry| *entry.key())
            .collect::<Vec<_>>();
        self.cancel_queries(&query_ids);
    }

    /// Submits a new query (possibly containing multiple statements) for execution.
    ///
    /// Each statement gets a globally unique `QueryId`, so concurrent submissions
    /// (the analytics dashboard runs six at once) never collide. This does *not*
    /// cancel queries already in flight — callers that need to supersede their
    /// previous run, like the SQL console, call `cancel_query` first.
    #[cfg(test)]
    pub fn submit_query(&self, client: DatabaseClient, query: &str) -> Result<Vec<QueryId>, Error> {
        self.submit_query_for_connection(Uuid::nil(), client, query)
    }

    pub fn submit_query_for_connection(
        &self,
        connection_id: Uuid,
        client: DatabaseClient,
        query: &str,
    ) -> Result<Vec<QueryId>, Error> {
        self.submit_query_for_connection_with_channel(connection_id, client, query, None)
    }

    pub fn submit_query_for_connection_with_channel(
        &self,
        connection_id: Uuid,
        client: DatabaseClient,
        query: &str,
        event_channel: Option<tauri::ipc::Channel<QueryEvent>>,
    ) -> Result<Vec<QueryId>, Error> {
        let parse_statements: fn(&str) -> Result<Vec<ParsedStatement>, anyhow::Error> =
            match &client {
                DatabaseClient::Postgres { .. } => postgres::parser::parse_statements,
                DatabaseClient::SQLite { .. } => sqlite::parser::parse_statements,
                DatabaseClient::DuckDB { .. } => crate::database::duckdb::parser::parse_statements,
                DatabaseClient::LibSQL { .. } => |query| {
                    crate::database::libsql::parser::parse_statements(query)
                        .map_err(|e| anyhow::anyhow!("{}", e))
                },
                DatabaseClient::MySQL { .. } => mysql::parser::parse_statements,
                DatabaseClient::D1 { .. } => sqlite::parser::parse_statements,
                DatabaseClient::Posthog { .. } => sqlite::parser::parse_statements,
            };

        let statements = parse_statements(query)?;
        let mut query_ids = Vec::with_capacity(statements.len());
        let mut start_gate = None;

        for statement in statements {
            let id = self.next_id.fetch_add(1, Ordering::Relaxed);
            let (finished_tx, finished_rx) = oneshot::channel();
            self.create_worker(
                id,
                connection_id,
                client.clone(),
                statement,
                start_gate,
                Some(finished_tx),
                event_channel.clone(),
            );
            start_gate = Some(finished_rx);
            query_ids.push(id);
        }

        self.reap_finished_queries();

        Ok(query_ids)
    }

    /// Drops the oldest *finished* statements once the map outgrows
    /// `MAX_RETAINED_QUERIES`. Running and pending statements are never reaped,
    /// so this can't pull results out from under an in-flight poll.
    fn reap_finished_queries(&self) {
        let excess = self.queries.len().saturating_sub(MAX_RETAINED_QUERIES);
        if excess == 0 {
            return;
        }

        let mut finished = self
            .queries
            .iter()
            .filter(|entry| {
                let status = entry.status.load(Ordering::Relaxed);
                status == QueryStatus::Completed as u8 || status == QueryStatus::Error as u8
            })
            .map(|entry| *entry.key())
            .collect::<Vec<_>>();
        finished.sort_unstable();

        for id in finished.into_iter().take(excess) {
            self.queries.remove(&id);
            self.execution_handles.remove(&id);
            self.listener_handles.remove(&id);
        }
    }

    /// Fetches some general data on a query execution.
    /// Useful for the front-end to poll the execution status, mainly when it is still trying to load the first page of results
    pub fn fetch_query(&self, query_id: QueryId) -> Result<StatementInfo, Error> {
        Ok(self.get(query_id)?.info())
    }

    /// Sleeps until the statement is `Completed` or `Error`, then returns its
    /// columns, first page and counts together, so a caller needs neither a
    /// status poll nor a separate column fetch. When `timeout` elapses first
    /// the statement keeps running and the snapshot still reports `Running`.
    pub async fn wait_for_statement(
        &self,
        query_id: QueryId,
        timeout: Duration,
    ) -> Result<StatementResult, Error> {
        // Cloned out so the map entry is not held across the await.
        let exec_state = Arc::clone(&*self.get(query_id)?);
        let mut finished = exec_state.finished.subscribe();
        let _ = tokio::time::timeout(timeout, finished.wait_for(|done| *done)).await;

        let info = exec_state.info();
        Ok(StatementResult {
            query_id,
            status: info.status,
            columns: exec_state.columns(),
            first_page: info.first_page,
            page_count: info.page_count,
            rows_received: info.rows_received,
            affected_rows: info.affected_rows,
            error: info.error,
        })
    }

    /// Fetches a page of results for a given query.
    pub fn fetch_page(&self, query_id: QueryId, page_idx: usize) -> Result<Option<Page>, Error> {
        let exec_state = self.get(query_id)?;
        match &exec_state.result {
            ExecResult::Rows { pages, .. } => Ok(pages
                .read()
                .expect("RwLock poisoned")
                .get(page_idx)
                .cloned()),
            ExecResult::NoRows => Ok(None),
        }
    }

    pub fn get_query_status(&self, query_id: QueryId) -> Result<QueryStatus, Error> {
        let exec_state = self.get(query_id)?;

        Ok(exec_state.status.load(Ordering::Relaxed).into())
    }

    pub fn get_page_count(&self, query_id: QueryId) -> Result<usize, Error> {
        let exec_state = self.get(query_id)?;
        match &exec_state.result {
            ExecResult::Rows { pages, .. } => Ok(pages.read().expect("RwLock poisoned").len()),
            ExecResult::NoRows => Ok(0),
        }
    }

    pub fn get_columns(&self, query_id: QueryId) -> Result<Option<Box<RawValue>>, Error> {
        Ok(self.get(query_id)?.columns())
    }
}

/// Impl block for internal methods
impl StatementManager {
    fn create_worker(
        &self,
        id: QueryId,
        connection_id: Uuid,
        client: DatabaseClient,
        stmt: ParsedStatement,
        start_gate: Option<oneshot::Receiver<bool>>,
        finished_gate: Option<oneshot::Sender<bool>>,
        event_channel: Option<tauri::ipc::Channel<QueryEvent>>,
    ) {
        let result = if stmt.returns_values {
            ExecResult::Rows {
                pages: RwLock::new(vec![]),
                rows_received: RwLock::new(0),
                columns: RwLock::new(None),
            }
        } else {
            ExecResult::NoRows
        };

        let exec_storage = ExecState {
            started: std::time::Instant::now(),
            connection_id,
            status: AtomicU8::new(QueryStatus::Pending as u8),
            error: RwLock::new(None),
            result,
            rows_affected: RwLock::new(None),
            sqlite_interrupt_handle: RwLock::new(None),
            pg_cancel: RwLock::new(None),
            event_channel,
            finished: watch::channel(false).0,
        };

        let exec_storage = Arc::new(exec_storage);
        self.queries.insert(id, exec_storage.clone());

        let (sender, recv) = channel();

        match client {
            DatabaseClient::Postgres {
                client,
                use_simple_query,
                dialect,
                ssl_mode,
            } => {
                *exec_storage.pg_cancel.write().expect("RwLock poisoned") = Some(PgCancel {
                    token: client.cancel_token(),
                    ssl_mode,
                });
                let worker_storage = exec_storage.clone();
                let handle = spawn(async move {
                    if !wait_for_batch_turn(start_gate, &worker_storage, &sender).await {
                        return;
                    }
                    let result = postgres::execute::execute_query(
                        &client,
                        stmt,
                        &sender,
                        use_simple_query,
                        dialect,
                    )
                    .await;
                    report_query_exec_outcome("Postgres", result, &sender);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::SQLite { connection } => {
                let interrupt_handle = connection
                    .lock()
                    .expect("Mutex poisoned")
                    .get_interrupt_handle();
                *exec_storage
                    .sqlite_interrupt_handle
                    .write()
                    .expect("RwLock poisoned") = Some(interrupt_handle);

                let worker_storage = exec_storage.clone();
                let handle = spawn(async move {
                    if !wait_for_batch_turn(start_gate, &worker_storage, &sender).await {
                        return;
                    }
                    let blocking_sender = sender.clone();
                    let result = spawn_blocking(move || {
                        let conn = connection.lock().expect("Mutex poisoned");
                        sqlite::execute::execute_query(&conn, stmt, &blocking_sender)
                    })
                    .await
                    .map_err(|error| Error::Internal(format!("SQLite query task failed: {error}")))
                    .and_then(|result| result);
                    report_query_exec_outcome("SQLite", result, &sender);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::DuckDB { connection, .. } => {
                let worker_storage = exec_storage.clone();
                let handle = spawn(async move {
                    if !wait_for_batch_turn(start_gate, &worker_storage, &sender).await {
                        return;
                    }
                    let result = connection.execute_query(stmt, &sender).await;
                    report_query_exec_outcome("DuckDB", result, &sender);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::LibSQL { connection } => {
                let worker_storage = exec_storage.clone();
                let handle = spawn(async move {
                    if !wait_for_batch_turn(start_gate, &worker_storage, &sender).await {
                        return;
                    }
                    let result =
                        crate::database::libsql::execute::execute_query(&connection, stmt, &sender)
                            .await;
                    report_query_exec_outcome("LibSQL", result, &sender);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::MySQL { pool, .. } => {
                let worker_storage = exec_storage.clone();
                let handle = spawn(async move {
                    if !wait_for_batch_turn(start_gate, &worker_storage, &sender).await {
                        return;
                    }
                    let result = mysql::execute::execute_query(&pool, stmt, &sender).await;
                    report_query_exec_outcome("MySQL", result, &sender);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::D1 { http } => {
                let worker_storage = exec_storage.clone();
                let handle = spawn(async move {
                    if !wait_for_batch_turn(start_gate, &worker_storage, &sender).await {
                        return;
                    }
                    let adapter = crate::database::d1::D1Adapter::new(http);
                    let result = adapter.run_statement(stmt, &sender).await;
                    report_query_exec_outcome("Cloudflare D1", result, &sender);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::Posthog { http } => {
                let worker_storage = exec_storage.clone();
                let handle = spawn(async move {
                    if !wait_for_batch_turn(start_gate, &worker_storage, &sender).await {
                        return;
                    }
                    let adapter = crate::database::posthog::PosthogAdapter::new(http);
                    let result = adapter.run_statement(stmt, &sender).await;
                    report_query_exec_outcome("PostHog", result, &sender);
                });
                self.execution_handles.insert(id, handle);
            }
        }

        let handle = tokio::task::spawn(async move {
            let mut recv = recv;
            let mut succeeded = false;

            while let Some(event) = recv.recv().await {
                match event {
                    QueryExecEvent::TypesResolved { columns } => {
                        if let Some(channel) = &exec_storage.event_channel {
                            let _ = channel.send(QueryEvent::Columns {
                                query_id: id,
                                columns: columns.clone(),
                            });
                        }
                        if let ExecResult::Rows { columns: slot, .. } = &exec_storage.result {
                            *slot.write().expect("RwLock poisoned") = Some(columns);
                        } else {
                            log::warn!(
                                "Received column metadata for a non-row-returning query; ignoring"
                            );
                        }
                    }
                    QueryExecEvent::Page { page_amount, page } => {
                        let page_index = match &exec_storage.result {
                            ExecResult::Rows { pages, .. } => {
                                pages.read().expect("RwLock poisoned").len()
                            }
                            ExecResult::NoRows => 0,
                        };
                        if let Some(channel) = &exec_storage.event_channel {
                            let _ = channel.send(QueryEvent::RowBatch {
                                query_id: id,
                                page_index,
                                rows: page.clone(),
                            });
                        }
                        if let ExecResult::Rows {
                            pages,
                            rows_received,
                            ..
                        } = &exec_storage.result
                        {
                            pages.write().expect("RwLock poisoned").push(page);
                            if page_index == 0 {
                                crate::database::perf_metrics::record(
                                    "query_first_rows",
                                    exec_storage.started,
                                    exec_storage.connection_id,
                                );
                            }
                            *rows_received.write().expect("RwLock poisoned") += page_amount;
                            if let Some(channel) = &exec_storage.event_channel {
                                let _ = channel.send(QueryEvent::Progress {
                                    query_id: id,
                                    rows_received: *rows_received.read().expect("RwLock poisoned"),
                                });
                            }
                        } else {
                            log::warn!(
                                "Received a result page for a non-row-returning query; ignoring"
                            );
                        }
                    }
                    QueryExecEvent::Finished {
                        elapsed_ms,
                        affected_rows,
                        error,
                    } => {
                        if let Some(err) = error {
                            if exec_storage.finish(Err(err.clone())) {
                                if let Some(channel) = &exec_storage.event_channel {
                                    let _ = channel.send(QueryEvent::Error {
                                        query_id: id,
                                        message: err,
                                    });
                                }
                            }
                        } else if exec_storage.finish(Ok(affected_rows)) {
                            succeeded = true;
                            if let Some(channel) = &exec_storage.event_channel {
                                let _ = channel.send(QueryEvent::Done {
                                    query_id: id,
                                    affected_rows,
                                    elapsed_ms,
                                });
                            }
                        }

                        break;
                    }
                }
            }

            // The executor dropped its sender without a `Finished` event (a row
            // failed to serialize, or the task panicked). Without this the
            // statement would report `Running` until the caller gave up.
            if exec_storage.finish(Err(EXECUTOR_STOPPED_MESSAGE.to_string())) {
                if let Some(channel) = &exec_storage.event_channel {
                    let _ = channel.send(QueryEvent::Error {
                        query_id: id,
                        message: EXECUTOR_STOPPED_MESSAGE.to_string(),
                    });
                }
            }

            if let Some(finished_gate) = finished_gate {
                let _ = finished_gate.send(succeeded);
            }
        });

        self.listener_handles.insert(id, handle);
    }

    fn get(
        &self,
        query_id: QueryId,
    ) -> Result<dashmap::mapref::one::Ref<'_, usize, Arc<ExecState>>, Error> {
        self.queries
            .get(&query_id)
            .with_context(|| format!("Did not find QueryId({query_id}) in StatementManager"))
            .map_err(Into::into)
    }
}

async fn wait_for_batch_turn(
    start_gate: Option<oneshot::Receiver<bool>>,
    exec_storage: &ExecState,
    sender: &ExecSender,
) -> bool {
    if let Some(start_gate) = start_gate {
        if !matches!(start_gate.await, Ok(true)) {
            let _ = sender.send(QueryExecEvent::Finished {
                elapsed_ms: 0,
                affected_rows: 0,
                error: Some("Skipped because an earlier statement failed".to_string()),
            });
            return false;
        }
    }

    exec_storage
        .status
        .store(QueryStatus::Running as u8, Ordering::Relaxed);
    true
}

#[cfg(test)]
mod tests {
    use std::{
        sync::{Arc, Mutex},
        time::Duration,
    };

    use crate::database::{stmt_manager::QueryStatus, types::DatabaseClient};
    use uuid::Uuid;

    use super::StatementManager;

    async fn wait_for_terminal_status(
        stmt_manager: &StatementManager,
        query_id: usize,
    ) -> QueryStatus {
        for _ in 0..50 {
            let status = stmt_manager.get_query_status(query_id).unwrap();
            if matches!(status, QueryStatus::Completed | QueryStatus::Error) {
                return status;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        stmt_manager.get_query_status(query_id).unwrap()
    }

    #[tokio::test]
    async fn test_basic_functionality() {
        let stmt_manager = StatementManager::new();
        let client = DatabaseClient::SQLite {
            connection: Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap())),
        };
        let query_ids = stmt_manager.submit_query(client, "SELECT 1").unwrap();
        assert_eq!(query_ids, vec![0]);

        let mut attempt = 0;
        while attempt < 3 {
            attempt += 1;
            let page = stmt_manager.get_query_status(0).unwrap();
            if page == QueryStatus::Completed {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }

        let columns = stmt_manager
            .get_columns(0)
            .unwrap()
            .expect("get_columns returned None");
        assert_eq!(serde_json::to_string(&columns).unwrap(), "[\"1\"]");

        let page = stmt_manager
            .fetch_page(0, 0)
            .unwrap()
            .expect("Page not found after 3 attempts");
        assert_eq!(serde_json::to_string(&page).unwrap(), r#"[[1]]"#);

        let info = stmt_manager.fetch_query(0).unwrap();
        assert_eq!(info.page_count, 1);
        assert_eq!(info.rows_received, 1);
    }

    #[tokio::test]
    async fn streams_columns_batches_progress_and_completion() {
        let stmt_manager = StatementManager::new();
        let client = DatabaseClient::SQLite {
            connection: Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap())),
        };
        let events = Arc::new(Mutex::new(Vec::<serde_json::Value>::new()));
        let captured_events = events.clone();
        let channel = tauri::ipc::Channel::new(move |body| {
            captured_events
                .lock()
                .unwrap()
                .push(body.deserialize::<serde_json::Value>().unwrap());
            Ok(())
        });

        let query_ids = stmt_manager
            .submit_query_for_connection_with_channel(
                Uuid::nil(),
                client,
                "SELECT 1 UNION ALL SELECT 2",
                Some(channel),
            )
            .unwrap();

        assert_eq!(
            wait_for_terminal_status(&stmt_manager, query_ids[0]).await,
            QueryStatus::Completed
        );

        let events = events.lock().unwrap();
        let event_types = events
            .iter()
            .filter_map(|event| event.get("type").and_then(serde_json::Value::as_str))
            .collect::<Vec<_>>();
        assert_eq!(event_types, ["columns", "row_batch", "progress", "done"]);
        assert_eq!(events[1]["rows"], serde_json::json!([[1], [2]]));
        assert_eq!(events[2]["rows_received"], 2);
    }

    /// The analytics dashboard submits several queries at once. Statement ids
    /// used to restart at `0` on every submission, so each submission overwrote
    /// the previous one's results and every caller polling id `0` got whichever
    /// query landed last.
    #[tokio::test]
    async fn concurrent_submissions_keep_their_own_results() {
        let stmt_manager = StatementManager::new();
        let client = DatabaseClient::SQLite {
            connection: Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap())),
        };

        let first = stmt_manager
            .submit_query(client.clone(), "SELECT 111")
            .unwrap();
        let second = stmt_manager
            .submit_query(client.clone(), "SELECT 222")
            .unwrap();

        assert_ne!(first, second, "concurrent submissions must not share ids");

        for id in [first[0], second[0]] {
            for _ in 0..10 {
                if stmt_manager.get_query_status(id).unwrap() == QueryStatus::Completed {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        }

        let first_page = stmt_manager.fetch_page(first[0], 0).unwrap().unwrap();
        let second_page = stmt_manager.fetch_page(second[0], 0).unwrap().unwrap();
        assert_eq!(serde_json::to_string(&first_page).unwrap(), "[[111]]");
        assert_eq!(serde_json::to_string(&second_page).unwrap(), "[[222]]");
    }

    /// A submission must not cancel queries already in flight — only an explicit
    /// `cancel_active_queries` does that.
    #[tokio::test]
    async fn submitting_does_not_cancel_an_earlier_submission() {
        let stmt_manager = StatementManager::new();
        let client = DatabaseClient::SQLite {
            connection: Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap())),
        };

        let first = stmt_manager
            .submit_query(client.clone(), "SELECT 1")
            .unwrap();
        for _ in 0..10 {
            if stmt_manager.get_query_status(first[0]).unwrap() == QueryStatus::Completed {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }

        stmt_manager
            .submit_query(client.clone(), "SELECT 2")
            .unwrap();

        let earlier = stmt_manager.fetch_query(first[0]).unwrap();
        assert_eq!(earlier.status, QueryStatus::Completed);
        assert_eq!(earlier.error, None);
    }

    #[tokio::test]
    async fn statements_in_one_submission_run_in_order() {
        let stmt_manager = StatementManager::new();
        let connection = Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap()));
        let client = DatabaseClient::SQLite {
            connection: connection.clone(),
        };

        let ids = stmt_manager
            .submit_query(
                client,
                "CREATE TABLE ordered (value INTEGER); INSERT INTO ordered VALUES (42); SELECT value FROM ordered;",
            )
            .unwrap();
        assert_eq!(ids.len(), 3);

        for id in &ids {
            assert_eq!(
                wait_for_terminal_status(&stmt_manager, *id).await,
                QueryStatus::Completed
            );
        }

        let value: i64 = connection
            .lock()
            .unwrap()
            .query_row("SELECT value FROM ordered", [], |row| row.get(0))
            .unwrap();
        assert_eq!(value, 42);
    }

    #[tokio::test]
    async fn failed_statement_skips_the_rest_of_its_submission() {
        let stmt_manager = StatementManager::new();
        let connection = Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap()));
        let client = DatabaseClient::SQLite {
            connection: connection.clone(),
        };

        let ids = stmt_manager
            .submit_query(
                client,
                "SELECT * FROM missing_table; CREATE TABLE must_not_exist (id INTEGER);",
            )
            .unwrap();

        assert_eq!(
            wait_for_terminal_status(&stmt_manager, ids[0]).await,
            QueryStatus::Error
        );
        assert_eq!(
            wait_for_terminal_status(&stmt_manager, ids[1]).await,
            QueryStatus::Error
        );
        assert_eq!(
            stmt_manager.fetch_query(ids[1]).unwrap().error.as_deref(),
            Some("Skipped because an earlier statement failed")
        );

        let exists: i64 = connection
            .lock()
            .unwrap()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'must_not_exist'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(exists, 0);
    }

    #[tokio::test]
    async fn test_cancel_active_queries_marks_running_sqlite_query_cancelled() {
        let stmt_manager = StatementManager::new();
        let client = DatabaseClient::SQLite {
            connection: Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap())),
        };

        stmt_manager
            .submit_query(
                client.clone(),
                "WITH RECURSIVE t(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM t WHERE x < 100000000) SELECT count(*) FROM t;",
            )
            .unwrap();

        for _ in 0..10 {
            if stmt_manager.get_query_status(0).unwrap() == QueryStatus::Running {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        stmt_manager.cancel_active_queries();

        let cancelled = stmt_manager.fetch_query(0).unwrap();
        assert_eq!(cancelled.status, QueryStatus::Error);
        assert_eq!(cancelled.error.as_deref(), Some("Query cancelled"));
    }

    #[tokio::test]
    async fn cancel_queries_only_cancels_the_given_statements() {
        let stmt_manager = StatementManager::new();
        let slow_query = "WITH RECURSIVE t(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM t WHERE x < 100000000) SELECT count(*) FROM t;";

        let client_a = DatabaseClient::SQLite {
            connection: Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap())),
        };
        let client_b = DatabaseClient::SQLite {
            connection: Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap())),
        };

        let ids_a = stmt_manager.submit_query(client_a, slow_query).unwrap();
        let ids_b = stmt_manager.submit_query(client_b, slow_query).unwrap();

        for _ in 0..10 {
            if stmt_manager.get_query_status(ids_a[0]).unwrap() == QueryStatus::Running {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        stmt_manager.cancel_queries(&ids_a);

        let cancelled = stmt_manager.fetch_query(ids_a[0]).unwrap();
        assert_eq!(cancelled.status, QueryStatus::Error);
        assert_eq!(cancelled.error.as_deref(), Some("Query cancelled"));

        let untouched = stmt_manager.get_query_status(ids_b[0]).unwrap();
        assert_ne!(untouched, QueryStatus::Error);

        stmt_manager.cancel_active_queries();
    }

    const SLOW_QUERY: &str = "WITH RECURSIVE t(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM t WHERE x < 100000000) SELECT count(*) FROM t;";

    fn sqlite_client() -> DatabaseClient {
        DatabaseClient::SQLite {
            connection: Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap())),
        }
    }

    /// The grid read used to start a statement, poll its status and then ask
    /// for the columns. One wait must hand back all of it.
    #[tokio::test]
    async fn waiting_returns_columns_first_page_and_counts_together() {
        let stmt_manager = StatementManager::new();
        let ids = stmt_manager
            .submit_query(
                sqlite_client(),
                "SELECT 1 AS id, 'ada' AS name UNION ALL SELECT 2, 'grace'",
            )
            .unwrap();

        let result = stmt_manager
            .wait_for_statement(ids[0], Duration::from_secs(5))
            .await
            .unwrap();

        assert_eq!(result.query_id, ids[0]);
        assert_eq!(result.status, QueryStatus::Completed);
        assert_eq!(result.error, None);
        assert_eq!(
            result.columns.as_ref().map(|columns| columns.get()),
            Some(r#"["id","name"]"#)
        );
        assert_eq!(
            result.first_page.as_ref().map(|page| page.get()),
            Some(r#"[[1,"ada"],[2,"grace"]]"#)
        );
        assert_eq!(result.page_count, 1);
        assert_eq!(result.rows_received, 2);
        assert_eq!(result.affected_rows, Some(0));
    }

    /// Only the first page rides in the response. Later pages stay behind
    /// `fetch_page`, so a wide read never becomes one oversized payload.
    #[tokio::test]
    async fn waiting_returns_only_the_first_page_of_a_larger_result() {
        let stmt_manager = StatementManager::new();
        let ids = stmt_manager
            .submit_query(
                sqlite_client(),
                "WITH RECURSIVE t(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM t WHERE x < 501) SELECT x FROM t",
            )
            .unwrap();

        let result = stmt_manager
            .wait_for_statement(ids[0], Duration::from_secs(5))
            .await
            .unwrap();

        assert_eq!(result.status, QueryStatus::Completed);
        assert_eq!(result.page_count, 2);
        assert_eq!(result.rows_received, 501);
        let first_page: Vec<Vec<i64>> =
            serde_json::from_str(result.first_page.unwrap().get()).unwrap();
        assert_eq!(first_page.len(), 500);
        let second_page = stmt_manager.fetch_page(ids[0], 1).unwrap().unwrap();
        assert_eq!(second_page.get(), "[[501]]");
    }

    #[tokio::test]
    async fn waiting_reports_a_failed_statement_with_its_error() {
        let stmt_manager = StatementManager::new();
        let ids = stmt_manager
            .submit_query(sqlite_client(), "SELECT * FROM missing_table")
            .unwrap();

        let result = stmt_manager
            .wait_for_statement(ids[0], Duration::from_secs(5))
            .await
            .unwrap();

        assert_eq!(result.status, QueryStatus::Error);
        assert_eq!(
            result.error.as_deref(),
            Some("Query failed: no such table: missing_table")
        );
        assert_eq!(result.first_page.map(|page| page.get().to_string()), None);
    }

    #[tokio::test]
    async fn waiting_for_an_unknown_statement_is_an_error() {
        let stmt_manager = StatementManager::new();

        let result = stmt_manager
            .wait_for_statement(42, Duration::from_millis(10))
            .await;

        assert!(result.is_err());
    }

    /// A timed-out wait is a give-up, not a cancel: the statement keeps
    /// running and the snapshot says so.
    #[tokio::test]
    async fn waiting_gives_up_at_the_timeout_and_leaves_the_statement_running() {
        let stmt_manager = StatementManager::new();
        let ids = stmt_manager
            .submit_query(sqlite_client(), SLOW_QUERY)
            .unwrap();

        let result = stmt_manager
            .wait_for_statement(ids[0], Duration::from_millis(50))
            .await
            .unwrap();

        assert!(matches!(
            result.status,
            QueryStatus::Running | QueryStatus::Pending
        ));
        assert_eq!(result.error, None);
        assert_ne!(
            stmt_manager.get_query_status(ids[0]).unwrap(),
            QueryStatus::Error
        );

        stmt_manager.cancel_active_queries();
    }

    /// A table switch cancels the previous read. The waiter must wake at once
    /// with the load-bearing `Query cancelled`, and the error the interrupted
    /// executor reports afterwards must not replace it.
    #[tokio::test]
    async fn cancelling_wakes_the_waiter_with_query_cancelled() {
        let stmt_manager = StatementManager::new();
        let ids = stmt_manager
            .submit_query(sqlite_client(), SLOW_QUERY)
            .unwrap();

        let started = std::time::Instant::now();
        let (result, ()) = tokio::join!(
            stmt_manager.wait_for_statement(ids[0], Duration::from_secs(30)),
            async {
                tokio::time::sleep(Duration::from_millis(50)).await;
                stmt_manager.cancel_queries(&ids);
            }
        );
        let result = result.unwrap();

        assert!(started.elapsed() < Duration::from_secs(5));
        assert_eq!(result.status, QueryStatus::Error);
        assert_eq!(result.error.as_deref(), Some("Query cancelled"));

        tokio::time::sleep(Duration::from_millis(100)).await;
        let later = stmt_manager.fetch_query(ids[0]).unwrap();
        assert_eq!(later.status, QueryStatus::Error);
        assert_eq!(later.error.as_deref(), Some("Query cancelled"));
    }

    /// `9e999` is an infinite REAL, which the SQLite row writer cannot encode,
    /// so the executor dies without a `Finished` event. That used to leave the
    /// statement `Running` until the caller's 30 second give-up.
    #[tokio::test]
    async fn a_dead_executor_fails_the_statement_instead_of_leaving_it_running() {
        let stmt_manager = StatementManager::new();
        let ids = stmt_manager
            .submit_query(sqlite_client(), "SELECT 9e999")
            .unwrap();

        let result = stmt_manager
            .wait_for_statement(ids[0], Duration::from_secs(5))
            .await
            .unwrap();

        assert_eq!(result.status, QueryStatus::Error);
        let error = result.error.expect("a dead executor must leave an error");
        assert!(error.contains("SQLite query task failed"), "{error}");
    }

    /// MySQL and libSQL executors return their error with `?` instead of
    /// sending `Finished`. The statement must still end with that error.
    #[tokio::test]
    async fn an_executor_error_without_a_finished_event_fails_the_statement() {
        let (sender, mut receiver) = crate::database::types::channel();

        super::report_query_exec_outcome(
            "MySQL",
            Err(crate::Error::Any(anyhow::anyhow!(
                "MySQL query failed: Table 'dora.users' doesn't exist"
            ))),
            &sender,
        );

        match receiver.try_recv() {
            Ok(crate::database::QueryExecEvent::Finished { error, .. }) => assert_eq!(
                error.as_deref(),
                Some("MySQL query failed: Table 'dora.users' doesn't exist")
            ),
            other => panic!("expected a Finished event, got {other:?}"),
        }
    }

    /// A send that failed because the consumer went away is a cancellation,
    /// and must not be turned into a statement error.
    #[tokio::test]
    async fn a_cancelled_executor_reports_nothing() {
        let (sender, mut receiver) = crate::database::types::channel();

        super::report_query_exec_outcome("MySQL", Err(crate::Error::Cancelled), &sender);
        super::report_query_exec_outcome("MySQL", Ok(()), &sender);

        assert!(receiver.try_recv().is_err());
    }

    /// The awaited read over a real Postgres connection: rows and columns in
    /// one result, the server's own error text, and a cancel that reaches the
    /// server instead of waiting out the sleep.
    #[tokio::test]
    async fn waiting_works_over_a_postgres_connection() -> anyhow::Result<()> {
        let db = pgtemp::PgTempDB::async_new().await;
        let (client, connection) =
            tokio_postgres::connect(&db.connection_uri(), tokio_postgres::NoTls).await?;
        tokio::task::spawn(connection);
        client
            .batch_execute(
                "CREATE TABLE users (id INT PRIMARY KEY, name TEXT);
                 INSERT INTO users VALUES (1, 'ada'), (2, 'grace'), (3, 'linus');",
            )
            .await?;
        let client = DatabaseClient::Postgres {
            client: Arc::new(client),
            use_simple_query: false,
            dialect: crate::database::dialect::PgDialect::Postgres,
            ssl_mode: tokio_postgres::config::SslMode::Disable,
        };
        let stmt_manager = StatementManager::new();

        let ids =
            stmt_manager.submit_query(client.clone(), "SELECT * FROM users ORDER BY id LIMIT 2")?;
        let read = stmt_manager
            .wait_for_statement(ids[0], Duration::from_secs(10))
            .await?;
        assert_eq!(read.status, QueryStatus::Completed, "{:?}", read.error);
        assert_eq!(
            read.columns.as_ref().map(|columns| columns.get()),
            Some(r#"["id","name"]"#)
        );
        assert_eq!(
            read.first_page.as_ref().map(|page| page.get()),
            Some(r#"[[1,"ada"],[2,"grace"]]"#)
        );
        assert_eq!(read.rows_received, 2);

        let ids = stmt_manager.submit_query(client.clone(), "SELECT * FROM dropped_table")?;
        let failed = stmt_manager
            .wait_for_statement(ids[0], Duration::from_secs(10))
            .await?;
        assert_eq!(failed.status, QueryStatus::Error);
        assert_eq!(
            failed.error.as_deref(),
            Some(r#"Database error: relation "dropped_table" does not exist"#)
        );

        let ids = stmt_manager.submit_query(client, "SELECT pg_sleep(30)")?;
        let started = std::time::Instant::now();
        let (cancelled, ()) = tokio::join!(
            stmt_manager.wait_for_statement(ids[0], Duration::from_secs(30)),
            async {
                tokio::time::sleep(Duration::from_millis(100)).await;
                stmt_manager.cancel_queries(&ids);
            }
        );
        let cancelled = cancelled?;
        assert!(started.elapsed() < Duration::from_secs(5));
        assert_eq!(cancelled.status, QueryStatus::Error);
        assert_eq!(cancelled.error.as_deref(), Some("Query cancelled"));

        Ok(())
    }

    #[tokio::test]
    async fn disconnect_cancellation_is_scoped_to_one_connection() {
        let stmt_manager = StatementManager::new();
        let slow_query = "WITH RECURSIVE t(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM t WHERE x < 100000000) SELECT count(*) FROM t;";
        let connection_a = Uuid::new_v4();
        let connection_b = Uuid::new_v4();

        let ids_a = stmt_manager
            .submit_query_for_connection(
                connection_a,
                DatabaseClient::SQLite {
                    connection: Arc::new(Mutex::new(
                        rusqlite::Connection::open_in_memory().unwrap(),
                    )),
                },
                slow_query,
            )
            .unwrap();
        let ids_b = stmt_manager
            .submit_query_for_connection(
                connection_b,
                DatabaseClient::SQLite {
                    connection: Arc::new(Mutex::new(
                        rusqlite::Connection::open_in_memory().unwrap(),
                    )),
                },
                slow_query,
            )
            .unwrap();

        stmt_manager.cancel_connection_queries(connection_a);

        assert_eq!(
            stmt_manager.get_query_status(ids_a[0]).unwrap(),
            QueryStatus::Error
        );
        assert_ne!(
            stmt_manager.get_query_status(ids_b[0]).unwrap(),
            QueryStatus::Error
        );

        stmt_manager.cancel_active_queries();
    }
}
