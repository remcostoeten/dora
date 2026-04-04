# WS4: Mutations And Export

Status: `[ ]`

## Goal

Make MySQL rows editable and exportable.

## Ownership

Safe write scope:

- `apps/desktop/src-tauri/src/database/services/mutation.rs`
- `apps/desktop/src-tauri/src/database/maintenance.rs`
- `apps/desktop/src-tauri/src/database/services/schema_export.rs`
- frontend read-side callers only if needed for honest UI

## Tasks

1. Add MySQL branches to mutation flows in [mutation.rs](/home/remco/dev/dora/apps/desktop/src-tauri/src/database/services/mutation.rs):
   - `update_cell`
   - `delete_rows`
   - `insert_row`
   - `duplicate_row`
   - `execute_batch`
2. Add MySQL parameter conversion helpers.
3. Review export behavior for JSON, CSV, and SQL insert.
4. Decide and document which of these are supported in beta:
   - soft delete
   - undo soft delete
   - truncate table
   - truncate database
   - dump database
5. Hide or block unsupported MySQL destructive ops instead of exposing broken buttons.

## Done When

- cell edit works
- add row works
- delete row works
- export does not hard-fail

## Validation

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Update Notes

- 2026-04-04:
