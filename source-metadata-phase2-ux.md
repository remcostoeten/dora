# Dora Source Metadata — Phase 2 UX Report

## Summary

Phase 2 adds UX improvements on top of the Phase 1 metadata layer. No new database engines, no Rust changes, no `DatabaseInfo` / `StatementManager` changes, and no provider persistence.

The metadata layer now drives **connection list badges**, **active-connection header labels**, a **data-file source detail panel**, **readonly messaging for flat-file sessions**, and an explicit **attach-file UI guard**.

---

## 1. Goals delivered

| Task | Status |
|------|--------|
| Provider/source badges in connection list and active header | ✅ |
| DuckDB data-file source detail panel | ✅ |
| Readonly messaging for CSV/JSON/Parquet sessions | ✅ |
| Guard unimplemented attach-file action | ✅ |
| Tests for labels, badges, readonly message, attach-file guard | ✅ |

---

## 2. Files changed

### New

| File | Purpose |
|------|---------|
| `packages/studio/src/features/connections/source-labels.ts` | Provider labels, source kind badges, connection subtitles, readonly message helper |
| `packages/studio/src/features/connections/utils/data-file-views.ts` | View name derivation (mirrors Rust `view_name_for`), file entry listing |
| `packages/studio/src/features/connections/components/source-badges.tsx` | Reusable provider + source badge row |
| `packages/studio/src/features/database-studio/components/data-file-readonly-notice.tsx` | Subtle readonly banner for data-file sessions |
| `packages/studio/src/features/database-studio/components/data-file-source-panel.tsx` | Data-file detail panel (path, view name, type, readonly, errors) |
| `packages/studio/src/features/database-studio/components/data-file-session-chrome.tsx` | Wraps studio views when `meta.kind === 'data-file'` |
| `__tests__/source-labels.test.ts` | Provider label + badge + readonly message tests |
| `__tests__/data-file-views.test.ts` | View name derivation + file entry tests |

### Updated

| File | Change |
|------|--------|
| `packages/studio/src/features/connections/ui-actions.ts` | Added `attach-file` action gated by `ATTACH_FILE_UI_IMPLEMENTED = false` |
| `packages/studio/src/features/connections/source-metadata.ts` | Exports label helpers + `SourceBadges` |
| `packages/studio/src/features/connections/components/connection-switcher.tsx` | Badges in list rows + active header; search uses label metadata |
| `packages/studio/src/features/database-studio/database-studio.tsx` | Data-file chrome on all connected studio views |
| `__tests__/ui-actions.test.ts` | Asserts attach-file stays hidden despite `canAttachFiles: true` |

---

## 3. Label resolution

### Provider labels (`resolveProviderLabel`)

Uses `describeConnectionSource()` metadata: `kind`, `engine`, `preset`.

| Condition | Label |
|-----------|-------|
| `kind === 'data-file'` | Data files |
| `preset === 'neon'` | Neon |
| `preset === 'supabase'` | Supabase |
| `preset === 'planetscale'` | PlanetScale |
| `preset === 'turso'` / `'libsql'` | Turso |
| `preset === 'cockroach'` | CockroachDB |
| `preset === 'mariadb'` | MariaDB |
| `preset === 'mysql'` | MySQL |
| `preset === 'postgres'` | PostgreSQL |
| `preset === 'sqlite'` | SQLite |
| `preset === 'duckdb'` (no data files) | DuckDB |

Generic Postgres without Neon/Supabase hostname detection stays **PostgreSQL**.

### Source kind badges (`resolveSourceKindBadge`)

| `SourceKind` | Badge |
|--------------|-------|
| `sql-server` | Server |
| `cloud-preset` | Cloud |
| `embedded-database` | Local database |
| `data-file` | Data files |

When the badge label matches the provider label (e.g. data-file sessions), only the provider badge is shown to avoid duplication.

### Connection subtitles (`resolveConnectionSubtitle`)

Format: `{providerLabel} · {location}`

| Kind | Location suffix |
|------|-----------------|
| `data-file` | `1 file` / `N files` |
| `embedded-database` | Local |
| `cloud-preset` | Cloud |
| `sql-server` | `{host}` or `Local` |

### Wire family

`wireFamily` is still derived at read time via `resolvePresetToEngine(meta.preset)` (e.g. in `source-debug.ts`). It is **not** stored on `SourceMeta` — no mapping or persistence changes.

---

## 4. UI components

### Connection switcher — active header

- Subtitle line: e.g. `Neon · Cloud`, `PostgreSQL · localhost`, `Data files · 2 files`
- Compact badge row below subtitle: provider pill + source kind pill when distinct

### Connection switcher — list rows

- Location line: e.g. `Cloud • Jun 13, 2026` or `2 files • Jun 13, 2026`
- Badge row under connection name

Search filtering uses `resolveConnectionSearchText()` so queries match provider labels, source badges, and host/location text.

### Database studio — data-file sessions

When `meta.kind === 'data-file'`:

1. **Readonly notice** — full-width muted bar:
   > Data files are opened as readonly DuckDB views. Export and SQL queries are available, but row editing is disabled.

2. **Source detail panel** — per attached file:
   - File type (CSV, JSON, Parquet, …)
   - Derived DuckDB view name (matches Rust `view_name_for`)
   - Original file path
   - Readonly badge on the panel header
   - “Active view” highlight when the selected table matches a derived view name
   - Connection error callout when `connection.status === 'error'`

Chrome wraps all connected studio states: loading, failed, no tables, no table selected, structure view, chart view, and content view.

---

## 5. Attach-file guard

`canAttachFiles: true` remains in `SourceCaps` for native DuckDB database files (future feature).

