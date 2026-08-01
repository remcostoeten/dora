# Spec 05: ORM Migration Awareness + Prisma Runner

Status: `[-]` Track B shipped; Track A delivered via a different approach.

> **Update (2026-06-20).**
> - **Track B (Prisma runner): `[x]` shipped (#137).** Write and execute Prisma Client queries natively with schema-aware completions and a SQL preview, alongside the Drizzle runner.
> - **Track A (migration awareness): superseded.** The bookkeeping-table panel described below (read `__drizzle_migrations` / `_prisma_migrations`, show applied/pending/missing, copy-CLI affordance, fs-watch) was **not** built. The drift use-case instead ships as the **ORM cockpit** (#151–#155): link a project folder → parse the Drizzle/Prisma schema → diff it against the live database (full schema introspection) → preview a generated migration. So Track A's *goal* is served, but via Spec 06's schema-diff mechanism rather than migration-bookkeeping comparison. An applied-vs-pending bookkeeping panel is still unbuilt if it's wanted later.

## Why

The Drizzle runner is Dora's most differentiated existing feature; no competitor treats ORMs as first-class. This spec deepens that wedge in two independent tracks: (A) migration awareness for Drizzle and Prisma projects, (B) a Prisma query runner alongside the Drizzle one. Track A and B can be picked up by different agents.

## Track A: Migration awareness

### Scope

- Detect the ORM in a linked project directory: `drizzle.config.*` / `drizzle/` folder, or `prisma/schema.prisma` / `prisma/migrations/`.
- Read the migration bookkeeping table on the connected database (`__drizzle_migrations` / `_prisma_migrations`) and cross-reference against migration files on disk.
- Show a "Migrations" panel per connection: applied / pending / missing-on-disk / failed, with timestamps, and a drift warning badge on the connection when local files and DB state disagree.
- Read-only in v1: do **not** apply migrations from the UI (the ORMs' CLIs own that). Offer a "copy CLI command" affordance instead (`bunx drizzle-kit migrate`, `npx prisma migrate deploy`).

### Out of scope

Applying/rolling back migrations, generating migrations from GUI schema edits (logged as the natural v2), non-JS ORMs.

## Track B: Prisma runner

### Scope

- Mirror the Drizzle runner UX in `packages/studio/src/features/drizzle-runner/` for Prisma Client queries: editor with schema-aware completions, "preview SQL" before execution, results in the standard table view.
- Schema awareness comes from parsing `schema.prisma` (models → completions), execution by translating the Prisma query AST to SQL the way the Drizzle runner does. Study how `drizzle-runner` executes today and follow the same strategy rather than embedding a Node runtime, if the current strategy is translation-based. If the Drizzle runner instead shells out to a JS runtime, reuse that mechanism.

## Safe write scope

- Frontend: `packages/studio/src/features/drizzle-runner/` (refactor shared pieces into an `orm-runner` core if needed), new `packages/studio/src/features/migrations/` panel
- Backend: new `apps/desktop/src-tauri/src/database/commands/migrations.rs` (+ `mod.rs`, `lib.rs` registration) for reading migration tables and scanning project dirs
- Connection settings: persist a per-connection "project directory" (extend `database/commands/settings.rs` / connection storage)

Do not touch provider modules or the adapter.

## Implementation notes

1. Project directory linkage: a connection optionally points at a local project path; file access goes through the Rust side (Tauri fs scope), not the webview.
2. Drizzle bookkeeping table name/location is configurable in `drizzle.config.*` (`migrations.table` / `schema`), so parse the config rather than assuming defaults. Prisma's `_prisma_migrations` schema is stable; handle `rolled_back_at` and failed rows.
3. Both bookkeeping tables may simply not exist (fresh DB). That's "all pending", not an error.
4. Watch the migrations folder (notify/fs events) so the panel updates when the user generates a migration in their terminal.
5. Drift detection v1 = bookkeeping comparison only (checksum/name matching), not full schema introspection diff. That's Spec 06's territory.

## Done when

- Linking a Drizzle project and a Prisma project each shows correct applied/pending status against a Docker Postgres, updates live when a migration is created or applied externally, and shows the drift badge when the DB has a migration the disk doesn't (and vice versa).
- Prisma runner executes findMany/create-style queries with SQL preview, parity with the Drizzle runner's safety behavior (writes go through the same confirmation path).
- Unit tests for config parsing, bookkeeping-table readers, and status reconciliation.

## Validation

```bash
bun run --cwd apps/desktop test
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
# manual: scaffold drizzle + prisma sample projects, run their CLIs, watch the panel
```
