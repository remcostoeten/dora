# Provider Support Roadmap

This document is the implementation handoff for adding new database providers to Dora, starting with `MySQL`.

It is written so multiple agents can work on it in parallel without stepping on each other. Each workstream has:

- a concrete scope
- exact files to touch
- a definition of done
- validation steps
- a state checkbox that can be updated as work lands

## Status Legend

- `[ ]` not started
- `[-]` in progress
- `[x]` done
- `[!]` blocked / needs decision

## Current Baseline

Today Dora has first-class backend paths for:

- `PostgreSQL`
- `SQLite`
- `LibSQL`

The backend service shape already assumes per-provider implementations:

- connection lifecycle in `apps/desktop/src-tauri/src/database/services/connection.rs`
- schema introspection in `apps/desktop/src-tauri/src/database/*/schema.rs`
- query execution in `apps/desktop/src-tauri/src/database/*/execute.rs`
- SQL parsing in `apps/desktop/src-tauri/src/database/*/parser.rs`
- metadata in `apps/desktop/src-tauri/src/database/services/metadata.rs`
- mutations in `apps/desktop/src-tauri/src/database/services/mutation.rs`
- maintenance / export / monitoring in shared service modules

The frontend is already partly scaffolded for `mysql`:

- `apps/desktop/src/features/connections/types.ts`
- `apps/desktop/src/features/connections/components/connection-dialog/connection-form.tsx`
- `apps/desktop/src/features/connections/validation.ts`
- `apps/desktop/src/features/connections/utils/providers.ts`

The real missing work is the Rust provider implementation and the places where the backend currently hardcodes provider branches.

## Delivery Strategy

Recommended order:

1. `MySQL beta`
2. `MariaDB compatibility pass`
3. optional `CockroachDB`
4. stop unless there is a strong product reason for more

## MySQL Scope Levels

### Level 1: MySQL Beta

Definition:

- save/test/connect MySQL connections
- browse schema
- open tables in Database Studio
- execute SQL in SQL Console
- basic row mutations: edit, insert, delete

### Level 2: MySQL First-Class Support

Definition:

- export parity
- metadata parity
- schema export behavior reviewed
- table structure actions reviewed
- query parsing and mutation edge cases hardened
- regression tests added

### Level 3: Release-Clean Support

Definition:

- live monitoring story decided
- destructive maintenance features reviewed
- runtime verification matrix completed
- README / release docs updated

## Workstream Overview

These workstreams are intentionally separated so different agents can own them.

| ID  | Workstream                          | Priority | Safe Ownership                                   |
| :-- | :---------------------------------- | :------- | :----------------------------------------------- |
| WS1 | Backend types + connection plumbing | Critical | Rust types / connection files only               |
| WS2 | MySQL query execution + parser      | Critical | new `database/mysql/*` files + adapter wiring    |
| WS3 | Schema introspection + metadata     | Critical | new `database/mysql/*` files + metadata service  |
| WS4 | Mutations + export parity           | High     | `services/mutation.rs`, maintenance/export files |
| WS5 | Frontend enablement                 | High     | frontend connections/UI files only               |
| WS6 | Tests + verification                | High     | tests only                                       |
| WS7 | Docs + release state                | Medium   | docs only                                        |

## WS1: Backend Types + Connection Plumbing

State: `[ ]`

### Goal

Make MySQL a real backend connection type instead of a frontend scaffold.

### Files

- `apps/desktop/src-tauri/src/database/types.rs`
- `apps/desktop/src-tauri/src/database/services/connection.rs`
- `apps/desktop/src-tauri/src/storage.rs`
- `apps/desktop/src-tauri/src/database/adapter.rs`
- `apps/desktop/src-tauri/src/database/mod.rs` if needed
- `apps/desktop/src/lib/bindings.ts` is generated, do not edit directly

### Tasks

1. Extend `DatabaseInfo` with a MySQL variant in:
    - `apps/desktop/src-tauri/src/database/types.rs`
2. Extend `Database` and `DatabaseClient` with a MySQL runtime variant in:
    - `apps/desktop/src-tauri/src/database/types.rs`
3. Teach connection persistence to save/load MySQL connection config in:
    - `apps/desktop/src-tauri/src/storage.rs`
4. Add connect/test/disconnect handling in:
    - `apps/desktop/src-tauri/src/database/services/connection.rs`
5. Add a `DatabaseType::MySQL` adapter enum case and adapter construction in:
    - `apps/desktop/src-tauri/src/database/adapter.rs`
6. Decide whether SSH tunneling is:
    - not supported in MySQL beta, or
    - supported by reusing `ssh_tunnel.rs`

### Notes

- For MySQL beta, it is acceptable to ship without SSH tunneling if the UI reflects that cleanly.
- If MySQL uses a separate driver crate, make the connection object fit the `DatabaseClient` abstraction used by query and mutation services.

### Done When

- `commands.testConnection(...)` works for MySQL
- `commands.addConnection(...)` and `commands.connectToDatabase(...)` can persist and reconnect a MySQL entry
- a saved MySQL connection survives app restart

