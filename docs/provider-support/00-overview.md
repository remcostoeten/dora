# Provider Support Overview

Primary target: `MySQL`

Secondary targets after MySQL:

- `MariaDB`
- optionally `CockroachDB`

Do not start MSSQL, Oracle, or other providers from this plan. They need separate roadmaps.

## Current State

Backend first-class providers:

- PostgreSQL
- SQLite
- LibSQL

Frontend scaffold already exists for:

- MySQL connection forms and provider typing

Main gap:

- Rust provider implementation and all backend branches that currently assume only Postgres, SQLite, and LibSQL.

## Recommended Sequence

1. backend connection plumbing
2. query execution and parser
3. schema and metadata
4. frontend enablement
5. mutations and export
6. tests and runtime verification
7. docs and release state

## Master Status

- [ ] WS1 backend connection plumbing
- [ ] WS2 query execution and parser
- [ ] WS3 schema and metadata
- [ ] WS4 mutations and export
- [ ] WS5 frontend enablement
- [ ] WS6 tests and verification
- [ ] WS7 docs and release state

## Shared Validation

```bash
bun x tsc --noEmit -p apps/desktop/tsconfig.app.json
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```
