# Source metadata — Phase 6: Attach files to existing DuckDB database

**Goal:** Allow users to import CSV/JSON/Parquet files as physical tables in an existing editable `.duckdb` database connection.

**Status:** ✅ Done

**First version:** Import as tables only (readonly attach-as-views deferred).

---

## Out of scope (unchanged)

- No new engines
- No write support for CSV / JSON / Parquet themselves
- No changes to data-file session behavior
- No DuckDB execution rewrite
- No source metadata changes beyond UI visibility (`ATTACH_FILE_UI_IMPLEMENTED`)

---

## Files changed

### New — Rust

| File | Role |
|------|------|
| `apps/desktop/src-tauri/src/database/duckdb/import_files.rs` | Import flat files as physical tables; 4 unit tests |

### Updated — Rust

| File | Role |
|------|------|
| `apps/desktop/src-tauri/src/database/duckdb.rs` | Export `import_files` module |
| `apps/desktop/src-tauri/src/database/services/connection.rs` | `import_files_into_duckdb()` service method |
| `apps/desktop/src-tauri/src/database/commands/connections.rs` | Tauri command |
| `apps/desktop/src-tauri/src/bindings.rs` + `lib.rs` | Registration |
| `apps/desktop/src/lib/bindings.ts` + `packages/studio/src/lib/bindings.ts` | Regenerated specta types |

### New — Frontend

| File | Role |
|------|------|
| `packages/studio/src/features/database-studio/components/import-files-into-duckdb-button.tsx` | Picker, collision confirm, loading, toast |
| `packages/studio/src/features/database-studio/hooks/use-import-files-into-duckdb.ts` | Import mutation |
| `packages/studio/src/features/database-studio/utils/import-files-into-duckdb.ts` | Collision detection, toast copy, schema refresh |
| `__tests__/import-files-into-duckdb.test.ts` | 7 frontend tests |
| `source-metadata-phase6-import-files.md` | This document |

### Updated — Frontend

| File | Role |
|------|------|
| `packages/studio/src/features/connections/ui-actions.ts` | `ATTACH_FILE_UI_IMPLEMENTED = true` |
| `packages/studio/src/features/database-studio/components/studio-toolbar.tsx` | `importFilesAction` slot |
| `packages/studio/src/features/database-studio/database-studio.tsx` | Renders import button for native DuckDB |
| `packages/studio/src/core/data-provider/types.ts` | Adapter method |
| `packages/studio/src/core/data-provider/adapters/tauri.ts` | IPC call |
| `packages/studio/src/core/data-provider/adapters/mock.ts` | Mock implementation |
| `__tests__/ui-actions.test.ts` | Updated attach-file visibility tests |

---

## Tauri command shape

```typescript
commands.importFilesIntoDuckdb(
  connectionId: string,
  filePaths: string[]
): Promise<Result<ImportFilesIntoDuckDbResult, BackendError>>

type ImportFilesIntoDuckDbResult = {
  tables: {
    name: string
    sourcePath: string
    fileType: string
    rowCount: number | null
  }[]
  failed: {
    path: string
    fileType: string
    error: string
  }[]
  warnings: string[]
}
```

### Backend validation

- Connection exists and is connected
- Connection is DuckDB with **empty** `file_sources` (native file, not data-file session)
- At least one file path provided
- Each path: exists on disk, supported extension

### Import behavior

- `CREATE TABLE main.{name} AS SELECT * FROM read_*('path')`
- Table names use same sanitization as data-file sessions (`view_name_for`)
- Collisions suffix table names (`sales_2`) with warnings
- Partial success: failed files collected; succeeds if at least one file imports
- Original source files on disk are never modified

---

## UI flow

```
Open native .duckdb connection
        ↓
Click "Import files" in studio toolbar
        ↓
Multi-select CSV / JSON / Parquet picker
        ↓
[Table name collision?] → Confirm suffixed names
        ↓
Backend imports as physical tables
        ↓
Schema refresh (dora-schema-refresh event)
        ↓
Toast: "Imported 3 files into analytics.duckdb"
        ↓
New tables appear in sidebar
```

### Visibility rules

| Connection type | Import files visible? |
|-----------------|----------------------|
| Postgres / MySQL / SQLite / etc. | No |
| Data-file session (`:memory:` + `fileSources`) | No |
| Native DuckDB file (`fileSources: []`) | Yes |

---

## Tests added

### Rust — `import_files::tests` (4 tests)

| Test | Covers |
|------|--------|
| `imports_valid_files_as_tables` | Valid CSV → physical table with row count |
| `handles_duplicate_table_names_with_suffixes` | Existing table → suffixed name + warning |
| `reports_partial_failures` | Mixed success/failure |
| `fails_when_no_files_imported` | All paths invalid → error |

### Frontend — `__tests__/import-files-into-duckdb.test.ts` (7 tests)

| Test | Covers |
|------|--------|
| Hidden for non-DuckDB engines | Postgres, SQLite |
| Hidden for data-file sessions | Readonly session caps |
| Visible for native DuckDB files | `attach-file` in visible actions |
| Collision detection | Proposed names vs schema |
| Toast formatting | Success + partial failure |
| Shared naming logic | `viewNameForPath` parity |
| Schema refresh event | `dora-schema-refresh` dispatch |

### Updated — `__tests__/ui-actions.test.ts`

- Native DuckDB shows attach-file when UI implemented
- Data-file sessions still hide attach-file

---

## Merge readiness

| Check | Status |
|-------|--------|
| Rust unit tests | ✅ 4/4 passing |
| Frontend tests | ✅ Run full suite before merge |
| Bindings regenerated | ✅ `cargo test export_bindings -- --ignored` |
| `ATTACH_FILE_UI_IMPLEMENTED` | ✅ Flipped to `true` |
| Desktop-only | ✅ Guarded in UI (Tauri picker) |

**Regenerate bindings before merge:**

```bash
cd apps/desktop/src-tauri
cargo test export_bindings -- --ignored
cp ../src/lib/bindings.ts ../../packages/studio/src/lib/bindings.ts
```

---

## Remaining limitations

- **Import as tables only** — readonly attach-as-views not implemented (deferred).
- **Desktop-only** — requires Tauri file picker.
- **No undo** — imported tables persist immediately in the `.duckdb` file.
- **Partial imports** — some files may fail while others succeed; user sees summary toast.
- **Schema-scoped to `main`** — tables created in the main schema.
- Data-file session behavior unchanged.

---

## What comes next

| Topic | Notes |
|-------|-------|
| Readonly attach-as-views | Optional follow-up if persistence model is clear |
| Provider preset persistence | Deferred unless URL redaction breaks badges |

See `source-metadata-roadmap.md` for the full sequence.
