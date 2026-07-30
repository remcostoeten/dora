# Migration safety — reference

Transcribed from `packages/studio/src/features/orm-cockpit/diff/diff-schema.ts`,
`diff/types.ts`, `migration/generate-sql.ts` and
`components/migration-sections.ts`. Nothing here is a proposal.

## 1. The two axes

They are computed in different modules and do not mean the same thing.

- **`Confidence`** (`diff/types.ts`) — `'safe' | 'review' | 'destructive'`.
  Produced by `diffSchema`, attached to every `ColumnDiff` and `TableDiff`.
  Drives the badges in `components/drift-view.tsx`.
- **`Section`** (`migration/generate-sql.ts`, not exported) —
  `'create' | 'additive' | 'destructive'`, plus an optional `review` string on
  the same `Stmt`. Drives what `renderUp` banners, comments out, and what
  `buildPreviewSql` gates.

A change's `Confidence` is an input to the section decision in some emitters
and ignored in others. Section 4 lists exactly where.

## 2. Confidence definitions, verbatim

From the doc comment on `Confidence` in `diff/types.ts`:

- `safe` — non-lossy, reversible-ish (add table, add nullable column, add index).
- `review` — intent unclear or possibly lossy (unknown types, default tweaks,
  lossy type change).
- `destructive` — data loss possible (drop table/column, narrowing, add NOT NULL
  without default).

## 3. Operation → Confidence

`CONFIDENCE_RANK` is `safe: 0, review: 1, destructive: 2`; `worst` takes the
higher rank; a `TableDiff.confidence` is `worstOf` its columns, indexes and
foreign keys.

| Operation | Condition | Confidence |
| --- | --- | --- |
| Table added | — | `safe` |
| Table removed | — | `destructive` (regardless of children) |
| Table changed | — | `worstOf` children |
| Column added | `nullable` or `default !== null` | `safe` |
| Column added | NOT NULL and no default | `destructive` |
| Column removed | — | `destructive` |
| Column type changed | either side `type === 'unknown'` | `review` |
| Column type changed | both in `NUMERIC_RANK`, target rank lower | `destructive` |
| Column type changed | both in `NUMERIC_RANK`, target rank same or higher | `review` |
| Column type changed | any other normalized change | `review` |
| Type params changed | same type in `PARAM_TYPES`, leading int shrinks | `destructive` |
| Type params changed | otherwise (widen, scale-only) | `review` |
| Nullability | → nullable (relaxation) | `safe` |
| Nullability | → NOT NULL | `review` |
| Default | any change | `review` |
| autoIncrement | toggled | `review` |
| Index | added | `safe` |
| Index | removed or changed | `review` |
| Foreign key | added, removed or changed | `review` |

`NUMERIC_RANK`: `smallint 1, int 2, bigint 3, float 4, double 5, decimal 6`.
Types outside it have no rank, so a change involving them falls to the generic
`review` arm.

`PARAM_TYPES`: `varchar`, `decimal`, `vector`. Params only participate when
both sides carry `typeParams` for the same normalized type (`paramsComparable`).

## 4. Operation → Section, and what is actually gated

| Emitter | Section | Gets `review`? |
| --- | --- | --- |
| `emitCreateTable` | `create` | no |
| `emitDropTable` | `destructive` | no |
| `emitAddColumn`, confidence `destructive` | `destructive` | no |
| `emitAddColumn`, otherwise | `additive` | no |
| `emitDropColumn` | `destructive` | no |
| `emitAlterColumn`, dialect `sqlite` | `additive` | **always** |
| `emitAlterColumn` type, confidence `destructive` | `destructive` | no |
| `emitAlterColumn` type, confidence `review` | `additive` | **yes** |
| `emitAlterColumn` type, otherwise | `additive` | no |
| `emitAlterColumn` nullable (pg), → NOT NULL | `destructive` | no |
| `emitAlterColumn` nullable (pg), → nullable | `additive` | no |
| `emitAlterColumn` default (pg) | `additive` | no |
| `emitCreateIndex` | `additive` | no |
| `emitIndexChange` removed / changed | `additive` | no |
| `emitAddForeignKey` | `additive` | no |
| `emitForeignKeyChange`, dialect `sqlite` | `additive` | **always** |
| `emitForeignKeyChange` removed / changed | `additive` | no |

