# Plan 03: Prisma schema parser (schema.prisma → SchemaIR)

**Effort:** M. **Depends on:** 01 (IR types only). **Parallel with:** 02, 04.

Parse a project's `schema.prisma` into `SchemaIR`.

## Files (owned)

`packages/studio/src/features/orm-cockpit/parsers/prisma/`
- `parse-prisma-schema.ts` — `parsePrismaSchema(text: string):
  { ir: SchemaIR; warnings: string[] }`.
- `__tests__/parse-prisma-schema.test.ts`.

## Approach — prefer the official parser

1. **Preferred:** `@prisma/internals` `getDMMF({ datamodel })` returns a fully
   resolved model (fields, types, attributes, relations). If it can be bundled in
   the studio (check size/Node-only constraints — it may require Node APIs not
   available in the renderer), use it: map DMMF models → `TableIR`.
   - Map `@@map`/`@map` to real table/column names.
   - `@id` / `@@id([...])` → primary key; `@unique`/`@@unique` → unique index;
     `@@index` → index; `@relation` → FK; `@default(...)` → default
     (`autoincrement()`/`uuid()`/`now()` → recognize; `dbgenerated` → unknown).
   - Scalar types (`Int`, `BigInt`, `String`, `Boolean`, `DateTime`, `Decimal`,
     `Json`, `Bytes`, `Float`) + `@db.*` native types → `NormalizedType`.
2. **Fallback if `@prisma/internals` can't run in-renderer:** a focused
   hand-written `.prisma` parser (the format is simple and line-oriented:
   `model X { … }` blocks, `field Type modifiers @attrs`). The existing
   `prisma-runner` model→table mapping (`utils/model-mapper.ts`) is a reference
   for name resolution. Hand parser is more work but has zero runtime
   constraints — **resolve which path is viable before committing.**

Either way: unknown attributes/types → warning + `unknown` (diff → "review").

## Acceptance criteria

- [ ] `parsePrismaSchema` returns `SchemaIR` for a representative `schema.prisma`
      (with `@@map`, relations, composite ids, enums-as-text).
- [ ] `@map`/`@@map` honored so names match the live DB.
- [ ] Decide + document the parser path (DMMF vs hand) with the reason.
- [ ] Unrecognized constructs warn + `unknown`, never throw-and-die.
- [ ] Unit tests; `bun run typecheck` clean.

## Risks

- `@prisma/internals` is heavy and may assume Node/filesystem — **spike this
  first** (can it import and run `getDMMF` in the studio bundle?). If not, the
  hand parser is the path; budget accordingly.
- Enums and native `@db.*` types vary by provider; map the common set, flag the
  rest "review".
