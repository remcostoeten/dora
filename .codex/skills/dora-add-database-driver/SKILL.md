---
name: dora-add-database-driver
description: Adding a database engine Dora cannot currently speak — a new wire protocol or HTTP query API that needs its own adapter. Use when wiring a new engine through the Rust connection enums, the read/write/watch adapters and their factories, the statement executor, the stored connection type id, and the studio's engine registries, capability table and connect tile. Not for a hosted account integration on top of an engine Dora already speaks (dora-add-provider), not for query lifecycle (dora-query-pipeline), the IPC surface (dora-tauri-boundary) or connect and credential mechanics (dora-connection-lifecycle).
---

# Add a database driver

## Scope

This skill owns adding an engine: the decision that it *is* an engine, every
registry and match arm it must appear in, and the contracts its adapters have to
satisfy before the studio can browse, query and edit it.

Connecting, credential storage and tunnels are `dora-connection-lifecycle`'s.
Statement lifecycle, cancellation and paging are `dora-query-pipeline`'s. Command
registration and generated bindings are `dora-tauri-boundary`'s. Verifying the
new engine behaves like the ones already shipped is `dora-database-parity`'s.
Nothing here restates any of them.

Cloudflare D1 is the worked example throughout — the last genuinely new engine
added. `reference.md` lists every file it touched.

## Unencodable

Source has two or more answers and `.agent-skills/FINDINGS.md` declines to pick
one. Ask before deciding.

- Whether a wire-compatible vendor becomes a `DatabaseInfo` variant or only a
  frontend preset. CockroachDB and MariaDB are `DatabaseInfo` variants but not
  `Database` / `DatabaseClient` variants (FINDINGS 4.5). Rules below cover a
  genuinely new engine only.
- Whether the backend `SourceCaps` or the frontend `ENGINE_CAPS` is authoritative
  (FINDINGS 4.4). Rules below describe the frontend table, which is what the UI
  reads today.
- Which of the three result paths a new read should use (FINDINGS 4.6). The
  export match still needs an arm either way.
- Which `bindings.ts` copy to update (FINDINGS 4.1) — `dora-tauri-boundary`.

## Workflow

1. Decide engine versus vendor first. It is a new engine only when nothing in
   `DatabaseType` (`apps/desktop/src-tauri/src/database/adapter/read.rs`) can
   execute its statements over its transport. D1 qualified on transport alone:
   its SQL is SQLite's, but it arrives over Cloudflare's HTTP query API. A
   vendor that speaks an existing wire protocol is a `DbPreset` in
   `packages/studio/src/features/connections/resolve-source.ts`, not an engine.
2. Add the variant to `DatabaseInfo`, `Database` and `DatabaseClient` in
   `apps/desktop/src-tauri/src/database/types.rs`, plus `DatabaseType`, then let
   `cargo check` enumerate the work: every non-exhaustive match it reports is a
   required arm. That compiler list *is* the checklist; `reference.md` is the
   copy for the sites that compile without you.
3. Add the storage type id and its migration before touching anything else that
   persists, or every reload of the new connection decodes as Postgres.
4. Implement the engine module, then the three adapters, then the factories.
5. Only then touch the studio. The frontend cannot narrow on a `DatabaseInfo`
   variant that does not exist in the bindings yet.
6. Finish with the capability entry, the connect surface and the docs rows.

## Invariants

**A new engine is three connection variants, one adapter id, and one stored type
id.** `DatabaseInfo`, `Database` and `DatabaseClient` in `apps/desktop/src-tauri/src/database/types.rs`;
`DatabaseType` plus its `Display` arm in `apps/desktop/src-tauri/src/database/adapter/read.rs`; a
`DB_TYPE_*` constant in `apps/desktop/src-tauri/src/storage/serialize.rs` wired
into `serialize_connection_data`, `db_type_name_from_id` and
`deserialize_database_info`. Anything less is a vendor flavour, not an engine.

**The stored type id needs a migration row or the connection reloads as
Postgres.** Add `apps/desktop/src-tauri/migrations/<n>.sql` with an
`INSERT OR IGNORE INTO database_types (id, name)` for the new id and append the
`include_str!` to `apps/desktop/src-tauri/src/storage/migrator.rs`. Without the
row the `database_types` join yields NULL, `COALESCE` falls back to `'postgres'`,
and the connection comes back as a Postgres connection with the wrong body —
`apps/desktop/src-tauri/migrations/011.sql` says exactly this.

**Never widen a match with `_` to make the build pass.** Every arm the compiler
demands is a decision about the new engine; a wildcard silently gives it another
engine's behaviour. The one pre-existing fallthrough on this path is
`DatabaseConnection::source_caps`, which hands anything that is not Postgres or
MySQL `supports_listen_notify: false`. An engine with real server push adds a
real arm there rather than inheriting that.

**All three adapter traits are mandatory, including the ones the engine cannot
honour.** `DatabaseAdapter`, `WriteAdapter` and `WatchAdapter` each need an impl
and an arm in `adapter_from_client`, `write_adapter_from_client` and
`watch_adapter_from_client`, because the factories match exhaustively on
`DatabaseClient`. An engine that cannot watch still implements `WatchAdapter` and
returns `Error::NotImplemented`, the way `D1Adapter` does.

**Unsupported is `Error::NotImplemented("<Trait>::<method> for <Engine>")`, never
a successful no-op.** `write_d1.rs` returns it for `truncate_database`,
`soft_delete_rows`, `undo_soft_delete` and `dump_database`. Returning
`MutationResult { success: true, affected_rows: 0, .. }` for work that did not
happen reports a lie the UI cannot detect.

**Generated SQL comes from the shared builders, never from `format!` on a raw
name.** SQLite-family engines (SQLite, libSQL, D1) use
`apps/desktop/src-tauri/src/database/adapter/grid_sql.rs`, which owns ANSI quoting and `?` placeholders.
Postgres-family and MySQL-family SQL quotes through
`database::ident::{quote_ansi, qualified_ansi, quote_mysql, qualified_mysql}`.
A new engine joins the family whose quoting and placeholder style it shares, or
gets its own pure builders beside `grid_sql.rs` — with the injection-shaped
table-name test that file already carries.

**Values are bound, not interpolated.** Every `WriteAdapter` method takes
`serde_json::Value` and hands it to the driver's binder: `?` positional params
for the SQLite family, `$n` for Postgres. Postgres additionally binds every value
as text and casts in the statement (`$n::text::<type>`, resolved by looking the
column type up first) because the grid edits cells as strings and a string bound
to a typed parameter fails to serialize. A new engine that types its parameters
strictly needs the same text-and-cast treatment or string edits will fail on
every non-text column.

**No generated write uses RETURNING, so a generated id arrives on the next
read.** `MutationResult` carries only `{ success, affected_rows, message }`.
`createDefaultValues` omits primary-key columns from a draft insert so the engine
assigns the id; the grid appends the row optimistically and then calls
`onLoadTableData`, and the real id appears from that refetch. Do not add a
RETURNING clause to a builder to shortcut this, and do not report an id the write
did not return.

**RETURNING matters to the parser, not the writer.** `ParsedStatement`'s
`returns_values` is what picks `ExecResult::Rows` over `ExecResult::NoRows`, and
each engine's parser sets it — for the SQLite family, true for `INSERT` /
`UPDATE` / `DELETE` only when a `RETURNING` clause is present, plus the
value-returning `PRAGMA` list. An engine whose parser gets this wrong shows an
empty result for a query that returned rows.

