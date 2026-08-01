# Spec 02: File-as-Database (CSV / Parquet / JSON)

Status: `[x]` shipped. Open `.csv/.tsv/.parquet/.json/.ndjson` via drag-and-drop or the connection dialog; files register as read-only DuckDB views in an in-memory connection, appear as tables, support cross-file JOINs, refuse mutations cleanly, and recover gracefully from missing files on reopen. Follow-up deferred: a dedicated "Materialize to database" action (results are already exportable via the existing export machinery).

## Why

"Drag a CSV or Parquet file into Dora and query it with SQL" is the single most demo-able feature on the roadmap and no mainstream desktop DB client does it well. DuckDB gives it to us nearly for free via `read_csv_auto`, `read_parquet`, `read_json_auto`.

## Scope

- Open a `.csv`, `.tsv`, `.parquet`, or `.json`/`.ndjson` file as a connection: drag-and-drop onto the app window and via the connection dialog ("Open data file").
- Under the hood: create an in-memory DuckDB connection and register the file as a view (`CREATE VIEW <stem> AS SELECT * FROM read_csv_auto('<path>')`).
- The file appears as a table in the data viewer and schema sidebar; full SQL console support including joins across multiple opened files in one session.
- "Materialize to database" action: copy the file's contents into a table on any other open connection (uses the existing export/insert machinery).

Out of scope: editing the underlying file in place (views are read-only, so surface a friendly "read-only source" error on mutation attempts); Excel files (follow-up); remote URLs.

## Safe write scope

- `apps/desktop/src-tauri/src/database/duckdb/` (extend)
- New command(s) in `apps/desktop/src-tauri/src/database/commands/` (e.g. `file_source.rs`) + registration in `commands/mod.rs` and `lib.rs`
- Frontend: `packages/studio/src/features/connections/` (new "data file" connection kind), drag-and-drop handling in the studio shell, `packages/studio/src/features/database-studio/` read-only affordances
- Tauri config for file-drop events: `apps/desktop/src-tauri/tauri.conf.json`

## Implementation notes

1. Connection model: represent as a `DatabaseInfo::DuckDB` variant with `path = :memory:` plus a list of registered file sources, persisted so reopening the app reopens the files. Validate the files still exist on reconnect and report missing ones without failing the whole connection.
2. Schema inference: `read_csv_auto` sniffs types; expose DuckDB's inference errors verbatim, since they are good. For malformed CSVs offer `ignore_errors=true` retry in the error toast.
3. Mutations: the adapter write path must refuse cleanly. Mark these connections read-only at the `DatabaseClient` level so the UI hides edit affordances rather than erroring after the fact.
4. Large files: Parquet is lazy; CSV is scanned. Test with a >1 GB CSV: the first query may be slow, so show the existing query-running state, never freeze the UI thread.
5. Drag-and-drop: Tauri `onDragDropEvent`. Files with DB extensions (`.sqlite`, `.db`, `.duckdb`) should route to the normal provider flow, not the file-source flow.

## Done when

- Dropping a CSV onto Dora opens it, shows inferred schema, and `SELECT … JOIN` across two dropped files works in the SQL console.
- Export of query results works; mutation attempts show a read-only notice.
- Reopening the app restores file connections or reports missing files gracefully.
- Tests cover view registration, type inference passthrough, read-only enforcement, and missing-file recovery.

## Validation

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
bun run --cwd apps/desktop test
# manual: drop sample.csv + sample.parquet, join them, export result, restart app
```
