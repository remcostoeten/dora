# DuckDB helper-process architecture

Status: **in progress** (feat/duckdb-helper-process)

## Why

`duckdb` is pulled in with the `bundled` feature, which statically compiles the
entire DuckDB C++ amalgamation into the `dora` binary. Measured cost:

- `libduckdb.a` static lib ≈ **114 MB**; it is ~half of the 68 MB stripped
  binary, and the C++ amalgamation is recompiled cold on every release
  (a large part of the ~30 min release build).
- It is the single largest contributor to bundle size (the `.deb` jumped from
  14 MB at v0.26.4 to 29 MB once DuckDB landed).

We want the **smallest default download** while keeping the DuckDB feature fully
intact (it is both a first-class connection type *and* the engine behind file
import / "save as DuckDB" / data-file-source views).

## Decision

Run DuckDB **out of process** in a small helper binary that is shipped in the
installer, and **download the prebuilt `libduckdb` shared library on first use**
(mirroring the existing Ollama installer). The main `dora` binary does not link
DuckDB at all.

Rejected alternatives:

- **CLI sidecar** (spawn the `duckdb` CLI): cannot do parameter binding, so the
  studio's parameter-bound write path (cell edits / row insert / delete /
  transactions in `adapter/write_duckdb.rs`) would become string-interpolated
  SQL — a correctness + injection regression. Also loses affected-row counts and
  type fidelity. Rejected.
- **Ship prebuilt `libduckdb` in the installer** (dynamic link, no download):
  zero code change and kills the C++ compile, but the download is *not* smaller
  (the full engine still ships). Does not meet the smallest-bundle goal.
- **Cargo feature gate only**: a no-DuckDB build is small but loses the feature.

The helper runs the **exact current Rust code** (`duckdb::Connection`, typed
rows, `params_from_iter`, transactions), so there are **no semantic
regressions**.

## Key enabling fact

Every `duckdb`-specific type (`Row`, `ValueRef`, `Value`, `Statement`, `Rows`,
`Transaction`, `params_from_iter`) is consumed *internally* and converted to
serde types before it reaches the main app. Mutation params arrive as
`serde_json::Value` and are converted to `duckdb::types::Value` inside
`write_duckdb.rs`. So the helper boundary lines up exactly with the existing
JSON-conversion boundary: **the RPC surface is entirely serde-serializable,
inputs included.**

## RPC surface (`DuckDbBackend`)

Derived from a full inventory of every call site against a `duckdb::Connection`
(19 files). All inputs/outputs are serde types that already exist in the app.

| Op | Inputs | Output | Notes |
|---|---|---|---|
| `open` | `db_path: String`, `file_sources: Vec<String>` | `OpenResult { conn_id, file_source_entries }` | file or `:memory:` + registered read-only views |
| `close` | `conn_id` | `()` | drops the connection |
| `execute_query` | `conn_id`, `ParsedStatement` | **stream** of `QueryExecEvent` | TypesResolved → Page(s of 50) → Finished |
| `get_database_schema` | `conn_id` | `DatabaseSchema` | param-bound introspection (helper-side) |
| `update_cell` | `conn_id`, table/schema/pk/col, `Value`s | `MutationResult` | param-bound |
| `delete_rows` | `conn_id`, table/schema/pk, `Vec<Value>` | `MutationResult` | param-bound |
| `insert_row` | `conn_id`, table/schema, `Map<String,Value>` | `MutationResult` | param-bound |
| `duplicate_row` | `conn_id`, table/schema/pk, `Value` | `MutationResult` | param-bound select+insert |
| `truncate_table` | `conn_id`, table/schema, cascade | `TruncateResult` | |
| `dump_database` | `conn_id`, `output_path` | `DumpResult` | `EXPORT DATABASE` |
| `execute_batch` | `conn_id`, `Vec<String>` | `MutationResult` | **transactional** |
| `poll_table_hash` | `conn_id`, table, schema | `u64` | live-monitor change detection |
| `get_counts` | `conn_id` | `(u32, u64)` | table + estimated row counts |
| `register_sources` | `conn_id`, `Vec<String>` | `Vec<DataFileSourceEntry>` | CSV/Parquet/JSON views |
| `import_files` | `conn_id`, `Vec<String>` | `ImportFilesIntoDuckDbResult` | files → physical tables |
| `materialize_data_file_session` | `conn_id`, `Vec<DataFileSourceEntry>`, dest, overwrite | `SaveDataFileSessionResult` | views → `.duckdb` file |

