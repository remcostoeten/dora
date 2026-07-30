# Database parity — reference

Detail behind `SKILL.md`. Paths and identifiers only, no line numbers. Add a row
here in the same change that creates a new difference.

## The two engine lists

| List | Where | Members |
| --- | --- | --- |
| Contract, nine | `DatabaseInfo` in `apps/desktop/src-tauri/src/database/types.rs`; `DatabaseType` in `packages/studio/src/features/connections/types.ts`; the `DB_TYPE_*` ids in `apps/desktop/src-tauri/src/storage/serialize.rs` | Postgres, CockroachDB, MySQL, MariaDB, SQLite, DuckDB, libSQL, Cloudflare D1, PostHog |
| Driver, seven | `DatabaseClient` in `apps/desktop/src-tauri/src/database/types.rs`; `DatabaseType` in `apps/desktop/src-tauri/src/database/adapter/read.rs` | Postgres-wire, MySQL-wire, SQLite, DuckDB, libSQL, D1, PostHog |

CockroachDB is `PgDialect::CockroachDb` on the Postgres driver; MariaDB is
`MySqlDialect::MariaDb` on the MySQL driver. Both are detected at connect time,
not chosen.

## Write support by driver

From the `WriteAdapter` impls in `apps/desktop/src-tauri/src/database/adapter`.
"no" means the method returns `Error::NotImplemented` or, for PostHog, the
read-only sentence.

| Method | Postgres | MySQL | SQLite | DuckDB | libSQL | D1 | PostHog |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `insert_row`, `update_cell`, `delete_rows`, `duplicate_row` | yes | yes | yes | yes | yes | yes | read-only |
| `truncate_table` | yes | yes | yes | yes | yes | yes, as an unfiltered `DELETE` | read-only |
| `truncate_database` | yes | no | no | no | no | no | read-only |
| `soft_delete_rows` | yes | yes | yes | no | yes | no | read-only |
| `undo_soft_delete` | yes | no | no | no | no | no | read-only |
| `dump_database` | yes | yes | yes | yes, `EXPORT DATABASE` into a directory | yes | no | read-only |
| `execute_batch` | yes | yes | yes | yes | yes | yes | read-only |
| `get_blob_bytes` | yes | no, trait default | yes | yes, via `DuckDbConnAdapter` | yes | no, trait default | no, trait default |

A DuckDB data-file session refuses every one of these regardless of the column
above: `get_client` sets `read_only` when `file_sources` is non-empty and each
method checks it.

The per-engine free functions those methods delegate to live in
`apps/desktop/src-tauri/src/database/maintenance.rs`, which is itself only
populated for Postgres, MySQL, SQLite and libSQL.

## Other differences that exist today

| Behaviour | How it differs |
| --- | --- |
| Live monitoring | Push via `LISTEN`/`NOTIFY` only where the Rust `SourceCaps.supports_listen_notify` is true, which is vanilla Postgres alone; CockroachDB, MySQL and MariaDB fall back to polling in `apps/desktop/src-tauri/src/database/live_monitor.rs`. `WatchAdapter` is implemented for Postgres, MySQL, SQLite, DuckDB and libSQL and returns `NotImplemented` for D1 and PostHog. The studio's `supportsLiveMonitor` is additionally false for DuckDB and libSQL, so the UI hides it even though a working watch adapter exists. |
| Value-constraint dropdowns | `ColumnInfo.allowed_values` is populated only by `apps/desktop/src-tauri/src/database/postgres/schema.rs` (enum labels and `CHECK (col IN (...))`) and `apps/desktop/src-tauri/src/database/mysql/schema.rs` (`ENUM` column type). Every other engine returns `None`, so the grid renders a free-text editor. |
| Row-count estimates | Every engine populates `row_count_estimate` except the DuckDB and PostHog fallback paths, which leave it `None`. Postgres additionally re-counts tables whose estimate came back zero. |
| Identifier quoting | ANSI double quotes for Postgres, CockroachDB, SQLite, libSQL, D1 and DuckDB; backticks for MySQL and MariaDB. `apps/desktop/src-tauri/src/database/ident.rs` on the Rust side, `packages/studio/src/shared/utils/table-ref.ts` on the studio side. |
| Schema qualification | The studio's `dialectUsesSchemas` treats only Postgres, CockroachDB, MySQL, MariaDB and DuckDB as schema-qualified; SQLite, libSQL, D1 and PostHog get a bare table name. |
| `DROP COLUMN` | `buildDropColumnSql` deliberately omits `IF EXISTS` because Postgres supports it and MySQL and SQLite do not — the intersection is emitted so a missing column fails loudly instead of silently succeeding on one engine. |
| Statement parsing | One `sqlparser` dialect per engine in the per-engine `parser.rs`: `PostgreSqlDialect`, `MySqlDialect`, `SQLiteDialect`, `DuckDbDialect`. libSQL delegates to the SQLite parser; D1 and PostHog are routed to it by `ConnectionRepository::parse_statements`. Only the SQLite path has a keyword-heuristic fallback for statements `sqlparser` rejects, so `VACUUM`, `DETACH DATABASE` and some `PRAGMA` forms parse there and would fail elsewhere. |
| Schema introspection | Postgres and MySQL resolve their queries through `PgIntrospection` / `MySqlIntrospection` in `apps/desktop/src-tauri/src/database/dialect.rs`; CockroachDB and MariaDB override only the constants that differ. The other engines have a single introspection implementation each. |
| Export | `MutationService::export_table` in `apps/desktop/src-tauri/src/database/services/mutation.rs` has a per-engine query match and a second dispatch to a `fetch_*_data` helper; every driver has one, and the `SqlInsert` format branches on MySQL for quoting. |
| Seeding | `apps/desktop/src-tauri/src/database/services/seeding.rs` matches on `DatabaseClient` and inserts through each driver; PostHog is the refused arm. |
| Metadata | `apps/desktop/src-tauri/src/database/metadata.rs` has a `get_*_metadata` per engine; DuckDB has only `get_duckdb_counts`. |
| Server-side cancel | Reaches the database for SQLite and the Postgres family only. The mechanism and its consequences belong to `dora-query-pipeline`; treat it here as one more row that is not uniform. |
| Compilation | DuckDB is behind the `duckdb-engine` Cargo feature, which is not in `default`. Its adapter, its tests and the helper binary are absent from a default build. |
| Transport | D1 and PostHog have no SQL wire protocol; both are HTTP query APIs, and PostHog is read-only by nature rather than by omission. |

