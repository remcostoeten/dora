# Dora Source Metadata — Phase 1 Hardening Report

## Summary

Phase 1 hardening tightened the frontend-only source metadata layer without expanding scope. No Rust changes, no new engines, no speculative capabilities, no `DbPreset` persistence.

The metadata layer is now the **single frontend entry point** for source kind, preset detection, readonly state, and UI action visibility — via `source-metadata.ts` and its modules.

---

## 1. Single frontend place verification

| Concern | Module | Function(s) |
|---------|--------|---------------|
| Source kind | `resolve-source.ts` | `describeConnectionSource()` → `SourceMeta.kind` |
| Preset detection | `resolve-source.ts` | `describeConnectionSource()` → `SourceMeta.preset` |
| Wire family | `resolve-source.ts` | `resolvePresetToEngine()` |
| Readonly state | `source-caps.ts` | `getSourceCaps().isReadonly`, `isReadonlySource()` |
| UI action visibility | `ui-actions.ts` | `isUiActionVisible()`, `getVisibleUiActions()` |
| Dev inspection | `source-debug.ts` | `resolveSourceDebugInfo()`, `logSourceDebugInfo()` |
| Public barrel | `source-metadata.ts` | Re-exports all of the above |

**Deprecated shim:** `isReadOnlyConnection()` in `types.ts` now delegates to `isReadonlySource()` in `source-caps.ts`.

---

## 2. Files changed (this hardening pass)

| File | Change |
|------|--------|
| `packages/studio/src/features/connections/ui-actions.ts` | Added `getVisibleUiActions()`, `STUDIO_UI_ACTIONS` list |
| `packages/studio/src/features/connections/source-caps.ts` | Added `isReadonlySource()` |
| `packages/studio/src/features/connections/types.ts` | `isReadOnlyConnection()` delegates to `isReadonlySource()` |
| `packages/studio/src/features/connections/source-debug.ts` | **New** — dev helper for resolved metadata |
| `packages/studio/src/features/connections/source-metadata.ts` | **New** — public barrel export |
| `packages/studio/src/features/database-studio/database-studio.tsx` | Fixed SelectionActionBar + PendingChangesBar readonly gating |
| `packages/studio/src/features/connections/components/connection-dialog.tsx` | `useConnectionString` / type select use caps |
| `__tests__/ui-actions.test.ts` | **New** — 7 ui-actions tests |
| `__tests__/source-debug.test.ts` | **New** — debug helper test |

*(Phase 1 initial implementation also added `source-kinds.ts`, `resolve-source.ts`, `source-caps.ts`, `ui-actions.ts`, wired connection-form + database-studio, and `__tests__/source-caps.test.ts`.)*

---

## 3. Remaining conditionals and why they stay

### Should stay — engine-specific rendering

| Location | Conditional | Why |
|----------|-------------|-----|
| `connection-form.tsx` | `engine === "libsql"` | libSQL has a unique URL + auth token form, not generic network fields |
| `connection-form.tsx` | `engine === "sqlite" \|\| engine === "duckdb"` | Different placeholders, picker commands, help text |
| `connection-form.tsx` | `engine === "duckdb"` in `handleBrowseFile` | Calls `openFile` vs `openSqliteDb` |
| `connection-form.tsx` | `formData.type === "postgres"` | Pooler mode is Postgres-specific (Neon/PgBouncer) |
| `connection-dialog.tsx` | `formData.type === "mysql/mariadb/cockroach"` | Builds correct `DatabaseInfo` variant for backend |
| `connection-dialog.tsx` | `nextType === "postgres" \|\| "cockroach"` for pooler | Postgres-family URL flag detection |
| `database-icons.tsx` / `database-type-selector.tsx` | Per-`DatabaseType` icons/themes | Pure presentation |
| `mapping.ts` | All `conn.type === …` branches | Serialization to `DatabaseInfo` — backend contract |
| `validation.ts` | Per-type Zod schemas | Validation rules differ by wire protocol |
| `providers.ts` | `params.type === 'sqlite'` etc. in `buildConnectionString` | Connection string builder throws for file-based types |
| `tauri.ts` | `databaseInfoToDialect()` | SQL quoting dialect for table refs |
| `command-palette.tsx` | `connection.type === "sqlite" \|\| "libsql"` in `formatConnectionTarget` | Display formatting only |

### Should stay — lives in metadata layer (correct place)

| Location | Conditional | Why |
|----------|-------------|-----|
| `resolve-source.ts` | `connection.type === 'cockroach'` etc. | Preset inference from engine label |
| `resolve-source.ts` | `fileSources?.length > 0` | Data-file session detection |
| `resolve-source.ts` | `libsql && url?.startsWith('file:')` | Local vs remote libSQL kind |
| `source-caps.ts` | `meta.isDataFileSession` | Readonly overrides |

### Moved to caps (done)

| Was | Now |
|-----|-----|
| `isReadOnlyConnection(c)` type + fileSources check | `getSourceCaps().isReadonly` |
| Connection form `type === sqlite/duckdb/libsql/postgres…` blocks | `isUiActionVisible('local-file'/'remote-url'/'ssh-tunnel')` |
| Validation SSH `type === postgres \|\| …` | `getSourceCaps().supportsSshTunnel` |
| Connection dialog `type === sqlite/duckdb/libsql` for connection string toggle | `getSourceCaps().supportsSshTunnel` |
| Database studio `readOnly` prop | `canEditRows` / `isUiActionVisible` from active connection caps |

### Should move later (Phase 2–3, not blocking)

| Location | Conditional | Target |
|----------|-------------|--------|
| `connection-dialog.tsx` save/test handlers | `formData.type === "sqlite"` etc. | Could use `describeConnectionSource().kind` + mapping helper |
| `command-palette.tsx` | sqlite/libsql display branch | `supportsLocalFile` + engine for label |
| `connection-dialog.tsx` pooler checkbox | `type === "postgres"` | `preset === 'neon' \|\| engine === 'postgres'` or dedicated cap later |

### Should be deleted — none found

No dead conditionals identified. All remaining checks serve rendering, serialization, or validation.

### Not related (ignore)

- `Index.tsx` / `docker-view.tsx` `event.payload.type === "drop"` — drag-drop events, not DB engine
- `database-sidebar.tsx` `table.type === "view"` — schema object type, not connection engine
- `result-charts` / `sql-console` `detail.type` — UI event types

---

## 4. Tests added

### `__tests__/ui-actions.test.ts` (7 tests)

- Readonly data-file sessions hide edit actions
- Data-file sessions hide import/edit but keep export
- SQLite shows local file actions, not remote URL or SSH
- DuckDB `.duckdb` file shows local file + edit actions
- libSQL shows remote URL, not SSH
- SQL servers (postgres/cockroach/mysql/mariadb) show SSH
- Embedded engines (sqlite, duckdb, libsql) do not show SSH

### `__tests__/source-debug.test.ts` (1 test)

- `resolveSourceDebugInfo()` returns kind, engine, preset, wireFamily, isReadonly, visible actions

### Existing `__tests__/source-caps.test.ts` (8 tests, unchanged)

- DuckDB data-file readonly, DuckDB file editable, SQLite editable
- Neon/Supabase presets, MariaDB/Cockroach wire mapping
- CSV/JSON/Parquet data-file sessions

**All 16 tests pass** across the three files.

---

## 5. Dev helper

```typescript
import { resolveSourceDebugInfo, logSourceDebugInfo } from '@studio/features/connections/source-metadata'

const info = resolveSourceDebugInfo(connection)
// info.kind, info.engine, info.preset, info.wireFamily, info.isReadonly, info.visibleUiActions

logSourceDebugInfo(connection, 'My connection') // logs in DEV only
```

