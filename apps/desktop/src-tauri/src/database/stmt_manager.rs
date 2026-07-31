use std::sync::{
    atomic::{AtomicU8, AtomicUsize, Ordering},
    Arc, RwLock,
};

use anyhow::Context;
use serde_json::value::RawValue;
use tauri::async_runtime::{spawn, spawn_blocking, JoinHandle};
use tokio::sync::oneshot;
use tokio_postgres::{config::SslMode, NoTls};
use uuid::Uuid;

use dashmap::DashMap;

use crate::database::postgres::connect::no_verify_tls;

use crate::{
    database::{
        mysql,
        parser::ParsedStatement,
        postgres, sqlite,
        types::{channel, DatabaseClient, Page, QueryId, QueryStatus, StatementInfo},
        QueryExecEvent,
    },
    Error,
};

/// Logs the outcome of an executor task. A `Cancelled` error here is benign —
/// it means the results channel's consumer was aborted (cancellation or a
/// superseding query), so the executor's send failed. Those are logged at debug
/// to avoid noisy error-level "channel closed" spam on every query cancel.
fn log_query_exec_outcome(engine: &str, result: Result<(), Error>) {
    if let Err(err) = result {
        if matches!(err, Error::Cancelled) {
            log::debug!("{} query stopped: results consumer dropped (cancelled)", engine);
        } else {
            log::error!("Error executing {} query: {}", engine, err);
        }
    }
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
    connection_id: Uuid,
    status: AtomicU8,
    error: RwLock<Option<String>>,
    result: ExecResult,
    rows_affected: RwLock<Option<usize>>,
    sqlite_interrupt_handle: RwLock<Option<rusqlite::InterruptHandle>>,
    pg_cancel: RwLock<Option<PgCancel>>,
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
        for query_id in query_ids {
            let Some(entry) = self.queries.get(query_id) else {
                continue;
            };
            let status = entry.status.load(Ordering::Relaxed);
            if status != QueryStatus::Running as u8 && status != QueryStatus::Pending as u8 {
                continue;
            }

            signal_engine_cancel(&entry);

            if let Some((_, handle)) = self.execution_handles.remove(query_id) {
                handle.abort();
            }

            *entry.error.write().expect("RwLock poisoned") = Some("Query cancelled".to_string());
            entry
                .status
                .store(QueryStatus::Error as u8, Ordering::Relaxed);

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
        let exec_state = self.get(query_id)?;

        let (returns_values, first_page, page_count, rows_received) = match &exec_state.result {
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

        let info = StatementInfo {
            returns_values,
            status: exec_state.status.load(Ordering::Relaxed).into(),
            first_page,
            affected_rows: *exec_state.rows_affected.read().expect("RwLock poisoned"),
            page_count,
            rows_received,
            error: exec_state.error.read().expect("RwLock poisoned").clone(),
        };

        Ok(info)
    }

    /// Fetches a page of results for a given query.
    pub fn fetch_page(&self, query_id: QueryId, page_idx: usize) -> Result<Option<Page>, Error> {
        let exec_state = self.get(query_id)?;
        match &exec_state.result {
            ExecResult::Rows { pages, .. } => {
                Ok(pages.read().expect("RwLock poisoned").get(page_idx).cloned())
            }
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
        let exec_state = self.get(query_id)?;
        match &exec_state.result {
            ExecResult::Rows { columns, .. } => {
                Ok(columns.read().expect("RwLock poisoned").clone())
            }
            ExecResult::NoRows => Ok(None),
        }
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
            connection_id,
            status: AtomicU8::new(QueryStatus::Pending as u8),
            error: RwLock::new(None),
            result,
            rows_affected: RwLock::new(None),
            sqlite_interrupt_handle: RwLock::new(None),
            pg_cancel: RwLock::new(None),
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
                    log_query_exec_outcome("Postgres", result);
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
                    let result = spawn_blocking(move || {
                        let conn = connection.lock().expect("Mutex poisoned");
                        sqlite::execute::execute_query(&conn, stmt, &sender)
                    })
                    .await
                    .map_err(|error| Error::Internal(format!("SQLite query task failed: {error}")))
                    .and_then(|result| result);
                    log_query_exec_outcome("SQLite", result);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::DuckDB { connection, .. } => {
                let worker_storage = exec_storage.clone();
                let handle = spawn(async move {
                    if !wait_for_batch_turn(start_gate, &worker_storage, &sender).await {
                        return;
                    }
                    log_query_exec_outcome(
                        "DuckDB",
                        connection.execute_query(stmt, &sender).await,
                    );
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
                    log_query_exec_outcome("LibSQL", result);
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
                    log_query_exec_outcome("MySQL", result);
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
                    log_query_exec_outcome("Cloudflare D1", result);
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
                    log_query_exec_outcome("PostHog", result);
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
                        if let ExecResult::Rows { columns: slot, .. } = &exec_storage.result {
                            *slot.write().expect("RwLock poisoned") = Some(columns);
                        } else {
                            log::warn!(
                                "Received column metadata for a non-row-returning query; ignoring"
                            );
                        }
                    }
                    QueryExecEvent::Page { page_amount, page } => {
                        if let ExecResult::Rows {
                            pages,
                            rows_received,
                            ..
                        } = &exec_storage.result
                        {
                            pages.write().expect("RwLock poisoned").push(page);
                            *rows_received.write().expect("RwLock poisoned") += page_amount;
                        } else {
                            log::warn!("Received a result page for a non-row-returning query; ignoring");
                        }
                    }
                    QueryExecEvent::Finished {
                        elapsed_ms: _,
                        affected_rows,
                        error,
                    } => {
                        if let Some(err) = error {
                            *exec_storage.error.write().expect("RwLock poisoned") = Some(err);
                            exec_storage
                                .status
                                .store(QueryStatus::Error as u8, Ordering::Relaxed);
                        } else {
                            succeeded = true;
                            exec_storage
                                .status
                                .store(QueryStatus::Completed as u8, Ordering::Relaxed);

                            *exec_storage.rows_affected.write().expect("RwLock poisoned") =
                                Some(affected_rows);
                        }

                        break;
                    }
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
    sender: &crate::database::types::ExecSender,
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

        let first = stmt_manager.submit_query(client.clone(), "SELECT 1").unwrap();
        for _ in 0..10 {
            if stmt_manager.get_query_status(first[0]).unwrap() == QueryStatus::Completed {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }

        stmt_manager.submit_query(client.clone(), "SELECT 2").unwrap();

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
