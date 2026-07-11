use std::sync::{
    atomic::{AtomicU8, AtomicUsize, Ordering},
    Arc, RwLock,
};

use anyhow::Context;
use serde_json::value::RawValue;
use tauri::async_runtime::{spawn, spawn_blocking, JoinHandle};
use tokio_postgres::{config::SslMode, NoTls};

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
    status: AtomicU8,
    error: RwLock<Option<String>>,
    result: ExecResult,
    rows_affected: RwLock<Option<usize>>,
    sqlite_interrupt_handle: RwLock<Option<rusqlite::InterruptHandle>>,
    pg_cancel: RwLock<Option<PgCancel>>,
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
        for entry in self.queries.iter() {
            let status = entry.status.load(Ordering::Relaxed);
            if status == QueryStatus::Running as u8 || status == QueryStatus::Pending as u8 {
                if let Some(handle) = entry
                    .sqlite_interrupt_handle
                    .read()
                    .expect("RwLock poisoned")
                    .as_ref()
                {
                    handle.interrupt();
                }

                // Postgres/CockroachDB: aborting the executor future below only
                // drops our socket; the server keeps running the query. Issue a
                // real CancelRequest over a fresh connection. Best-effort and
                // fire-and-forget — if it fails we still fall back to the abort.
                if let Some(pg) = entry.pg_cancel.read().expect("RwLock poisoned").as_ref() {
                    let token = pg.token.clone();
                    let ssl_mode = pg.ssl_mode;
                    spawn(async move {
                        // Mirror the SSL strategy `postgres::connect::connect`
                        // uses so the cancel connection negotiates the same way
                        // the live one did (encrypt-only, no cert verification,
                        // which is enough for a single control message).
                        let outcome = match ssl_mode {
                            SslMode::Require | SslMode::Prefer => {
                                token.cancel_query(no_verify_tls()).await
                            }
                            _ => token.cancel_query(NoTls).await,
                        };
                        if let Err(err) = outcome {
                            log::warn!("Postgres cancel request failed: {err}");
                        }
                    });
                }
            }
        }

        for entry in self.execution_handles.iter() {
            entry.value().abort();
        }
        for entry in self.queries.iter() {
            let status = entry.status.load(Ordering::Relaxed);
            if status == QueryStatus::Running as u8 || status == QueryStatus::Pending as u8 {
                *entry.error.write().expect("RwLock poisoned") =
                    Some("Query cancelled".to_string());
                entry
                    .status
                    .store(QueryStatus::Error as u8, Ordering::Relaxed);
            }
        }
        for entry in self.listener_handles.iter() {
            entry.value().abort();
        }
        self.execution_handles.clear();
        self.listener_handles.clear();
    }

    /// Submits a new query (possibly containing multiple statements) for execution.
    ///
    /// Each statement gets a globally unique `QueryId`, so concurrent submissions
    /// (the analytics dashboard runs six at once) never collide. This does *not*
    /// cancel queries already in flight — callers that need to supersede their
    /// previous run, like the SQL console, call `cancel_query` first.
    pub fn submit_query(&self, client: DatabaseClient, query: &str) -> Result<Vec<QueryId>, Error> {
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

        for statement in statements {
            let id = self.next_id.fetch_add(1, Ordering::Relaxed);
            self.create_worker(id, client.clone(), statement);
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
    fn create_worker(&self, id: QueryId, client: DatabaseClient, stmt: ParsedStatement) {
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
                let handle = spawn(async move {
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

                let handle = spawn_blocking(move || {
                    let conn = connection.lock().expect("Mutex poisoned");
                    log_query_exec_outcome(
                        "SQLite",
                        sqlite::execute::execute_query(&conn, stmt, &sender),
                    );
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::DuckDB { connection, .. } => {
                let handle = spawn(async move {
                    log_query_exec_outcome(
                        "DuckDB",
                        connection.execute_query(stmt, &sender).await,
                    );
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::LibSQL { connection } => {
                let handle = spawn(async move {
                    let result =
                        crate::database::libsql::execute::execute_query(&connection, stmt, &sender)
                            .await;
                    log_query_exec_outcome("LibSQL", result);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::MySQL { pool, .. } => {
                let handle = spawn(async move {
                    let result = mysql::execute::execute_query(&pool, stmt, &sender).await;
                    log_query_exec_outcome("MySQL", result);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::D1 { http } => {
                let handle = spawn(async move {
                    let adapter = crate::database::d1::D1Adapter::new(http);
                    let result = adapter.run_statement(stmt, &sender).await;
                    log_query_exec_outcome("Cloudflare D1", result);
                });
                self.execution_handles.insert(id, handle);
            }
            DatabaseClient::Posthog { http } => {
                let handle = spawn(async move {
                    let adapter = crate::database::posthog::PosthogAdapter::new(http);
                    let result = adapter.run_statement(stmt, &sender).await;
                    log_query_exec_outcome("PostHog", result);
                });
                self.execution_handles.insert(id, handle);
            }
        }

        let handle = tokio::task::spawn(async move {
            let mut recv = recv;

            exec_storage
                .status
                .store(QueryStatus::Running as u8, Ordering::Relaxed);

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

#[cfg(test)]
mod tests {
    use std::{
        sync::{Arc, Mutex},
        time::Duration,
    };

    use crate::database::{stmt_manager::QueryStatus, types::DatabaseClient};

    use super::StatementManager;

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
}
