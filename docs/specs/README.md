# Roadmap Initiative Specs

One spec per initiative, written so an individual agent can pick a file up and execute it without further context. Format follows `docs/provider-support/`: scope, exact files, definition of done, validation, status checkbox.

## Status Legend

- `[ ]` not started
- `[-]` in progress
- `[x]` done
- `[!]` blocked / needs decision

## Index (priority order)

| # | Spec | Status | Depends on |
|---|------|--------|------------|
| 01 | [DuckDB provider](01-duckdb-provider.md) | `[-]` | none |
| 02 | [File-as-database (CSV/Parquet/JSON)](02-file-as-database.md) | `[x]` | 01 |
| 03 | [MCP server](03-mcp-server.md) | `[ ]` | none |
| 04 | [MSSQL provider](04-mssql-provider.md) | `[ ]` | none |
| 05 | [ORM migration awareness + Prisma runner](05-orm-migration-awareness.md) | `[-]` | none |
| 06 | [Schema + data diff](06-schema-data-diff.md) | `[-]` | none |
| 07 | [Serverless Postgres integrations (Neon/Supabase)](07-serverless-postgres-integrations.md) | `[x]` | none |
| 08 | [Result set charts](08-result-charts.md) | `[ ]` | none |
| 09 | [Redis / Valkey browser](09-redis-valkey.md) | `[ ]` | `[!]` needs product decision |
| 10 | [ClickHouse provider](10-clickhouse.md) | `[ ]` | none |

## Parallelization Rules

- Each spec lists a **safe write scope**. Do not edit files outside it; if you must, coordinate via the spec's "Cross-cutting touchpoints" section first.
- Files that several specs all touch (merge hotspots):
  - `apps/desktop/src-tauri/src/database/types.rs`: enum variants per provider
  - `apps/desktop/src-tauri/src/database/services/connection.rs`: connect/disconnect branches
  - `apps/desktop/src-tauri/src/lib.rs`: command registration
  - `apps/desktop/src/lib/bindings.ts`: regenerated bindings
  - `packages/studio/src/features/connections/`: provider pickers and forms
  Provider specs (01, 04, 10) each add additive branches to these files; land them serially or rebase carefully.
- Specs 02 depends on 01 landing first. Everything else is independent.

## Shared Conventions

- New providers follow the existing module shape: `apps/desktop/src-tauri/src/database/<provider>/{execute.rs, parser.rs, schema.rs}` plus an adapter write module `apps/desktop/src-tauri/src/database/adapter/write_<provider>.rs`.
- The phased process for any new provider is documented in `docs/provider-support/` (WS1 plumbing → WS2 execution/parser → WS3 schema/metadata → WS4 mutations/export → WS5 frontend → WS6 tests → WS7 docs). Provider specs below reference those workstreams instead of repeating them.
- TS bindings are generated from Rust (`apps/desktop/src-tauri/src/bindings.rs` → `apps/desktop/src/lib/bindings.ts`); never hand-edit the generated file.
- Update `docs/product-roadmap.md` and `CHANGELOG.md` when a spec ships.