Consequence: only three things are ever commented out — a SQLite column alter, a
SQLite foreign-key change, and a `review`-confidence type change. Index drops,
foreign-key drops, default changes and autoIncrement toggles all carry
`Confidence.review` in the drift view yet are emitted live in the additive
block.

## 5. Down-script rules

`renderDown` keeps `stmts.filter((s) => s.reverse && !s.review).reverse()`. So a
statement contributes to `down` only when it has a `reverse` **and** is not
review-gated.

| Operation | `reverse` | `reverseCaveat` |
| --- | --- | --- |
| CREATE TABLE | `DROP TABLE` | none |
| DROP TABLE | best-effort recreate | `data dropped with the table cannot be restored` |
| ADD COLUMN (destructive) | `DROP COLUMN` | `adding NOT NULL without default fails on a non-empty table` |
| ADD COLUMN (additive) | `DROP COLUMN` | none |
| DROP COLUMN | `ADD COLUMN` from `before` | `column data is lost on drop and cannot be restored` |
| ALTER type (destructive) | reverse type SQL | `narrowing type change may have truncated data` |
| ALTER type (review) | present but **dropped** — review-gated | n/a |
| SET NOT NULL (pg) | `DROP NOT NULL` | `SET NOT NULL fails if existing rows are NULL` |
| DROP NOT NULL (pg) | `SET NOT NULL` | none |
| SET/DROP DEFAULT (pg) | inverse default | none |
| Index add / drop / change | inverse | none |
| FK add / drop / change | inverse | none |
| SQLite column alter | **no `reverse` at all** | n/a |
| SQLite FK change | **no `reverse` at all** | n/a |

A caveat renders as `-- ⚠ <caveat>` on the line above its statement. When
nothing survives the filter, `down` is exactly `-- No reversible statements.`

## 6. Warnings

`MigrationResult.warnings` is a separate channel from the SQL. Emitted by:

- `emitDropTable` when no source `TableIR` was passed — recreate is best-effort.
- `emitAlterColumn` on SQLite — column change needs a table rebuild.
- `emitForeignKeyChange` on SQLite — FK change needs a table rebuild.
- `typeToken` when `col.type === 'unknown'` — raw type emitted verbatim.
- `typeToken` for `vector` with no dimension — bare `VECTOR` is incomplete.
- `resolvePrimaryKey` when no target IR — PK inferred from an autoIncrement
  column, or none could be determined.
- `assemble` for MySQL when `stmts.length > 0` — no transactional DDL, so a
  mid-migration failure leaves partial state.

## 7. Marker strings

`components/migration-sections.ts` re-parses the `up` text by exact string
match, and its own doc comment says to update both files in lockstep.

- `DESTRUCTIVE_BANNER` = `-- ⚠ DESTRUCTIVE: drops or rewrites data — review before running`
- `REVIEW_HEADER` = `-- The following changes need review and are commented out. Enable them deliberately.`
- Empty script: `-- No changes.`
- Everything gated off: `-- No changes selected.`
- Transaction wrap: `BEGIN;` / `COMMIT;`, postgres only (`assemble`'s `wrap`).

`uncommentReview` strips a leading `-- ` from each line, keeps `-- REVIEW:`
reason lines as annotations, and rewrites `REVIEW_HEADER` to
`-- Review changes (enabled below):`.

## 8. Tests that pin this

Under `__tests__/packages/studio/orm-cockpit/`:

- `diff/diff-schema.test.ts` — the confidence mapping in section 3.
- `diff/filter-managed-tables.test.ts` — bookkeeping/system-table exclusion.
- `migration/generate-sql.test.ts` — emitted sections, caveats, warnings.
- `migration/migration-status.test.ts` — `reconcileMigrations`.
- `migration/read-journal.test.ts` — journal parsing and `out` resolution.
- `components/migration-sections.test.ts` — the split/reassemble round-trip.
