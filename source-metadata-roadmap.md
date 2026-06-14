# Dora Source Metadata — Roadmap

## Mergeable unit: Phases 1 + 2

Treat **Phase 1** and **Phase 2** as one mergeable PR / release slice:

| Phase | What it is | Status |
|-------|------------|--------|
| **Phase 1** | Source metadata and capabilities | ✅ Done |
| **Phase 2** | Source metadata made visible in the UI | ✅ Done |

Together they deliver:

- `describeConnectionSource()`, `getSourceCaps()`, `isUiActionVisible()` — the metadata layer
- Readonly gating in database studio and connection form
- Provider/source badges, data-file panel, readonly banner, attach-file guard
- 25 source-metadata tests (261 suite-wide)

**Docs:** `source-metadata-phase1-hardening.md`, `source-metadata-phase2-ux.md`

Together they deliver Phases 1–3: metadata layer, UI visibility, and backend file-source status. See also `source-metadata-phase3-file-sources.md`.

---

## Reprioritized: what comes next

### ✅ Phase 3 — Backend-backed file-source status (done)

See **`source-metadata-phase3-file-sources.md`**.

Delivered: `DataFileSourceEntry` per path, `DatabaseConnectResult` on connect, recovery actions in the data-file panel, Rust + frontend tests.

### ✅ Phase 4 — Data file polish (done)

See **`source-metadata-phase4-polish.md`**.

Delivered: connection health indicator (Active / Connected with issues / Unavailable), source summaries in the connection list, collapsible help panel, 8 frontend tests (273 suite-wide).

### ✅ Phase 5 — Save data-file session as DuckDB (done)

See **`source-metadata-phase5-save-as-duckdb.md`**.

Delivered: `save_data_file_session_as_duckdb` command, materialization into editable `.duckdb` files, save UI with overwrite/skipped confirmations, auto-connect to saved DuckDB connection, Rust + frontend tests.

### ✅ Phase 6 — Import files into DuckDB (done)

See **`source-metadata-phase6-import-files.md`**.

Delivered: `import_files_into_duckdb` command, import-as-tables for native DuckDB connections, toolbar UI with collision confirm, schema refresh, `ATTACH_FILE_UI_IMPLEMENTED = true`, Rust + frontend tests.

### ✅ Phase 7 — Release polish (done)

See **`source-metadata-phase7-release-polish.md`**.

Delivered: caps-based visibility audit, centralized failure copy, accessibility pass, README/CHANGELOG, release notes and manual test checklist.

### Postponed — Provider preset persistence (nice-to-have)

Persisting `DbPreset` on `ConnectionInfo` so Neon/Supabase labels survive URL redaction.

**Defer unless:** redacted or edited URLs routinely lose hostname-based preset detection and users report wrong badges.

**Current mitigation:** `detectProviderName()` on URL at read time works for stored URLs; badges fall back to generic engine labels when hostname is gone. Acceptable for now.

### Postponed — Readonly attach-as-views (optional)

Attach CSV/JSON/Parquet as persistent views inside native DuckDB without materializing tables.

**Defer unless:** a persistence model for view definitions is needed beyond Save as DuckDB / Import files.

---

### Later phases (unchanged intent, lower priority)

| Phase | Topic | When |
|-------|-------|------|
| **8** | Incremental cleanup — command palette labels, pooler as cap, mapping helpers | Only when touching those areas anyway |
| **9** | Deeper adapter / `DatabaseInfo` normalization | Only if still painful after above |

---

## Principle

```
Phases 1+2  →  frontend knows what a source *is* and what the UI may do
Phase 3     →  frontend knows what happened when flat files were *opened* ✅
Phase 4     →  data-file sessions feel first-class (health, docs, summaries) ✅
Phase 5     →  materialize readonly data files into editable .duckdb ✅
Phase 6     →  import flat files into native DuckDB databases ✅
Phase 7     →  release polish (docs, a11y, error copy, caps audit) ✅
Phase 8+    →  optional attach-as-views, provider persistence
```

Phase 7 closed the release slice for local files. Next valuable work: readonly attach-as-views or provider persistence only if product need arises.
