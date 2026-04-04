# WS3: Schema And Metadata

Status: `[ ]`

## Goal

Make Database Studio understand MySQL structure.

## Ownership

Safe write scope:

- `apps/desktop/src-tauri/src/database/mysql/schema.rs`
- `apps/desktop/src-tauri/src/database/metadata.rs`
- `apps/desktop/src-tauri/src/database/services/metadata.rs`
- `apps/desktop/src-tauri/src/database/types.rs`

## Tasks

1. Implement MySQL schema discovery for tables, columns, PKs, indexes, and foreign keys.
2. Map MySQL database/schema semantics into Dora’s `DatabaseSchema` shape.
3. Add MySQL metadata collection in [metadata.rs](/home/remco/dev/dora/apps/desktop/src-tauri/src/database/metadata.rs) and [services/metadata.rs](/home/remco/dev/dora/apps/desktop/src-tauri/src/database/services/metadata.rs).
4. Verify that PK metadata is good enough for inline edits and SQL result mutations later.

## Done When

- MySQL tables appear in Database Studio
- structure view works
- metadata fetch works

## Validation

```bash
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## Update Notes

- 2026-04-04:
