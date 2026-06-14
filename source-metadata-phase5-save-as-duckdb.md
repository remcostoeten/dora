# Source metadata — Phase 5: Save data-file session as DuckDB

**Goal:** Allow users to materialize a readonly CSV/JSON/Parquet data-file session into a real editable `.duckdb` database file.

**Status:** ✅ Done

---

## Out of scope (unchanged)

- No new engines
- No write support for CSV / JSON / Parquet
- No DuckDB execution rewrite
- No persisted data-file registration status
- No source metadata changes unless required for wiring
- Original data-file connection is not modified by save

---

## Current behavior (before → after)

| Before | After |
|--------|-------|
| Data-file sessions are in-memory DuckDB with readonly views | User can materialize active views into a `.duckdb` file on disk |
| “Save as DuckDB” was a disabled placeholder | Real save action with dialog, confirmations, and auto-connect |
| CSV/JSON/Parquet stay readonly forever in-session | Saved `.duckdb` connection is editable via existing caps |

Underlying model unchanged: data-file sessions remain `DatabaseInfo::DuckDB { db_path: ":memory:", file_sources: [...] }` until the user explicitly saves.

---

## Files changed

### New — Rust

| File | Role |
|------|------|
| `apps/desktop/src-tauri/src/database/duckdb/save_session.rs` | Materialize active views via `ATTACH` + `CREATE TABLE AS SELECT`; validation; 5 unit tests |

### Updated — Rust

| File | Role |
|------|------|
| `apps/desktop/src-tauri/src/database/duckdb.rs` | Export `save_session` module |
| `apps/desktop/src-tauri/src/database/services/connection.rs` | `save_data_file_session_as_duckdb()` service method |
| `apps/desktop/src-tauri/src/database/commands/connections.rs` | Tauri command |
| `apps/desktop/src-tauri/src/bindings.rs` | Specta command registration |
| `apps/desktop/src-tauri/src/lib.rs` | Invoke handler registration |

### New — Frontend

| File | Role |
|------|------|
| `packages/studio/src/features/database-studio/components/save-as-duckdb-button.tsx` | Save dialog, overwrite + skipped confirmations, loading state |
| `packages/studio/src/features/database-studio/hooks/use-save-data-file-session.ts` | Save mutation + create/reuse/connect saved DuckDB connection |
| `packages/studio/src/features/database-studio/utils/save-data-file-session.ts` | Pure helpers (find connection, toast copy, caps checks) |
| `__tests__/save-data-file-session.test.ts` | 6 frontend tests |
| `source-metadata-phase5-save-as-duckdb.md` | This document |

### Updated — Frontend

| File | Role |
|------|------|
| `packages/studio/src/features/database-studio/components/data-file-session-chrome.tsx` | Wires real save action in source panel header |
| `packages/studio/src/features/database-studio/database-studio.tsx` | Passes `onConnectionSelect` |
| `packages/studio/src/pages/Index.tsx` | Switches active connection after save |
| `packages/studio/src/core/data-provider/types.ts` | `saveDataFileSessionAsDuckdb` adapter method |
| `packages/studio/src/core/data-provider/adapters/tauri.ts` | IPC call |
| `packages/studio/src/core/data-provider/adapters/mock.ts` | Mock implementation |
| `apps/desktop/src/lib/bindings.ts` | Regenerated specta types |
| `packages/studio/src/lib/bindings.ts` | Synced from desktop bindings |

### Removed

| File | Reason |
|------|--------|
| `packages/studio/src/features/database-studio/components/save-as-duckdb-placeholder.tsx` | Replaced by `save-as-duckdb-button.tsx` |

---

## Tauri command shape

```typescript
commands.saveDataFileSessionAsDuckdb(
  connectionId: string,
  destinationPath: string,
  overwrite: boolean
): Promise<Result<SaveDataFileSessionResult, BackendError>>

type SaveDataFileSessionResult = {
  path: string
  tables: {
    name: string
    sourcePath: string
    rowCount: number | null
  }[]
  skipped: {
    path: string
    viewName: string
    status: 'missing' | 'failed'
    error: string | null
  }[]
  warnings: string[]
}
```

### Backend validation

- Source connection exists
- Source is DuckDB with non-empty `file_sources` (data-file session)
- Session is connected
- At least one `active` entry exists
- Destination path is non-empty, ends with `.duckdb`, parent directory exists
- Existing destination rejected unless `overwrite: true` (file removed before write)

### Materialization

