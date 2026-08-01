# Spec 10: ClickHouse Provider

Status: `[ ]`

## Why

ClickHouse adoption is growing fast and its desktop tooling is weak (web UIs or DBeaver). It speaks SQL over HTTP, so integration cost is moderate, and it pairs with the DuckDB/file-querying story (Specs 01–02) to position Dora for the analytics crowd.

## Scope

ClickHouse at beta level, **read-heavy by design**, since ClickHouse is an OLAP store and users mostly browse/query:

- connect: host/port/user/password/database over HTTP(S) (native TCP protocol out of scope v1); ClickHouse Cloud works via HTTPS + credentials
- SQL console: full query support, table + JSON results, export
- schema introspection: databases, tables, columns, engines (`system.tables`, `system.columns`) for the data viewer and schema visualizer; show table engine + partition key as metadata
- data viewer: browse, sort, filter, paginate
- mutations: **disabled in v1**. Inline editing is hidden for ClickHouse connections (ALTER TABLE UPDATE is async and surprising; a half-working edit path is worse than none). DDL and INSERT via the SQL console still work since the console just executes what the user writes.
- Docker manager template for `clickhouse/clickhouse-server`

Out of scope v1: adapter write path / dry-run staging, live monitoring (stub), cluster awareness (`ON CLUSTER`), async insert tuning.

## Safe write scope

- `apps/desktop/src-tauri/src/database/clickhouse/` (new: `execute.rs`, `parser.rs`, `schema.rs`)
- Additive branches in `database/types.rs`, `database/services/{connection.rs,metadata.rs}`, `database/adapter/{mod.rs,read.rs}` (read only, no `write_clickhouse.rs` in v1), `storage/serialize.rs`, `lib.rs`
- Frontend: `packages/studio/src/features/connections/` provider option/form; a read-only capability flag consumed by `packages/studio/src/features/database-studio/` so edit affordances hide (if a capability mechanism doesn't exist yet, introduce it minimally; Spec 02 needs the same flag, so coordinate via the specs README)
- `apps/desktop/src-tauri/Cargo.toml` (`clickhouse` crate, or plain `reqwest` + `JSONEachRow` format if the crate fights the existing async patterns)

## Implementation notes

1. Wire format: query with `FORMAT JSON` / `JSONEachRow` over HTTP, which gives column names + types in the response, which maps cleanly onto the existing result payload shape.
2. Type mapping: `UInt64`/`Int128`/`UInt256` overflow JS numbers, so serialize big integers as strings in the result payload the same way other providers handle 64-bit values (check how Postgres `bigint` is handled and match it). `Nullable(T)`, `LowCardinality(T)`, `Array(T)`, `Map`, `DateTime64` all need rendering rules; default unknowns to text.
3. Pagination in the data viewer: `LIMIT/OFFSET` works; always show the approximate total from `system.tables.total_rows` rather than `count()` on billion-row tables.
4. Statement classification (`parser.rs`): in the ClickHouse dialect, `ALTER TABLE … UPDATE/DELETE` are mutations, `OPTIMIZE`, `SYSTEM` commands exist; classify conservatively (unknown ⇒ write) for MCP/read-only purposes (Spec 03 consumes this).
5. Sessions: HTTP is stateless; `SET` statements need a session id param if supported, and v1 may document that session settings don't persist across statements.

## Done when

- Connect to Docker ClickHouse and ClickHouse Cloud; browse a billion-row table with responsive pagination; run aggregate queries; export results; schema visualizer renders tables with engine metadata.
- Edit affordances are absent for ClickHouse connections; all other providers unaffected.
- Tests cover type rendering (incl. big ints, arrays, nullables), schema introspection, and parser classification.

## Validation

```bash
docker run -d -p 8123:8123 clickhouse/clickhouse-server
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
bun run --cwd apps/desktop test
```