**An executor emits `TypesResolved`, then pages, then exactly one `Finished`.**
`TypesResolved` only when `returns_values`, carrying the ordered column list;
zero or more `Page`; one `Finished` on every exit path including the error path,
where it carries the message *and* the function still returns `Err`. Page size is
a per-engine constant in that engine's `execute.rs` (50 for SQLite, 500 for MySQL
and libSQL) — there is no shared constant and no obligation to chunk; D1 sends
one page.

**Every row has one slot per column, in the column order that was announced.**
Rows go out as positional `Vec<Vec<Value>>` built against the same column list
sent in `TypesResolved`. For a driver that returns JSON objects, derive the
column order once and index each row by it; a key the row is missing still
occupies its slot. A short row misaligns every column after it.

**An unmapped native type is rendered and logged, never dropped and never
nulled.** The Postgres row writer's fallback arm takes the raw bytes, emits them
as a string when they are valid UTF-8, and otherwise logs the unknown type and
emits `\x` plus hex. A new row writer does the same: keep the slot, produce a
lossless display string, log the type. On the type-*name* side `normalizeDbType`
(`packages/studio/src/features/orm-cockpit/ir/normalize-type.ts`) returns
`'unknown'` for anything it does not confidently recognise and the diff engine
treats that as review — leaving a type out of that map is safe, mapping it wrong
is not.

**Row editing is only as good as the primary keys `get_schema` reports.**
`resolveMutationPrimaryKey` trusts declared metadata only: it disables edit and
delete when there is no primary key and when the key is composite, and it never
assumes a column named `id`. Introspection must populate
`ColumnInfo.is_primary_key` and `TableInfo.primary_key_columns`, or the grid is
read-only for reasons that look like a grid bug.

**Connecting means building the handle *and* probing it.** `connect_to_database`
sets `connected = true` only after a trivial query succeeds — D1 issues
`SELECT 1` — so a bad or expired credential fails at connect instead of on first
browse. `test_connection` runs without a storage handle, so for an engine whose
credential lives in an integration setting it validates the URL shape only.

**Capabilities are declared once, as a total record, and consumed by name of
capability.** `ENGINE_CAPS: Record<DbEngine, SourceCaps>` in
`packages/studio/src/features/connections/source-caps.ts` cannot compile without
an entry for the new engine. The UI reads it through `getSourceCaps(connection)`
and asks `isUiActionVisible(action, caps)` / `getVisibleUiActions(caps)` in
`packages/studio/src/features/connections/ui-actions.ts`. Add a capability field
when a new axis of difference appears; never add an engine check at the call
site.

**Live monitoring has an explicit backend admission flag.**
`SourceCaps.supports_live_monitor` must be set for the engine before a monitor
task can start, and must match the Studio capability table.

**An admitted live monitor always polls; push only shortens the wait.** `run_monitor_loop`
calls `poll_table_hash` every tick and re-snapshots only when the hash changed.
When `source_caps().supports_listen_notify` is true it also opens a notification
receiver and `select!`s it against the sleep, so `LISTEN`/`NOTIFY` is an
accelerator over the same loop, never a second path. The interval floors at
1000 ms. Implement a real `poll_table_hash` for any engine that should show live
updates.

**`supportsLiveMonitor` in `ENGINE_CAPS` is the only thing that stops a monitor
starting.** `start_live_monitor` does not consult the backend caps, so an engine
left `true` with a `NotImplemented` watch adapter emits an error event every
tick. Set it `false` when polling would be too costly — that is why D1 and
PostHog are false — and let the watch impl stay a `NotImplemented` stub.

**The frontend never branches on engine identity to decide what a user may do.**
`docs/architecture/data-sources.md` states it: feature code asks the resolved
capability, not the engine. Engine and dialect identity is legitimate only where
the SQL text or the wire shape genuinely differs — `TableDialect` and
`dialectUsesSchemas` in `packages/studio/src/shared/utils/table-ref.ts`, the SQL
composition and dialect resolution in
`packages/studio/src/core/data-provider/adapters/tauri.ts`, and the connection
shape mapping in `packages/studio/src/features/connections/utils/mapping.ts` and
`resolve-source.ts`. Editing, import, export, live monitor, SSH and local-file
affordances are decided by caps, everywhere, with no exceptions.

**An engine that needs an account token is a gated tile, not a type in the
picker grid.** `DATABASE_TYPES` in
`packages/studio/src/features/connections/components/connection-dialog/database-type-selector.tsx`
lists only engines a user can connect by typing a URL; D1 and PostHog reach the
dialog through their own integration tiles instead. The total records in that
file and beside it — `TYPE_THEME`, `DATABASE_META`, `PROVIDER_CONFIGS`,
`DEFAULT_PORTS` — still need an entry either way.

**`validateConnection` passes silently for a type it does not know.** An engine
whose URL the user types needs a schema branch in
`packages/studio/src/features/connections/validation.ts`; an engine whose URL an
integration flow builds deliberately gets none, because the flow is what
guarantees the shape.

## Common mistakes

- Adding a `_` arm so `cargo check` passes, giving the engine another engine's
  behaviour in a path nobody looked at.
- Shipping the storage type id without the `database_types` migration row, so
  every stored connection reloads as Postgres.
- Returning a successful `MutationResult` with zero affected rows instead of
  `Error::NotImplemented` for an operation the engine cannot do.
- Interpolating a table or column name into SQL instead of going through
  `grid_sql` or `ident`.
- Expecting a generated id in the insert response rather than from the refetch.
- Emitting `Finished` without a preceding `TypesResolved` for a row-returning
  statement, or emitting `Finished` twice, or swallowing the error after
  reporting it in `Finished`.
- Turning an unrecognised native value into `null` instead of a logged display
  string.
- Writing `get_schema` without primary-key metadata and then debugging the grid.
- Gating a UI affordance on `connection.type` in `features/` instead of adding
  the capability.
- Leaving `supportsLiveMonitor: true` for an engine whose watch adapter is a
  `NotImplemented` stub.
- Adding a token-only engine to `DATABASE_TYPES`, which offers the user a URL
  form that cannot work.
- Starting on the studio before the Rust variant exists, then narrowing on a
  `DatabaseInfo` key the bindings do not have.

## Verification

From `apps/desktop/src-tauri`:

```bash
cargo test
```

From the repository root:

```bash
bun run test:desktop
bun run --cwd packages/studio typecheck
bun run --cwd apps/desktop typecheck
bun run lint
```

`apps/desktop/src-tauri/tests/live_db_tests.rs` runs the full insert → update →
delete → truncate sequence through the real write adapters, but only for the
MySQL family; no engine added since has a fixture there. State that gap rather
than implying the new engine is covered. Behaviour parity against the engines
already shipped is `dora-database-parity`'s.

## Definition of done

- The engine has variants in `DatabaseInfo`, `Database`, `DatabaseClient` and
  `DatabaseType`, and no match on the path acquired a `_` arm.
- The stored type id has both a `DB_TYPE_*` constant and a migration row, and a
  saved connection survives a restart as the right engine.
- All three adapter traits are implemented and reachable from their factories,
  with `Error::NotImplemented` — not a silent success — wherever the engine
  cannot comply.
- Generated SQL quotes through the shared builders and binds every value as a
  parameter.
- The executor emits `TypesResolved` before pages, exactly one `Finished` on
  every path, and positional rows with one slot per announced column.
- Introspection reports primary keys, and an unmapped value reaches the grid as
  a logged display string.
- `ENGINE_CAPS` has an entry, every UI decision about the engine reads it, and
  `supportsLiveMonitor` agrees with what the watch adapter actually does.
- Every registry in `reference.md` is either updated or explicitly ruled out.
- `cargo test`, `bun run test:desktop` and both typechecks pass.

See `reference.md` for the exhaustive registry list, derived file by file from
the Cloudflare D1 and PostHog engines.
