# Dora Product Roadmap

Bugs and debt first, then features. Items within each tier are ordered by impact/effort ratio.

---

## Tier 0 — Must fix before next release

### 0-1. TypeScript build gate broken
**File:** `bun x tsc --noEmit -p apps/desktop/tsconfig.app.json` → fails  
**Why:** CI cannot enforce type safety. Any agent can silently introduce type regressions.  
**Fixes needed:**
- `src/components/ui/sonner.tsx:6` — `ToasterProps` not imported
- `src/core/data-generation/schema-analyzer.ts:11` — `faker.internet.userName` invalid in current typings (use `faker.internet.username`)
- `src/features/database-studio/database-studio.tsx:1490` — passes `pagination`/`onPaginationChange` props not in `StudioToolbar`
- Remaining `result.error` access without narrowing across adapter types
- After fix: add `tsc --noEmit` to CI so it stays green

### 0-2. Error shape breaking change needs frontend wire-up
**Why:** Phase 3 backend refactor changed error serialization from `{ name, message }` to `{ kind, detail }`. Frontend error handling reads the old shape.  
**Files to update:**
- `src/core/data-provider/adapters/tauri.ts` — `getAdapterError()` and any `.message` / `.name` reads
- `src/core/data-provider/types.ts` — `AdapterError` type
- Any toast/error display that destructures `error.message`

### 0-3. SQL Console filter action is a stub
**File:** `src/features/sql-console/sql-console.tsx:663` — shows "Coming Soon"  
**Fix:** Wire up client-side row filtering on the result grid (filter by column value). Backend not needed — pure frontend. Use existing `result.rows` array.

---

## Tier 1 — High value, relatively contained

