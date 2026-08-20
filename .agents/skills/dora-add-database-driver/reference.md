# Add a database driver — reference

Exhaustive touch-point list, derived from the two most recent engine additions:
PostHog (`feat(posthog): HogQL connector…`, 2026-07-04) and Cloudflare D1
(`feat(integrations): Cloudflare D1 connector (new HTTP engine) (#150)`,
2026-06-20). Both touched nearly the same set; anything only one of them touched
is marked.

## 1. Rust — engine module

| Path | What goes in it |
| --- | --- |
| `apps/desktop/src-tauri/src/database/<engine>/mod.rs` | The client (`D1Http`, `PosthogHttp`), the adapter struct, `run_statement`, `new`, `http()` |
| `apps/desktop/src-tauri/src/database/<engine>/schema.rs` | `get_database_schema` returning `DatabaseSchema` |
| `apps/desktop/src-tauri/src/database.rs` | `pub mod <engine>;` |

Per-engine submodules are optional. Postgres and MySQL split into
`{connect,connection_string,execute,parser,schema,row_writer,tls}`; D1 and
PostHog need only `mod.rs` + `schema.rs` because they reuse
`crate::database::sqlite::parser::parse_statements`.

## 2. Rust — types and connection state

`apps/desktop/src-tauri/src/database/types.rs`, one arm or variant each:

1. `DatabaseInfo` — new variant (serialized connection config).
2. `Database` — new variant (runtime connection state).
3. `DatabaseClient` — new variant (cloneable driver handle).
4. `DatabaseConnection::new`
5. `DatabaseConnection::to_connection_info`
6. `DatabaseConnection::from_connection_info`
7. `DatabaseConnection::is_client_connected`
8. `DatabaseConnection::get_client` — two arms: connected, and the
   not-connected error.
9. `DatabaseConnection::source_caps` — falls through `_` today; see the
   `supports_listen_notify` rule in SKILL.md.

## 3. Rust — adapters and factories

Paths in this section and the next are relative to `apps/desktop/src-tauri/src/`.

| File | Change |
| --- | --- |
| `database/adapter/read.rs` | `DatabaseType` variant + its `Display` arm; `impl DatabaseAdapter`; arm in `adapter_from_client` |
| `database/adapter/write.rs` | arm in `write_adapter_from_client` |
| `database/adapter/write_<engine>.rs` | `impl WriteAdapter` |
| `database/adapter/watch.rs` | `impl WatchAdapter`; arm in `watch_adapter_from_client` |
| `database/adapter/mod.rs` | `mod` + `pub use` |

`database/adapter/grid_sql.rs` is reused as-is by any engine that speaks
ANSI-quoted identifiers with `?` placeholders (SQLite, libSQL, D1). Do not copy
its statements into a new `write_<engine>.rs`.

## 4. Rust — lifecycle, services, plumbing

