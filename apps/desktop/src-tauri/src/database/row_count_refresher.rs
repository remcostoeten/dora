//! Background exact row counts.
//!
//! Schema introspection returns immediately with whatever estimates the engine
//! keeps (`pg_class.reltuples`, `information_schema.TABLES.TABLE_ROWS`,
//! `duckdb_tables().estimated_size`) and leaves unknown or zero estimates as
//! they are. This module owns the follow-up: a per-connection background task
//! that runs batched exact `COUNT(*)` queries for those tables, patches the
//! cached `Arc<DatabaseSchema>` in place and emits
//! [`SCHEMA_ROW_COUNTS_EVENT`] so the frontend refetches the (now patched)
//! cache. Keeping counts off the introspection critical path is what lets a
//! cloud connection paint its sidebar in one round trip instead of counting
//! every table first.
//!
//! Cancellation is a generation counter: every full schema invalidation or
//! teardown calls [`RowCountRefresher::cancel`], which bumps the connection's
//! generation and aborts the running task. A task compares its spawn-time
//! generation before patching, so a stale result is discarded rather than
//! resurrecting a dropped schema entry.
//!
//! Counted tables are remembered per generation. An empty table counts to
//! exactly zero, which still matches [`pending_counts`], so without that memory
//! the emit → frontend refetch → `schedule` cycle would recount forever.

use std::collections::HashSet;
use std::sync::Arc;

use dashmap::DashMap;
use serde::Serialize;
use tauri::{AppHandle, Emitter, EventTarget, Manager};
use uuid::Uuid;

use crate::database::ident::{qualified_ansi, qualified_mysql};
use crate::database::types::{Database, DatabaseSchema};
use crate::AppState;

pub const SCHEMA_ROW_COUNTS_EVENT: &str = "schema-row-counts-updated";

/// Tables per UNION ALL count statement for the server engines.
const COUNT_BATCH_SIZE: usize = 50;
/// Smaller batches for SQLite so the connection mutex is released between
/// batches and interactive queries can interleave.
const SQLITE_COUNT_BATCH_SIZE: usize = 25;
/// Upper bound on one whole count run; a hung remote must not zombie the task.
const COUNT_RUN_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(180);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PendingCount {
    pub schema: String,
    pub table: String,
}

/// Tables whose estimate is unknown or zero. Zero is included because a stale
/// stats source (Neon resets `pg_stat`; MySQL samples lazily) reports exactly
/// zero, and counting a genuinely empty table is cheap.
pub fn pending_counts(schema: &DatabaseSchema) -> Vec<PendingCount> {
    schema
        .tables
        .iter()
        .filter(|table| table.row_count_estimate.unwrap_or(0) == 0)
        .map(|table| PendingCount {
            schema: table.schema.clone(),
            table: table.name.clone(),
        })
        .collect()
}

/// Applies positional counts onto a schema, returning the patched copy and
/// whether any estimate actually changed. `None` counts (unreadable tables)
/// leave the existing estimate untouched.
pub fn apply_counts(
    schema: &DatabaseSchema,
    pending: &[PendingCount],
    counts: &[Option<u64>],
) -> (DatabaseSchema, bool) {
    let mut patched = schema.clone();
    let mut changed = false;
    for (entry, count) in pending.iter().zip(counts) {
        let Some(count) = count else { continue };
        if let Some(table) = patched
            .tables
            .iter_mut()
            .find(|table| table.name == entry.table && table.schema == entry.schema)
        {
            if table.row_count_estimate != Some(*count) {
                table.row_count_estimate = Some(*count);
                changed = true;
            }
        }
    }
    (patched, changed)
}

#[derive(Clone, Serialize)]
struct RowCountsUpdatedPayload {
    #[serde(rename = "connectionId")]
    connection_id: Uuid,
}

struct RunningTask {
    generation: u64,
    handle: tauri::async_runtime::JoinHandle<()>,
}

struct CountedTables {
    generation: u64,
    done: HashSet<(String, String)>,
}

