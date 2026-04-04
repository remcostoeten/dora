# WS2: Query Execution And Parser

Status: `[ ]`

## Goal

Make SQL Console execution work for MySQL.

## Ownership

Safe write scope:

- `apps/desktop/src-tauri/src/database/mysql/mod.rs`
- `apps/desktop/src-tauri/src/database/mysql/execute.rs`
- `apps/desktop/src-tauri/src/database/mysql/parser.rs`
- `apps/desktop/src-tauri/src/database/mysql/row_writer.rs`
- `apps/desktop/src-tauri/src/database/adapter.rs`
- `apps/desktop/src-tauri/src/database/commands.rs`

Avoid touching schema, mutation, or frontend files here unless blocked.

## Tasks

1. Add a new MySQL module tree under [database](/home/remco/dev/dora/apps/desktop/src-tauri/src/database).
2. Implement statement parsing and statement splitting.
3. Implement read-only detection and DDL detection.
4. Implement execution that fits the existing statement manager output model.
5. Update schema invalidation logic in [commands.rs](/home/remco/dev/dora/apps/desktop/src-tauri/src/database/commands.rs) so MySQL write/DDL queries invalidate cached schema.

## Done When

- MySQL `SELECT` works in SQL Console
- MySQL non-`SELECT` statements execute through the same query path
- fetch/query/page flows work

## Validation

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Update Notes

- 2026-04-04:
