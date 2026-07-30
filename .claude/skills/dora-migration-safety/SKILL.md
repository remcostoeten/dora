---
name: dora-migration-safety
description: Schema-drift migration generation and its safety gates. Use when changing how a diff is classified safe, review or destructive; how migration SQL is emitted, sectioned, bannered or commented out; what a down script contains and where it admits it cannot reverse; how the preview gates or hands SQL to the SQL console; or how a Drizzle journal reconciles against what the database applied. Not for the Drizzle and SQL converters, the schema IR or the ORM parsers themselves, and not for how the handed-off SQL is then executed (dora-query-pipeline).
---

# Migration safety

## Scope

This skill owns the path from a `SchemaDiff` to text a user could run: the
confidence classification, the SQL emitters, the section assembly, the down
script, and the gates in front of both.

It stops at the clipboard. What happens to the SQL once it reaches the SQL
console — execution, cancellation, result handling — is `dora-query-pipeline`'s.
The IR, the ORM parsers, and the Drizzle/SQL converters are upstream of this
skill and are not restated here.

The modules:

- `packages/studio/src/features/orm-cockpit/diff/diff-schema.ts` —
  classification
- `packages/studio/src/features/orm-cockpit/diff/types.ts` — the frozen
  `Confidence` contract
- `packages/studio/src/features/orm-cockpit/diff/filter-managed-tables.ts` —
  pre-diff noise removal
- `packages/studio/src/features/orm-cockpit/migration/generate-sql.ts` —
  emission, sectioning, `up` and `down`
- `packages/studio/src/features/orm-cockpit/components/migration-sections.ts` —
  re-parsing `up` back into sections
- `packages/studio/src/features/orm-cockpit/components/migration-preview.tsx` —
  the opt-in gates and the handoff
- `packages/studio/src/features/orm-cockpit/migration/migration-status.ts`,
  `packages/studio/src/features/orm-cockpit/migration/read-journal.ts` and
  `packages/studio/src/features/orm-cockpit/migration/query-applied.ts` — the
  Drizzle journal reconciliation

`reference.md` carries the full per-operation classification table, the
down-script table, the warning list and the marker strings. Consult it before
changing any mapping.

## Unencodable

- Where a new test file belongs (FINDINGS 4.15). The existing migration tests
  are centralized under `__tests__/packages/studio/orm-cockpit/`, which is one
  of the two conventions in play.

## Workflow

1. Establish which axis you are changing. `Confidence` in `packages/studio/src/features/orm-cockpit/diff/types.ts` is
   what the drift view badges; `Section` plus the optional `review` note in
   `packages/studio/src/features/orm-cockpit/migration/generate-sql.ts` is what the preview gates. Changing one does not
   change the other.
2. Change the classification in `diffSchema` only if the *risk* changed.
   Change the emitter only if the *SQL* changed.
3. If you touch a banner or header string, update
   `packages/studio/src/features/orm-cockpit/components/migration-sections.ts` in the same edit — it re-parses the
   generated text by exact string match.
4. Give every new statement a `reverse`, or deliberately leave it absent. If it
   is reversible but lossy, set `reverseCaveat` rather than omitting `reverse`.
5. Run the orm-cockpit tests. They pin the mapping, not just the plumbing.

## Invariants

**`Confidence` is `'safe' | 'review' | 'destructive'`, defined once in
`packages/studio/src/features/orm-cockpit/diff/types.ts` and imported everywhere.** That file marks itself a frozen
contract: "Do not redefine these shapes downstream — import them from here."
The three meanings are the ones its doc comment gives — `safe` is non-lossy,
`review` is unclear intent or possible loss, `destructive` is possible data
loss — and `reference.md` transcribes the full operation mapping. Add a
classification arm only by extending the existing `worstOf` fold; never add a
fourth level, and never re-derive a risk level from SQL text after the fact.

**A table's confidence is the worst of its children, except when the table
itself is added or dropped.** `diffTable` returns `safe` for an added table and
`destructive` for a dropped one regardless of what its columns say, and
`worstOf(children)` only for a changed table. `worst` compares through
`CONFIDENCE_RANK` (`safe: 0, review: 1, destructive: 2`), so any new level would
silently sort wrong.

**Confidence does not decide gating; the emitter does.** Only three things are
ever commented out: a SQLite column alter, a SQLite foreign-key change, and a
type change whose confidence is `review`. Index drops, foreign-key drops,
default changes and autoIncrement toggles are all `Confidence.review` in the
drift view and are still emitted live in the additive block. Do not tell a user
that "review means it won't run" — check the table in `reference.md` first, and
if you want a `review`-badged operation gated, set `review` on its `Stmt`.