### Validation

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
bun x tsc --noEmit -p apps/desktop/tsconfig.app.json
```

## WS2: MySQL Query Execution + Parser

State: `[ ]`

### Goal

Make SQL Console and async statement execution work for MySQL.

### Files

- `apps/desktop/src-tauri/src/database/mysql/mod.rs` new
- `apps/desktop/src-tauri/src/database/mysql/execute.rs` new
- `apps/desktop/src-tauri/src/database/mysql/parser.rs` new
- `apps/desktop/src-tauri/src/database/mysql/row_writer.rs` new, if needed
- `apps/desktop/src-tauri/src/database/adapter.rs`
- `apps/desktop/src-tauri/src/database/services/query.rs`
- `apps/desktop/src-tauri/src/database/commands.rs`

### Tasks

1. Create a new `mysql` module mirroring the existing shape used by:
    - `apps/desktop/src-tauri/src/database/postgres/*`
    - `apps/desktop/src-tauri/src/database/sqlite/*`
    - `apps/desktop/src-tauri/src/database/libsql/*`
2. Implement SQL parsing suitable for:
    - statement splitting
    - read-only detection
    - DDL detection
3. Implement statement execution that can feed the existing statement manager format.
4. Add MySQL adapter wiring in:
    - `apps/desktop/src-tauri/src/database/adapter.rs`
5. Update schema invalidation logic in:
    - `apps/desktop/src-tauri/src/database/commands.rs`
      so MySQL non-read-only statements also invalidate cached schema.

### Done When

- SQL Console can run `SELECT`
- SQL Console can run non-`SELECT` statements
- results can be paged/fetched through the existing statement manager path

### Validation

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## WS3: Schema Introspection + Metadata

State: `[ ]`

### Goal

Make Database Studio work against MySQL.

### Files

- `apps/desktop/src-tauri/src/database/mysql/schema.rs` new
- `apps/desktop/src-tauri/src/database/metadata.rs`
- `apps/desktop/src-tauri/src/database/services/metadata.rs`
- `apps/desktop/src-tauri/src/database/types.rs`

### Tasks

1. Implement MySQL schema discovery for:
    - schemas / databases
    - tables
    - columns
    - primary keys
    - indexes
    - foreign keys
2. Match the app’s existing `DatabaseSchema` and `ColumnInfo` shape in:
    - `apps/desktop/src-tauri/src/database/types.rs`
3. Add MySQL metadata collection in:
    - `apps/desktop/src-tauri/src/database/metadata.rs`
    - `apps/desktop/src-tauri/src/database/services/metadata.rs`
4. Verify schema names vs database names semantics for MySQL.

### Notes

- This work is what makes the table tree, structure view, PK detection, and mutation targeting behave correctly.
- Be explicit about how MySQL databases map into Dora’s current schema model.

### Done When

- Database Studio sidebar can load MySQL tables
- table columns / PKs / structure render correctly
- metadata fetch succeeds

## WS4: Mutations + Export Parity

State: `[ ]`

### Goal

Make editing and export work in Database Studio and SQL result grids.

### Files

- `apps/desktop/src-tauri/src/database/services/mutation.rs`
- `apps/desktop/src-tauri/src/database/maintenance.rs`
- `apps/desktop/src-tauri/src/database/services/schema_export.rs`
- `apps/desktop/src/features/database-studio/api.ts`
- `apps/desktop/src/features/sql-console/components/sql-results.tsx`

### Tasks

1. Add MySQL branches to mutation paths in:
    - `update_cell`
    - `delete_rows`
    - `insert_row`
    - `duplicate_row`
    - `execute_batch`
    - export helpers
2. Review placeholder syntax and parameter binding conventions for MySQL.
3. Verify type conversion from JSON into driver parameter values.
4. Decide whether these are in MySQL beta or deferred:
    - soft delete support
    - undo soft delete
    - truncate table
    - truncate database
    - dump database
5. If a feature is deferred, make the UI honest instead of exposing a broken path.

### Done When

- Database Studio can edit, insert, duplicate, and delete MySQL rows
- SQL result-set edit/delete works for supported MySQL result sets
- export paths do not hard-fail for MySQL

## WS5: Frontend Enablement

State: `[ ]`

### Goal

Expose MySQL as a supported provider in the desktop UI only when the backend path is ready.

### Files

- `apps/desktop/src/features/connections/api.ts`
- `apps/desktop/src/features/connections/types.ts`
- `apps/desktop/src/features/connections/validation.ts`
- `apps/desktop/src/features/connections/utils/providers.ts`
- `apps/desktop/src/features/connections/components/connection-dialog/database-type-selector.tsx`
- `apps/desktop/src/features/connections/components/connection-dialog/connection-form.tsx`
- `apps/desktop/src/pages/Index.tsx`
- optionally `apps/desktop/src/features/app-sidebar/*`

### Tasks

1. Ensure frontend-to-backend mapping includes MySQL in:
    - `apps/desktop/src/features/connections/api.ts`
2. Re-enable MySQL selection in:
    - `apps/desktop/src/features/connections/components/connection-dialog/database-type-selector.tsx`
      only after WS1 is ready
3. Verify provider defaults and connection-string behavior in:
    - `apps/desktop/src/features/connections/utils/providers.ts`
4. Verify validation rules in:
    - `apps/desktop/src/features/connections/validation.ts`
5. Check UI strings so MySQL is described as supported only when it really is.

### Done When

- user can create, edit, test, and save MySQL connections from the dialog
- frontend does not claim unsupported features

## WS6: Tests + Verification

State: `[ ]`

### Goal

Prevent MySQL support from being “connects once” only.

### Files

- `__tests__/apps/desktop/tauri-invoke-contract.test.ts`
- `__tests__/apps/desktop/src/features/connections/*`
- `apps/desktop/src-tauri/src/database/services/tests.rs`
- add new Rust integration tests near the MySQL modules if needed

### Tasks

1. Add frontend tests for:
    - MySQL connection mapping
    - validation
    - provider selection UI
2. Add Rust tests for:
    - connect/test connection
    - schema introspection
    - mutation helpers
    - query execution
3. Build a manual runtime verification matrix:

| Flow                     | PostgreSQL | SQLite | LibSQL | MySQL |
| :----------------------- | :--------: | :----: | :----: | :---: |
| Add connection           |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Test connection          |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Connect / reconnect      |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Browse schema            |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Open table               |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Edit cell                |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Add row                  |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Delete row               |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Bulk edit                |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| SQL SELECT               |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| SQL INSERT/UPDATE/DELETE |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Result-set edit/delete   |    [ ]     |  [ ]   |  [ ]   |  [ ]  |
| Export                   |    [ ]     |  [ ]   |  [ ]   |  [ ]  |

### Validation

```bash
bun run test:desktop
bun x vitest run __tests__/apps/desktop/src/features/connections
bun x tsc --noEmit -p apps/desktop/tsconfig.app.json
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## WS7: Docs + Release State

State: `[ ]`

### Goal

Keep product docs honest while support is partial.

### Files

- `README.md`
- `apps/desktop/RELEASE_TASKS.md`
- `docs/app-audit-2026-02-20.md`
- this file

### Tasks

1. Do not mark MySQL as supported until:
    - WS1
    - WS2
    - WS3
    - WS4
      are done at minimum
2. Update the product README only after runtime verification exists.
3. Record known limitations explicitly:
    - no SSH tunnel support if omitted
    - no live monitoring if omitted
    - no dump/restore parity if omitted

## Recommended MySQL Implementation Sequence

Use this order to reduce rework:

1. WS1 backend connection plumbing
2. WS2 query execution
3. WS3 schema introspection
4. WS5 frontend enablement
5. WS4 mutations
6. WS6 tests and runtime verification
7. WS7 docs

## Provider-Specific Notes

## MariaDB

State: `[ ]`

Recommendation:

- Do not start MariaDB before MySQL beta is stable.
- Treat MariaDB as a compatibility pass on top of MySQL support.

Likely file touch points:

- same files as MySQL
- mostly around:
    - connection options
    - introspection query differences
    - type mapping differences
    - SQL edge cases

Definition of done:

- the MySQL adapter works against MariaDB with either:
    - zero code changes, or
    - small compatibility branches documented here

## CockroachDB

State: `[ ]`

Recommendation:

- Consider this only after MySQL if there is demand.
- It may fit better as a Postgres-compatibility pass than as a brand-new provider.

Likely files:

- `apps/desktop/src-tauri/src/database/postgres/*`
- `apps/desktop/src-tauri/src/database/services/*`
- frontend docs and provider labeling

Main risk:

- “Postgres compatible” does not mean mutation, schema, and metadata parity by default.

## MSSQL / Oracle / Others

State: `[ ]`

Recommendation:

- Do not add these casually.
- They are large enough to deserve their own roadmap documents.

Reasons:

- different protocol stacks
- different parameter syntax
- different introspection systems
- different data type handling
- higher testing burden

## Agent Coordination Rules

If multiple agents are working from this document:

1. One agent owns one workstream.
2. Do not mix docs, tests, frontend, and backend changes in the same agent unless necessary.
3. Update the state marker at the top of the workstream you finished.
4. Add a short note under the workstream:

```md
Update note:

- 2026-04-04: Implemented connection persistence and basic connect/test support.
- Remaining: schema introspection and mutations.
```

5. Always validate before marking `[x]`.

## Open Decisions

State: `[ ]`

- Should MySQL beta ship without SSH tunneling?
- Should MySQL beta ship without live monitoring?
- Should destructive maintenance operations be hidden for MySQL until proven?
- Which MySQL driver crate should own the runtime path?

## Suggested First Agent Tasks

If you want to split this immediately:

1. Agent A: WS1 backend connection plumbing
2. Agent B: WS2 MySQL parser + execute module scaffold
3. Agent C: WS3 schema introspection design and metadata implementation
4. Agent D: WS6 tests for connection mapping/validation and future runtime matrix harness
