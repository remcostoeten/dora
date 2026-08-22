# Architecture and performance roadmap

Status: living document, 2026-08-22. Tracks 0–3 are landed on
`perf/track-2-workspace-store` (see `docs/benchmarks/`). High-level plan with independent sub-paths. Each track
lists the evidence in today's code, the steps, the first PR, and the exit
criterion that proves it landed. Tracks are ordered by leverage; the dependency
graph at the end shows what can run in parallel.

## Goal

Everything the user has already seen must be instant: switching views, tabs,
connections and previously visited tables must not wait on IPC, the network,
a remount, or a chunk load. First contact with remote data is allowed to be
slow; nothing after it is. Large result sets must stream and window instead of
being collected into one array. Performance is a measured contract, not an
assumption.

This borrows the model that made Skriuw fast (bootstrap snapshot, normalized
external store, persistent editor host, optimistic queued writes, a written
performance contract enforced by a harness) and adapts it to a tool whose data
lives in remote databases.

## Invariants the plan is working towards

- No view or editor remount when switching between Database Studio, SQL
  console, schema visualizer, Docker or AI panels.
- No remount when switching connections or tabs.
- No post-startup chunk load on a navigation path (Monaco and its workers are
  warm before the boot screen dismisses).
- Cached table navigation paints the last known rows synchronously; refresh is
  background.
- Keystrokes in any editor render zero application-shell components.
- Query results stream to the UI in batches over a push channel; the grid
  requests row windows on demand; no path collects every page into memory.
- Every mutation paints locally in the same frame and is durably applied
  through one queued pipeline that can preview, batch, undo and audit.
- All of the above is asserted by a harness with P95 budgets; regressions do
  not merge.

## Current state (evidence)

The first four rows describe the state before Tracks 0–2 and are kept as the
baseline the benchmarks compare against; the "Now" column is the post-Track-2
state.

| Area | Before Track 0 | Now | Where |
| --- | --- | --- | --- |
| View switching | Conditional render chain on `activeNavId`; the inactive view unmounts | Keep-alive `core/workspace-views`; zero remounts (Track 1) | `core/workspace-views/` |
| Connection switching | `<DatabaseStudio key={studioConnectionId}>` forces full teardown | No remount; per-connection state in the store (Track 1) | `core/workspace-store/` |
| Editors | Monaco is `lazy()`-loaded per feature, destroyed on view switch | One Monaco per session via `core/editor-host` (Track 1) | `core/editor-host/` |
| Table data | React Query key per page/sort/filter, `staleTime` 10 s, plus a second ad-hoc `tableDataCache` Map | Snapshot store paints synchronously, zero IPC on a cached switch (Track 2) | `core/workspace-store/` |
| Query transport | Frontend polls `fetchQuery` on an interval, then `collectAllRows` walks every 50-row page and concatenates | `start_query_stream` pushes `QueryEvent`s over a Tauri channel; 500-row pages; `BufferedQueryRowSource` serves row windows; 100k-row first paint P95 87.6 ms (Track 3) | `core/data-provider/query-row-source.ts`, `src-tauri/.../stmt_manager.rs` |
| Row encoding | `serde_json::Value` per row over IPC | Arrays per row, columns sent once; binary/columnar still open | `src-tauri/src/database/types.rs` |
| Shell state | One 1,447-line component, 36 hook calls, eight `useState` dialogs | `Index.tsx` is 15 lines; shell split under `pages/workspace/` (Track 2) | `pages/workspace/` |
| Adapter seam | `DataAdapter` exists with mock and Tauri impls, but 65 feature files import `lib/bindings` directly | Unchanged (Track 4) | `core/data-provider/` |
| Persistence | 14 independent `localStorage` writers | Unchanged (Track 8) | settings-store, appearance-store, ui-zoom, sidebar width, frecency, onboarding, tab session |
| Rust layout | Single `app_lib` crate, 81 deps; `tauri::` referenced in 25 files under `database/` | Unchanged (Track 7) | `apps/desktop/src-tauri/` |
| Measurement | None. No budgets, no render-count tests, no perf harness | `docs/performance-contract.md`, `bun perf`, CI invariants, dated files in `docs/benchmarks/` (Track 0) | `packages/studio/src/test/performance/` |

## Tracks

### Track 0 — Performance contract and harness — DONE