pub struct RowCountRefresher {
    app: AppHandle,
    generations: DashMap<Uuid, u64>,
    tasks: DashMap<Uuid, RunningTask>,
    counted: DashMap<Uuid, CountedTables>,
}

impl RowCountRefresher {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            generations: DashMap::new(),
            tasks: DashMap::new(),
            counted: DashMap::new(),
        }
    }

    fn generation(&self, connection_id: Uuid) -> u64 {
        *self.generations.entry(connection_id).or_insert(0)
    }

    /// Bumps the generation and aborts any running count task. Call on every
    /// full schema invalidation, disconnect, removal or config change so a
    /// stale count run can neither patch the cache nor hold engine handles
    /// alive past teardown.
    pub fn cancel(&self, connection_id: Uuid) {
        *self.generations.entry(connection_id).or_insert(0) += 1;
        self.counted.remove(&connection_id);
        if let Some((_, task)) = self.tasks.remove(&connection_id) {
            task.handle.abort();
        }
    }

    /// Spawns a count run for the given pending tables unless one is already
    /// running at the current generation. Tables already counted at this
    /// generation are dropped, so repeated schema reads do not recount.
    /// Safe to call on every schema read.
    pub fn schedule(&self, connection_id: Uuid, pending: Vec<PendingCount>) {
        let generation = self.generation(connection_id);
        let pending = self.uncounted(connection_id, generation, pending);
        if pending.is_empty() {
            return;
        }
        if let Some(task) = self.tasks.get(&connection_id) {
            if task.generation == generation {
                return;
            }
        }
        if let Some((_, stale)) = self.tasks.remove(&connection_id) {
            stale.handle.abort();
        }

        let app = self.app.clone();
        let handle = tauri::async_runtime::spawn(async move {
            run_count_task(app, connection_id, generation, pending).await;
        });
        self.tasks
            .insert(connection_id, RunningTask { generation, handle });
    }

    fn uncounted(
        &self,
        connection_id: Uuid,
        generation: u64,
        pending: Vec<PendingCount>,
    ) -> Vec<PendingCount> {
        let Some(counted) = self.counted.get(&connection_id) else {
            return pending;
        };
        if counted.generation != generation {
            return pending;
        }
        pending
            .into_iter()
            .filter(|entry| {
                !counted
                    .done
                    .contains(&(entry.schema.clone(), entry.table.clone()))
            })
            .collect()
    }

    /// Marks the tables a successful run covered so the next schema read does
    /// not schedule them again. Tables whose count failed stay unmarked and are
    /// retried on the next read.
    fn mark_counted(&self, connection_id: Uuid, generation: u64, done: Vec<(String, String)>) {
        let mut entry = self
            .counted
            .entry(connection_id)
            .or_insert_with(|| CountedTables {
                generation,
                done: HashSet::new(),
            });
        if entry.generation != generation {
            entry.generation = generation;
            entry.done.clear();
        }
        entry.done.extend(done);
    }

    fn finish(&self, connection_id: Uuid, generation: u64) {
        self.tasks
            .remove_if(&connection_id, |_, task| task.generation == generation);
    }
}

async fn run_count_task(
    app: AppHandle,
    connection_id: Uuid,
    generation: u64,
    pending: Vec<PendingCount>,
) {
    let outcome =
        tokio::time::timeout(COUNT_RUN_TIMEOUT, run_counts(&app, connection_id, &pending)).await;

    let counts = match outcome {
        Ok(Some(counts)) => counts,
        Ok(None) => {
            cleanup(&app, connection_id, generation);
            return;
        }
        Err(_) => {
            log::warn!("Row count refresh timed out for connection {connection_id}");
            cleanup(&app, connection_id, generation);
            return;
        }
    };

    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let Some(refresher) = try_refresher(&app) else {
        return;
    };
    if refresher.generation(connection_id) != generation {
        refresher.finish(connection_id, generation);
        return;
    }

    refresher.mark_counted(
        connection_id,
        generation,
        pending
            .iter()
            .zip(&counts)
            .filter(|(_, count)| count.is_some())
            .map(|(entry, _)| (entry.schema.clone(), entry.table.clone()))
            .collect(),
    );

    let mut patched_any = false;
    state.schemas.alter(&connection_id, |_, old| {
        let (patched, changed) = apply_counts(&old, &pending, &counts);
        patched_any = changed;
        Arc::new(patched)
    });

    if patched_any {
        match app.emit_to(
            EventTarget::App,
            SCHEMA_ROW_COUNTS_EVENT,
            RowCountsUpdatedPayload { connection_id },
        ) {
            Ok(()) => log::debug!("Row counts updated for connection {connection_id}"),
            Err(e) => log::error!("Error emitting {SCHEMA_ROW_COUNTS_EVENT}: {e}"),
        }
    }

    refresher.finish(connection_id, generation);
}