Existing serde types reused verbatim: `QueryExecEvent`, `Page`,
`ParsedStatement`, `DatabaseSchema`, `DataFileSourceEntry`, `MutationResult`,
`TruncateResult`, `DumpResult`, `ImportFilesIntoDuckDbResult`,
`SaveDataFileSessionResult`. Errors cross as a serialized `Error` string/struct
(`error.rs`).

## Crate / binary layout

- `dora-duckdb` — new crate. Holds the duckdb-using code (`execute`, `schema`,
  `row_writer`, `import_files`, `save_session`, `file_source`, the duckdb arms of
  the adapters/metadata/live-monitor), the `duckdb` dependency
  (`default-features = false`, dynamic link), and the helper `main()`.
- `dora` (main app) — depends on `dora-duckdb` **only for the shared protocol
  types** (a `proto` module with no `duckdb` dep), never on the `duckdb` crate.
  Holds `Arc<dyn DuckDbBackend>` in the connection enums.

The protocol types live in a `dora-duckdb-proto` portion that does not pull the
`duckdb` crate, so the main app stays DuckDB-free.

## IPC transport

- Long-lived helper process, spawned lazily on first DuckDB connection.
- Framing: length-prefixed JSON (`u32` length + payload). Requests carry a
  `request_id`; responses are tagged with it so concurrent requests multiplex.
- Streaming: `execute_query` emits multiple frames (`QueryExecEvent`) for one
  request id, terminated by `Finished`.
- Connection handles are `conn_id: u64` the helper maps to real `Connection`s.
- Helper crash/exit surfaces as an `Error` on all in-flight requests; the next
  request respawns it.

## libduckdb download + linking

- Helper built with `duckdb` `default-features = false` → `dylib=duckdb`
  (a `DT_NEEDED libduckdb.so` / `@rpath/libduckdb.dylib` / `duckdb.dll`).
- Because the lib is a hard load-time dependency, the **main app** downloads it
  before spawning the helper, then spawns the helper with the library search
  path pointed at the download dir (`LD_LIBRARY_PATH` / `DYLD_LIBRARY_PATH` /
  prepended `PATH` on Windows).
- Source: DuckDB publishes per-platform prebuilt libs on its GitHub releases
  (`libduckdb-linux-amd64.zip`, `libduckdb-linux-arm64.zip`,
  `libduckdb-osx-universal.zip`, `libduckdb-windows-amd64.zip`). Version-pinned
  to match the `duckdb` crate's DuckDB major (currently 1.x); may require
  `buildtime_bindgen` so generated bindings match the prebuilt headers.
- Reuse `src/ollama_installer/download.rs` (`platform_download()` URL table,
  `fetch_with_progress`, zip/zstd/tar extraction) as the template.
- First DuckDB use offline → feature unavailable with a clear error until the
  one-time download succeeds.

## Packaging

- Ship the helper binary as a Tauri **`externalBin`** sidecar so it is installed
  next to the app on every platform/installer.
- `release.yml`: build + sign the helper per platform, add to checksums.

## Phases

1. **`DuckDbBackend` trait + serde protocol types** (additive, compiles).
2. **In-process backend + migrate 19 call sites** — `InProcessDuckDbBackend`
   wraps current code; enums hold `Arc<dyn DuckDbBackend>`; behaviour-identical;
   still bundled; `cargo check` + tests green. (Atomic: the enum payload change
   touches all call sites at once.)
3. **Helper binary + IPC** — move duckdb code into the helper crate; add IPC and
   `IpcDuckDbBackend`; flip the backend to IPC; helper links duckdb non-bundled.
4. **Downloader + packaging + CI**.

Phases 1–2 of the plan correspond to design-phases 1–3 here; phase-3 download/CI
follows.

