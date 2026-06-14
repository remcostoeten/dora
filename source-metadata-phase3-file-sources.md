# Dora Source Metadata — Phase 3: DuckDB File-Source Reliability

## Summary

Phase 3 exposes backend DuckDB file registration results to the frontend and adds recovery actions in the data-file panel. Data-file sessions stay readonly. No new engines, no provider persistence, no DuckDB execution rewrite.

---

## Rust files changed

| File | Change |
|------|--------|
| `apps/desktop/src-tauri/src/database/duckdb/file_source.rs` | `DataFileSourceEntry`, `DataFileSourceStatus`, per-file registration results |
| `apps/desktop/src-tauri/src/database/types.rs` | `DatabaseConnectResult`, `file_source_entries` on runtime `Database::DuckDB` |
| `apps/desktop/src-tauri/src/database/services/connection.rs` | Store registration on connect; `get_data_file_source_status`, `retry_data_file_registration` |
| `apps/desktop/src-tauri/src/database/commands/connections.rs` | New Tauri commands + `connect_to_database` return type |
| `apps/desktop/src-tauri/src/bindings.rs` | Register new commands for specta export |
| `apps/desktop/src-tauri/src/lib.rs` | Invoke handler entries |

---

## Tauri response shape

### `DataFileSourceEntry`

```typescript
{
  path: string
  viewName: string
  fileType: string
  status: 'active' | 'missing' | 'failed'
  error: string | null
}
```

### `DatabaseConnectResult`

Returned by `connect_to_database` and `retry_data_file_registration`:

```typescript
{
  connected: boolean
  fileSources: DataFileSourceEntry[] | null  // null for non-data-file connections
}
```

### Commands

| Command | Returns |
|---------|---------|
| `connect_to_database` | `DatabaseConnectResult` |
| `get_data_file_source_status` | `DataFileSourceEntry[]` |
| `retry_data_file_registration` | `DatabaseConnectResult` |

Partial success: if 2 of 3 files register, `connected: true` and entries mix `active` + `missing`/`failed`.

---

## Frontend types added

| File | Purpose |
|------|---------|
| `packages/studio/src/features/connections/types/data-file-source.ts` | Re-exports + status helpers |
| `packages/studio/src/lib/bindings.ts` | Auto-generated specta types (synced from desktop) |
| `packages/studio/src/features/database-studio/hooks/use-data-file-sources.ts` | Query + recovery mutations |

### Adapter API

- `connectToDatabase()` → `DatabaseConnectResult`
- `getDataFileSourceStatus(connectionId)`
- `retryDataFileRegistration(connectionId)`

---

## UI states added

**`DataFileSourcePanel`** now shows backend status per file:

| Status | Badge | Recovery actions |
|--------|-------|------------------|
| `active` | Green “Active” | — |
| `missing` | Amber “Missing” | Locate file, Remove source, Retry registration |
| `failed` | Red “Failed” + error text | Locate file, Remove source, Retry registration |

Panel-level **Retry registration** when any file has issues.

**Recovery flows:**

- **Remove source** — updates `fileSources` via `update_connection`, disconnects, reconnects
- **Locate file** — `openDataFiles` picker replaces path, then reconnect
- **Retry registration** — `retry_data_file_registration` re-runs DuckDB view registration on the live connection

Readonly banner and caps unchanged (`isReadonly` for data-file sessions).

---

## Tests added

### Rust (`file_source.rs`)

- All files active (CSV queryable + view rejects inserts)
- One missing file
- Partial registration keeps active views queryable
- Duplicate stems → stable view names
- Invalid JSON registration fails with error
- Missing path reporting

### Frontend

- `__tests__/data-file-source-status.test.ts` — status helpers + fallback view names

**265 tests** pass in studio vitest suite.

---

## Migration concerns

| Area | Impact |
|------|--------|
| **Persistence** | None — `file_source_entries` are runtime-only on the in-memory connection |
| **`connect_to_database` return type** | Breaking: `boolean` → `DatabaseConnectResult`. Frontend adapter updated; callers use `.connected` |
| **Bindings** | Regenerate via `cargo test export_bindings -- --ignored` in `apps/desktop/src-tauri`; copy to `packages/studio/src/lib/bindings.ts` |
| **Source metadata shape** | Unchanged — no `SourceMeta` / `DbPreset` changes |
| **Stored connections** | `file_sources` paths unchanged in storage; status is computed on connect |

---

## Merge readiness

Phase 3 is **ready to merge** with Phases 1+2. The data-file feedback loop is closed: registration outcomes come from Rust, partial success is supported, and users can recover from moved/missing/failed files without leaving readonly mode.