UI visibility is gated separately:

```typescript
export const ATTACH_FILE_UI_IMPLEMENTED = false

case 'attach-file':
  return ATTACH_FILE_UI_IMPLEMENTED && caps.canAttachFiles
```

Flip `ATTACH_FILE_UI_IMPLEMENTED` to `true` when the picker and backend command ship.

---

## 6. Data-file view name derivation

`packages/studio/src/features/connections/utils/data-file-views.ts` mirrors Rust logic in `apps/desktop/src-tauri/src/database/duckdb/file_source.rs`:

- Sanitize file stem to SQL-safe identifier (non-alphanumeric → `_`, lowercase)
- Prefix with `t_` when empty or leading digit
- Append `_2`, `_3`, … on collision within a session

Example:

| Path | View name |
|------|-----------|
| `/data/My Sales-2024.csv` | `my_sales_2024` |
| `/other/My Sales-2024.csv` (same session) | `my_sales_2024_2` |
| `/x/123.csv` | `t_123` |

---

## 7. Missing file detection — deferred

Per-file missing/inaccessible status is **not** surfaced yet. The frontend only has:

- `connection.fileSources` paths
- `connection.status` / `connection.error` on failed connects

Rust `RegisterReport` (missing/failed paths) is not exposed to the frontend. The panel shows a generic connection error when status is `error`; per-file status waits on a future backend hook (Phase 4).

---

## 8. Tests added

### `__tests__/source-labels.test.ts` (6 tests)

- Neon and Supabase provider + Cloud badge
- Generic Postgres → PostgreSQL + Server badge
- Engine-specific labels (MySQL, MariaDB, CockroachDB, Turso, SQLite)
- DuckDB file vs data-file session labels
- Connection subtitle formatting
- Readonly message only for `meta.kind === 'data-file'`

### `__tests__/data-file-views.test.ts` (2 tests)

- View name sanitization and deduplication (matches Rust test cases)
- File entry listing with friendly type labels

### `__tests__/ui-actions.test.ts` (+1 test)

- `attach-file` hidden when `ATTACH_FILE_UI_IMPLEMENTED === false` even though `canAttachFiles === true`

**Phase 2 adds 9 tests.** Combined with Phase 1: **25 source-metadata tests**, **261 total** in the studio vitest suite (all passing).

---

## 9. Public API additions

Import from `@studio/features/connections/source-metadata`:

```typescript
import {
  resolveProviderLabel,
  resolveSourceKindBadge,
  resolveConnectionSubtitle,
  resolveConnectionLocationLabel,
  resolveConnectionSearchText,
  shouldShowSourceKindBadge,
  shouldShowDataFileReadonlyMessage,
  DATA_FILE_READONLY_MESSAGE,
  SourceBadges,
  ATTACH_FILE_UI_IMPLEMENTED,
} from '@studio/features/connections/source-metadata'
```

Data-file view helpers (direct import):

```typescript
import {
  viewNameForPath,
  listDataFileEntries,
  formatDataFileType,
} from '@studio/features/connections/utils/data-file-views'
```

---

## 10. Remaining type checks (unchanged)

These still use `connection.type` directly — intentional, out of Phase 2 scope:

| Location | Why it stays |
|----------|--------------|
| `connection-form.tsx` | Engine-specific form fields (host/port vs file path vs libSQL URL) |
| `mapping.ts` | Tauri `DatabaseInfo` serialization contract |
| `validation.ts` | Per-engine Zod schemas |
| Pooler mode checkbox | Postgres-specific feature |
| SQL dialect cache | Keyed by `connection.type` |
| `database-icons.tsx` / type selector | Pure presentation |

Do **not** add new `connection.type === '…'` checks for **visibility**. Use caps and label helpers instead.

---

## 11. Is Phase 2 complete?

**Yes.**

✅ Provider/source badges in connection list and active header  
✅ Data-file source detail panel with path, view name, type, readonly  
✅ Readonly messaging for flat-file sessions  
✅ Attach-file action explicitly hidden until implemented  
✅ Tests cover label resolution, badges, readonly condition, attach-file guard  
✅ No Rust / `DatabaseInfo` / `StatementManager` changes  
✅ Full test suite green  

**Deferred to later phases** (see `source-metadata-roadmap.md`):

- Persist `DbPreset` on connections — **postponed** (nice-to-have)
- Per-file register report from Rust — **Phase 3** (next)
- Attach-file picker + command — Phase 4
- Command palette display using label helpers
- Replacing `mapping.ts` / save-handler type switches

Phases 1 + 2 are **one mergeable unit**. Do not add more frontend metadata before Phase 3 (backend file-source status).

---

## 12. Usage for new display features

```typescript
import {
  describeConnectionSource,
  getSourceCaps,
  resolveProviderLabel,
  resolveSourceKindBadge,
  SourceBadges,
} from '@studio/features/connections/source-metadata'

const meta = describeConnectionSource(connection)
const caps = getSourceCaps(connection, meta)

// Labels
resolveProviderLabel(meta)       // "Neon", "PostgreSQL", "Data files", …
resolveSourceKindBadge(meta)     // "Cloud", "Server", "Local database", …

// Component
<SourceBadges connection={connection} compact />
```

For data-file sessions in custom views:

```typescript
import { shouldShowDataFileReadonlyMessage } from '@studio/features/connections/source-metadata'
import { listDataFileEntries } from '@studio/features/connections/utils/data-file-views'

if (shouldShowDataFileReadonlyMessage(meta)) {
  // show readonly notice
}

const entries = listDataFileEntries(connection.fileSources ?? [])
```
