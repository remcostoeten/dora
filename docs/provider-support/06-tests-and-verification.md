# WS6: Tests And Verification

Status: `[ ]`

## Goal

Prove that provider support is real, not just compilable.

## Ownership

Safe write scope:

- `__tests__/apps/desktop/**`
- Rust test files near provider modules
- verification docs only

## Tasks

1. Add frontend tests for MySQL connection mapping and validation.
2. Add Rust tests for:
    - test connection
    - connect/reconnect
    - query execution
    - schema introspection
    - mutation helpers
3. Maintain this runtime matrix:

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

## Validation

```bash
bun run test:desktop
bun x vitest run __tests__/apps/desktop/src/features/connections
bun x tsc --noEmit -p apps/desktop/tsconfig.app.json
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Update Notes

- 2026-04-04:
