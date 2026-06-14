# Dora Source Metadata — Recap

## Original prompt (architecture audit)

You asked for a **thin compatibility layer** on top of Dora’s existing structure — not a rewrite. The audit covered:

### What Dora already has (and should keep)

- **Rust:** `DatabaseInfo` (7 persisted variants) → `Database` runtime state → `DatabaseClient` (5 drivers). CockroachDB/MariaDB are separate in persistence but use Postgres/MySQL at runtime.
- **Query path:** UI → Tauri commands → `StatementManager` → per-engine execute modules.
- **Schema:** `MetadataService` + per-engine `schema` modules.
- **Adapters:** `read` / `write` / `watch` traits — good shape, don’t replace.
- **Frontend:** `DatabaseType` (7 values), `Connection` ↔ `DatabaseInfo` mapping, `PROVIDER_PATTERNS` for Neon/Supabase hostname detection (display only, not separate engines).
- **File sources:** CSV/JSON/Parquet → DuckDB in-memory + `file_sources` → views via `file_source.rs`. SQLite/DuckDB files via pickers + header probe.

### Recommended approach

- Add a **small frontend metadata layer** (kinds, presets, capabilities).
- Keep Neon/Supabase as **Postgres presets**, MariaDB as **MySQL-compatible** with `mariadb` label, CockroachDB as **Postgres-compatible** with `cockroach` label, Turso as **libSQL**.
- Replace UI `if (type === …)` checks with capability helpers incrementally.
- **Don’t** rewrite Rust commands, `StatementManager`, or `DatabaseInfo` yet.

### Suggested source grouping

| Group | Examples |
|-------|----------|
| SQL servers | PostgreSQL, MySQL, MariaDB, CockroachDB |
| Cloud presets | Neon, Supabase, Turso, PlanetScale |
| Local embedded | SQLite, DuckDB, libSQL local |
| Local data files | CSV, JSON, Parquet (via DuckDB views) |
| Developer infra | Docker PostgreSQL (separate feature today) |

### Phased migration

#### ✅ Mergeable unit (Phases 1 + 2)

| Phase | Scope | Doc |
|-------|-------|-----|
| **Phase 1** | Source metadata and capabilities | `source-metadata-phase1-hardening.md` |
| **Phase 2** | Source metadata made visible in the UI | `source-metadata-phase2-ux.md` |

Ship together. No further frontend metadata work before the next backend slice.

#### 🔜 Next — Phase 3: backend-backed file-source status ✅

Expose Rust registration results to the frontend. **Implemented** — see `source-metadata-phase3-file-sources.md`.

#### ⏸ Postponed — provider preset persistence

Persist `DbPreset` on connections only if redacted URLs losing Neon/Supabase labels becomes a real problem. Nice-to-have, not core.

#### Later

- Attach-file UI for native `.duckdb` databases
- Command palette / mapping cleanup
- Deeper engine adapter work only if still painful

Full priority order: **`source-metadata-roadmap.md`**

---

## Follow-up prompt (tightened implementation)

Scope was narrowed to **only caps the UI actually uses**, with these names:

| Old name | Final name |
|----------|------------|
| `EngineId` | `DbEngine` |
| `ProviderPresetId` | `DbPreset` |
| `SourceCapabilities` | `SourceCaps` |
| `SourceDescriptor` | `SourceMeta` |

### 12 capabilities (no speculative extras)

- `canRunSql`
- `canInspectSchema`
- `canEditRows`
- `canImportFile`
- `canExportFile`
- `canQueryFiles`
- `canAttachFiles`
- `supportsLocalFile`
- `supportsRemoteUrl`
- `supportsSshTunnel`
- `supportsLiveMonitor`
- `isReadonly`

---

## What was implemented

### New files

`packages/studio/src/features/connections/`:

| File | Purpose |
|------|---------|
| `source-kinds.ts` | `DbEngine`, `DbPreset`, `SourceKind`, `SourceMeta` |
| `resolve-source.ts` | `describeConnectionSource()`, `resolvePresetToEngine()` |
| `source-caps.ts` | `SourceCaps`, `getSourceCaps()` |
| `ui-actions.ts` | `isUiActionVisible()` for form + studio |

### Wired into UI

- `isReadOnlyConnection()` → delegates to `getSourceCaps().isReadonly` (kept as deprecated shim)
- **Connection form** — file picker, URL/libSQL, SSH sections driven by caps
- **Database studio** — edit, import, export, live monitor, DDL, dry-edit gated via caps (also fixed content view missing readonly guards on add/import/edit)
- **Validation** — SSH check uses `supportsSshTunnel`

### Tests

`__tests__/source-caps.test.ts` — all passing:

- DuckDB data files → readonly
- DuckDB `.duckdb` file → editable
- SQLite file → editable
- Neon → `postgres` preset
- Supabase → `postgres` preset
- MariaDB → `mariadb` engine label, mysql wire family via `resolvePresetToEngine()`
- CockroachDB → `cockroach` engine label, postgres wire family via `resolvePresetToEngine()`
- CSV / JSON / Parquet → DuckDB data-file sessions

### Explicitly not done

- Rust changes
- `DatabaseInfo` shape changes
- Speculative caps (transactions, explain query, Docker lifecycle, multiple schemas, etc.)
- Provider preset persistence on `ConnectionInfo`
- Deeper adapter / `StatementManager` cleanup

---

## Key architectural answers

### Cloud presets

- **Neon / Supabase:** Persist as `DatabaseInfo::Postgres`. Detect via hostname in `PROVIDER_PATTERNS`. `DbPreset` = `neon` / `supabase`, `DbEngine` = `postgres`.
- **MariaDB:** Persist as `DatabaseInfo::MariaDB`. Runtime uses MySQL driver. `DbEngine` = `mariadb`, wire family = `mysql`.
- **CockroachDB:** Persist as `DatabaseInfo::CockroachDB`. Runtime uses Postgres driver. `DbEngine` = `cockroach`, wire family = `postgres`.
- **Turso / libSQL:** Separate engine (`libsql`). Remote URL + auth token; local `file:` URLs differ from SQLite despite shared header magic.

### DuckDB file handling

- CSV / JSON / Parquet are **not database files**.
- Stored as `DatabaseInfo::DuckDB { db_path: ":memory:", file_sources: [...] }`.
- Rust registers read-only **views** (`read_csv_auto`, `read_json_auto`, `read_parquet`) with sanitized stem names.
- Views are ephemeral (rebuilt on connect); connection record + file paths are persisted.
- `isReadonly: true`, `canEditRows: false` for data-file sessions.

### SQLite file handling

- Real embedded DB file → `DatabaseInfo::SQLite { db_path }`.
- Separate picker (`open_sqlite_db`) from data files (`open_data_files`).
- Ambiguous `.db` resolved via header probe (`SQLite format 3` vs `DUCK`).

---

## UI impact (capability → action)

| UI element | Capability |
|------------|------------|
| Cell edit, add row, delete, DDL | `canEditRows` |
| Import CSV | `canImportFile` |
| Export JSON/CSV/SQL | `canExportFile` |
| Live monitor | `supportsLiveMonitor` |
| SSH tunnel section | `supportsSshTunnel` |
| File path picker | `supportsLocalFile` |
| Connection URL / libSQL | `supportsRemoteUrl` |
| Read-only studio mode | `isReadonly` |

---

## Open questions (for later)

1. Persist `DbPreset` on `ConnectionInfo` for accurate badges after URL redaction?
2. Unify `DatabaseType`, `TableDialect`, and `DbEngine`?
3. Keep CockroachDB/MariaDB as separate `DatabaseInfo` variants forever?
4. Explicit `source_kind` field vs inferring from `file_sources`?
5. Backend `get_source_capabilities` command — when is frontend-only not enough?
6. “Attach file” on native `.duckdb` databases — views only or import into tables?

---

## Phase 2 UX (implemented)

See **`source-metadata-phase2-ux.md`** for the full report.

| Deliverable | Module / component |
|-------------|-------------------|
| Provider labels | `source-labels.ts` → `resolveProviderLabel()` |
| Source kind badges | `source-labels.ts` → `resolveSourceKindBadge()` |
| Connection list / header badges | `source-badges.tsx`, `connection-switcher.tsx` |
| Data-file detail panel | `data-file-source-panel.tsx` |
| Readonly banner | `data-file-readonly-notice.tsx` |
| Studio wrapper for data files | `data-file-session-chrome.tsx` |
| View name derivation | `data-file-views.ts` (mirrors Rust) |
| Attach-file guard | `ui-actions.ts` → `ATTACH_FILE_UI_IMPLEMENTED` |

Tests: 9 new (25 source-metadata total, 261 suite-wide).

---

## Bottom line

The goal was to **stop source-specific UI conditionals from spreading** while keeping Dora’s current architecture intact. Phase 1 provides caps and readonly gating; Phase 2 adds provider/source badges, data-file UX, and attach-file guardrails. Execution, schema introspection, and persistence are unchanged.

**Framing:** Open any database. Open any data file. Query it locally.
