# WS1: Backend Connection Plumbing

Status: `[ ]`

## Goal

Make MySQL a real persisted backend connection type.

## Ownership

Safe write scope:

- `apps/desktop/src-tauri/src/database/types.rs`
- `apps/desktop/src-tauri/src/database/services/connection.rs`
- `apps/desktop/src-tauri/src/storage.rs`
- `apps/desktop/src-tauri/src/database/adapter.rs`
- new MySQL connection module files if needed

Do not edit frontend files in this workstream.

## Tasks

1. Extend `DatabaseInfo` with a MySQL variant in [types.rs](/home/remco/dev/dora/apps/desktop/src-tauri/src/database/types.rs).
2. Extend `Database` and `DatabaseClient` with a MySQL runtime variant in [types.rs](/home/remco/dev/dora/apps/desktop/src-tauri/src/database/types.rs).
3. Persist and load MySQL connection config in [storage.rs](/home/remco/dev/dora/apps/desktop/src-tauri/src/storage.rs).
4. Add MySQL connect, disconnect, and test behavior in [connection.rs](/home/remco/dev/dora/apps/desktop/src-tauri/src/database/services/connection.rs).
5. Add a `MySQL` adapter enum case and adapter construction in [adapter.rs](/home/remco/dev/dora/apps/desktop/src-tauri/src/database/adapter.rs).
6. Decide whether MySQL beta includes SSH tunneling. If not, document the omission and keep the UI honest later.

## Done When

- MySQL connections can be added, saved, reloaded, tested, and connected
- MySQL entries survive app restart

## Validation

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Update Notes

- 2026-04-04:
