# Dora — repository findings for skill authoring

Read-and-report only. Everything below was derived from source in this working tree
(branch `master`, version `0.38.0`). Paths and identifiers only, no line numbers.
Anything not confirmed from source is marked **unverified**.

---

## 1. Module map

### 1.1 Workspace shape

- Bun workspaces (`package.json` → `workspaces: ["apps/*", "packages/*"]`), Turborepo
  (`turbo.json`), package manager pinned to `bun@1.3.14`.
- `apps/desktop` — Tauri v2 app. `src/` is a **three-file shell** (`App.tsx`,
  `main.tsx`, `boot-screen.ts`) that renders `StudioApp` from `@dora/studio`.
  `src-tauri/` is the entire Rust backend.
- `packages/studio` (`@dora/studio`) — all application UI and frontend logic.
  Exports only `StudioApp`, `createAnalyticsConfig`, and the analytics config types
  from `src/index.ts`; everything else is reached via the `./*` subpath export.
- `apps/marketing` — Next.js site (also consumes `@dora/studio`).
- `apps/docs`, `apps/db-tester` — present as directories with **no `package.json`**
  (so not real workspace members).
- `packages/style` (`@repo/style`) — the lint/format toolchain (oxlint, oxfmt,
  ts-morph codemods). Root `lint`/`format`/`fix` scripts delegate here.
- `packages/promo` (`@dora/promo`) — Playwright-driven promo/GIF recorder.
- `tools/`, `tools/scripts/`, `scripts/` — release/packaging/verification scripts.
- `docs/` — specs, architecture, provider workstreams, distribution guide.

### 1.2 Rust backend — `apps/desktop/src-tauri/src`

Entry: `lib.rs` → `run()`.

- `AppState` (in `lib.rs`) is the single Tauri-managed state object. Fields:
  `connections: DashMap<Uuid, DatabaseConnection>`, `schemas: DashMap<Uuid,
  Arc<DatabaseSchema>>`, `storage: Storage`, `stmt_manager: StatementManager`,
  `command_registry: RwLock<CommandRegistry>`, and three `DashMap<String,
  Arc<AtomicBool>>` cancel-flag maps (`ai_cancel_flags`, `ollama_cancel_flags`,
  `ollama_install_cancel_flags`).
- Additional managed state: `database::Certificates`, `ConnectionMonitor`,
  `LiveMonitorManager` (the latter two are `handle.manage(...)`d in `.setup`).
- Tauri plugins registered: `opener`, `shell`, `updater`, `process`, `dialog`, `fs`.

**`database/` (the core)**

| File / dir | Contents |
| --- | --- |
| `types.rs` | `DatabaseInfo` (serialized connection config, 9 variants), `Database` (runtime connection state), `DatabaseClient` (cloneable driver handle), `DatabaseConnection`, `ConnectionInfo`, `SshConfig`, `DatabaseSchema`/`TableInfo`/`ColumnInfo`/`IndexInfo`/`ForeignKeyInfo`, `QueryStatus`, `StatementInfo`, `QueryExecEvent`, `Page = Box<RawValue>`, `QueryId = usize`, `ExecSender`, `detect_pgbouncer_flag`, `is_postgres_pooler_url` |
| `dialect.rs` | `PgDialect`, `MySqlDialect`, `DetectedDialect`, `SourceCaps` (Rust flavour: single field `supports_listen_notify`), `PgIntrospection`, `MySqlIntrospection`, `detect_pg_dialect`, `detect_mysql_dialect`, and all `VANILLA_*` / `COCKROACH_*` introspection SQL constants |
| `adapter/read.rs` | `DatabaseAdapter` trait, `DatabaseType` enum, `PostgresAdapter`, `SqliteAdapter`, `MySqlAdapter`, `LibSqlAdapter`, `DuckDbAdapter` (feature-gated), re-exports `D1Adapter` + `PosthogAdapter`, `BoxedAdapter`, factory `adapter_from_client` |
| `adapter/write.rs` | `WriteAdapter` trait, `BoxedWriteAdapter`, factory `write_adapter_from_client`; per-driver impls in `write_postgres.rs`, `write_mysql.rs`, `write_sqlite.rs`, `write_libsql.rs`, `write_d1.rs`, `write_posthog.rs`, `write_duckdb.rs` |
| `adapter/watch.rs` | `WatchAdapter` trait, `BoxedWatchAdapter`, factory `watch_adapter_from_client` |
| `adapter/duckdb_proxy.rs` | `DuckDbConnAdapter` — implements all three adapter traits by forwarding to an `Arc<dyn DuckDbConn>` |
| `adapter/grid_sql.rs` | Pure SQL builders (`update_cell_sql`, `delete_rows_sql`, `insert_row_sql`, `select_row_sql`) shared by the SQLite-family write adapters (SQLite / libSQL / D1) |
| `ident.rs` | Canonical identifier quoting: `quote_ansi`, `quote_mysql`, `qualified_ansi`, `qualified_mysql` |
| `parser.rs` | `ParsedStatement { statement, returns_values, is_read_only }`, `SqlDialectExt` trait, generic `parse_statements<T: Dialect + SqlDialectExt>` |
| `stmt_manager.rs` | `StatementManager` — owns all query result state; `ExecState`, `ExecResult::{Rows, NoRows}`, `PgCancel`, `signal_engine_cancel`, `MAX_RETAINED_QUERIES = 64` |
| `connection_repository.rs` | `ConnectionRepository` trait (`get_client`, `get_read_adapter`, `get_write_adapter`, `parse_statements`), implemented for `AppState` |
| `services/` | `connection.rs` (`ConnectionService`), `query.rs` (`QueryService`), `mutation.rs` (`MutationService`, `MutationResult`, `ExportFormat`, `fetch_*_data` helpers), `metadata.rs` (`MetadataService`), `schema_export.rs`, `seeding.rs`, `query_builder.rs`, `ai/` |
| `commands/` | One module per surface (`query`, `connections`, `mutation`, `schema`, `schema_export`, `snippets`, `snippet_folders`, `scripts`, `settings`, `seeding`, `query_builder`, `storage`, `live_monitor`, `integrations`, `ai`), all re-exported with `pub use *` from `commands/mod.rs` |
| `<engine>/` | `postgres/{connect,connection_string,execute,parser,schema,row_writer,tls}`, `mysql/`, `sqlite/`, `libsql/`, `duckdb/` (+ `file_source`, `import_files`, `save_session`), `d1/`, `posthog/` |
| `duckdb_backend.rs` | `DuckDbConn` trait, `BoxedDuckDbConn = Arc<dyn DuckDbConn>`, `InProcessDuckDbConn`, `open_in_process` |
| `duckdb_ipc/` | `proto.rs`, `framing.rs`, `client.rs` (`IpcDuckDbConn`), `helper.rs`; env switch `DORA_DUCKDB_IPC=1` |
| `maintenance.rs` | Per-engine free functions for truncate / soft-delete / dump (`*_postgres`, `*_sqlite`, `*_mysql`, `*_libsql`) plus `SoftDeleteResult`, `TruncateResult`, `DumpResult`, `find_soft_delete_column`. The `WriteAdapter` impls delegate here. |
| `metadata.rs` | `DatabaseMetadata`, per-engine `get_*_metadata` / `get_*_counts`, `parse_mysql_connection_target` |
| `live_monitor.rs` | `LiveMonitorManager`, `LiveMonitorSession`, `LiveMonitorChangeType`, `LiveMonitorChangeEvent`, `LiveMonitorUpdateEvent` |
| `connection_monitor.rs` | `ConnectionMonitor` (health/reconnect) |
| `ssh_tunnel.rs` | `SshTunnel::start(...)` — russh client, binds `127.0.0.1:0`, forwards to remote host/port on a dedicated thread + current-thread tokio runtime |
| `blob_display.rs` | `describe_blob` (grid rendering of binary cells) |
| `contract.rs` | `get_command_contract()` — a hand-written `Vec<CommandDefinition>` describing commands, arguments, return types, `CommandStability`, and side effects |

**Other Rust modules**

- `error.rs` — `Error` enum, `BackendErrorShape { kind, detail }`, `DatabaseKind`,
  `Error::tag()`, custom `serde::Serialize`, `specta::Type` shim.
- `credentials.rs` — `extract_sensitive_data`, keyring entries under service `"Dora"`.
- `credential_storage.rs` — `CredentialStorageBackend::{OsKeyring, LocalEncryptedFile}`,
  `CredentialStorageStatus`, `KeyringInstallPlan`, `backend()`, `warm_up()`,
  `FALLBACK_KEY_FILE = "encryption.key"`, probe service `dora_db_client`.
- `security.rs` — encryption used by the integration settings.
- `storage/` — `Storage` (a `Mutex<rusqlite::Connection>` over the app SQLite DB),
  `Migrator` with 12 `include_str!`'d migrations in `src-tauri/migrations/NNN.sql`
  gated on `PRAGMA user_version`, plus `connections`, `queries`, `settings`,
  `ai_keys`, `ai_usage`, `connection_history`, `snippet_folders`, `serialize`.
- `integrations/` — one module per hosted provider: `supabase`, `turso`, `neon`,
  `cloudflare`, `xata`, `planetscale`, `vercel`, `posthog`.
- `commands_system/` — `CommandRegistry`, `CommandDefinition`, `ShortcutDefinition`,
  `load_custom_shortcuts`, and the `get_all_commands` / `get_command` /
  `update_command_shortcut` / `get_custom_shortcuts` commands.
- `window/` — `commands.rs` (window chrome + file/folder pickers + `read_project_file`
  + `list_dir`), `file_probe.rs`.
- `bindings.rs` — `generate_bindings()` (tauri-specta `collect_commands!`) and
  `export_ts_bindings()`; writes to `../src/lib/bindings.ts`, `#[cfg(any(debug_assertions, test))]`
  only, invoked from `.setup` under `#[cfg(debug_assertions)]`.
- `bin/duckdb_helper.rs` — sidecar binary, `required-features = ["duckdb-engine"]`.
- Cargo features: `default = []`, `duckdb-engine = ["dep:duckdb"]`. Lib crate name
  `app_lib`, `#![warn(clippy::unwrap_used)]`.

### 1.3 Frontend — `packages/studio/src`

- `studio-app.tsx` + `providers.tsx` — the app root.
- `lib/bindings.ts` — a **hand-maintained copy** of the generated bindings
  (see §4). Exposes `commands.*` and all generated types.
- `core/`
  - `data-provider/` — `DataAdapter` type (`types.ts`), `createTauriAdapter`
    (`adapters/tauri.ts`), `createMockAdapter` (`adapters/mock.ts`, lazy-imported),
    `DataProvider` / `useAdapter` / `useIsTauri` (`context.tsx`), react-query hooks
    (`hooks.ts`), `buildWhereClauseFrom` (`filter-sql.ts`).
  - `platform/` — `isTauriRuntime`, `assertTauriRuntime`, `DesktopOnlyError`,
    `platform-guard.tsx`, `desktop-only.tsx`.
  - `tabs/` (`tabs-store.tsx`, `session-persistence.ts`), `pending-edits/`
    (`pending-edits-store.tsx`, `overlay.ts`), `undo/` (zustand `undo-store.ts`),
    `settings/` (`settings-store.tsx`), `shortcuts/` (`shortcuts.ts` with
    `APP_SHORTCUTS`, zustand `store.ts`), `live-monitor/`, `analytics/`,
    `data-generation/`, `privacy/`, `url-state/`, `table-cache.ts`.
- `features/`
  - `sql-console/` — `sql-console.tsx` (the editor + execute + cancel orchestration),
    `stores/tab-store.tsx` (context+reducer, `QueryTab`, `SqlQueryResult`,
    `localStorage` key prefix `dora-query-tabs`, `MAX_TABS = 20`),
    `stores/query-history-store.tsx`, `components/{sql-editor,sql-results,console-toolbar,query-tab-bar,query-history-panel,query-plan-panel,unified-sidebar,ai-cmd-k}`,
    `query-target.ts`, `mutation-primary-key.ts`, `lib/infer-column-definitions.ts`.
  - `database-studio/` — `database-studio.tsx` (browse view; owns ~35 `useState`
    slots including `tableData`), `components/data-grid.tsx` + `components/data-grid/*`
    (`grid-body`, `grid-header`, `cell-value`, `draft-row`, `selection.ts`,
    `use-cell-editing`, `use-cell-selection`, `use-column-resize`, `use-focused-cell`,
    `use-grid-keyboard`, `use-right-drag-scroll`, `use-row-selection`,
    `use-row-virtualizer`), `hooks/use-database-studio-*`, `utils/table-cache.ts`.
  - `connections/` — `types.ts` (`DatabaseType`, `Connection`, `DEFAULT_PORTS`),
    `source-kinds.ts` (`DbEngine`, `DbPreset`, `SourceKind`, `SourceMeta`),
    `source-caps.ts` (`SourceCaps` TS flavour + `ENGINE_CAPS`), `resolve-source.ts`,
    `ui-actions.ts`, `validation.ts`, `source-labels.ts`, `source-metadata.ts`,
    `data-file-health.ts`, `utils/providers.ts` (`PROVIDER_CONFIGS`,
    `ProviderPattern`), `utils/mapping.ts` (`backendToFrontendConnection`,
    `frontendToBackendSshConfig`), `components/connection-dialog.tsx` +
    `connection-dialog/{connection-form,database-type-selector,ssh-tunnel-config-form}`,
    `components/database-icons.tsx` (`DATABASE_META`).
  - `integrations/` — one folder per provider (`supabase`, `turso`, `neon`,
    `cloudflare`, `planetscale`, `xata`, `vercel`, `posthog`) each with an
    `*-api.ts` and a `*-connect-flow.tsx`, plus `_shared/` mock flow + mock data.
  - `orm-cockpit/` — `ir/` (`SchemaIR`, `TableIR`, `ColumnIR`, `IndexIR`,
    `ForeignKeyIR`, `NormalizedType`, `Dialect`, `from-live-schema.ts`,
    `normalize-type.ts`), `diff/` (`diffSchema`, `SchemaDiff`, `TableDiff`,
    `ColumnDiff`, `Confidence`, `filter-managed-tables.ts`), `migration/`
    (`read-journal.ts`, `query-applied.ts`, `reconcileMigrations` in
    `migration-status.ts`, `generate-sql.ts` → `MigrationResult { up, down, warnings }`),
    `parsers/drizzle/parse-drizzle-schema.ts`, `parsers/prisma/parse-prisma-schema.ts`,
    `converters/` (`contract.ts` with `ConvertResult`/`QueryIR`, `drizzle-to-sql*`,
    `sql-to-drizzle*`, `emit-sql.ts`), `link/` (`detect-orm.ts`, `link-api.ts`,
    `connection-target.ts`, `demo-project.ts`), `components/`.
  - Others: `drizzle-runner/`, `prisma-runner/`, `result-charts/`,
    `schema-visualizer/`, `docker-manager/`, `command-palette/`, `ai-assistant/`,
    `analytics/`, `posthog-analytics/`, `updater/`, `onboarding/`, `todo-list/`,
    `app-sidebar/`, `sidebar/`, `tab-bar/`, `connection-tab-bar/`.
  - `shared/` — `utils/table-ref.ts` (`TableDialect`, `getTableSqlIdentifier`,
    `getTableRefParts`, `buildDropColumnSql`), `utils/backend-error.ts`
    (`formatBackendError`), `ui/`, `hooks/`.

### 1.4 Dependency direction

`apps/desktop/src` → `@dora/studio` → `@studio/lib/bindings` → `@tauri-apps/api/core`
→ Tauri IPC → `lib.rs` `invoke_handler` → `database::commands::*` → `services::*`
→ `ConnectionRepository` → `adapter_from_client` / `write_adapter_from_client` →
per-engine module. `apps/marketing` also imports `@dora/studio`.

---

## 2. Existing abstractions that must be reused, not reinvented

### 2.1 Rust traits and factories

- `DatabaseAdapter` (`database/adapter/read.rs`) — `parse_statements`,
  `execute_query`, `get_schema`, `is_connected`, `database_type`.
- `WriteAdapter` (`database/adapter/write.rs`) — `insert_row`, `update_cell`,
  `delete_rows`, `duplicate_row`, `truncate_table`, `truncate_database`,
  `soft_delete_rows`, `undo_soft_delete`, `dump_database`, `execute_batch`,
  `get_blob_bytes` (defaults to `Error::NotImplemented`).
- `WatchAdapter` (`database/adapter/watch.rs`).
- `DuckDbConn` (`database/duckdb_backend.rs`) — the process-agnostic DuckDB surface.
- `ConnectionRepository` (`database/connection_repository.rs`).
- `SqlDialectExt` + generic `parse_statements` (`database/parser.rs`).
- Factories that must gain an arm for a new engine:
  `adapter_from_client`, `write_adapter_from_client`, `watch_adapter_from_client`.
- Identifier quoting: `database::ident::{quote_ansi, quote_mysql, qualified_ansi,
  qualified_mysql}`. Generated SQL for the SQLite family: `adapter::grid_sql::*`.

### 2.2 Every Rust match/registry a new engine must be added to

1. `DatabaseInfo` (`database/types.rs`) — new variant.
2. `Database` (`database/types.rs`) — new variant.
3. `DatabaseClient` (`database/types.rs`) — new variant.
4. `DatabaseConnection::to_connection_info` — match arm.
5. `DatabaseConnection::new` — match arm.
6. `DatabaseConnection::from_connection_info` — match arm.
7. `DatabaseConnection::is_client_connected` — match arm.
8. `DatabaseConnection::get_client` — two arms (connected + not-connected error).
9. `DatabaseConnection::source_caps` — falls through `_` today.
10. `DatabaseType` enum + its `Display` impl (`adapter/read.rs`).
11. `adapter_from_client` (`adapter/read.rs`).
12. `write_adapter_from_client` (`adapter/write.rs`).
13. `watch_adapter_from_client` (`adapter/watch.rs`).
14. `adapter/mod.rs` — `mod` + `pub use` lines.
15. `StatementManager::submit_query` — the `parse_statements` fn-pointer match.
16. `StatementManager::create_worker` — the executor-spawn match.
17. `ConnectionRepository::parse_statements` for `AppState` — match arm.
18. `ConnectionService::connect_to_database` / `disconnect_from_database` /
     `test_connection` — match arms (`services/connection.rs`).
19. `MutationService::export_table` — the query-building match **and** the
     `db_type` string dispatch to `fetch_*_data` (`services/mutation.rs`).
20. `metadata.rs` — a `get_*_metadata` and usually a `get_*_counts`.
21. `credentials::extract_sensitive_data` — match arm.
22. `error.rs::DatabaseKind` — only if driver-scoped errors are wanted (currently
     has just `Postgres | Mysql | Sqlite | Libsql`).
23. `lib.rs` `invoke_handler` **and** `bindings.rs` `collect_commands!` for any new
     commands (two separate lists; see §4).
24. `database/contract.rs` `get_command_contract()` if the command should appear in
     the hand-written contract.

### 2.3 Every frontend registry a new engine/provider must be added to

1. `DatabaseType` union — `features/connections/types.ts`.
2. `DEFAULT_PORTS: Record<DatabaseType, number>` — same file.
3. `PROVIDER_CONFIGS: Record<DatabaseType, ProviderConfig>` —
   `features/connections/utils/providers.ts` (also `PROVIDER_PATTERNS` there).
4. `DATABASE_META: Record<DatabaseType, {name, description}>` —
   `features/connections/components/database-icons.tsx`.
5. `DbEngine` / `DbPreset` / `SourceKind` / `SourceMeta` —
   `features/connections/source-kinds.ts`.
6. `ENGINE_CAPS: Record<DbEngine, SourceCaps>` — `features/connections/source-caps.ts`.
7. `resolvePresetToEngine`, `inferPresetFromConnection`, `inferSourceKind` —
   `features/connections/resolve-source.ts`.
8. `backendToFrontendConnection` (the `'X' in conn.database_type` chain) and
   `frontendToBackendSshConfig` — `features/connections/utils/mapping.ts`.
9. `TableDialect` union + `dialectUsesSchemas` — `shared/utils/table-ref.ts`.
10. `databaseInfoToDialect` — `core/data-provider/adapters/tauri.ts`.
11. `ProviderKey`, `DATABASE_TYPES`, `TYPE_THEME: Record<ProviderKey, Theme>` —
    `features/connections/components/connection-dialog/database-type-selector.tsx`.
12. `activeDialect` mapping inside `features/sql-console/sql-console.tsx`.
13. `DataAdapter` — both `adapters/tauri.ts` and `adapters/mock.ts` implement it.
14. `features/connections/source-labels.ts`, `source-metadata.ts`, `ui-actions.ts`,
    `validation.ts` where they switch on engine.

For a **hosted provider integration** (token/OAuth, not a new engine): add
`integrations/<name>.rs` + commands in `database/commands/integrations.rs` +
registration in `lib.rs` and `bindings.rs`, then a
`features/integrations/<name>/{<name>-api.ts,<name>-connect-flow.tsx}` wired into
`features/connections/components/connection-dialog.tsx` and a tile in
`database-type-selector.tsx`. `tools/scripts/verify-providers.ts` is the existing
live-API verification harness.

### 2.4 Contracts explicitly marked frozen in source

- `orm-cockpit/ir/types.ts` — "THIS IS A FROZEN CONTRACT … Add fields only additively."
- `orm-cockpit/diff/types.ts` — "the FROZEN contract Wave C and Wave D import …
  Do not redefine these shapes downstream."
- `orm-cockpit/converters/contract.ts` — "Both directions and the UI import ONLY
  from this module"; determinism is stated as the contract.
- `error.rs` — `Error::tag()` is documented as "Stable — frontend switches on it".

### 2.5 Frontend helpers that already exist

`formatBackendError` (`shared/utils/backend-error.ts`), `buildWhereClauseFrom`
(`core/data-provider/filter-sql.ts`), `getTableSqlIdentifier` / `getTableRefParts` /
`buildDropColumnSql` (`shared/utils/table-ref.ts`), `useRowVirtualizer`
(`features/database-studio/components/data-grid/use-row-virtualizer.ts`),
`APP_SHORTCUTS` + `useShortcut` (`core/shortcuts`), `isTauriRuntime` /
`assertTauriRuntime` / `DesktopOnlyError` (`core/platform`), `tableDataCache`
(`core/table-cache.ts`), `reconcileMigrations`, `diffSchema`, `generateMigrationSql`
(`orm-cockpit/*`).

---

## 3. Invariants already stated in `AGENTS.md` / `.agent/`

These already live in repo-tracked agent instructions. Future skills should **not**
restate them.

From `AGENTS.md` (repo root):
- Single non-exported props/args type is named `Props`, not `ComponentNameProps`.
- Export types only when consumed outside their defining module.
- `docker-compose.databases.yml` stands up the local DB servers; port map with the
  MySQL/MariaDB swap (MySQL **3307**, MariaDB 3306, Postgres 5432, Cockroach 26257,
  libsql/sqld 8081); live adapter tests are
  `apps/desktop/src-tauri/tests/live_db_tests.rs`, gated on `DORA_LIVE_DB_TESTS=1`,
  CI-run via `.github/workflows/live-db-tests.yml`; the
  `up -d --force-recreate --wait <service>` recovery hint.

From `.agent/AGENTS.md`:
- Release-note drafts go to `docs/RELEASE_NOTES.md`; plain Markdown, **no emojis**,
  no marketing fluff; sections Highlights / Features / Fixes / Technical; do not
  invent version numbers.
- Every PR needs one label before merge (`feat`, `fix`, `perf`, `refactor`, `deps`,
  `ci`, `docs`); the label drives `.github/release.yml` auto-notes.
- README stays professional, no decorative emojis, text labels (Done/WIP) not icons.

From `.agent/claude.md`:
- Project root, CLI at `tools/dora-runner` (Go), scripts at `tools/scripts`, docs at
  `docs/`; no emojis; release notes live in `docs/`, not the repo root;
  `dora-runner` is the source of truth for build management.

From `.agent/rules/no-arrow-constants.md` (`trigger: always_on`):
- No arrow functions anywhere; only `function` declarations; scan for `=>` before
  returning code.

From `.agent/rules/type-convention.md` (`trigger: always_on`):
- Single-type component files must name the props type (see §4 — the file's title
  says `Props`, its body says `TProps`).

From `.agent/workflows/`:
- `release.md` — the normal release path is `bun run release` or the **Release
  dispatch** Action, documented in `docs/distribution/release-guide.md`;
  `bun release:gen` is the optional AI draft helper with `--test`, `--list-models`,
  `--dry-run`, `--build`, `--version-bump=patch|minor|major`.
- `build-linux.md`, `setup-ai.md` — Linux packaging and local-Ollama setup flows.

Also stated in tracked docs (not `.agent/`, but already written down):
- `docs/specs/README.md` — merge-hotspot files for provider work; the per-provider
  module shape; "TS bindings are generated from Rust … never hand-edit the generated
  file"; update `docs/product-roadmap.md` and `CHANGELOG.md` when a spec ships.
- `docs/architecture/data-sources.md` — model/engine/dialect three-tier design;
  "Feature code MUST NOT branch on engine/dialect identity"; enum-as-strategy
  rationale; "Backend is canonical" for capabilities.
- `docs/provider-support/00-overview.md` — the WS1→WS7 provider workstream order.

---

## 4. Inconsistencies (two or more ways of doing the same thing)

No winner is picked here. Each is excluded from skill content until a human resolves it.

**4.1 Two `bindings.ts` files, one generated and one hand-maintained.**
`src-tauri/src/bindings.rs::export_ts_bindings` writes to
`apps/desktop/src/lib/bindings.ts`. Nothing in `apps/desktop/src` imports it — the
only files there are `App.tsx`, `main.tsx`, `boot-screen.ts`, `App.css`,
`vite-env.d.ts`. All application code imports `@studio/lib/bindings`
(`packages/studio/src/lib/bindings.ts`), which is a separate copy that has already
drifted: it is missing `clean_build_cache` and `get_build_cache_stats`. Both files
carry the header "Auto-generated by tauri-specta. DO NOT EDIT."

**4.2 Two command-registration lists.** `lib.rs` `invoke_handler` and
`bindings.rs` `collect_commands!`. `bindings.rs` is a strict subset; these six are
registered but have no generated binding: `check_tcp_port`, `get_all_commands`,
`get_command`, `get_custom_shortcuts`, `update_command_shortcut`,
`populate_test_queries_command`.

**4.3 Two IPC invocation styles from the frontend.** Generated `commands.*`
(`@studio/lib/bindings`) vs raw `invoke()` from `@tauri-apps/api/core` in
`features/sidebar/components/build-cache-section.tsx`,
`features/sidebar/components/storage-section.tsx`,
`features/docker-manager/utilities/port-utils.ts`. Two of those
(`get_build_cache_stats`, `clean_build_cache`) *do* have generated bindings in the
desktop copy but not the studio copy.

**4.4 Two `SourceCaps` types with the same name and different meaning.**
Rust `database::dialect::SourceCaps { supports_listen_notify }` vs TS
`features/connections/source-caps.ts::SourceCaps { canRunSql, canInspectSchema,
canEditRows, canImportFile, canExportFile, canQueryFiles, canAttachFiles,
supportsLocalFile, supportsRemoteUrl, supportsSshTunnel, supportsLiveMonitor,
isReadonly }` with `ENGINE_CAPS`. `docs/architecture/data-sources.md` names this
duplication and declares the backend canonical, but the frontend table is still the
one the UI reads.

**4.5 Four overlapping engine enums.** `DatabaseInfo` (9 variants, incl.
`CockroachDB` and `MariaDB`), `Database`/`DatabaseClient` (7 variants — dialects
collapsed into a field), `adapter::DatabaseType` (7), `error::DatabaseKind` (4:
`Postgres | Mysql | Sqlite | Libsql`). Frontend adds `DatabaseType` (9),
`DbEngine`, `DbPreset` (25), `TableDialect` (9), `ProviderKey`.

**4.6 Three separate query/result paths.**
(a) `start_query` → `StatementManager` → `fetch_query`/`fetch_page`/`get_columns`
    (paged, `Box<RawValue>`);
(b) `MutationService::export_table` → its own per-engine SQL match →
    `fetch_postgres_data` / `fetch_sqlite_data` / `fetch_duckdb_data` /
    `fetch_libsql_data` / `fetch_mysql_data` / D1 / PostHog branches;
(c) `DuckDbConn::query_raw` / `execute_raw` for ad-hoc internal callers.

**4.7 Two places that build browse SQL.** The frontend
`core/data-provider/adapters/tauri.ts::fetchTableData` composes
`SELECT * FROM <getTableSqlIdentifier(...)> WHERE … ORDER BY … LIMIT … OFFSET …`
in TypeScript (quoting via `shared/utils/table-ref.ts`), while the Rust side has
`database/ident.rs` and `adapter/grid_sql.rs` for the same job.

**4.8 Two state-management idioms in the studio.** zustand `create()` stores
(`core/undo/undo-store.ts`, `core/shortcuts/store.ts`,
`features/ai-assistant/store.ts`, `features/docker-manager/stores/docker-manager-store.ts`)
vs React `createContext` + `useReducer`/`useState` "stores"
(`core/tabs/tabs-store.tsx`, `core/settings/settings-store.tsx`,
`core/pending-edits/pending-edits-store.tsx`, `core/live-monitor/live-monitor-context.tsx`,
`core/data-provider/context.tsx`, `features/sql-console/stores/tab-store.tsx`,
`features/sql-console/stores/query-history-store.tsx`, `features/app-sidebar/context.tsx`).

**4.9 Three caching layers for the same data.** `@tanstack/react-query` hooks in
`core/data-provider/hooks.ts`; the module-level `Map` in `core/table-cache.ts` used
directly by `features/database-studio/database-studio.tsx`; and the Rust
`AppState.schemas` `DashMap`. Additionally `useTableData`, `useExecuteQuery`,
`useScripts`, `useScriptMutations`, and `useDataProvider` are exported from
`core/data-provider` and have **zero** consumers outside that folder.

**4.10 Three Tauri-runtime detections.** `detectTauri()` in
`core/data-provider/context.tsx`, `isTauriRuntime()` in `core/platform/runtime.ts`,
and the `useIsTauri()` context hook.

**4.11 Three virtualized result tables.**
`features/database-studio/components/data-grid/*` (via `useRowVirtualizer`),
`features/sql-console/components/sql-results.tsx` (its own `useVirtualizer`),
`features/drizzle-runner/components/results-panel.tsx` (its own `useVirtualizer`).

**4.12 Arrow functions vs function declarations.** `.agent/rules/no-arrow-constants.md`
is `trigger: always_on` and bans `=>` entirely; the user-level global instructions
require arrows for callbacks; the code mixes both — e.g.
`features/sql-console/sql-console.tsx` uses `useCallback(async (…) => {…})` and
arrow `.map()` callbacks, while `core/data-provider/adapters/tauri.ts` and
`features/sql-console/stores/tab-store.tsx` use `function () {}` callbacks.

**4.13 Props type name.** `AGENTS.md` and the *title* of
`.agent/rules/type-convention.md` say `Props`; the *body* of that same rule file says
`TProps` five times. Source uses `Props` (`components/data-grid.tsx`,
`core/data-provider/context.tsx`, `database-type-selector.tsx`).

**4.14 Formatting.** `packages/studio` is predominantly tabs + no semicolons
(`tab-store.tsx`, `tauri.ts`, `source-caps.ts`), but
`features/sql-console/sql-console.tsx` and `features/database-studio/utils` files
are 2-space + semicolons. `orm-cockpit/*` uses tabs + trailing commas.
`packages/style` (`oxfmt`, `oxlint`) is the configured formatter/linter.

**4.15 Test layout and setup files.** Root `vitest.config.ts` includes
`__tests__/**`, `packages/*/src/**/*.test.*`, and `apps/*/src/**/*.test.*` — i.e.
both centralized and colocated. `__tests__/README.md` says tests "live under `tests/`"
(the directory is `__tests__/`) and that colocated tests are avoided, yet colocated
tests exist (`features/sql-console/stores/tab-store.test.tsx`,
`features/database-studio/components/data-grid/use-grid-keyboard.test.ts`,
`core/pending-edits/overlay.test.ts`,
`features/database-studio/hooks/use-database-studio-edits.test.ts`).
Three setup files exist: `__tests__/vitest.setup.ts` (the live one, referenced by
`vitest.config.ts` and `tools/prebuild.ts`), `__tests__/setup/vitest.setup.ts`
(older, no localStorage polyfill; referenced only by the README), and
`packages/studio/src/test/setup.ts` (referenced by nothing).

**4.16 A second, dead vitest config.** `apps/desktop/vitest.config.ts` exists with
`setupFiles: ['./src/test/setup.ts']` — that path does not exist under
`apps/desktop`. The `apps/desktop` `test` script explicitly uses
`-c ../../vitest.config.ts`, so this config is unused as written.

**4.17 Two shortcut/command registries.** Rust `commands_system::CommandRegistry`
(seeded with `palette.open`, `theme.toggle`, `connections.new`, `queries.run`, …,
persisted via `load_custom_shortcuts`) vs frontend `APP_SHORTCUTS` in
`core/shortcuts/shortcuts.ts` + the zustand `core/shortcuts/store.ts`. No frontend
code calls `get_all_commands`, `get_command`, `get_custom_shortcuts`, or
`update_command_shortcut`.

**4.18 Two command-description sources.** `database/contract.rs`
`get_command_contract()` is a hand-written list of commands with arguments, return
types, stability and side effects; the generated specta bindings are the other
description of the same surface. `get_command_contract` has no caller in `src`.

**4.19 Package manager in agent docs.** `.agent/workflows/build-linux.md` instructs
`npm run tauri build --prefix apps/desktop`; the repo is bun-only
(`packageManager: bun@1.3.14`, all CI steps use `bun`).

**4.20 Stale path in `.agent/claude.md`.** It states the project root is
`/home/remco-stoeten/dora`; the actual checkout is `/home/remcostoeten/dev/dora`.

**4.21 Two project-local agent-skill directories, both gitignored.**
`.agents/skills/` and `.claude/skills/` hold the same 7 skills
(`find-skills`, `copywriting`, `crafting-effective-readmes`, `create-readme`,
`readme-generator`, `grill-with-docs`, `get-api-docs`); `.claude/skills` also has
`integration-nextjs-app-router` and `integration-nextjs-pages-router`.
`.gitignore` ignores `.agents/` (line 36) and `.claude/` (line 38). `skills-lock.json`
at the repo root is tracked and currently modified in the working tree.

**4.22 SQLite-family adapters: shared builders vs per-file SQL.**
`adapter/grid_sql.rs` exists for SQLite/libSQL/D1, but `write_sqlite.rs`,
`write_libsql.rs`, and `write_d1.rs` also delegate parts of their work to
`maintenance.rs` free functions, and `write_posthog.rs` / `write_duckdb.rs` follow
neither pattern.

---

## 5. Ownership boundaries as they exist in code today

### 5.1 Who owns query result state

**Backend (authoritative).** `StatementManager` (`database/stmt_manager.rs`) owns
every result. Per statement it holds an `Arc<ExecState>` in a
`DashMap<QueryId, Arc<ExecState>>`:

- `status: AtomicU8` (`QueryStatus::{Pending, Running, Completed, Error}`),
- `error: RwLock<Option<String>>`,
- `result: ExecResult::Rows { pages: RwLock<Vec<Page>>, rows_received, columns }`
  or `ExecResult::NoRows` (chosen from `ParsedStatement::returns_values`),
- `rows_affected: RwLock<Option<usize>>`,
- `sqlite_interrupt_handle`, `pg_cancel`.

`QueryId` comes from a monotonic `AtomicUsize` (`next_id`), so ids are globally
unique across submissions. Finished statements are reaped by
`reap_finished_queries()` once the map exceeds `MAX_RETAINED_QUERIES = 64`; running
and pending statements are never reaped. Two task handles per query:
`execution_handles` (the driver executor) and `listener_handles` (the task draining
`QueryExecEvent`s into `ExecState`).

Executors push `QueryExecEvent::{TypesResolved, Page, Finished}` over an unbounded
tokio mpsc channel; pages are `DEFAULT_QUERY_PAGE_SIZE = 50` rows
(`database/sqlite/execute.rs`).

`AppState.schemas: DashMap<Uuid, Arc<DatabaseSchema>>` separately caches schema;
`database::commands::query::start_query` removes the entry when the submitted SQL
contains a non-read-only statement (falling back to keyword sniffing for
`CREATE|ALTER|DROP|TRUNCATE|RENAME|ATTACH|DETACH` if parsing fails).

**Frontend.** There is no streaming — the adapter polls.
`core/data-provider/adapters/tauri.ts::pollQueryToCompletion` loops
`commands.fetchQuery(queryId)` every `QUERY_POLL_INTERVAL_MS = 100` up to
`QUERY_POLL_TIMEOUT_MS = 30_000`, then `commands.getColumns` and `collectAllRows`,
which walks pages `1..page_count` via `commands.fetchPage`. Only after that does the
adapter return a `QueryResult`.

Once returned, result state is owned by React:
- SQL console — `features/sql-console/stores/tab-store.tsx`, per-tab
  `QueryTab.result: SqlQueryResult | null` plus `isExecuting`, persisted to
  `localStorage` under the `dora-query-tabs` prefix.
- Browse/grid — `features/database-studio/database-studio.tsx` `useState<TableData |
  null>` seeded from the module-level `tableDataCache` `Map`.

### 5.2 Where cancellation is implemented, and whether it reaches the server

Frontend: `features/sql-console/sql-console.tsx` keeps `inFlightQueryIdsRef`
(populated by the `ExecuteQueryOptions.onStarted(queryIds)` callback) and
`cancelledTabsRef`. `handleCancel` calls `adapter.cancelQueries(queryIds)` when the
ids are known, otherwise falls back to `adapter.cancelActiveQuery(connectionId)`.
Those map to the `cancel_queries` and `cancel_query` commands. **Note:**
`cancelActiveQuery` ignores its `connectionId` argument and calls
`commands.cancelQuery()`, which cancels *all* running/pending statements process-wide
(`StatementManager::cancel_active_queries`).

Backend: `StatementManager::cancel_queries(&[QueryId])` and `cancel_active_queries()`.
For each targeted, still-running/pending statement it:
1. calls `signal_engine_cancel(&entry)`,
2. aborts the executor `JoinHandle`,
3. sets `error = "Query cancelled"` and `status = QueryStatus::Error`,
4. aborts the listener handle.

`signal_engine_cancel` reaches the **database server** for exactly two engines:
- **SQLite** — `rusqlite::InterruptHandle::interrupt()`, captured at
  `create_worker` time.
- **Postgres / CockroachDB** — a real `CancelRequest`: the stored
  `tokio_postgres::CancelToken` is cloned and `token.cancel_query(...)` is spawned on
  a fresh short-lived connection, choosing `no_verify_tls()` for
  `SslMode::{Require, Prefer}` and `NoTls` otherwise. The `ssl_mode` is recovered in
  `DatabaseConnection::get_client` by re-parsing the connection string.

**MySQL/MariaDB, libSQL, DuckDB, Cloudflare D1, and PostHog get no server-side
cancel** — only the local task is aborted, so the server keeps executing. Cancellation
is documented as best-effort and fire-and-forget.

Related but separate cancellation mechanisms: `AppState.ai_cancel_flags`,
`ollama_cancel_flags`, `ollama_install_cancel_flags` (`DashMap<String,
Arc<AtomicBool>>` observed by the streaming loops, driven by `ai_abort_stream`,
`ai_cancel_ollama_pull`, `ai_cancel_ollama_install`), and
`SshTunnel`'s `stop_signal: Arc<AtomicBool>`.

A dropped results channel is *not* an error: `impl From<SendError<T>> for Error`
maps it to `Error::Cancelled`, and `log_query_exec_outcome` logs `Cancelled` at debug.

### 5.3 How errors cross the Tauri boundary

Single `Error` enum in `src-tauri/src/error.rs`, split into typed application
variants (`ConnectionNotFound(Uuid)`, `ConnectionFailed`, `AuthFailed`,
`PermissionDenied`, `Driver { kind: DatabaseKind, message }`, `Serialization`,
`Cancelled`, `Timeout { ms }`, `NotImplemented(&'static str)`, `InvalidInput`, `Io`,
`Internal`) and transparent `#[from]` wrappers (`anyhow`, `tauri`, `rusqlite`,
`std::fmt`, `serde_json`, `tokio_postgres`, `mysql_async`, and `duckdb` under the
feature flag).

A hand-written `serde::Serialize` impl emits exactly
`{ "kind": <Error::tag()>, "detail": <Display string> }`. `Error::tag()` collapses
variants onto a stable set of tags: `Serialization` covers `Json`; `Driver` covers
`Rusqlite`, `Postgres`, `MySQL`, `DuckDB`; `Internal` covers `Internal`, `Any`,
`Tauri`, `Fmt`. `impl specta::Type for Error` forwards to `BackendErrorShape`, so
TypeScript sees `{ kind: string; detail: string }`.

Frontend: every generated command returns
`Promise<Result<T, { kind: string; detail: string }>>` with `{ status: 'ok' | 'error' }`.
The bindings re-throw real JS `Error`s and only wrap non-`Error` rejections. The
studio funnels the payload through `formatBackendError`
(`shared/utils/backend-error.ts`), and `core/data-provider` re-shapes everything into
`AdapterResult<T> = { ok: true, data } | { ok: false, error: string }` — so the
`kind` discriminator is flattened to a string at the adapter boundary.
`DesktopOnlyError` (`core/platform/runtime.ts`) is a separate, frontend-only error.

### 5.4 Are large payloads serialized as JSON

Yes, end to end.

- Row pages are `Page = Box<serde_json::value::RawValue>` — the row writers produce
  JSON text (`Vec<Vec<Json>>`) and `StatementInfo.first_page` carries the same, typed
  to specta as `serde_json::Value`.
- Column metadata is `QueryExecEvent::TypesResolved { columns: Box<RawValue> }` —
  a JSON-serialized `Vec<String>` (the source comments this as intentional).