1. Open in-memory source connection (already connected).
2. `ATTACH` destination `.duckdb` file as `dora_dest`.
3. For each **active** entry: `CREATE TABLE dora_dest."{viewName}" AS SELECT * FROM "{viewName}"`.
4. Resolve table name collisions with numeric suffix (`sales_2`, …).
5. Record row counts; collect missing/failed entries in `skipped`.
6. `DETACH` destination; on failure, delete incomplete destination file.

Saved DuckDB connections use `DatabaseInfo::DuckDB { db_path: "<path>", file_sources: [] }`.

---

## UI flow

```
Open CSV/JSON/Parquet
        ↓
Inspect as readonly views
        ↓
Click "Save as DuckDB"
        ↓
Native save dialog (.duckdb)
        ↓
[File exists?] → Overwrite confirmation
        ↓
[Missing/failed sources?] → Continue confirmation
        ↓
Backend materializes active views → physical tables
        ↓
Create or reuse saved DuckDB connection (fileSources: [])
        ↓
Connect + select in connection switcher
        ↓
Toast: "Saved 3 tables to analytics.duckdb"
```

### UX details

| Step | Behavior |
|------|----------|
| Save button | In data-file source panel header; shows spinner while saving |
| Overwrite | Explicit confirm before replacing an existing `.duckdb` file |
| Skipped sources | Confirm when some entries are missing/failed; only active sources saved |
| After success | Switches to new editable DuckDB connection; original data-file session unchanged |
| Toast | Includes skipped count when relevant |
| Non-desktop | Button shows error toast (requires Tauri runtime) |

### Readonly vs editable

| Connection type | Editable? |
|-----------------|-----------|
| Data-file session (`:memory:` + `fileSources`) | No — readonly via existing caps |
| Saved `.duckdb` file (`fileSources: []`) | Yes — normal DuckDB file connection |

---

## Tests added

### Rust — `save_session::tests` (5 tests)

| Test | Covers |
|------|--------|
| `materializes_active_views_into_physical_tables` | Active views → editable physical tables with row counts |
| `skips_missing_and_failed_sources_with_warning` | Partial sessions; warnings in result |
| `fails_when_no_active_sources_exist` | Error when nothing to materialize |
| `rejects_existing_destination_without_overwrite` | Explicit overwrite required |
| `suffixes_colliding_table_names_in_destination` | Safe rename on collision |

Run: `cargo test save_session::tests --lib` in `apps/desktop/src-tauri`

### Frontend — `__tests__/save-data-file-session.test.ts` (6 tests)

| Test | Covers |
|------|--------|
| Find existing DuckDB file connection | Reuse by path, no `fileSources` |
| Build saved connection payload | `file_sources: []` |
| Saved DuckDB connection editable | Existing `getSourceCaps` / readonly distinction |
| Toast formatting | Table count + skipped sources |
| Skipped-source detection | Pre-save confirmation gate |
| Original data-file connection unchanged | Session shape preserved |

**Suite result:** 279 tests passing (48 files)

---

## Merge readiness

| Check | Status |
|-------|--------|
| Rust unit tests | ✅ 5/5 passing |
| Frontend tests | ✅ 6/6 passing; 279 suite-wide |
| Bindings regenerated | ✅ `cargo test export_bindings -- --ignored` → copied to `packages/studio` |
| Tauri invoke contract | ✅ Passes |
| Source metadata layer | ✅ Unchanged (save wired through existing caps) |
| Desktop-only feature | ✅ Guarded in UI (Tauri dialog/fs) |

**Regenerate bindings before merge:**

```bash
cd apps/desktop/src-tauri
cargo test export_bindings -- --ignored
cp ../src/lib/bindings.ts ../../packages/studio/src/lib/bindings.ts
```

---

## Remaining limitations

- Save is **desktop-only** (no web/marketing runtime).
- Existing DuckDB connections are **reused by path match**; connection name is not updated automatically.
- **Partial failures** delete the incomplete `.duckdb` file (all-or-nothing per save attempt).
- **Attach-file UI** still deferred (`ATTACH_FILE_UI_IMPLEMENTED = false`).
- CSV/JSON/Parquet remain readonly in-session; only the materialized `.duckdb` file is editable.
- Provider preset persistence still deferred.

---

## What comes next

| Topic | Notes |
|-------|-------|
| Attach-file UI + command | Flip `ATTACH_FILE_UI_IMPLEMENTED`; native `.duckdb` attach flow |
| Provider preset persistence | Only if URL redaction routinely breaks hostname-based preset detection |

See `source-metadata-roadmap.md` for the full sequence.
