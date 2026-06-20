# Pillar 2 — ORM & migration cockpit (overview)

**Goal:** link a project folder → read its Drizzle/Prisma schema → diff against
the live DB → generate & preview a migration. This is the deep moat: no generic
GUI (TablePlus/DBeaver/DataGrip) does ORM-aware drift detection for a TS stack.

## Architecture decision: TypeScript-side, one Schema IR

Everything keys off a single normalized representation — **Schema IR** — defined
once in `01-schema-ir-and-introspection.md`. Three producers map *into* it; two
consumers operate *on* it:

```
 live DB ──(Rust getDatabaseSchema)──► map ─┐
 drizzle schema .ts ──(parser)──────────────┼─► SchemaIR ─► diff ─► migration gen ─► UI
 schema.prisma ──(parser)───────────────────┘
```

Why TypeScript (not Rust):
- The existing ORM runners (`prisma-to-sql.ts`, `drizzle-query.ts`) are already
  TS client-side parsers — stay consistent.
- TS has the right tooling: the TypeScript compiler API for Drizzle `.ts`, and
  `@prisma/internals` `getDMMF` (or a focused hand parser) for `.prisma`.
- The live schema already crosses the Rust→TS boundary as `DatabaseSchema` via
  bindings; mapping it to the IR is pure TS.
- Migration SQL is string generation — fine in TS, and the SQL-export Rust code
  (`services/schema_export.rs`) is a reference for dialect-correct DDL.

Only **new Rust** needed: a folder/file read command (see `04-folder-linking.md`).

## Feature location

New module: `packages/studio/src/features/orm-cockpit/`
- `ir/` — Schema IR types + the live-DB mapper (plan 01)
- `parsers/drizzle/` (plan 02), `parsers/prisma/` (plan 03)
- `link/` — folder linking + ORM detection (plan 04)
- `diff/` — diff engine (plan 05)
- `migration/` — migration generation (plan 06)
- `components/` — the cockpit UI (plan 07)

## Parallelization

- **01 (Schema IR + live mapper) is the foundation — do it first, it blocks
  everyone.** Land the IR types as a stable contract, then the rest fan out.
- **02 (Drizzle parser) and 03 (Prisma parser) run fully in parallel** once the
  IR type exists. Each ships its own folder + unit tests against IR.
- **04 (folder linking)** is parallel to the parsers (just fs + detection).
- **05 (diff)** depends on 01 only (operates on two IRs); can start as soon as
  01's types exist, tested with hand-built IR fixtures.
- **06 (migration gen)** depends on 05's diff output type.
- **07 (UI)** depends on the others' public functions existing; build against
  stubs, integrate last.

To avoid churn, **freeze the IR type and the diff-result type early** (plans 01
and 05 define them); downstream plans import those types and mock the rest.

## Scope discipline (v1)

- **v1 = detection + preview, read-only-ish.** Show drift and a generated
  migration the user can copy/run; do **not** auto-apply silently. Applying goes
  through the existing SQL console / mutation path with the user in control.
- Support **Postgres + SQLite/libsql + MySQL** to match shipped adapters.
- Be **conservative on uncertain diffs**: when type normalization can't prove
  equivalence, mark the column "review" rather than emit a confident (and
  possibly destructive) `ALTER`. False confidence here is dangerous.

## Verification (whole pillar)

- Unit tests per producer/consumer against IR fixtures (`bun run test`).
- `bun run typecheck` in `packages/studio`.
- Manual: link a real Drizzle project + a real Prisma project against a live DB
  with known drift; confirm the diff and generated migration are correct.
