# Plan 06: Migration generation + preview

**Effort:** M. **Depends on:** 05 (`SchemaDiff`), 01 (IR). **Blocks:** 07.

Turn a `SchemaDiff` into a previewable migration. v1 target: **raw SQL DDL**
(dialect-correct). Stretch: emit Drizzle/Prisma migration files.

## Files (owned)

`packages/studio/src/features/orm-cockpit/migration/`
- `generate-sql.ts` — `generateMigrationSql(diff: SchemaDiff, dialect: Dialect):
  { up: string; down: string; warnings: string[] }`.
- `__tests__/generate-sql.test.ts`.
- (stretch) `generate-drizzle.ts`, `generate-prisma.ts`.

## SQL generation

- Use the dialect DDL conventions already encoded in
  `apps/desktop/src-tauri/src/database/services/schema_export.rs` `SqlGenerator`
  as the reference for `CREATE TABLE`, PK/FK/NOT NULL/DEFAULT syntax per dialect
  (pg uses `ALTER TABLE … ADD CONSTRAINT` for FKs; sqlite inlines; mysql differs).
- Emit, ordered for safety: creates → additive alters → (gated) destructive ops.
- **Guard rails — the whole point of "preview, don't auto-apply":**
  - Prefix `destructive` statements with a clear comment banner
    (`-- ⚠ DESTRUCTIVE: drops data`) and, in the UI, require an explicit opt-in to
    include them.
  - For `review` items, emit the statement **commented out** with a `-- REVIEW:`
    note explaining the uncertainty (e.g. unknown type mapping), so the user
    consciously enables it.
  - Generate a best-effort `down` (reverse) but mark where it can't be exact
    (data loss isn't reversible).
- Wrap in a transaction where the dialect supports DDL transactions (pg yes;
  mysql largely no — note it).

## Applying (v1 = hand off, not auto-run)

Do **not** execute migrations from this module. The preview offers: copy SQL,
and "Open in SQL console" (hand the `up` text to the existing SQL console so the
user runs it with full visibility / the prod-safety guardrails). Auto-apply can
come later behind a confirmation, reusing the mutation path.

## Acceptance criteria

- [ ] `generateMigrationSql` produces valid pg + sqlite + mysql DDL for: new
      table, add column, add index, add FK.
- [ ] Destructive ops are clearly marked and separated; `review` ops are emitted
      commented-out with reasons.
- [ ] A `down` script is produced (best-effort, with caveats noted).
- [ ] Unit tests over `SchemaDiff` fixtures; `bun run typecheck` clean.

## Risks

- Dialect DDL differences (esp. column type changes, which sqlite can't `ALTER`
  cleanly — may need table-rebuild; note as a limitation or emit the rebuild
  recipe). Keep v1 scoped to the operations you can generate correctly; warn on
  the rest rather than emit wrong SQL.
- "Down" migrations for destructive changes are inherently lossy — be honest in
  the output, don't pretend reversibility.