### 1-1. MySQL full parity
**Status:** Backend connectivity landed (PR #43-45). Schema browsing works. Mutations still hit the `WriteAdapter::NotImplemented` stub.  
**Blocked by:** Backend Phase 5b (WriteAdapter port).  
**After 5b lands:**
- Re-enable MySQL option in `connection-dialog/database-type-selector.tsx` (remove `disabled` prop)
- Test full round-trip: connect → browse schema → edit cell → insert row → delete row
- Export table as CSV/JSON from MySQL source

### 1-2. Schema visualizer
**Branch exists:** `feat/schema-visualizer` (stashed/WIP)  
**What it is:** ERD-style view of table relationships (FK arrows, column types).  
**Implementation path:**
- Use `get_database_schema` command (already exists, returns `DatabaseSchema`)
- Render with `reactflow` or plain SVG — FK edges from `foreign_keys` field on `TableInfo`
- Entry point: sidebar table context menu → "Visualize Schema"
- No backend changes needed

### 1-3. Query history improvements
**Current state:** History saved, displayed in a flat list. No search, no favorite pinning, no grouping by connection.  
**Spec:**
- Search/filter by query text
- Pin queries to top (persist `favorite: bool` — field exists in `SavedQuery` struct but unused in UI)
- Group by connection ID with connection name label
- Show execution time from history entry

### 1-4. Drizzle runner — make it useful
**Current state:** Drizzle runner exists as a feature but runs raw Drizzle ORM queries against the connection. Limited discovery.  
**Spec:**
- Add schema autocomplete in the editor (table/column names from current connection's schema)
- Show generated SQL preview before execution
- Export result as Drizzle insert statements

### 1-5. Bundle size — lazy-load Monaco
**Current state:** Monaco editor loads eagerly in the main chunk. Build warns about chunk sizes >500KB.  
**Fix:**
- `React.lazy(() => import('./features/sql-console'))` and `./features/drizzle-runner`
- Add `<Suspense>` wrappers with skeleton loaders
- Expected win: ~40-60% reduction in initial bundle
- Files: `src/App.tsx` routing, or wherever SQL Console / Drizzle Runner are mounted

---

## Tier 2 — Medium value, requires planning

### 2-1. Table structure view
**What:** Dedicated tab in Database Studio showing column definitions, types, constraints, indexes — not just data.  
**Backend:** `get_database_schema` already returns column metadata. Just a UI view.  
**Spec:**
- Columns tab: name | type | nullable | default | primary key | foreign key
- Indexes tab: index name | columns | unique | type
- Constraints tab: FK references with jump-to-table link
- DDL tab: shows `CREATE TABLE` statement (already exported via `export_schema_sql` command)

### 2-2. Todo list feature
**Status:** Planned, no implementation.
**Implementation path:**
- Backend: add `todos` table to SQLite storage migrations (add `migrator.rs`)
- Tauri commands: `create_todo`, `list_todos`, `update_todo`, `delete_todo`
- Frontend: `TodoList`, `TodoItem`, `CreateTodoDialog` components
- Sidebar nav item already exists (`todo-list` feature folder exists)

### 2-3. Keyboard shortcut coverage
**Current state:** Command registry exists with `CommandRegistry` (Phase 1 backend). Frontend command palette exists. Gap: most actions don't have registered shortcuts.  
**Spec:**
- Map common actions: run query (`Cmd+Enter`), new connection (`Cmd+Shift+N`), focus search (`Cmd+K`), close tab, next/prev connection
- Expose shortcut customization UI (settings panel → keyboard shortcuts)
- `update_command_shortcut` backend command already exists

### 2-4. Connection groups / folders
**What:** Allow grouping connections (e.g. "production", "staging", "local"). Visual separation in sidebar.  
**Backend work:** Add `group` field to `ConnectionInfo`. Migrate storage. No new commands needed.  
**Frontend work:** Group sidebar connections under collapsible headers. Drag to reorder groups.

### 2-5. Telemetry decision
**Current state:** `@vercel/analytics/react` renders `<Analytics />` in `App.tsx`. Unclear if users are informed.  
**Action needed:** Make a decision — opt-in with explicit consent dialog on first launch, or remove. Do not leave undisclosed.  
**Files:** `src/App.tsx:14`, `src/App.tsx:32`

---

## Tier 3 — Planned, no immediate action

### 3-1. MariaDB / CockroachDB support
**After MySQL reaches Level 2 (full parity).**  
- MariaDB: mostly a MySQL compatibility pass with minor dialect differences
- CockroachDB: Postgres-wire protocol, should work with Postgres driver + dialect flag

### 3-2. MSSQL (SQL Server) support
**Requires:** New Rust driver (`tiberius` crate). New adapter impl in `database/adapter/`.  
**Estimate:** ~3 days backend + 1 day frontend after WriteAdapter (Phase 5b) lands.

### 3-3. Live monitor per-driver trait (Phase 5c)
**What:** Extract SQLite-specific polling from `live_monitor.rs` into `WatchAdapter` trait, implement per driver so live monitoring works for Postgres, MySQL, LibSQL.

### 3-4. Native notifications for live monitor events
**Current state:** Live monitor emits Tauri events → frontend shows in-app banner.  
**Enhancement:** Also trigger OS-level notification when app is backgrounded.  
**Tauri plugin:** `tauri-plugin-notification` (already in ecosystem).

### 3-5. AI context-aware query generation
**Current state:** AI commands exist (`ai_complete`, `ai_set_provider`). Basic completion.  
**Enhancement:** Pass current table schema + selected rows as context to the AI prompt so it can generate targeted queries, explain query plans, suggest indexes.

### 3-6. Query plan visualization
**What:** Run `EXPLAIN ANALYZE` on a query and render the plan as a tree diagram.  
**Backend:** New command `explain_query(connection_id, sql) -> ExplainResult`.  
**Frontend:** Tree/flamegraph component showing node cost, rows, timing.

---

## Frontend quality checklist (any agent can pick these up)

- [ ] Fix TypeScript build gate (`tsc --noEmit` green) — **Tier 0-1**
- [ ] Wire new error shape `{ kind, detail }` in `tauri.ts` adapter — **Tier 0-2**
- [ ] Implement SQL Console column filter (remove "Coming Soon") — **Tier 0-3**
- [ ] Lazy-load Monaco / SQL Console / Drizzle Runner — **Tier 1-5**
- [ ] Schema visualizer (branch: `feat/schema-visualizer`) — **Tier 1-2**
- [ ] Query history: search + pin + group by connection — **Tier 1-3**
- [ ] Table structure view tab in Database Studio — **Tier 2-1**
- [ ] Todo list implementation — **Tier 2-2**
- [ ] Keyboard shortcut UI in settings — **Tier 2-3**
- [ ] Connection groups/folders — **Tier 2-4**
- [ ] Telemetry opt-in dialog or removal — **Tier 2-5**

---

## Decision log

| Decision | Status | Notes |
|----------|--------|-------|
| Vite vs Next.js for desktop | Stay Vite | Desktop is Tauri, no SSR benefit. Add `apps/web` Next.js separately for marketing/demo |
| Mock adapter | Keep | `/demo` route uses mock adapter for web preview without Tauri |
| MySQL | Enabled in backend, disabled in UI | Re-enable after Phase 5b WriteAdapter ports |
| Telemetry | Undecided | Must resolve before public release announcement |
| MSSQL | Planned | After MySQL reaches full parity |
| File-as-database (CSV/Parquet/JSON) | Shipped | Spec 02 — flat files open as read-only DuckDB views; drag-and-drop or "Open data file". Follow-up: dedicated "Materialize to database" action |