fn cleanup(app: &AppHandle, connection_id: Uuid, generation: u64) {
    if let Some(refresher) = try_refresher(app) {
        refresher.finish(connection_id, generation);
    }
}

fn try_refresher(app: &AppHandle) -> Option<tauri::State<'_, RowCountRefresher>> {
    app.try_state::<RowCountRefresher>()
}

/// A cloned engine handle: everything a count run needs, detached from the
/// connections map so no `Ref` guard outlives this function's stack frame.
enum CountTarget {
    Postgres(Arc<tokio_postgres::Client>),
    MySql(Arc<mysql_async::Pool>),
    Sqlite(Arc<std::sync::Mutex<rusqlite::Connection>>),
    LibSql(Arc<libsql::Connection>),
    D1(Arc<crate::database::d1::D1Http>),
}

fn count_target(app: &AppHandle, connection_id: Uuid) -> Option<CountTarget> {
    let state = app.try_state::<AppState>()?;
    let entry = state.connections.get(&connection_id)?;
    if !entry.connected {
        return None;
    }
    match &entry.database {
        Database::Postgres {
            client: Some(client),
            ..
        } => Some(CountTarget::Postgres(Arc::clone(client))),
        Database::MySQL {
            pool: Some(pool), ..
        } => Some(CountTarget::MySql(Arc::clone(pool))),
        Database::SQLite {
            connection: Some(conn),
            ..
        } => Some(CountTarget::Sqlite(Arc::clone(conn))),
        Database::LibSQL {
            connection: Some(conn),
            ..
        } => Some(CountTarget::LibSql(Arc::clone(conn))),
        Database::D1 {
            connection: Some(http),
            ..
        } => Some(CountTarget::D1(Arc::clone(http))),
        _ => None,
    }
}

async fn run_counts(
    app: &AppHandle,
    connection_id: Uuid,
    pending: &[PendingCount],
) -> Option<Vec<Option<u64>>> {
    let target = count_target(app, connection_id)?;
    let result = match target {
        CountTarget::Postgres(client) => {
            let pairs: Vec<(String, String)> = pending
                .iter()
                .map(|p| (p.schema.clone(), p.table.clone()))
                .collect();
            crate::database::postgres::row_counts::exact_row_counts(&client, &pairs).await
        }
        CountTarget::MySql(pool) => mysql_counts(&pool, pending).await,
        CountTarget::Sqlite(conn) => sqlite_counts(conn, pending).await,
        CountTarget::LibSql(conn) => libsql_counts(&conn, pending).await,
        CountTarget::D1(http) => d1_counts(&http, pending).await,
    };
    match result {
        Ok(counts) => Some(counts),
        Err(err) => {
            log::debug!("Row count refresh failed for connection {connection_id}: {err}");
            None
        }
    }
}

fn union_all_counts(batch: &[PendingCount], quote: impl Fn(&PendingCount) -> String) -> String {
    batch
        .iter()
        .enumerate()
        .map(|(index, entry)| {
            format!(
                "SELECT {} AS idx, COUNT(*) AS cnt FROM {}",
                index,
                quote(entry)
            )
        })
        .collect::<Vec<_>>()
        .join(" UNION ALL ")
}

fn ansi_target(entry: &PendingCount) -> String {
    let schema = if entry.schema.is_empty() {
        None
    } else {
        Some(entry.schema.as_str())
    };
    qualified_ansi(schema, &entry.table)
}

