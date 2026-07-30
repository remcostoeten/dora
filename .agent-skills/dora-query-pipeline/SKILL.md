---
name: dora-query-pipeline
description: Query execution lifecycle between submitting SQL and holding rows. Use when changing how a query is started, polled, cancelled or superseded; how statements are retained, reaped or addressed by id; how many queries may run at once per tab, across tabs or per connection; what happens to an in-flight query when a tab closes or a connection drops; or how a stale result is kept from painting. Not for the IPC command surface (dora-tauri-boundary) and not for how rows are drawn (dora-data-grid).
---

# Query pipeline

## Scope

This skill owns lifecycle: execution, cancellation, concurrency, per-tab
isolation, and who holds result state at each moment.

The shape of the commands and their payloads is `dora-tauri-boundary`'s. Row
rendering, virtualization and cell editing are `dora-data-grid`'s. Nothing here
restates either.

## Unencodable

Source has two or more answers and `.agent-skills/FINDINGS.md` declines to pick
one. Ask before deciding.

- Which of the three result paths a new feature should use: the statement
  pipeline, the per-engine query building in `MutationService::export_table`, or
  `DuckDbConn::query_raw` (FINDINGS 4.6). Rules below cover the statement
  pipeline only.
- Which cache a new read path should write to; three layers exist (FINDINGS 4.9).
- Which of the two browse-SQL builders owns composing a windowed read
  (FINDINGS 4.7).

## Workflow

Changing anything on the query path:

1. Decide whether the change belongs to the statement pipeline
   (`apps/desktop/src-tauri/src/database/stmt_manager.rs`) or to a caller. The
   pipeline owns statement state; callers own what they do with it.
2. Backend changes go through `StatementManager`. `QueryService` in
   `apps/desktop/src-tauri/src/database/services/query.rs` is a pass-through and
   should stay one.
3. If the change adds an engine, add its arm to `signal_engine_cancel` at the
   same time, or it inherits the no-server-cancel gap listed below.
4. Frontend changes go in `packages/studio/src/core/data-provider/adapters/tauri.ts`
   for the poll-and-collect shape, and in the owning view for state.
5. Add a `#[tokio::test]` beside the existing ones in `stmt_manager.rs` for any
   change to id allocation, reaping, cancellation scope or supersession. Those
   four already have tests that encode the current contract; a change that
   breaks one is a behaviour change, not a test to update.

## Invariants

**Rust owns rows while a statement lives; JS owns them after collection.**
`StatementManager` holds every page under a `QueryId` and is the only thing that
can produce a row. Once `collectAllRows` has walked pages `1..page_count` and
returned an array, that array is React state and the backend copy is dead — do
not re-read it, and do not treat a `QueryId` as a handle you can come back to
later. `QueryTab.result` in
`packages/studio/src/features/sql-console/stores/tab-store.tsx` owns console
rows; the `tableData` state in
`packages/studio/src/features/database-studio/database-studio.tsx` owns browse
rows.

**Results are deliberately not persisted.** The tab store strips `result` and
`isExecuting` before writing to localStorage. A restored tab has SQL and no
rows, and that is the intended state — do not persist rows to make a reload look
faster.

**Browse is windowed, the console is not.** Browse composes `LIMIT` and `OFFSET`
from `pagination`, which starts at a limit of 50, and refetches per page. The
console collects the whole result: every page, concatenated, unbounded. Backend
paging is transport, not windowing — nothing stops before the last page.

**A new read path bounds its rows in SQL.** 10 000 rows is the ceiling for a
whole-result fetch, the number `packages/studio/src/features/sidebar/database-sidebar.tsx`
already uses for export. Past that, page the way browse does. Raising
`QUERY_POLL_TIMEOUT_MS` is not a fix for a result that is too big.

**Cancellation lives in Rust and nowhere else.** Dropping a JS promise, aborting
an executor future, or unmounting a component stops nothing: the future's death
only drops our end of the socket while the server keeps running the query. Only
`StatementManager::cancel_queries` cancels, and only `signal_engine_cancel`
reaches the database server.

**Server-side cancel exists for two engines.** SQLite, through the
`rusqlite::InterruptHandle` captured when the worker is created, and
Postgres and CockroachDB, through a real `CancelRequest` issued over a fresh
connection using the stored `CancelToken` and SSL mode. MySQL, MariaDB, libSQL,
DuckDB, Cloudflare D1 and PostHog have no server-side cancel: the statement is
marked `Error` locally and the server finishes the work anyway. Never describe
cancel as guaranteed for those engines in UI copy or comments.

**Cancel by statement id.** The tab's ids come from the `onStarted` callback into
`inFlightQueryIdsRef`, keyed by tab id. `cancelActiveQuery` ignores the
`connectionId` it is given and cancels every running and pending statement in
the process; it exists only for the window before ids are known, and is never
the right call once you have ids.

**The string `Query cancelled` is load-bearing on both sides.** `cancel_queries`
writes it as the statement's error, and the adapter compares against it to turn
a cancellation into a clean result instead of an error toast. Changing it in one
place breaks the other.

**One run per tab, unlimited across tabs.** `handleExecute` returns early while
that tab's `isExecuting` is set. Submitting never supersedes anything:
`submit_query` starts new statements and leaves in-flight ones alone, which
`submitting_does_not_cancel_an_earlier_submission` pins. A caller that wants to
replace its previous run cancels it first, by id.

**A submission with N statements starts N executors at once.** `submit_query`
loops over the parsed statements and spawns a worker for each without awaiting,
so there is no ordering between them, and the console reads only the first id
for status and rows. Do not build a feature on a multi-statement script whose
statements depend on each other's order.

**The bound on concurrency is the connection, not the pipeline.** Postgres and
CockroachDB share one client across every statement. MySQL and MariaDB use a
pool capped by `MYSQL_POOL_MAX`, currently 4. SQLite and DuckDB hold a single
mutex-guarded connection, so one slow statement blocks every other statement on
that connection. Fan-out that looks fine on Postgres will serialize on SQLite.

**Sixty-four finished statements stay addressable.** `MAX_RETAINED_QUERIES`
bounds the map; running and pending statements are never reaped, so a poll
cannot lose its own results, but a view that fans out has to stay well under
that figure or an older result is dropped while still referenced.

**Neither closing a tab nor disconnecting cancels anything.** `CLOSE_TAB` just
removes the tab from state. `disconnect_from_database` clears the client handle
on the connection entry, but every executor was handed its own clone of the
client, so the statement runs to completion and its pages sit in the manager
until reaped. Any code that destroys a query's consumer must call
`cancelQueries` with that consumer's ids first.

**Browse drops stale loads with a monotonic request id.** `loadTableData`
increments `loadRequestIdRef` on entry, captures the value, and checks
`isCurrentRequest()` after every await, skipping every state write when it is no
longer current. A new async load in that view uses the same shape rather than a
new mechanism.

**The console keeps tabs apart by capturing the tab id before the first await.**
`executingTabId` is read once at the top of `handleExecute` and used for the
in-flight and cancelled ref maps. Never read `activeTab` after an await on this
path — by then the user may have switched tabs.

**A late response cannot be confused for a fresh one.** `QueryId` comes from a
process-wide monotonic counter and is never reused, so a delayed `fetch_query`
can only ever read the statement it asked for. Do not reintroduce per-submission
ids.

**The cache key is the staleness guard.** `buildTableCacheKey` covers connection,
table, limit, offset, sort, filters, conjunction and filter group. Any new input
that changes which rows come back belongs in that key, or the wrong rows paint.
`displayedCacheKeyRef` decides cache painting: paint on a genuine view switch,
never on an in-place refresh of the key already on screen.

## Known gaps

State these as gaps; do not write around them as if they were solved.

- No server-side cancel for MySQL, MariaDB, libSQL, DuckDB, D1 and PostHog.
- No row cap on the console path. A large `SELECT` materializes every row into
  one array; the only bound is the 30-second poll timeout, which surfaces as an
  error while the query keeps running.
- Nothing cancels on tab close, on unmount, on view switch or on disconnect. The
  Cancel button in the console is the only cancel trigger in live code.
- No streaming. The frontend polls `fetch_query` every 100ms and only renders
  once the statement has reached a terminal state, so a long query shows nothing
  until it finishes even though pages already exist in the manager.

## Common mistakes

- Assuming an aborted promise, an unmount or a dropped future stopped the query.
- Cancelling with `cancelActiveQuery` when statement ids are already known,
  which kills other tabs' queries.
- Adding an engine without an arm in `signal_engine_cancel`, so its Cancel
  button silently does nothing server-side.
- Making a submission supersede the previous one inside `submit_query` instead
  of having the caller cancel its own ids.
- Reading `activeTab` after an await and writing the result into whichever tab
  the user has since switched to.
- Writing state in an async browse load without re-checking `isCurrentRequest()`
  after each await.
- Adding a filter, sort or pagination input without adding it to
  `buildTableCacheKey`.
- Treating backend pages as windowing and assuming a partial fetch is possible.
- Relying on statement order inside one multi-statement submission.
- Raising `QUERY_POLL_TIMEOUT_MS` to make a slow or oversized query pass.

## Verification

From `apps/desktop/src-tauri`:

```bash
cargo test
```

`stmt_manager.rs` carries the tests that pin this contract: unique ids across
concurrent submissions, submission not cancelling an earlier submission,
cancellation marking a running SQLite statement, and `cancel_queries` touching
only the ids it was given.

From the repository root:

```bash
bun run test:desktop
bun run --cwd packages/studio typecheck
bun run lint
```

## Definition of done

- Statement state changes live in `StatementManager`, with a test beside the
  existing ones when id allocation, reaping, cancellation scope or supersession
  moved.
- Every engine reachable by the change has an arm in `signal_engine_cancel`, or
  the missing server-side cancel is stated explicitly.
- Cancellation targets statement ids, and the caller that owns those ids is the
  one that cancels them.
- Any new consumer that can go away mid-query cancels its own ids first.
- Every state write after an await is guarded: by a captured tab id in the
  console, by `isCurrentRequest()` in browse.
- Any new query input is part of `buildTableCacheKey`.
- A new read path either bounds its rows in SQL or pages; nothing new
  materializes an unbounded result.
- `cargo test` and `bun run test:desktop` pass.

See `reference.md` for the statement state machine, per-engine paging and cancel
support, and the exact poll-and-collect sequence.
