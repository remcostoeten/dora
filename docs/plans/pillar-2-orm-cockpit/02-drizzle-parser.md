# Plan 02: Drizzle schema parser (.ts → SchemaIR)

**Effort:** M. **Depends on:** 01 (IR types only). **Parallel with:** 03, 04.

Parse a project's Drizzle schema (`schema.ts` / a `schema/` dir) into `SchemaIR`
so it can be diffed against the live DB.

## Files (owned)

`packages/studio/src/features/orm-cockpit/parsers/drizzle/`
- `parse-drizzle-schema.ts` — `parseDrizzleSchema(files: {path,text}[], dialect):
  { ir: SchemaIR; warnings: string[] }`.
- `__tests__/parse-drizzle-schema.test.ts` (fixtures of real drizzle schemas).

## Approach

Use the **TypeScript compiler API** (`typescript` package — check if already a
dep; if not, add to `packages/studio`). Do **not** execute user code; parse the
AST statically.

Recognize the Drizzle table-builder idioms:
- `export const x = pgTable('name', { col: type()... })` (and
  `sqliteTable`, `mysqlTable`).
- Column builders: `integer`, `bigint`, `serial`, `text`, `varchar`, `boolean`,
  `timestamp`, `uuid`, `json`/`jsonb`, `numeric`/`decimal`, `real`, … →
  `NormalizedType` (reuse `ir/normalize-type.ts`; add a Drizzle-builder→canonical
  map). Cross-check the inverse map in `services/schema_export.rs` `get_drizzle_type`.
- Modifiers: `.primaryKey()`, `.notNull()`, `.default(...)`/`.defaultNow()`,
  `.$defaultFn()` (treat as unknown default), `.references(() => other.col)` → FK,
  `.unique()` → unique index.
- Table-level: `primaryKey({ columns: [...] })`, `index()/uniqueIndex()`,
  composite FKs in the second callback arg.

For anything unrecognized, **emit a warning and mark the column type/default
`unknown`** rather than guessing — the diff treats that as "review".

## Strategy notes

- Resolve the dialect from the builder (`pgTable`→postgres, `sqliteTable`→sqlite,
  `mysqlTable`→mysql); the cockpit should also know the connection's dialect and
  warn on mismatch.
- Handle multi-file schemas (glob the linked dir for `*.ts`, concat tables).
- Map `serial`/`$default` autoincrement → `ColumnIR.autoIncrement = true`.
- Output sorted, identical-shape IR to the live mapper so diffs are clean.

## Acceptance criteria

- [ ] `parseDrizzleSchema` returns a `SchemaIR` for representative pg + sqlite
      drizzle schemas (single-file and multi-file).
- [ ] PK (single + composite), not-null, defaults, FKs, unique indexes parsed.
- [ ] Unrecognized constructs produce warnings + `unknown`, never a throw that
      kills the whole parse.
- [ ] Unit tests cover each idiom; `bun run typecheck` clean.

## Risks

- Drizzle's API surface is broad and evolves. Cover the **common 80%** and
  degrade gracefully (warn + `unknown`) on the rest — do not chase 100%.
- Re-exports/barrel files and helper-wrapped column defs may hide tables; note
  these as known limitations in warnings.
