# Spec 04: SQL Server (MSSQL) Provider

Status: `[ ]`

## Why

Largest underserved market: SSMS is Windows-only and dated, Azure Data Studio is deprecated, DBeaver is heavy. A fast cross-platform native client for SQL Server is a real wedge into enterprise users. `docs/provider-support/00-overview.md` explicitly says MSSQL needs its own roadmap. This is it.

## Scope

MSSQL at "beta" level per the scope-level model in `docs/provider-support-roadmap.md`:

- connect via host/port/user/password and connection-string paste; encryption on by default with a trust-server-certificate toggle (common with local/dev servers)
- SQL console: SELECT/INSERT/UPDATE/DELETE/DDL, multi-statement batches
- schema introspection across **schemas within a database** (dbo and friends) for data viewer + schema visualizer
- inline mutations via the adapter write path
- SSH tunneling reusing `database/ssh_tunnel.rs`
- export (JSON/CSV/INSERT)

Out of scope v1: Windows/Entra ID authentication (`[!]` flag it and decide after beta feedback), live monitoring (stub politely), T-SQL-specific tooling (sp_ browsing, execution plans).

## Safe write scope

- `apps/desktop/src-tauri/src/database/mssql/` (new: `execute.rs`, `parser.rs`, `schema.rs`, `row_writer.rs`)
- `apps/desktop/src-tauri/src/database/adapter/write_mssql.rs` (new)
- Additive branches in: `database/types.rs`, `database/services/{connection.rs,metadata.rs,mutation.rs}`, `database/adapter/{mod.rs,read.rs,write.rs}`, `storage/serialize.rs`, `lib.rs`
- Frontend: `packages/studio/src/features/connections/` (provider option + form), generated bindings
- `apps/desktop/src-tauri/Cargo.toml` (`tiberius` + `tokio-util` compat)

## Implementation notes

1. Driver: `tiberius` (pure-Rust TDS). Wrap a connection like the Postgres path (`database/postgres/` is the structural reference; MySQL's pool model does not fit tiberius v1, a single client + reconnect is fine for beta).
2. Dialect differences the shared code will trip on; audit for hardcoded assumptions:
   - identifier quoting is `[bracket]` not `"quote"`; parameters are `@P1` not `$1`/`?`
   - pagination is `OFFSET … ROWS FETCH NEXT … ROWS ONLY` (requires ORDER BY), so check the data viewer's pagination SQL builder in the adapter read path
   - no `RETURNING`; use `OUTPUT INSERTED.*` in `write_mssql.rs`
   - booleans are `BIT`; `LIMIT` does not exist
3. Schema introspection: `sys.tables`, `sys.columns`, `sys.indexes`, `sys.foreign_keys`, `INFORMATION_SCHEMA` as fallback. The data viewer must namespace tables by schema (`dbo.users`) the way the Postgres path handles non-public schemas.
4. Parser: extend or fork the provider `parser.rs` pattern for T-SQL statement classification (`GO` batch separators should be split client-side).
5. Type mapping: `DATETIME2`, `DATETIMEOFFSET`, `UNIQUEIDENTIFIER`, `MONEY`, `NVARCHAR(MAX)`, `VARBINARY`. Render unknowns as text, never panic.
6. Test infra: add an `mcr.microsoft.com/mssql/server` service to the Docker-based test setup mirroring `docs/provider-support/06-tests-and-verification.md`.

## Done when

- All WS1–WS7 criteria from `docs/provider-support/` hold for MSSQL at beta level against SQL Server 2019+ in Docker.
- Pagination, inline edit, bulk edit, dry-run staging, and export all work on a `dbo` table and on a non-default schema.
- README support table + `docs/product-roadmap.md` updated; Entra ID auth logged as a follow-up issue.

## Validation

```bash
docker run -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='Str0ng!Pass' -p 1433:1433 -d mcr.microsoft.com/mssql/server:2022-latest
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
bun run --cwd apps/desktop test
```