- `database::commands::query::fetch_page` and `get_columns` take the `RawValue` and
  `serde_json::from_str(...)` it back into a `serde_json::Value` before returning,
  so the IPC layer re-serializes a fully materialized JSON value (falling back to
  `Value::Null` on a parse failure).
- The whole result is materialized client-side: `collectAllRows` concatenates every
  page into one JS array before any UI sees it. There is no streaming, no Channel,
  and no binary transport on the query path.
- The DuckDB helper-process transport is also JSON: `duckdb_ipc/framing.rs` is
  described as length-prefixed JSON, and `DuckDbConn` is specified as
  "Every method takes and returns serde-serialisable types".
- `Channel` from `@tauri-apps/api/core` *is* used, but only for AI streaming
  (`features/sql-console/components/ai-cmd-k.tsx`,
  `features/ai-assistant/use-ai-chat.ts`, `features/ai-assistant/ollama-models-section.tsx`).
- Binary cells are an explicit exception: the grid renders a display string via
  `blob_display.rs::describe_blob`, and `WriteAdapter::get_blob_bytes` re-selects the
  raw `Vec<u8>` by primary key when the user asks for it.

---

## 6. Commands and scripts that actually exist

Skills may only reference commands from this list.

### 6.1 Root `package.json` scripts (verbatim)

```
dev                         turbo dev
generate:releasetext        bash scripts/generate-release-text.sh
generate:changelog-data     bun scripts/sync-changelog-data.ts
release                     bash scripts/release.sh
release:prepare             bash scripts/release-prepare.sh
ship                        bash scripts/ship.sh
prebuild                    bun run tools/print-flathub-reminder.ts && bun run tools/prebuild.ts
build                       turbo build
lint                        bun run --cwd packages/style lint
lint:fix                    bun run --cwd packages/style lint:fix
format                      bun run --cwd packages/style format
format:fix                  bun run --cwd packages/style format:fix
fix                         bun run --cwd packages/style fix
test                        turbo test
test:watch                  vitest
test:ui                     vitest --ui
test:coverage               vitest run --coverage
test:desktop                bun run --cwd apps/desktop test
verify:providers            bun tools/scripts/verify-providers.ts
web:dev                     bun --cwd apps/desktop run dev
desktop:dev                 bun run --cwd apps/desktop tauri dev
desktop:build               bun run --cwd apps/desktop tauri build
desktop:build:linux         bun run --cwd apps/desktop tauri build --bundles appimage,deb,rpm
desktop:build:win           bun run --cwd apps/desktop tauri build --bundles nsis,msi
desktop:build:mac           bun run --cwd apps/desktop tauri build --bundles dmg
desktop:build:deb           bun run --cwd apps/desktop tauri build --bundles deb
desktop:build:rpm           bun run --cwd apps/desktop tauri build --bundles rpm
desktop:build:appimage      bun run --cwd apps/desktop tauri build --bundles appimage
desktop:build:nsis          bun run --cwd apps/desktop tauri build --bundles nsis
desktop:build:msi           bun run --cwd apps/desktop tauri build --bundles msi
desktop:build:dmg           bun run --cwd apps/desktop tauri build --bundles dmg
release:checksums           bun tools/scripts/generate-checksums.ts
release:winget              bun tools/scripts/generate-winget-manifest.ts
release:aur                 bun tools/scripts/generate-aur-package.ts
release:homebrew            bun tools/scripts/generate-homebrew-cask.ts
release:apt                 bun tools/scripts/generate-apt-repo.ts
release:flatpak:build       bash packaging/flatpak/build-flatpak.sh
release:snap:build          bash scripts/snapcraft.sh --use-lxd
release:snap:build:destructive  bash scripts/snapcraft.sh --sudo --destructive-mode
release:guide               bash tools/scripts/release-guide.sh
vm:lab                      bash tools/scripts/vm-lab.sh
desktop:install:deb         bash -c '…dpkg -i the newest apps/desktop/src-tauri/target/release/bundle/deb/*.deb…'
desktop:uninstall           bash -c '…apt-get remove -y dora…'
release:gen                 bun tools/scripts/generate-release.ts
ai:setup                    bun tools/scripts/setup-local-ai.ts
setup:ai                    bun tools/scripts/setup-local-ai.ts
runner                      ./dora-manager-executor
```

### 6.2 `apps/desktop/package.json` scripts (verbatim)

```
dev              bun vite --port 1420 --strictPort
build            vite build
build:dev        vite build --mode development
build:sidecar    bun scripts/build-duckdb-helper.ts
lint             bun run --cwd ../.. lint
typecheck        tsc --noEmit -p tsconfig.app.json
preview          vite preview
tauri            tauri
pretauri         bun ../../tools/print-flathub-reminder.ts
tauri:dev        bun run build:sidecar && node -e "…bun x tauri dev…"   (sets GDK_BACKEND=x11 and WEBKIT_DISABLE_DMABUF_RENDERER=1 on Linux)
tauri:win        powershell -NoProfile -ExecutionPolicy Bypass -File scripts\tauri-dev-win.ps1
test             vitest run -c ../../vitest.config.ts
test:watch       vitest -c ../../vitest.config.ts
test:ui          vitest --ui -c ../../vitest.config.ts
test:coverage    vitest run --coverage -c ../../vitest.config.ts
```

### 6.3 `packages/studio/package.json` scripts (verbatim)

```
typecheck   tsc --noEmit
test        vitest run -c ../../vitest.config.ts
smoke       node smoke/boot-smoke.mjs
```

### 6.4 `packages/style/package.json` scripts (verbatim)

```
lint             cd ../.. && oxlint -c packages/style/.oxlintrc.json . && bun run packages/style/tools/run-lint-style.ts --strict
lint:fix         cd ../.. && oxlint --fix -c packages/style/.oxlintrc.json . && bun run packages/style/tools/run-lint-style-fix.ts
format           cd ../.. && oxfmt --check -c packages/style/.oxfmtrc.json .
format:check     (not defined here — see apps/marketing)
format:fix       cd ../.. && oxfmt --write -c packages/style/.oxfmtrc.json . && bun run packages/style/tools/run-fix-imports.ts
fix              bun run format:fix && bun run lint:fix
lint:style       cd ../.. && tsx packages/style/tools/run-lint-style.ts
lint:style:fix   cd ../.. && tsx packages/style/tools/run-lint-style-fix.ts
fmt:imports:fix  cd ../.. && tsx packages/style/tools/run-fix-imports.ts
```

### 6.5 `apps/marketing/package.json` scripts (verbatim)

```
dev               bun --bun next dev
seo               tools/seo/run.sh
seo:setup         tools/seo/setup-ci.sh
seo:prod          tools/seo/index.sh
build             bun --bun next build
build:ci          bun --bun next build
start             bun --bun next start
typecheck         bun --bun tsc --noEmit
format            bunx oxfmt .
format:check      bunx oxfmt --check .
lint              bunx oxlint .
check             bun run typecheck && bun run format:check && bun run lint && bun run build
capture:features  node tools/capture-feature-assets.mjs
```

### 6.6 `packages/promo/package.json` scripts (verbatim)

```
render  node src/cli.mjs
hero    node record-hero-flow.mjs
author  node src/cli.mjs author
edit    node src/cli.mjs edit
list    node src/cli.mjs --list
```

### 6.7 `turbo.json` tasks

`test` (`dependsOn ^test`, `cache: false`), `build` (`dependsOn ^build`, outputs
`dist/**`, `.next/**`, `src-tauri/target/**`), `dev` (`cache: false`, `persistent`),
`lint` (`dependsOn ^lint`), `typecheck` (`dependsOn ^typecheck`).

### 6.8 Commands run by `.github/workflows/**` (verbatim)

`ci.yml` (push/PR on `main`, `master`, `develop`):
```
bun install
bun run test:desktop
cargo test                          # working-directory apps/desktop/src-tauri, DATABASE_URL set
bun run lint
bun run --cwd packages/studio typecheck
bun run --cwd apps/desktop typecheck
bun run build                       # working-directory apps/desktop
bunx playwright install --with-deps chromium
bun run --cwd packages/studio smoke
```
Jobs: `test-typescript`, `test-rust`, `lint`, `typecheck`, `build` (needs the first
four), `boot-smoke` (needs `test-typescript`, `lint`, `typecheck`). Bun is pinned to
`1.3.14`.

`live-db-tests.yml` (`workflow_dispatch` + cron `17 5 * * 1`):
```
docker compose -f docker-compose.databases.yml up -d --wait mysql mariadb
cargo test --test live_db_tests -- --nocapture
docker compose -f docker-compose.databases.yml down -v
```

`ci-mac.yml` (`workflow_dispatch`): `bun install`, `bun run desktop:build`, plus a
macOS updater-artifact verification step.

`release.yml`: `bun install`, `bun run build`, and
`bun ../../tools/scripts/generate-checksums.ts --input-dir=src-tauri/target/release/bundle --output=src-tauri/target/release/bundle/checksums-<os>.txt --extensions=…`.

`release-dispatch.yml` (`workflow_dispatch`, semver bump input):
`bun install --frozen-lockfile`, git-cliff install, prepare/push release commit + tag.

Other workflows present: `apt.yml`, `aur.yml`, `brew.yml`, `flatpak.yml`,
`snap.yml`, `tag-create.yml`, `winget.yml`.

### 6.9 Commands referenced by tracked docs

- `docs/provider-support/*` shared validation:
  `bun x tsc --noEmit -p apps/desktop/tsconfig.app.json` and
  `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`.
- `docs/specs/*` validation: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`.
- `AGENTS.md`: `docker compose -f docker-compose.databases.yml up -d --wait mysql mariadb`
  and `docker compose -f docker-compose.databases.yml up -d --force-recreate --wait <service>`.
- `.agent/claude.md`: `cd tools/dora-runner && go build -o ../../dora-runner .`
- `README.md`: `bun install`, `bun run desktop:dev`, `bun run --cwd apps/marketing dev`,
  the `desktop:build*` set, `bun run test`, `bun run test:watch`, `bun run test:coverage`,
  and an explicit warning to use `bun run test`, never a bare `bun test`.

**Not verified:** whether `bun run lint`, `bun run --cwd apps/marketing typecheck`,
or `turbo build` currently pass on `master`. Nothing was executed.

---

## 7. Project-local skill support — verified in this environment

Versions present: **Claude Code 2.1.220**, **Codex CLI 0.146.0** (npm install at
`~/.local/share/fnm/node-versions/v24.15.0/…/@openai/codex`, native binary vendored
for `x86_64-unknown-linux-musl`).

Method: probe skill folders were created in a scratch directory outside the repo, then
each CLI was asked what it could see —
`codex debug prompt-input` (renders the model-visible prompt, offline) and
`claude -p` (one-shot prompt). Results below are observed, not assumed.

### 7.1 Codex CLI 0.146.0

Project-local discovery roots, both confirmed to load:

- `<project>/.codex/skills/<skill-name>/SKILL.md`
- `<project>/.agents/skills/<skill-name>/SKILL.md`

`<project>/.claude/skills/…` was **not** loaded. A bare `<project>/skills/…` was
**not** loaded. Discovered skills appear in the prompt as
`name: description (file: <absolute path to SKILL.md>)`.

User-level root: `$CODEX_HOME/skills`, defaulting to `~/.codex/skills` (stated in the
bundled `skill-creator` and `skill-installer` system skills, and matching the
populated `~/.codex/skills/` on this machine, which also contains a `.system/`
subdirectory of built-in skills). There is also a `skills/extraRoots/set` app-server
method, so additional roots are settable programmatically — **not tested here**.

File format (from the bundled `skill-creator` system skill):

```
skill-name/
├── SKILL.md            (required)
│   ├── YAML frontmatter: name (required), description (required)
│   └── Markdown body
├── agents/openai.yaml  (recommended — UI metadata: display_name, short_description, default_prompt)
└── scripts/ | references/ | assets/   (optional)
```

Only `name` and `description` are read to decide when a skill triggers. The body is
loaded after the skill triggers. `skill_search` is a stable feature flag and is
enabled in this install (`codex features list`). Codex also honors a `metadata:`
frontmatter block (`~/.codex/skills/.system/skill-creator/SKILL.md` carries
`metadata.short-description`).

### 7.2 Claude Code 2.1.220

Project-local discovery root, confirmed:

- `<project>/.claude/skills/<skill-name>/SKILL.md`

`<project>/.agents/skills/…` and `<project>/.codex/skills/…` were **not** loaded.

Frontmatter fields observed in use in this repo:
`name`, `description`, and `disable-model-invocation: true`. The last one is honored:
`.claude/skills/grill-with-docs/SKILL.md` sets it and that skill does not appear in
the model-visible skill list, while its neighbours in the same directory do.
Bundled resources (`references/`, `templates/`, extra `.md` files) sit alongside
`SKILL.md` — e.g. `.claude/skills/crafting-effective-readmes/` has `templates/`,
`references/`, `style-guide.md`, `section-checklist.md`.

### 7.3 Can they share one directory?

**Not by pointing both at the same path** — the directory names are fixed and differ
(`.claude/skills` vs `.codex/skills`/`.agents/skills`), and Claude Code does not read
either Codex root.

**Symlink behaviour, tested:**

| Layout | Codex 0.146.0 | Claude Code 2.1.220 |
| --- | --- | --- |
| `.claude/skills` is itself a symlink to a shared dir | n/a | **not discovered** |
| `.codex/skills` is itself a symlink to a shared dir | discovered | n/a |
| real `.claude/skills/` containing a symlink to a shared skill folder | discovered | **discovered** |
| real `.codex/skills/` containing a symlink to a shared skill folder | discovered | n/a |

So one physical directory of skill folders *can* back both tools, but the shared
directory must be reached through **per-skill symlinks inside a real
`.claude/skills/` directory** for Claude Code. Codex accepts either a symlinked
`skills` directory or per-skill symlinks.

### 7.4 Repository-specific caveat

`.agents/skills/` is the canonical skills root here, and it is the only one tracked:
`.gitignore` excludes `.agents/*` but re-includes `.agents/skills/dora-*/` and this
report. `.claude/` and `.codex/` are gitignored outright — Claude Code reaches the
canonical root through untracked per-skill symlinks in `.claude/skills/`, which every
clone recreates locally. Anything else under those directories is local-only and will
not reach other clones or CI.