## Where each capability table is read

**Studio — `SourceCaps` and `ENGINE_CAPS` in
`packages/studio/src/features/connections/source-caps.ts`.** Twelve boolean
fields keyed by all nine engines. `getSourceCaps` applies
`applyDataFileSessionOverrides` for a DuckDB data-file session, forcing
`canEditRows`, `canImportFile`, `canAttachFiles` and `supportsLiveMonitor` off
and `isReadonly` on. Consumers:

- `packages/studio/src/features/connections/ui-actions.ts` maps a flag to a
  `StudioUiAction`; `isUiActionVisible` is what
  `packages/studio/src/features/database-studio/database-studio.tsx` and
  `packages/studio/src/features/connections/components/connection-dialog/connection-form.tsx`
  actually call.
- `packages/studio/src/features/connections/components/source-badges.tsx` renders
  the `Readonly` badge from `isReadonly`, suppressed for data-file sessions
  because those get their own message.
- `packages/studio/src/features/connections/validation.ts` gates SSH-tunnel
  validation on `supportsSshTunnel`.
- `packages/studio/src/features/connections/source-debug.ts` dumps the resolved
  caps and visible actions.
- `packages/studio/src/features/connections/source-metadata.ts` re-exports the
  whole surface.

**Backend — `SourceCaps` in
`apps/desktop/src-tauri/src/database/dialect.rs`.** One field,
`supports_listen_notify`, resolved by `SourceCaps::for_dialect` from the detected
dialect and read through `DatabaseConnection::source_caps()`. Its only live
consumer is the live monitor, which uses it to choose push over polling.

## What the tests actually cover

| Layer | Where | Runs under |
| --- | --- | --- |
| Capability tables, source metadata, labels, data-file health | `__tests__/source-caps.test.ts`, `__tests__/source-debug.test.ts`, `__tests__/source-labels.test.ts`, `__tests__/data-file-health.test.ts` | `bun run test:desktop` |
| Dialect detection and caps | the test module in `apps/desktop/src-tauri/src/database/dialect.rs` | `cargo test` |
| Identifier quoting, including injection-shaped names | the test module in `apps/desktop/src-tauri/src/database/ident.rs` | `cargo test` |
| SQLite parsing and its fallback | `apps/desktop/src-tauri/tests/sqlite_parser_tests.rs` | `cargo test` |
| SQLite writes in process | the test modules in `apps/desktop/src-tauri/src/database/adapter/write_sqlite.rs` and `apps/desktop/src-tauri/src/database/sqlite/execute.rs` | `cargo test` |
| DuckDB writes, file sources, save-session, IPC | the test modules in `apps/desktop/src-tauri/src/database/adapter/write_duckdb.rs` and friends, plus `apps/desktop/src-tauri/tests/duckdb_ipc_tests.rs` | `cargo test --features duckdb-engine` only |
| MySQL metadata parsing | `apps/desktop/src-tauri/tests/mysql_metadata_tests.rs` | `cargo test` |
| MySQL and MariaDB against real servers | `apps/desktop/src-tauri/tests/live_db_tests.rs` | the live harness described in `AGENTS.md`; silently passes otherwise |
| libSQL, Cloudflare D1, PostHog | nothing | — |
