# Backend Refactor Checklist

Branch convention: `refactor/backend-phase-{N}-{slug}`
After each phase: commit → push → `gh pr create` → `gh pr merge --squash --delete-branch`

## Completed

- [x] **Phase 1** — split `commands.rs` (1270L) into 13 domain files under `database/commands/`
  - `mod.rs` does `pub use *` → all `lib.rs` invoke_handler paths unchanged
  - PR #47 merged

- [x] **Phase 2-3** — split `storage.rs` (988L) + typed `Error` enum
  - `storage/` split into 9 files (mod, types, serialize, migrator, connections, queries, connection_history, settings, snippet_folders)
  - `error.rs`: replaced 7-variant coarse enum with 16-variant typed enum
  - Custom `Serialize`: `{ "kind": "<tag>", "detail": "<display>" }`
  - PR #48 merged

- [x] **Phase 5a** — `WriteAdapter` trait scaffold
  - `database/adapter/write.rs`: 10-method async trait + stub impls via `write_adapter_stub!` macro for all 4 drivers
  - Stubs return `Error::NotImplemented(&'static str)`
  - PR #49 merged

- [x] **Phase 6** — tracing + structured spans
  - New `src/observability.rs`: `EnvFilter` from `RUST_LOG`, `tracing-log` bridge (no find-replace at log:: call sites)
  - `#[instrument]` on: `ConnectionService::{add_connection, update_connection, connect_to_database, disconnect_from_database, test_connection}`, `MutationService::{update_cell, delete_rows, insert_row, execute_batch}`, `QueryService::start_query`, `LiveMonitorManager::start_monitor`
  - All spans skip sensitive/large params, record key fields
  - PR #50 merged