Or import from `source-debug.ts` directly.

---

## 6. Connection form behavior check

| Source | Expected | Status |
|--------|----------|--------|
| SQLite | File picker (`openSqliteDb`) | ✅ `local-file` + `engine === 'sqlite'` |
| DuckDB file | File picker (`openFile`) | ✅ `local-file` + `engine === 'duckdb'` |
| DuckDB data files | Via drag-drop / `openDataFiles`, not connection form | ✅ Not configured in form |
| libSQL | URL + auth token fields | ✅ `engine === 'libsql'` branch |
| Postgres/MySQL/MariaDB/Cockroach | Host/port/user/password or connection string | ✅ `remote-url` + `ssh-tunnel` |
| SSH tunnel | Only SQL servers | ✅ Gated by `supportsSshTunnel` |

---

## 7. Database studio readonly behavior check

| Action | Gated by | Status |
|--------|----------|--------|
| Add row | `canEditRows` | ✅ |
| Delete row (grid + selection bar) | `canEditRows` | ✅ (fixed in hardening) |
| Cell edit | `canEditRows` | ✅ |
| Batch edit / duplicate / set null | `canEditRows` on SelectionActionBar | ✅ (fixed in hardening) |
| DDL (add column, drop table) | `canEditRows` | ✅ |
| Dry-edit mode | `canEditRows` | ✅ |
| Pending changes bar | `canEditRows && hasEdits` | ✅ (fixed in hardening) |
| Import CSV | `canImportFile` | ✅ |
| Export JSON/CSV/SQL | `canExportFile` | ✅ (still available on data files) |
| Live monitor | `supportsLiveMonitor` | ✅ hidden for DuckDB/data files |
| SQL query (console) | Not gated — `canRunSql` always true | ✅ by design |

---

## 8. Regressions found and fixed

| Issue | Fix |
|-------|-----|
| **SelectionActionBar** still exposed delete/duplicate/bulk-edit on readonly data-file sessions | Gated mutation handlers with `canEditRows`; export with `canExportFile` |
| **PendingChangesBar** could show on readonly connections if edits existed | Added `canEditRows &&` guard |
| **Content view toolbar** previously missed readonly guards on add/import (fixed in initial Phase 1) | Already using caps |

No Rust regressions. No connection form regressions found in review.

---

## 9. Is Phase 1 complete?

**Yes, with a narrow definition:**

✅ Frontend metadata layer exists and is the single source of truth for caps/readonly/UI actions  
✅ Connection form and database studio use caps instead of ad-hoc type checks for visibility  
✅ Tests cover caps, ui-actions, and debug helper  
✅ Dev helper available  
✅ Known readonly regression in selection bar fixed  

**Not in Phase 1 scope (defer to Phase 2+):**

- Persisting `DbPreset` on connections
- Replacing `mapping.ts` / save-handler type switches
- Backend `get_source_capabilities` command
- Pooler mode as a capability flag
- Command palette display using caps
- Attaching files to native `.duckdb` databases (cap exists, UI gated — see Phase 2 `ATTACH_FILE_UI_IMPLEMENTED`)
- Normalized provider preset badges in connection list ✅ (Phase 2)

Phase 1 is **complete**. Phase 2 UX is documented in `source-metadata-phase2-ux.md`.

**Merge guidance:** Ship Phase 1 + Phase 2 as one unit. See `source-metadata-roadmap.md`.

---

## 10. Usage for new UI features

```typescript
import {
  getSourceCaps,
  isUiActionVisible,
  describeConnectionSource,
  resolveSourceDebugInfo,
} from '@studio/features/connections/source-metadata'

const caps = getSourceCaps(connection)

if (isUiActionVisible('edit-rows', caps)) {
  // show edit affordance
}
```

Do **not** add new `connection.type === '…'` checks for visibility. Add a cap in `source-caps.ts` only when the UI actually needs it.
