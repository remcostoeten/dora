# Query pipeline — reference

Overflow for `SKILL.md`. Rules live there; this file is lookup material.

## Statement state machine

One `ExecState` per statement, held in a `DashMap<QueryId, Arc<ExecState>>` in
`apps/desktop/src-tauri/src/database/stmt_manager.rs`.

`Pending` is set when the worker is created. The listener task flips it to
`Running` before draining its first event. `Completed` and `Error` are terminal
and set by the `Finished` event, or by `cancel_queries`.

Row storage is an enum, not an optional: `ExecResult::Rows` carries `pages`,
`rows_received` and `columns`; `ExecResult::NoRows` carries none of them and is
chosen from `ParsedStatement::returns_values`. `fetch_page`, `get_page_count`
and `get_columns` all answer empty for a `NoRows` statement rather than failing.

Two task handles exist per statement: the executor in `execution_handles` and
the listener draining `QueryExecEvent`s in `listener_handles`. Cancellation
aborts both. Each state also records its connection id, allowing disconnect to
cancel only that connection's pending and running statements.

Events flow executor to listener over an unbounded channel:
`TypesResolved { columns }` once, `Page { page_amount, page }` repeatedly, and
`Finished { elapsed_ms, affected_rows, error }` once, which breaks the loop.

`fetch_query` returns `StatementInfo`, which carries only the *first* page plus
`page_count` and `rows_received`. Every later page needs its own `fetch_page`
call.

Reaping runs on each `submit_query`, after ids are allocated. It drops the
lowest-numbered finished statements down to `MAX_RETAINED_QUERIES`, which is 64.
Running and pending statements are excluded from the candidate list.

## Per-engine paging and cancel

| Engine | Page size | Server-side cancel |
| --- | --- | --- |
| Postgres, CockroachDB | 50 | yes — `CancelRequest` on a fresh connection |
| SQLite | 50 (`DEFAULT_QUERY_PAGE_SIZE`) | yes — `rusqlite::InterruptHandle` |
| DuckDB | 50 | no |
| MySQL, MariaDB | 500 | no |
| libSQL | 500 | no |
| Cloudflare D1 | one page per result set | no |
| PostHog | one page per result set | no |

The Postgres and DuckDB sizes are local `batch_size` bindings in
`apps/desktop/src-tauri/src/database/postgres/execute.rs` and
`apps/desktop/src-tauri/src/database/duckdb/execute.rs`. SQLite's is
configurable through `SqliteExecuteConfig` but only ever constructed from its
`Default`. MySQL and libSQL use a private `PAGE_SIZE` constant in
`apps/desktop/src-tauri/src/database/mysql/execute.rs` and
`apps/desktop/src-tauri/src/database/libsql/execute.rs`.

The Postgres cancel path mirrors the SSL strategy of the live connection:
`no_verify_tls()` for `SslMode::Require` and `SslMode::Prefer`, `NoTls`
otherwise. The `ssl_mode` is recovered by re-parsing the connection string in
`DatabaseConnection::get_client`, and stored alongside the `CancelToken` in
`PgCancel` when the worker is created. The cancel is spawned and never awaited —
a failure is logged at warn and nothing else.

Concurrency ceilings per engine: Postgres and CockroachDB share one client;
MySQL and MariaDB use a pool with `MYSQL_POOL_MIN` 0 and `MYSQL_POOL_MAX` 4, set
in `apps/desktop/src-tauri/src/database/services/connection.rs`; SQLite and
DuckDB hold one mutex-guarded connection each; libSQL, D1 and PostHog are HTTP.

## Poll and collect

`packages/studio/src/core/data-provider/adapters/tauri.ts` runs the same
sequence for both read paths:

1. `startQuery` returns a `Vec<usize>` of statement ids. `executeQuery` hands the
   whole vector to `options.onStarted` for cancellation, then polls the ids in
   submission order. The backend gates each statement on its predecessor and
   skips the remainder after the first error.