Why first: every other track is unprovable without it, and the harness is
cheap because browser-mode Studio (`localhost:1420`, mock adapter) and
Playwright already exist.

Steps

1. Write `docs/performance-contract.md` with Dora-shaped budgets:
   - view switch Studio ↔ SQL console: P95 < 16 ms, zero remounts
   - cached table switch: P95 < 8 ms, zero IPC
   - connection switch with cached schema: P95 < 16 ms, zero remounts
   - SQL editor keystroke: zero shell React commits
   - 100k-row result: first rows painted < 100 ms, scroll at 60 fps
   - cold start to interactive with a 200-table schema: budget set after a
     baseline run
2. Add fixtures to the mock adapter: 200-table / 2,000-column schema, 100k-row
   table, 10 connections, 50 saved queries.
3. Harness under `packages/studio/src/test/performance/`: Playwright drives the
   browser-mode app, reads `performance.mark`/`measure`, `PerformanceObserver`
   long-animation-frame entries, and React Profiler commit counts; writes raw
   samples plus P50/P95/max to JSON.
4. CI: functional run on shared runners (asserts invariants like "zero
   remounts", not timings); timing assertions only on a dedicated runner or a
   local `bun perf` script until one exists.
5. Record the baseline and commit it under `docs/benchmarks/`.

First PR: contract doc + fixtures + harness measuring the current state.

Exit: baseline numbers committed; "zero remount" and "zero shell commits on
keystroke" tests exist and are currently red.

### Track 1 — Keep-alive views and persistent editor host — DONE

Steps

1. Replace the `activeNavId` ternary chain with a `WorkspaceViews` component
   that mounts each view once and toggles `hidden`/`inert` (CSS, not React).
   Views that have never been opened stay unmounted until first open.
2. Drop `key={studioConnectionId}` on `DatabaseStudio`; move connection-scoped
   state (selection, scroll, column widths, pending edits) into the workspace
   store keyed by connection id so a switch is a store read, not a remount.
3. `core/editor-host/`: one Monaco editor instance per language family (SQL,
   TS for Drizzle/Prisma), `setModel()` per tab; models live in a
   `Map<tabId, ITextModel>` owned by the store, never by a component. Monaco
   options, themes, fonts and workers are configured once.
4. Warm-up: preload the Monaco chunk, workers and fonts during the existing
   boot screen (`apps/desktop/src/boot-screen.ts`); remove per-feature
   `lazy()` for Monaco.
5. Remove the `resetKeys` remount on the error boundary; scope boundaries per
   view instead.

First PR: keep-alive views + drop the connection key (no editor work yet) and
flip the Track 0 "zero remount" test green.

Exit: Track 0 view-switch and connection-switch budgets green; Monaco created
once per language family per session.

### Track 2 — Normalized workspace store — DONE

Steps

1. `core/workspace-store/`: dependency-free external store
   (`useSyncExternalStore`) with narrow selectors. Slices: connections,
   schemas by connection, tabs, table snapshots (last rows + columns + sort +
   filters by `conn/table`), saved queries, snippets, UI chrome (nav, dialogs).
2. Single `bootstrap` Tauri command returning connections, settings, snippets,
   saved queries and any cached schema metadata in one IPC; the renderer
   normalizes it before dismissing the boot screen.
3. Table navigation reads the snapshot synchronously and paints; a background
   refresh reconciles. Delete `core/table-cache.ts` and the React Query
   `tableData` key; React Query remains only for truly remote-fresh fetches
   (Docker, provider APIs).
4. Decompose `pages/Index.tsx` into `WorkspaceShell` (layout) + slice
   consumers; dialogs become store-driven so opening one does not render the
   grid or editor.
5. Render-count tests per the contract's render-invariant table.

First PR: store skeleton + tabs and connections slices migrated, `Index.tsx`
reading them through selectors; no behaviour change.

Exit: keystroke and cached-navigation render budgets green; `Index.tsx` under
300 lines.

### Track 3 — Streaming query transport and windowed grid — DONE (SQL console); profiling and fixing the Data Viewer navigation frame is the follow-up

Steps

1. Rust: `QueryEvent { Columns, RowBatch(Vec<Row>), Progress, Done, Error }`
   pushed through `tauri::ipc::Channel` from `StatementManager`; polling
   `fetch_query` stays for one release behind a flag, then goes.
2. Raise the buffer page to 500–1,000 rows; encode rows as arrays not objects
   (columns sent once), and evaluate `tauri::ipc::Response` raw bytes or a
   columnar encoding for results over a size threshold.
3. Frontend `QueryPort` consumes the channel; results object exposes
   `rows(range)` backed by buffered pages plus on-demand `fetch_page`.
   `collectAllRows` is deleted; export and copy iterate pages.
4. Grid virtualizer (`data-grid/use-row-virtualizer.ts`) requests windows;
   total count from `affected_rows`; no full-array materialization.
5. Cancellation wired end to end (the Rust side already has it).

First PR: Rust channel + frontend consumer behind a flag, grid unchanged.

Exit: 100k-row budget green; memory for a 1M-row result bounded by the window
and page cache.

### Track 4 — Adapter seam as the only door (ports)

Steps

1. Split `DataAdapter` into ports: `QueryPort`, `SchemaPort`, `MutationPort`,
   `ConnectionPort`, `AiPort`, `IntegrationsPort`, `DockerPort`, `SystemPort`.
2. Move the 65 direct `lib/bindings` imports in `features/` behind ports;
   ESLint `no-restricted-imports` bans `lib/bindings` outside `core/`.
3. Mock implementations for every port so browser mode, Playwright, promos and
   the perf harness cover the real UI paths.
4. Contract test suite run against mock and (behind `DORA_LIVE_DB_TESTS`) the
   Tauri adapter to catch drift.

First PR: ports types + lint rule + migrate one feature (ai-assistant, 9
files) as the template.

Exit: zero `lib/bindings` imports outside `core/`; contract suite green on both
adapters.

### Track 5 — Mutation pipeline

Steps

1. Rust `Mutation` enum (`UpdateCell`, `InsertRow`, `DeleteRows`,
   `AddColumn`, `DropColumn`, `AlterColumn`, `RawSql`) exposed via specta.
2. `apply_mutations(conn, Vec<Mutation>, dry_run)` returning generated SQL and
   per-mutation results; per-connection FIFO so ordering is explicit.
3. Frontend: `pending-edits` and `undo` queue `Mutation` values; cell edits
   paint in the same frame, ack carries the result; DDL mutations bump a
   schema version that invalidates the schema slice.
4. One preview/confirm surface shared by every dialog (drop table, bulk edit,
   set null, add column…).

First PR: `Mutation` type + `apply_mutations` with `dry_run` + migrate cell
edits.

Exit: every write in the studio goes through `apply_mutations`; dry-run
preview available everywhere.

### Track 6 — Engine and provider registries

Steps

1. `EngineDescriptor { kind, capabilities, dialect, make_read, make_write,
   make_watch }` in a static registry; the stored connection type id and the
   studio `Record<DatabaseType, …>` tables are generated from it.
2. Collapse the per-engine match sites (the D1 note counts ~20 across three
   enums) to registry lookups.
3. `ProviderSpec` (auth scheme, endpoints, mapping) for the common "token →
   projects → databases → connection string" shape; Supabase-style specials
   keep hand-written adapters.

First PR: registry + migrate SQLite and Postgres, leave others on the old path.

Exit: adding an engine is one file plus one registry line; Redis/Valkey lands
through it.

### Track 7 — Rust workspace split

Not a runtime win (fat LTO already erases crate boundaries). Build-time,
testability and reuse win; forces Track 4's "Tauri in one crate" rule.

Crates: `dora-types`, `dora-engine` (adapters, dialects, stmt manager,
services; no tauri), `dora-duckdb` (+ helper bin), `dora-integrations`,
`dora-ai`, `dora-storage`, `dora-app` (Tauri). `EventSink` trait in engine,
implemented with `AppHandle` in app.

First PR: extract `dora-types` + `dora-engine`; let compiler errors locate the
25 `tauri::` leaks.

Exit: `cargo test -p dora-engine` runs without Tauri; `tauri` appears in one
crate.

### Track 8 — Persistence consolidation

Steps

1. One versioned settings schema in `core/settings` with a migration step.
2. Persist through Rust `Storage` (SQLite) instead of 14 `localStorage`
   callers; survives WebView data clears, multi-window safe, exportable.
3. "Reset to defaults" and settings export/import become one feature.

First PR: schema + migrate appearance, zoom and sidebar width.

Exit: zero direct `localStorage` writers outside `core/settings`.

### Track 9 — Finish DuckDB out-of-process, then generalise

Existing work on `feat/duckdb-helper-process`. Completing it gives bundle size,
startup and crash isolation. The helper pattern then serves any heavy engine.

## Sequencing

```text
Track 0 (contract + harness)
├── Track 1 (keep-alive, editor host)  ──┐
├── Track 2 (workspace store)  ──────────┼── Track 5 (mutation pipeline)
└── Track 3 (streaming transport, grid) ─┘
Track 4 (ports) ── runs alongside 1–3; required before 5 finishes
Track 7 (crate split) ── independent; ideally after 3 so query types are final
Track 6, 8, 9 ── independent, any time
```

Recommended order for a single developer: 0 → 1 → 2 → 3 → 4 → 5, with 7 and 9
as background work between milestones and 6/8 when touching those areas anyway.

Milestone A (tracks 0–1): no remounts, editors warm, measurable.
Milestone B (tracks 2–3): instant cached navigation, streaming results.
Milestone C (tracks 4–5): one door to the backend, one write pipeline.
Milestone D (tracks 6–9): structural clean-up and bundle size.

## Non-goals

- Serialized single FIFO runtime across all connections (Skriuw's model);
  Dora wants concurrency across remote databases, ordering only per
  connection for writes.
- Making first contact with remote data instant.
- Rewriting the UI framework or state library; the store is dependency-free by
  design and React stays the view layer.

## Open questions

- Dedicated perf runner hardware for CI timing assertions, or local-only
  script with committed evidence for now.
- Row encoding for large results: arrays over JSON vs. a binary/columnar
  format; decide after Track 3's first measurement.
- Whether `pages/Index.tsx` navigation state should move to the URL
  (`core/url-state` exists) or stay in the store.

## Prompts per track

Each prompt is self-contained for a fresh agent session: it points at this
document, names the files, and states the exit criterion.

### Track 0

Read docs/architecture-roadmap.md, Track 0. Implement it: (1) write
docs/performance-contract.md with the budgets listed there; (2) add
mock-adapter fixtures (200-table/2000-column schema, 100k-row table, 10
connections, 50 saved queries; deterministic, generated, not committed as
data); (3) build a Playwright harness under
packages/studio/src/test/performance that drives browser-mode Studio
(localhost:1420, mock adapter), records performance.mark/measure around view
switch, table switch, connection switch and keystroke, LoAF long tasks and
React Profiler commit counts for the shell, and outputs raw samples plus
P50/P95/max JSON; (4) add a `bun perf` script; CI runs only invariant
assertions (zero remounts, zero shell commits), not timings; (5) run it and
commit the baseline to docs/benchmarks/<date>-baseline.md. Do not change
product code. Exit: baseline committed; remount and keystroke-commit tests
exist and are red.

### Track 1

Read docs/architecture-roadmap.md, Track 1, and docs/performance-contract.md.
Replace the activeNavId ternary chain in packages/studio/src/pages/Index.tsx
with a WorkspaceViews component that mounts each view on first open and
toggles hidden/inert via CSS, never unmounting. Remove key={studioConnectionId}
on DatabaseStudio and the error-boundary resetKeys remount; move
connection-scoped state into per-connection keyed state. Create
core/editor-host: one Monaco instance per language family (SQL; TS for
drizzle/prisma), models in a Map<tabId, ITextModel> owned outside components,
setModel on tab switch, themes/fonts/workers configured once; remove
per-feature lazy() of Monaco and preload Monaco, workers and fonts during
boot-screen.ts. Run `bun perf`: zero-remount tests green, view and connection
switch budgets pass. Keep every shortcut scope working. Run vitest and oxfmt.

### Track 2

Read docs/architecture-roadmap.md, Track 2. PR A: core/workspace-store, a
dependency-free external store via useSyncExternalStore with narrow selectors
and slices for connections, schemas, tabs, tableSnapshots, savedQueries,
snippets and uiChrome; migrate tabs and connections first with no behaviour
change; add render-count tests per the contract's render-invariant table.
PR B: a Rust `bootstrap` command returning connections, settings, snippets,
saved queries and cached schema metadata in one IPC, normalized before the
boot screen dismisses; table navigation paints the snapshot synchronously and
refreshes in the background; delete core/table-cache.ts and the tableData
React Query key; split Index.tsx into WorkspaceShell plus slice consumers
with store-driven dialogs. Target: Index.tsx under 300 lines; keystroke and
cached-navigation render budgets green.

### Track 3

Read docs/architecture-roadmap.md, Track 3. Rust first: QueryEvent {
Columns, RowBatch, Progress, Done, Error } pushed through tauri::ipc::Channel
from StatementManager; keep fetch_query polling behind a flag for one
release; raise DEFAULT_QUERY_PAGE_SIZE to 500–1000; send rows as arrays with
columns once; regenerate specta bindings. Frontend: a QueryPort consuming the
channel whose result exposes rows(range) backed by buffered pages plus
on-demand fetchPage; delete collectAllRows in
core/data-provider/adapters/tauri.ts; make data-grid/use-row-virtualizer
request windows; export and copy iterate pages; wire cancellation end to end.
Verify with the 100k-row fixture: first paint under 100 ms, bounded memory.
Add Rust tests for the channel and a mock-adapter streaming implementation.

### Track 4

Read docs/architecture-roadmap.md, Track 4. Split DataAdapter into QueryPort,
SchemaPort, MutationPort, ConnectionPort, AiPort, IntegrationsPort,
DockerPort and SystemPort. Add an ESLint no-restricted-imports rule banning
lib/bindings outside core/. Migrate features/ai-assistant as the template
with a mock AiPort. Add a contract test suite run against the mock adapter
and, behind DORA_LIVE_DB_TESTS=1, the Tauri adapter. Follow-up PRs migrate
the remaining direct bindings imports feature by feature. Exit: no
lib/bindings imports under packages/studio/src/features.

### Track 5

Read docs/architecture-roadmap.md, Track 5 (requires Track 4's
MutationPort). Rust: a specta-exposed Mutation enum (UpdateCell, InsertRow,
DeleteRows, AddColumn, DropColumn, AlterColumn, RawSql) and
apply_mutations(connection_id, Vec<Mutation>, dry_run) returning generated
SQL and per-mutation results, FIFO per connection. Frontend:
core/pending-edits and core/undo queue Mutation values; cell edits paint
same-frame and reconcile on ack; DDL mutations bump a schema version that
invalidates the schema slice; one shared preview/confirm dialog used by every
write dialog. Migrate cell edits first, then each dialog. Exit: every write
goes through apply_mutations with dry-run preview available.

### Track 6

Read docs/architecture-roadmap.md, Track 6, and the dora-add-database-driver
skill. Introduce EngineDescriptor in a static registry under
database/adapter; migrate SQLite and Postgres; generate the stored connection
type id mapping and the studio Record<DatabaseType, …> tables from it; then
migrate the remaining engines one PR each. Separately add a ProviderSpec for
the token→projects→databases→connection-string providers in
src/integrations, keeping Supabase-style specials hand-written. Exit: adding
an engine is one file plus one registry line.

### Track 7

Read docs/architecture-roadmap.md, Track 7. Convert apps/desktop/src-tauri
into a Cargo workspace. First PR: extract dora-types and dora-engine with no
tauri dependency; introduce an EventSink trait implemented in the app crate
with AppHandle; fix the tauri:: leaks under database/ that the compiler
reports. Keep the duckdb-engine feature and duckdb_helper bin building. Use
[workspace.dependencies]. Exit: cargo test -p dora-engine passes without
Tauri; release binary size unchanged; CI green.

### Track 8

Read docs/architecture-roadmap.md, Track 8. Define one versioned settings
schema in core/settings with a migration step, persisted through the Rust
Storage via a settings port. Migrate appearance-store, ui-zoom and
use-sidebar-width first, then the remaining localStorage writers. Add
reset-to-defaults and export/import. Exit: no localStorage writes outside
core/settings.

### Track 9

Read docs/duckdb-helper-process.md. Finish the feat/duckdb-helper-process
branch: complete the DuckDbConn trait migration, download libduckdb on first
use, keep duckdb_ipc tests green, measure binary size before and after and
record it in docs/benchmarks. Then write a short design note on generalising
the helper pattern for future heavy engines.