async fn mysql_counts(
    pool: &mysql_async::Pool,
    pending: &[PendingCount],
) -> Result<Vec<Option<u64>>, crate::Error> {
    use mysql_async::prelude::Queryable;

    let mut conn = pool
        .get_conn()
        .await
        .map_err(|e| crate::Error::Any(anyhow::anyhow!("MySQL count connection failed: {e}")))?;

    let mut counts: Vec<Option<u64>> = Vec::with_capacity(pending.len());
    for batch in pending.chunks(COUNT_BATCH_SIZE) {
        let sql = union_all_counts(batch, |entry| {
            let schema = if entry.schema.is_empty() {
                None
            } else {
                Some(entry.schema.as_str())
            };
            qualified_mysql(schema, &entry.table)
        });
        let mut batch_counts: Vec<Option<u64>> = vec![None; batch.len()];
        match conn.query::<(u64, u64), _>(sql).await {
            Ok(rows) => {
                for (index, count) in rows {
                    if let Some(slot) = batch_counts.get_mut(index as usize) {
                        *slot = Some(count);
                    }
                }
            }
            Err(err) => {
                log::debug!("MySQL batched count failed: {err}");
            }
        }
        counts.extend(batch_counts);
    }
    Ok(counts)
}

async fn sqlite_counts(
    conn: Arc<std::sync::Mutex<rusqlite::Connection>>,
    pending: &[PendingCount],
) -> Result<Vec<Option<u64>>, crate::Error> {
    let mut counts: Vec<Option<u64>> = Vec::with_capacity(pending.len());
    for batch in pending.chunks(SQLITE_COUNT_BATCH_SIZE) {
        let sql = union_all_counts(batch, ansi_target);
        let batch_len = batch.len();
        let conn = Arc::clone(&conn);
        let batch_counts = tokio::task::spawn_blocking(move || {
            let mut batch_counts: Vec<Option<u64>> = vec![None; batch_len];
            let guard = match conn.lock() {
                Ok(guard) => guard,
                Err(_) => return batch_counts,
            };
            let mut stmt = match guard.prepare(&sql) {
                Ok(stmt) => stmt,
                Err(err) => {
                    log::debug!("SQLite batched count failed: {err}");
                    return batch_counts;
                }
            };
            let rows = stmt.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)));
            if let Ok(rows) = rows {
                for row in rows.flatten() {
                    let (index, count) = row;
                    if count >= 0 {
                        if let Some(slot) = batch_counts.get_mut(index as usize) {
                            *slot = Some(count as u64);
                        }
                    }
                }
            }
            batch_counts
        })
        .await
        .map_err(|e| crate::Error::Any(anyhow::anyhow!("SQLite count task failed: {e}")))?;
        counts.extend(batch_counts);
    }
    Ok(counts)
}

async fn libsql_counts(
    conn: &libsql::Connection,
    pending: &[PendingCount],
) -> Result<Vec<Option<u64>>, crate::Error> {
    let mut counts: Vec<Option<u64>> = Vec::with_capacity(pending.len());
    for batch in pending.chunks(COUNT_BATCH_SIZE) {
        let sql = union_all_counts(batch, ansi_target);
        let mut batch_counts: Vec<Option<u64>> = vec![None; batch.len()];
        match conn.query(&sql, ()).await {
            Ok(mut rows) => {
                while let Ok(Some(row)) = rows.next().await {
                    let index = row.get::<i64>(0).unwrap_or(-1);
                    let count = row.get::<i64>(1).unwrap_or(-1);
                    if index >= 0 && count >= 0 {
                        if let Some(slot) = batch_counts.get_mut(index as usize) {
                            *slot = Some(count as u64);
                        }
                    }
                }
            }
            Err(err) => {
                log::debug!("libSQL batched count failed: {err}");
            }
        }
        counts.extend(batch_counts);
    }
    Ok(counts)
}

async fn d1_counts(
    http: &crate::database::d1::D1Http,
    pending: &[PendingCount],
) -> Result<Vec<Option<u64>>, crate::Error> {
    let mut counts: Vec<Option<u64>> = Vec::with_capacity(pending.len());
    for batch in pending.chunks(COUNT_BATCH_SIZE) {
        let sql = union_all_counts(batch, ansi_target);
        let mut batch_counts: Vec<Option<u64>> = vec![None; batch.len()];
        match http.query(&sql, Vec::new()).await {
            Ok(result_sets) => {
                for set in result_sets {
                    for row in &set.results {
                        let index = row.get("idx").and_then(|v| v.as_i64()).unwrap_or(-1);
                        let count = row.get("cnt").and_then(|v| v.as_i64()).unwrap_or(-1);
                        if index >= 0 && count >= 0 {
                            if let Some(slot) = batch_counts.get_mut(index as usize) {
                                *slot = Some(count as u64);
                            }
                        }
                    }
                }
            }
            Err(err) => {
                log::debug!("D1 batched count failed: {err}");
            }
        }
        counts.extend(batch_counts);
    }
    Ok(counts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::types::TableInfo;

    fn table(name: &str, schema: &str, estimate: Option<u64>) -> TableInfo {
        TableInfo {
            name: name.to_string(),
            schema: schema.to_string(),
            columns: Vec::new(),
            primary_key_columns: Vec::new(),
            row_count_estimate: estimate,
            indexes: Vec::new(),
        }
    }

    fn schema_of(tables: Vec<TableInfo>) -> DatabaseSchema {
        DatabaseSchema {
            tables,
            schemas: Vec::new(),
            unique_columns: Vec::new(),
        }
    }

    #[test]
    fn pending_includes_none_and_zero_estimates_only() {
        let schema = schema_of(vec![
            table("a", "public", None),
            table("b", "public", Some(0)),
            table("c", "public", Some(42)),
        ]);
        let pending = pending_counts(&schema);
        assert_eq!(
            pending.iter().map(|p| p.table.as_str()).collect::<Vec<_>>(),
            vec!["a", "b"]
        );
    }

    #[test]
    fn apply_counts_patches_matching_tables_positionally() {
        let schema = schema_of(vec![
            table("a", "public", None),
            table("b", "other", Some(0)),
        ]);
        let pending = vec![
            PendingCount {
                schema: "public".into(),
                table: "a".into(),
            },
            PendingCount {
                schema: "other".into(),
                table: "b".into(),
            },
        ];
        let (patched, changed) = apply_counts(&schema, &pending, &[Some(7), None]);
        assert!(changed);
        assert_eq!(patched.tables[0].row_count_estimate, Some(7));
        assert_eq!(patched.tables[1].row_count_estimate, Some(0));
    }

    #[test]
    fn apply_counts_ignores_missing_tables() {
        let schema = schema_of(vec![table("a", "public", None)]);
        let pending = vec![PendingCount {
            schema: "public".into(),
            table: "dropped".into(),
        }];
        let (patched, changed) = apply_counts(&schema, &pending, &[Some(9)]);
        assert!(!changed);
        assert_eq!(patched.tables[0].row_count_estimate, None);
    }

    #[test]
    fn apply_counts_reports_no_change_when_estimate_already_matches() {
        let schema = schema_of(vec![table("a", "public", Some(0))]);
        let pending = vec![PendingCount {
            schema: "public".into(),
            table: "a".into(),
        }];
        let (_, changed) = apply_counts(&schema, &pending, &[Some(0)]);
        assert!(!changed);
    }

    #[test]
    fn union_all_counts_quotes_and_indexes() {
        let batch = vec![
            PendingCount {
                schema: String::new(),
                table: "users".into(),
            },
            PendingCount {
                schema: String::new(),
                table: "we\"ird".into(),
            },
        ];
        let sql = union_all_counts(&batch, ansi_target);
        assert_eq!(
            sql,
            "SELECT 0 AS idx, COUNT(*) AS cnt FROM \"users\" UNION ALL SELECT 1 AS idx, COUNT(*) AS cnt FROM \"we\"\"ird\""
        );
    }
}
