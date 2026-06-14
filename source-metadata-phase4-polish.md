# Source metadata — Phase 4: Data file polish

**Goal:** Make data-file sessions feel like a first-class Dora workflow, not a hidden DuckDB trick.

**Status:** ✅ Done

---

## Out of scope (unchanged)

- No new engines
- No provider preset persistence
- No DuckDB execution rewrite
- No write support for CSV / JSON / Parquet

---

## Files changed

### New

| File | Role |
|------|------|
| `packages/studio/src/features/connections/data-file-health.ts` | Health resolution, summary formatting, help copy, placeholder constants |
| `packages/studio/src/features/connections/components/data-file-health-indicator.tsx` | Badge with colored status dot |
| `packages/studio/src/features/connections/hooks/use-data-file-entries-catalog.ts` | Batch-fetch entries when connection switcher is open |
| `packages/studio/src/features/database-studio/components/data-file-help-panel.tsx` | Collapsible docs panel |
| `packages/studio/src/features/database-studio/components/save-as-duckdb-placeholder.tsx` | Disabled “Save as DuckDB” future action |
| `__tests__/data-file-health.test.ts` | Health, summary, and help visibility tests |
| `source-metadata-phase4-polish.md` | This document |

### Updated

| File | Role |
|------|------|
| `packages/studio/src/features/connections/components/connection-switcher.tsx` | Source summaries + health on active header and list rows |
| `packages/studio/src/features/connections/source-labels.ts` | Search text includes data-file summary and health |
| `packages/studio/src/features/connections/source-metadata.ts` | Re-exports Phase 4 helpers |
| `packages/studio/src/features/database-studio/components/data-file-session-chrome.tsx` | Wires help panel, source panel, health, and placeholder |
| `packages/studio/src/features/database-studio/components/data-file-source-panel.tsx` | Optional `health` and `headerActions` in panel header |

---

## UX states added

### Connection health indicator

Three states, shown in the connection switcher (active connection + list rows) and in the data-file source panel header:

| State | Label | When |
|-------|-------|------|
| `active` | Active | Connected and every registered source is active |
| `connected-with-issues` | Connected with issues | At least one active source, but some are missing or failed |
| `unavailable` | Unavailable | Connection error, or zero active sources |

Health is hidden until backend entries are loaded (`null`).

### Connection list source summary

Data-file connections show richer subtitles when entries are available:

| Example | Meaning |
|---------|---------|
| `Data files · 3 files` | All sources active |
| `Data files · 2 active, 1 missing` | Partial registration (also handles `failed`) |
| `Data files · N files` | Path-count fallback when backend entries are not loaded yet |

Entries are fetched for **connected** data-file sessions when the connection switcher dropdown is open (`useDataFileEntriesCatalog`).

### Help panel

Collapsible panel in data-file sessions (`DataFileHelpPanel`), title: **How data files work in Dora**.

1. SQLite and DuckDB files are real editable database files.
2. CSV, JSON, and Parquet are opened as readonly DuckDB views.
3. Data-file views are rebuilt when the connection opens.
4. Broken or moved files can be relocated from the source panel.

Only shown when `meta.kind === 'data-file'` (`shouldShowDataFileHelpPanel`).

### Save as DuckDB (placeholder)

Disabled button in the source panel header.

- **Label:** Save as DuckDB
- **Hint:** Coming soon: materialize this data-file session into an editable `.duckdb` file.
- No backend implementation in this phase.

---

## Tests added

**File:** `__tests__/data-file-health.test.ts` — **8 tests**

| Test | Covers |
|------|--------|
| Health: active | All sources registered and active |
| Health: connected-with-issues | Mix of active + missing/failed |
| Health: unavailable | Connection error or zero active sources |
| Health: null | No indicator until entries load |
| Summary: healthy multi-file | `Data files · N files` |
| Summary: partial | `Data files · 2 active, 1 missing` |
| Summary: fallback | Path count when entries unavailable |
| Help visibility | Docs only for data-file sessions, not DuckDB/SQLite files or server connections |

**Suite result:** 273 tests passing (47 files).

---

## Remaining limitations

- Health and detailed summaries in the connection list only populate for **connected** data-file sessions while the switcher dropdown is open.
- “Save as DuckDB” is UI placeholder only — no materialization backend.
- Attach-file UI still gated (`ATTACH_FILE_UI_IMPLEMENTED = false`).
- Provider preset persistence deferred.
- Per-file status is runtime-only (not persisted in connection storage).
- No write support for CSV / JSON / Parquet.
- No new engines or DuckDB execution changes.

---

## What comes next

| Topic | Notes |
|-------|-------|
| Attach-file UI + command | Flip `ATTACH_FILE_UI_IMPLEMENTED`; native `.duckdb` attach flow |
| Save as DuckDB | Implement materialization into an editable `.duckdb` file |
| Provider preset persistence | Only if URL redaction routinely breaks hostname-based preset detection |

See `source-metadata-roadmap.md` for the full sequence.
