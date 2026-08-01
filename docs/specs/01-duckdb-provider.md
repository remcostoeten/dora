# Spec 01: DuckDB Provider

Status: `[-]` backend + frontend implemented and unit-tested; remaining: manual end-to-end run in the app and release binary-size measurement.

## Why

DuckDB is an embedded analytical database with a fast-growing user base and no good native desktop GUI. Integration cost is low because it is file-based like SQLite, which Dora already supports first-class. This spec is also the prerequisite for Spec 02 (querying CSV/Parquet/JSON files directly), which is the headline marketing feature.

## Scope

First-class DuckDB support, modeled on the existing SQLite path:

- open a local `.duckdb` / `.db` file (and `:memory:`)
- run queries in the SQL console with results in table/JSON view
- schema introspection (tables, columns, types, indexes) for the data viewer and schema visualizer
- inline edits / row mutations via the adapter write path
- export (JSON, CSV, SQL INSERT) like other providers

Out of scope: remote DuckDB (MotherDuck), noted as a follow-up; extensions management UI; file-as-database UX (Spec 02).

## Safe write scope

- `apps/desktop/src-tauri/src/database/duckdb/` (new: `execute.rs`, `parser.rs`, `schema.rs`)
- `apps/desktop/src-tauri/src/database/adapter/write_duckdb.rs` (new)
- Additive branches in: `database/types.rs`, `database/services/connection.rs`, `database/services/metadata.rs`, `database/adapter/{mod.rs,read.rs,write.rs}`, `storage/serialize.rs`, `lib.rs`
- Frontend: `packages/studio/src/features/connections/` (provider option, file-picker form reusing the SQLite dialog), generated `apps/desktop/src/lib/bindings.ts`
- `apps/desktop/src-tauri/Cargo.toml` (add `duckdb` crate with `bundled` feature)

## Implementation notes

1. Follow the workstream sequence in `docs/provider-support/00-overview.md`; SQLite is the reference implementation throughout (`database/sqlite/`, `adapter/write_sqlite.rs`). DuckDB's Rust crate API is rusqlite-shaped, so `sqlite/execute.rs` and `sqlite/row_writer.rs` translate almost mechanically.
2. Schema introspection: use `information_schema.tables/columns` and `duckdb_indexes()` rather than sqlite_master.
3. Type mapping: DuckDB has rich types (LIST, STRUCT, MAP, DECIMAL, HUGEINT, TIMESTAMP_TZ). Map unknowns to a JSON/text rendering in `row_writer` rather than erroring: the first release must never panic on an exotic type.
4. Concurrency: DuckDB allows one writer process. Open the connection like SQLite (`Arc<Mutex<...>>`) and surface a clear error if the file is locked by another process.
5. Live monitoring (`database/live_monitor.rs`): polling like SQLite, or explicitly stub it out. Do not leave the watch path panicking.
6. Binary size: the bundled DuckDB lib adds tens of MB. Measure the release binary before/after; if the hit is unacceptable, gate behind a cargo feature + separate build artifact and flag this as `[!]` for a product decision.

## Done when

- A DuckDB file connection can be created, saved, reloaded, tested, connected, queried, browsed, edited, and exported, surviving app restart.
- All existing provider tests still pass; new tests cover execute/schema/row_writer (mirror `database/sqlite/` test coverage and `docs/provider-support/06-tests-and-verification.md`).
- README database support table and `docs/product-roadmap.md` updated.

## Validation

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
bun run --cwd apps/desktop test
# manual: create a duckdb file with the duckdb CLI, connect, browse, edit, export
```