**Destructive statements are emitted, not withheld.** `generate-sql.ts` states
the design: destructive ops are emitted live under `DESTRUCTIVE_BANNER` and
grouped last; review ops are emitted commented out under `-- REVIEW: <reason>`.
The generator never drops a statement to make a script safe. Suppression is the
preview's job, and only the preview's.

**Nothing in this path applies a migration.** `generate-sql.ts` says it
"NEVER applies migrations", and no module here calls an adapter mutation.
`MigrationResult` is `{ up, down, warnings }` — three strings and nothing
executable. A new feature that would run the SQL belongs on the other side of
the console handoff, not here.

**Both gates default to off and are independent.** `MigrationPreview` holds
`includeDestructive` and `includeReview` as separate `useState(false)`.
`buildPreviewSql` starts from the safe section and appends the destructive block
only under `includeDestructive` and the uncommented review block only under
`includeReview`. A checkbox appears only when
`migrationHasGatedSections` reports that section exists. Never default either to
true, never collapse them into one toggle, and never let a section reach the
output without its opt-in.

**What is displayed is exactly what is copied and what is handed off.** The
preview computes one `sql` string and uses it for the `<pre>`, for
`navigator.clipboard.writeText`, and for `onOpenInSqlConsole`. Any transform
applied to one must be applied by `buildPreviewSql` so all three move together.

**The console handoff fills the editor and stops.** `packages/studio/src/pages/Index.tsx` switches
`activeNavId` to `sql-console` and dispatches a `dora-open-sql-content`
`CustomEvent` carrying `{ sql }` on a zero-delay `setTimeout`. It does not
execute, and the header text — "Generated SQL — review and run in the SQL
console" — is the promise that it does not. A handoff that auto-runs would
bypass both opt-ins, since the gates live in the panel the user just left.

**A statement reaches `down` only if it has a `reverse` and is not
review-gated.** `renderDown` filters `s.reverse && !s.review`, then reverses
order. Two emitters produce no `reverse` at all — the SQLite column alter and
the SQLite foreign-key change — so a SQLite schema change contributes nothing
reversible. Review-gated type changes are likewise excluded even though they
carry a `reverse`. When the filter empties, `down` is exactly
`-- No reversible statements.`

**Irreversibility is stated, never implied by omission.** Where a reverse exists
but cannot restore what was lost, the statement carries a `reverseCaveat` that
renders as `-- ⚠ <caveat>` above it — data dropped with a table, column data
lost on drop, a narrowing type change that may have truncated, a `SET NOT NULL`
that fails on existing NULLs, an added NOT NULL without a default that fails on
a non-empty table. Adding a lossy operation without a caveat is the failure mode
this rule exists to stop; dropping `reverse` instead is worse, because the
statement then vanishes from `down` silently.

**Warnings are a third channel and never substitute for a gate.**
`MigrationResult.warnings` carries what the SQL cannot say — an inferred primary
key, an unknown type emitted verbatim, a `vector` with no dimension, a
best-effort table recreate, and MySQL's lack of transactional DDL. They are not
rendered into the script, so a risk expressed only as a warning is a risk the
copied SQL does not carry.

**Only Postgres scripts are transaction-wrapped.** `assemble` sets `wrap` from
`dialect === 'postgres'`, and `splitMigrationSql` strips a `BEGIN;`/`COMMIT;`
pair back off before sectioning and re-adds it after. MySQL additionally warns
that a mid-migration failure leaves partial state. Do not wrap MySQL to make the
scripts uniform.

**The section markers are a parsing contract between two files.**
`DESTRUCTIVE_BANNER` and `REVIEW_HEADER` are duplicated as exported constants in
`packages/studio/src/features/orm-cockpit/components/migration-sections.ts` specifically so the split can find them, and
that file says to update both in lockstep. Editing a banner in
`generate-sql.ts` alone silently un-gates a section: the marker is not found,
the whole body reads as safe, and destructive statements land in the default
output.

**ORM bookkeeping tables are filtered before the diff, not after.**
`filter-managed-tables.ts` removes `__drizzle_migrations` and
`_prisma_migrations` plus platform schemas from the live IR, and says why: they
are never in a code schema, so they would otherwise diff as destructive drops.
Both ORMs share the one `MANAGED_TABLE_NAMES` set. A new bookkeeping table goes
in that set, never into a special case in the emitter.

**Drizzle and Prisma diverge only in detection and parsing.** Detection keys off
`drizzle.config.*` versus prisma/schema.prisma / prisma/schema/
(`packages/studio/src/features/orm-cockpit/link/detect-orm.ts`). Parsing differs in shape: `parseDrizzleSchema` takes the
file list plus the connection's dialect, while `parsePrismaSchema` takes one
concatenated string and derives its own dialect from the datasource block. From
the `SchemaIR` onward there is no ORM branch — same `diffSchema`, same
`Confidence`, same `generateMigrationSql`, same gates. Never add an ORM
conditional downstream of `parseLink`.

**Migration status is Drizzle-only, and says so rather than guessing.**
`use-migration-status.ts` returns early when `orm !== 'drizzle'`, because the
whole mechanism is Drizzle's: the journal at `<out>/meta/_journal.json` and the
applied watermark from `MAX(created_at)` in `__drizzle_migrations`.
`reconcileMigrations` mirrors Drizzle's migrator exactly — an entry is applied
iff `entry.when <= lastApplied` — and when the table is missing it sets
`tableMissing` and treats every entry as pending instead of reporting zero
drift. Do not extend this to Prisma by analogy; `_prisma_migrations` has a
different shape.

## Common mistakes

- Treating a `review` badge in the drift view as proof the statement is
  commented out.
- Adding a fourth confidence level, or deriving risk from the emitted SQL rather
  than from the diff.
- Renaming a banner in `generate-sql.ts` without updating the matching constant
  in `packages/studio/src/features/orm-cockpit/components/migration-sections.ts`, which un-gates the section.
- Defaulting `includeDestructive` or `includeReview` to true, or merging them.
- Transforming the SQL on copy or on handoff instead of inside
  `buildPreviewSql`, so display and clipboard drift apart.
- Making the console handoff execute the SQL, which bypasses the opt-ins.
- Adding a lossy statement with no `reverseCaveat`, or dropping `reverse` so it
  disappears from `down` without explanation.
- Expecting a review-gated statement to appear in `down` — it never does.
- Wrapping a MySQL script in `BEGIN;`/`COMMIT;`.
- Recording a risk only in `warnings` and assuming the user sees it in the SQL.
- Special-casing a bookkeeping table in an emitter instead of adding it to
  `MANAGED_TABLE_NAMES`.
- Branching on `link.orm` anywhere after `parseLink`.
- Extending the journal reconciliation to Prisma on the assumption that
  `_prisma_migrations` works like `__drizzle_migrations`.

## Verification

From the repository root:

```bash
bun run --cwd packages/studio test
bun run --cwd packages/studio typecheck
bun run test:desktop
bun run lint
```

The suites that pin this contract are under
`__tests__/packages/studio/orm-cockpit/`: `__tests__/packages/studio/orm-cockpit/diff/diff-schema.test.ts` for the
confidence mapping, `__tests__/packages/studio/orm-cockpit/migration/generate-sql.test.ts` for sections and caveats,
`__tests__/packages/studio/orm-cockpit/components/migration-sections.test.ts` for the split/reassemble round-trip, and
`__tests__/packages/studio/orm-cockpit/migration/migration-status.test.ts` plus `__tests__/packages/studio/orm-cockpit/migration/read-journal.test.ts` for
the Drizzle journal path. A change that breaks one of those is a behaviour
change, not a test to update.

## Definition of done

- Any new risk level came from extending the existing `Confidence` fold, not a
  new type, and `reference.md`'s mapping table still matches `diff-schema.ts`.
- Every new emitter sets a `Section`, and sets `review` if and only if the
  statement must not run as written.
- Every new statement has a `reverse`, or deliberately has none; every lossy one
  has a `reverseCaveat`.
- Banner and header strings match between `generate-sql.ts` and
  `packages/studio/src/features/orm-cockpit/components/migration-sections.ts`.
- Both opt-ins still default to off, remain independent, and still gate the
  displayed, copied and handed-off text identically.
- The handoff still only fills the console.
- No ORM conditional exists downstream of `parseLink`, and no bookkeeping table
  is special-cased outside `MANAGED_TABLE_NAMES`.
- The four commands above pass.

See `reference.md` for the operation-to-confidence table, the operation-to-
section table, the down-script and caveat table, the warning list, and the exact
marker strings.