### Phase 4a — DONE (commit 5d2dd5d)

Full IPC transport landed additively, **in-process still the default**: the
helper, framing, proto, `IpcDuckDbConn`, and `build_duckdb_backend` factory all
exist in `app_lib`, gated by `DORA_DUCKDB_IPC=1`. DuckDB is still bundled in the
main binary. End-to-end test spawns the real helper and round-trips
open/batch/query_raw/streaming. The remaining work splits the build graph so the
main binary stops linking the engine.

### Phase 4b — crate extraction (the size win), execution plan

Grounded in an inventory of every live `duckdb`-crate reference in `app_lib`.
The invariant: **`app_lib` must not reference the `duckdb` crate at all** (a
single `#[from] duckdb::Error` or feature-gated dep re-pulls it into the main
binary via Cargo feature unification).

Layout: keep `apps/desktop/src-tauri` as the workspace root package (`dora` /
`app_lib`) and add member `crates/dora-duckdb` (path-deps on `app_lib`). The
helper binary moves there. Direction is `dora-duckdb → app_lib` only (no cycle).

**Stays in `app_lib`** (no `duckdb` crate): the `DuckDbConn` trait, `proto`,
`framing`, `client`/`IpcDuckDbConn`, `DuckDbConnAdapter`, the duckdb SQL
`parser` (sqlparser only), and **all serde type *definitions*** —
`DataFileSourceEntry`, `ImportFilesIntoDuckDbResult`, `SaveDataFileSessionResult`,
`MutationResult`/`TruncateResult`/`DumpResult`/`SoftDeleteResult`, `DatabaseSchema`,
`ParsedStatement`, `QueryExecEvent`. `build_duckdb_backend` becomes **IPC-only**.

**Moves to `dora-duckdb`** (links `duckdb`): `InProcessDuckDbConn` +
`open_in_process`; `DuckDbAdapter` (`adapter/read.rs` duckdb arm) and its
`WriteAdapter`/`WatchAdapter` impls (`write_duckdb.rs`, `watch.rs` arm);
`metadata::get_duckdb_counts`; and the engine bodies of `duckdb/{execute,schema,
row_writer,import_files,save_session,file_source}` — **split each file** so the
type *definition* stays in `app_lib` and the `duckdb`-using *functions* move.
The helper `main` + `helper.rs` serving loop move too.

**Decisions to settle before the move:**
1. **Error coupling (orphan rule).** `app_lib::Error::DuckDB(#[from] duckdb::Error)`
   must lose its `duckdb` dependency. Plan: change the variant to
   `DuckDB(String)`; in `dora-duckdb`, since neither `duckdb::Error` nor
   `app_lib::Error` is local, use a local newtype `struct DErr(duckdb::Error)`
   with `From<duckdb::Error> for DErr` (so `?` still works internally) and
   `From<DErr> for app_lib::Error` at public boundaries. Moderate churn at the
   moved `?`-sites.
2. **`test_connection` (`services/connection.rs:1283`)** opens `duckdb::Connection`
   directly to validate. Reroute through the helper — either a tiny `Open`+`Close`
   round-trip or a dedicated `TestConnection` proto op.
3. Once both default paths are IPC, drop the `DORA_DUCKDB_IPC` gate (always IPC)
   and remove `duckdb` from `app_lib/Cargo.toml`. The helper is found as a sibling
   binary in dev; real packaging path is 4c.

This is an atomic flip for the engine code (the `duckdb` dep can only be removed
once every live reference is relocated), so it lands as one reviewed change, not
incrementally.

## Open questions / risks

- libduckdb version pinning vs the `duckdb` crate's vendored bindings — may need
  `buildtime_bindgen` + shipping/downloading the matching `duckdb.h`.
- macOS code-signing/notarization of the helper sidecar and the downloaded
  `.dylib` (Gatekeeper / hardened runtime; the downloaded lib is unsigned).
- Updater interaction: the helper is versioned with the app; libduckdb is cached
  in app-data and re-validated by checksum.
- Per-query process boundary adds latency vs in-process; acceptable for a desktop
  client, and streaming pages keep large result sets responsive.
