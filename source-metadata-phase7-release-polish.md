# Dora Source Metadata — Phase 7: Release polish

Release-readiness pass for the source metadata layer and local-file workflows (Phases 1–6).

## Delivered

| Area | Change |
|------|--------|
| Visibility audit | `findExistingDuckDbFileConnection` / `isEditableDuckDbFileConnection` use `isNativeDuckDbFileConnection()` (caps) instead of `connection.type === 'duckdb'` |
| Caps helpers | `isDataFileSessionConnection()`, `isNativeDuckDbFileConnection()` exported from `source-metadata` |
| Failure copy | `local-file-errors.ts` — centralized user-facing strings + `mapSaveDataFileSessionError` / `mapImportFilesIntoDuckDbError` |
| Accessibility | Health badge `role="status"` + `aria-label`; save/import buttons `aria-busy` / `aria-label`; overwrite dialog uses destructive wording |
| Schema refresh | `refreshStudioSchemaAfterImport()` refetches schema query and surfaces `schemaRefreshFailed` toast |
| Docs | README support matrix + **Local files** section; CHANGELOG Unreleased entry |
| Naming | UI: **Import files**, **Save as DuckDB**, **Data files** — no user-facing “Attach” for file import |

## Visibility grep (final)

Engine branches remain only for identity/rendering/mapping:

| Location | Verdict |
|----------|---------|
| `resolve-source.ts` | Identity — OK |
| `connection-form.tsx` | Gated by `isUiActionVisible('local-file')` — OK |
| `command-palette.tsx` | Connection target label — OK |
| `save-data-file-session.ts` | **Fixed** — uses caps |

All studio toolbar / readonly / attach visibility goes through `getSourceCaps` + `isUiActionVisible`.

## Manual test checklist

Run in the desktop app (`bun run desktop:dev`). Automated tests cover helpers; these flows need human verification.

| # | Scenario | Result |
|---|----------|--------|
| 1 | Open SQLite file (`.sqlite`) | ☐ Editable; no data-file chrome |
| 2 | Open DuckDB file (`.duckdb`) | ☐ Editable; **Import files** visible in toolbar |
| 3 | Open single CSV as data file | ☐ Readonly banner; health Active; tables queryable |
| 4 | Open multiple CSV/JSON/Parquet | ☐ All appear as tables; summary shows file count |
| 5 | Break one file path (move/rename on disk) | ☐ Health → Connected with issues or Unavailable; relocate/remove works |
| 6 | Save data-file session as `.duckdb` | ☐ File created; switches to editable DuckDB connection; original session unchanged |
| 7 | Import files into existing `.duckdb` | ☐ Tables appear; schema refreshes |
| 8 | Edit imported table rows | ☐ Inline edit commits |

**Code-verified (automated):** caps visibility, collision detection, save payload shape, error mapping, schema refresh event dispatch.

## Files changed (Phase 7)

```
packages/studio/src/features/connections/source-caps.ts
packages/studio/src/features/connections/source-metadata.ts
packages/studio/src/features/connections/local-file-errors.ts
packages/studio/src/features/connections/data-file-health.ts
packages/studio/src/features/connections/source-labels.ts
packages/studio/src/features/connections/components/data-file-health-indicator.tsx
packages/studio/src/features/database-studio/utils/save-data-file-session.ts
packages/studio/src/features/database-studio/utils/import-files-into-duckdb.ts
packages/studio/src/features/database-studio/components/save-as-duckdb-button.tsx
packages/studio/src/features/database-studio/components/import-files-into-duckdb-button.tsx
__tests__/source-metadata-release.test.ts
README.md
CHANGELOG.md
source-metadata-roadmap.md
source-metadata-phase7-release-polish.md
```

## Final limitations

- Data-file sessions stay **readonly** until Save as DuckDB or import into native DuckDB.
- No readonly attach-as-views (persistent views in `.duckdb` without materializing).
- No provider preset persistence on connections.
- Import creates **physical tables** only on native DuckDB files, not on data-file sessions.
- Save as DuckDB requires desktop (Tauri); web demo is browse-only for local files.
- Schema refresh after import depends on an active schema query; if none is mounted, sidebar may need a manual reconnect.

## Release notes (compact)

**Source metadata & local files**

- Connections expose capabilities (`getSourceCaps`) so UI shows the right actions per source kind.
- CSV/JSON/Parquet open as readonly **data files** with health, recovery, and docs.
- **Save as DuckDB** materializes data files into editable databases.
- **Import files** adds flat files as tables in existing `.duckdb` files.
- Improved error messages and accessibility for save/import flows.