| File | Change |
| --- | --- |
| `database/stmt_manager.rs` | the `parse_statements` fn-pointer match and the `create_worker` executor-spawn match (behaviour is `dora-query-pipeline`'s) |
| `database/connection_repository.rs` | arm in `ConnectionRepository::parse_statements` for `AppState` |
| `database/connection_monitor.rs` | arm in the health/reconnect match |
| `database/live_monitor.rs` | arm (both engines added one) |
| `database/metadata.rs` | `get_<engine>_metadata`, usually `get_<engine>_counts` |
| `database/services/connection.rs` | `connect_to_database`, `disconnect_from_database`, `test_connection` |
| `database/services/metadata.rs` | dispatch arm |
| `database/services/mutation.rs` | the `export_table` query-building match **and** the `db_type` string dispatch to a `fetch_<engine>_data` helper |
| `database/services/seeding.rs` | arm |
| `database/commands/ai.rs` | arm (one line in both engines) |
| `credentials.rs` | arm in `extract_sensitive_data` |

## 5. Rust — persistence

| File | Change |
| --- | --- |
| `apps/desktop/src-tauri/migrations/NNN.sql` | `INSERT OR IGNORE INTO database_types (id, name) VALUES (<n>, '<engine>');` — D1 is 011, PostHog is 012 |
| `storage/migrator.rs` | register the new migration (one `include_str!` line) |
| `storage/serialize.rs` | `DB_TYPE_<ENGINE>` const, the `DatabaseInfo::<Engine> => (DB_TYPE_…, …)` arm, the id→name arm, and the name→`DatabaseInfo` arm |

Nothing in the type system enforces this file set. See the mis-decode rule in
SKILL.md.

## 6. Rust — hosted-provider half (only if the engine ships with one)

`src/integrations/<provider>.rs` + a `pub mod` in `src/integrations/mod.rs`,
commands in `database/commands/integrations.rs`, registration in `lib.rs` and
`bindings.rs`. The provider half is `dora-add-provider`'s subject;
an engine only needs it when the credentials cannot be expressed as a
connection string.

Nothing in `apps/desktop/src-tauri/capabilities/default.json` is needed for a new
engine. The backend reaches an HTTP engine with `reqwest` from Rust, which no
Tauri capability gates; the entries PostHog's commit added to that file belong to
its analytics dashboard, not to the connector.

## 7. Frontend registries

All under `packages/studio/src/`:

| File | Change |
| --- | --- |
| `features/connections/types.ts` | `DatabaseType` union member; `DEFAULT_PORTS` entry |
| `features/connections/source-kinds.ts` | `DbPreset` member (`DbEngine` is an alias of `DatabaseType`, so it follows automatically); `SourceKind`/`SourceMeta` if the shape changes |
| `features/connections/source-caps.ts` | `ENGINE_CAPS` row — a `Record<DbEngine, SourceCaps>`, so this one is compiler-enforced |
| `features/connections/resolve-source.ts` | `resolvePresetToEngine`, `inferPresetFromConnection`, `inferSourceKind` |
| `features/connections/utils/providers.ts` | `PROVIDER_CONFIGS` entry, `PROVIDER_PATTERNS` if the URL is recognizable, and `FUZZY_EXCLUDED_TYPES` when the scheme is internal and would poison typo detection (PostHog is there so `postttgr` still resolves to postgres) |
| `features/connections/utils/mapping.ts` | `backendToFrontendConnection`'s `'X' in conn.database_type` chain; `frontendToBackendSshConfig` if tunnelling applies (PostHog touched this; D1 did not) |
| `features/connections/components/database-icons.tsx` | `DATABASE_META` entry |
| `features/connections/components/connection-dialog.tsx` | mount the connect flow |
| `features/connections/components/connection-dialog/database-type-selector.tsx` | `ProviderKey`, `DATABASE_TYPES`, `TYPE_THEME` |
| `shared/utils/table-ref.ts` | `TableDialect` member; `dialectUsesSchemas` |
| `core/data-provider/adapters/tauri.ts` | `databaseInfoToDialect` (PostHog touched this) |
| `features/connections/source-labels.ts`, `source-metadata.ts`, `ui-actions.ts`, `validation.ts` | wherever they switch on engine |
| `features/integrations/<name>/<name>-api.ts`, `<name>-connect-flow.tsx` | the connect UI, if hosted |
| `features/sql-console/sql-console.tsx` | the `activeDialect` mapping |

Both bindings files changed in both commits. Which one to edit, and whether it
is generated, is `dora-tauri-boundary`'s call — see FINDINGS 4.1.

## 8. Tests and docs

| Path | Note |
| --- | --- |
| `apps/desktop/src-tauri/tests/live_db_tests.rs` | the live parity harness; `dora-database-parity` owns what belongs in it |
| unit tests inside `write_<engine>.rs` | `write_sqlite.rs` carries `insert_row_coerces_typed_values` and `full_mutation_lifecycle` against a real in-memory connection — the shape to copy for an embeddable engine |
| `docs/connect/<engine>.mdx` | PostHog added one; D1 did not |
| `docs/connect/meta.json` | the page must be listed or it 404s |
| `docs/connect/index.mdx` | the entry in the connect list |
| `README.md` | a row in the "Database support" table, stating the support level honestly; D1 has one, PostHog does not |
| `docs/architecture/data-sources.md` | a dated `**Update (YYYY-MM-DD):**` line saying why this is an engine and not a dialect; D1's is there |

Deliberately untouched by both engines, so rule them out rather than hunt for
them: `error.rs`'s `DatabaseKind` (still `Postgres | Mysql | Sqlite | Libsql`;
driver errors surface through `Error::Any` and tag as `Internal`),
`database/services/schema_export.rs`'s `ExportDialect` (still
`PostgreSQL | SQLite`, selected from a string), and
`core/data-provider/adapters/mock.ts`.

## 9. What the compiler does and does not catch

Caught, because the match is exhaustive and has no `_`:
`adapter_from_client`, `write_adapter_from_client`, `watch_adapter_from_client`,
`is_client_connected`, `get_client`, `DatabaseType`'s `Display`, and every
frontend `Record<DatabaseType, …>` (`DEFAULT_PORTS`, `PROVIDER_CONFIGS`,
`DATABASE_META`, `ENGINE_CAPS`).

Not caught — silent at compile time:
`DatabaseConnection::source_caps` (has a `_` arm), the `database_types`
migration row, `storage/serialize.rs`'s string arms,
`MutationService::export_table`'s `db_type` string dispatch,
`resolve-source.ts`'s inference functions, `PROVIDER_PATTERNS`,
`validateConnection` (an unknown type falls through every branch and is reported
valid), `databaseInfoToDialect` (falls through to `'sqlite'`), the
`activeDialect` mapping (falls through to `'unknown'`), and every
`docs/connect/` file.
