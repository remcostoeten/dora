# Plan 05: Schema diff engine (IR vs IR)

**Effort:** M. **Depends on:** 01 (IR). **Blocks:** 06, 07. **Parallel with:** 02, 03, 04.

Compare two `SchemaIR`s (code-side vs live, or branch-vs-branch) and produce a
structured, **confidence-aware** diff. Pure function over IRs — test with
hand-built fixtures; no DB or parser needed to develop this.

## Files (owned)

`packages/studio/src/features/orm-cockpit/diff/`
- `diff-schema.ts` — `diffSchema(from: SchemaIR, to: SchemaIR): SchemaDiff`.
- `types.ts` — the `SchemaDiff` result type (freeze it; plan 06 + 07 import).
- `__tests__/diff-schema.test.ts`.

## Result type (frozen contract)

```ts
export type Confidence = 'safe' | 'review' | 'destructive'

export type SchemaDiff = {
  tables: TableDiff[]
  hasChanges: boolean
}
export type TableDiff = {
  name: string
  kind: 'added' | 'removed' | 'changed'
  columns: ColumnDiff[]
  indexes: Change<IndexIR>[]
  foreignKeys: Change<ForeignKeyIR>[]
  confidence: Confidence       // worst of its children
}
export type ColumnDiff = {
  name: string
  kind: 'added' | 'removed' | 'changed'
  before?: ColumnIR; after?: ColumnIR
  changedFields?: Array<'type' | 'nullable' | 'default' | 'autoIncrement'>
  confidence: Confidence
}
export type Change<T> = { kind: 'added' | 'removed' | 'changed'; before?: T; after?: T }
```

## Rules

- **Direction:** `from` = current/live, `to` = desired/code (so "added" = exists
  in code, missing in DB → needs a CREATE/ALTER ADD). Make direction explicit in
  the API and the UI labels.
- **Match** tables/columns by name (already normalized + sorted in the IR).
- **Confidence:**
  - `safe`: add table, add nullable column, add index.
  - `review`: any change touching a `'unknown'` normalized type or an
    unrecognized default; type changes that *might* be lossy; nullable→nullable
    default tweaks.
  - `destructive`: drop table, drop column, narrowing type change, add NOT NULL
    column without default to a (presumably non-empty) table.
- **Never** silently treat `unknown` as equal — if either side is `unknown` and
  raw types differ textually, it's at least `review`.
- A table's confidence = worst of its column/index/fk confidences.

## Acceptance criteria

- [ ] `diffSchema` detects added/removed/changed tables, columns (type/nullable/
      default/autoincrement), indexes, FKs.
- [ ] Confidence assigned per the rules; `unknown` types never produce a
      confident change.
- [ ] Identical schemas → `hasChanges: false`.
- [ ] Extensive unit tests over hand-built IR fixtures (this is the spec).
- [ ] `bun run typecheck` clean.

## Risks

- Equality of defaults and types is the perennial source of false positives —
  lean on `01`'s normalization and **bias to `review`**. A noisy-but-safe diff
  beats a confident-but-wrong one that generates a destructive migration.