- [x] **Phase 7** — kill production unwraps, clippy enforcement
  - `#![warn(clippy::unwrap_used)]` + `#![cfg_attr(test, allow(clippy::unwrap_used))]` in `lib.rs`
  - Storage layer (6 files): `self.conn.lock().unwrap()` → `map_err(|_| Error::Internal(...))?`
  - `MutationService`: 9 Mutex locks → `map_err`
  - `stmt_manager`: RwLock writes in spawned tasks → `.expect("RwLock poisoned")` (spawned closure, can't use `?`)
  - `ssh_tunnel`, `metadata`, `adapter/read`: Mutex locks fixed
  - Infallible unwraps (hand-built JSON, `write!` to String, literal URL, OnceLock after init) → `.expect("reason")`
  - 141 remaining unwraps all in `#[cfg(test)]` blocks — suppressed by `cfg_attr`
  - PR #51 merged

---

## Pending

### Phase 5b — Port mutation logic into WriteAdapter impls
**Branch:** `refactor/backend-phase-5b-write-adapter`
**Estimated size:** ~2 days / largest single change

**Goal:** Replace match-on-engine branches in `MutationService` and `database/maintenance.rs` with `adapter.method().await` calls. Each driver's `WriteAdapter` impl gets the real body ported from the service.

**Files to read first:**
- `src/database/services/mutation.rs` — 1160L, contains all mutation logic per driver
- `src/database/maintenance.rs` — truncate, soft-delete, dump logic
- `src/database/adapter/write.rs` — stub impls to replace
- `src/database/adapter/read.rs` — pattern to follow for how adapters hold driver handles

**Steps:**

- [x] **5b-1: PostgresAdapter WriteAdapter**
  - Port `MutationService::update_cell` Postgres branch → `PostgresAdapter::update_cell`
  - Port `MutationService::delete_rows` Postgres branch → `PostgresAdapter::delete_rows`
  - Port `MutationService::insert_row` Postgres branch → `PostgresAdapter::insert_row`
  - Port `MutationService::duplicate_row` Postgres branch → `PostgresAdapter::duplicate_row`
  - Port `MutationService::execute_batch` Postgres branch → `PostgresAdapter::execute_batch`
  - Port truncate/soft-delete/dump from `maintenance.rs` Postgres branch → adapter methods

- [x] **5b-2: SqliteAdapter WriteAdapter**
  - Same port for SQLite branches
  - `connection.lock().map_err(...)? ` pattern already established in Phase 7

- [x] **5b-3: MySqlAdapter WriteAdapter**
  - Same port for MySQL branches
  - Note: `row.unwrap()` in MySQL paths is `mysql_async::Row::unwrap()` (API call, not panic) — leave as-is

- [x] **5b-4: LibSqlAdapter WriteAdapter**
  - Same port for LibSQL branches

- [x] **5b-5: Collapse MutationService**
  - Replace each match-on-engine in `MutationService` with adapter dispatch
  - `MutationService` should shrink to thin wrappers calling `adapter.method().await`
  - Delete dead match arms

- [x] **5b-6: Collapse maintenance.rs**
  - Same collapse for `truncate_table`, `truncate_database`, `soft_delete_rows`, `undo_soft_delete`, `dump_database`

**Key invariant:** `WriteAdapter` methods take owned params (no connection_id) — the adapter already owns the driver handle. Match this in every impl.

**Error mapping:** driver errors already covered by `From<tokio_postgres::Error>`, `From<mysql_async::Error>`, `From<rusqlite::Error>` on `Error` enum.

---

### Phase 5c — LiveMonitor trait per driver
**Branch:** `refactor/backend-phase-5c-live-monitor-trait`
**Estimated size:** ~1 day

**Goal:** Extract `LiveMonitorManager::start_monitor` match-on-engine into a per-driver `WatchAdapter` trait (planned in `database/adapter/watch.rs`).

**Files to read first:**
- `src/database/live_monitor.rs` — current poll-based implementation (~165L)
- `src/database/adapter/mod.rs` — add `watch` module here

**Steps:**

- [x] Create `database/adapter/watch.rs` with `WatchAdapter` trait
  ```rust
  #[async_trait]
  pub trait WatchAdapter: Send + Sync {
      async fn poll_table_hash(&self, table: &str, schema: Option<&str>) -> Result<u64, Error>;
  }
  ```
- [x] Implement `WatchAdapter` for each driver (SQLite, Postgres, MySQL, LibSQL)
- [x] Refactor `LiveMonitorManager::start_monitor` to use adapter dispatch
- [x] Update `database/adapter/mod.rs` exports

---

### Phase 4 (deferred) — ConnectionRepository trait
**Branch:** `refactor/backend-phase-4-connection-repo`
**Estimated size:** ~1 day (best done AFTER 5b)

**Goal:** Bundle connection lookup + adapter construction behind a trait so commands don't touch DashMap directly.

**Blocker:** `DatabaseConnection` is not `Clone`, and `DashMap::Ref` can't be held across `.await`. Clean trait needs either:
- Make `DatabaseConnection` clone the driver handle (Arc-wrap the client)
- Or return `Arc<DatabaseConnection>` from the repo

**Recommendation:** Do after Phase 5b — once adapter methods are defined, the repository shape becomes clear.

**Steps:**

- [x] Arc-wrap `DatabaseClient` variants inside `DatabaseConnection` (or make connection return `Arc<dyn ReadAdapter + WriteAdapter>`)
- [x] Define `ConnectionRepository` trait with `get_adapter(id: Uuid) -> Result<Arc<dyn ...>, Error>`
- [x] Implement on `AppState`
- [x] Refactor commands to use `state.connection_repo().get_adapter(id)?` instead of `state.connections.get(&id)`

---

### Phase 8 — Frontend type safety (post-backend)
**Branch:** `refactor/frontend-phase-8-type-safety`

- [ ] Regenerate TypeScript bindings after all backend changes (`bun tauri:dev` triggers `export_ts_bindings()`)
- [x] Audit `apps/desktop/src/` for any `as any` casts on API responses
- [x] Wire up new `Error` shape `{ kind, detail }` in frontend error handling (was `{ name, message }`)

---

## Architecture notes for next agent

### Crate layout (post-refactor)
```
src/
  lib.rs                    # AppState, run(), #![warn(clippy::unwrap_used)]
  observability.rs          # tracing init
  error.rs                  # typed Error enum, custom Serialize
  storage/                  # SQLite app DB (connections, queries, settings, snippets)
  database/
    commands/               # thin Tauri command wrappers, delegate to services
    services/               # business logic (connection, query, mutation, metadata, ai)
    adapter/
      read.rs               # DatabaseAdapter trait + 4 impls
      write.rs              # WriteAdapter trait + stubs (Phase 5b: real bodies)
      watch.rs              # WatchAdapter trait
    postgres/               # PG driver (connect, execute, parser, row_writer, tls)
    sqlite/                 # SQLite driver
    mysql/                  # MySQL driver
    libsql/                 # LibSQL driver
    live_monitor.rs         # poll-based live change monitor
    maintenance.rs          # truncate, soft-delete, dump
    stmt_manager.rs         # query execution state machine
```

### Error enum shape (for frontend)
```json
{ "kind": "ConnectionNotFound", "detail": "connection abc-123 not found" }
```
Was `{ "name": "error", "message": "..." }` — frontend must handle new shape.

### Tracing usage
```sh
RUST_LOG=debug bun tauri dev          # all spans
RUST_LOG=info,app=debug bun tauri dev  # default: connection-level only
```

### WriteAdapter stub pattern
All 4 drivers currently return `Error::NotImplemented("WriteAdapter::method_name")`.
Phase 5b replaces each stub body with the logic ported from `MutationService`.
Do NOT call `MutationService` from the adapter — port the body directly.