2. For each id, `pollQueryToCompletion` calls `fetchQuery` every `QUERY_POLL_INTERVAL_MS`
   (100) until the status is `Completed` or `Error`, giving up at
   `QUERY_POLL_TIMEOUT_MS` (30 000). It distinguishes four outcomes —
   `completed`, `error`, `timeout`, `fetch-failed` — so a still-running query is
   never misreported as missing columns.
3. After the final statement, `getColumns` is parsed into
   `ColumnDefinition[]`.
4. `collectAllRows` parses that final result's `first_page`, then loops
   `fetchPage` for indices `1..page_count`, appending. A failed page breaks the
   loop and returns what it has, logging to the console.

A timeout is a frontend giveup only. The statement stays `Running` in the
manager, the server keeps working, and nothing cancels it.

## Where result state lives

| Path | Holder | Notes |
| --- | --- | --- |
| Console rows | `QueryTab.result` in `packages/studio/src/features/sql-console/stores/tab-store.tsx` | reducer over context; `MAX_TABS` 20 |
| Console in-flight ids | `inFlightQueryIdsRef`, a `Map` from tab id to ids | `packages/studio/src/features/sql-console/sql-console.tsx` |
| Console cancelled tabs | `cancelledTabsRef`, a `Set` of tab ids | same file |
| Browse rows | `tableData` state in `packages/studio/src/features/database-studio/database-studio.tsx` | seeded from the module cache |
| Browse cache | `tableDataCache` in `packages/studio/src/core/table-cache.ts` | plain `Map`, keyed, never expires |
| Browse request token | `loadRequestIdRef` in `packages/studio/src/features/database-studio/hooks/use-database-studio-sync.ts` | monotonic per view |
| Browse painted key | `displayedCacheKeyRef` | same file |
| Schema | `AppState.schemas` | invalidated by `start_query` on non-read-only SQL |

Persistence: the tab store writes tabs to localStorage under the
`dora-query-tabs` prefix with `result` and `isExecuting` blanked.

Cache keys come from `buildTableCacheKey` in
`packages/studio/src/features/database-studio/utils/table-cache.ts`.
`buildDefaultTableCacheKey` hardcodes limit 50, offset 0, no sort, no filters and
an empty filter group so a sidebar prefetch lands on the same key the first real
load will look up; a change to the initial `pagination` state has to be mirrored
there or every prefetch misses.

## Schema invalidation

`start_query` in `apps/desktop/src-tauri/src/database/commands/query.rs` parses
the submitted SQL and removes the connection's cached schema when any statement
is not read-only. When parsing fails it falls back to searching the uppercased
text for `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME`, `ATTACH` and `DETACH`,
preferring an unnecessary invalidation over a stale schema. This happens on the
command, not in `QueryService`, so a new entry point that submits SQL does not
get it for free.

## Tests that pin the contract

In `apps/desktop/src-tauri/src/database/stmt_manager.rs`:

- `test_basic_functionality` — submit, poll to `Completed`, read columns, page,
  and `StatementInfo` counts.
- `concurrent_submissions_keep_their_own_results` — ids are globally unique;
  written after a regression where ids restarted at 0 per submission and
  concurrent callers overwrote each other.
- `submitting_does_not_cancel_an_earlier_submission` — submission never
  supersedes.
- `statements_in_one_submission_run_in_order` — later statements wait for their
  predecessor.
- `failed_statement_skips_the_rest_of_its_submission` — a failed statement
  prevents later SQL in the same submission from running.
- `test_cancel_active_queries_marks_running_sqlite_query_cancelled` — a running
  SQLite statement ends as `Error` with `Query cancelled`.
- `cancel_queries_only_cancels_the_given_statements` — a second connection's
  statement is untouched.
- `disconnect_cancellation_is_scoped_to_one_connection` — disconnect cleanup
  does not cancel another connection's query.

Frontend tests that touch this area live beside their subjects, for example
`packages/studio/src/features/sql-console/stores/tab-store.test.tsx`.
