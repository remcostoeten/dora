---
name: dora-orm-cockpit
description: Schema modeling and deterministic ORM conversion inside Dora. Use whenever changing SchemaIR, type normalization, live-schema mapping, Drizzle or Prisma project detection and parsing, the Drizzle-to-SQL or SQL-to-Drizzle converters, QueryIR, converter warnings/errors, or the link-to-parse orchestration upstream of a schema diff. Not for safe/review/destructive classification, migration SQL, down scripts, preview gates or journal reconciliation (dora-migration-safety), and not for executing converted SQL (dora-query-pipeline).
---

# ORM cockpit

## Scope

This skill owns the layers that turn database and project syntax into stable
intermediate representations, and the deterministic converters that emit from
those representations:

- project discovery and ORM detection;
- live schema, Drizzle schema and Prisma schema to `SchemaIR`;
- raw database and ORM type normalization;
- Drizzle query chains and SQL DML to `QueryIR`;
- Drizzle to SQL and SQL to Drizzle parsing and emission;
- converter state up to the point where output text is displayed.

The diff is the boundary. Confidence classification, migration SQL, down scripts,
preview opt-ins, console handoff and Drizzle journal reconciliation belong to
`dora-migration-safety`. Running any resulting SQL belongs to
`dora-query-pipeline`. IPC command shapes for project file access belong to
`dora-tauri-boundary`.

Read `reference.md` before changing an IR field, parser grammar, converter
surface or dialect mapping. It records the producer matrix, supported syntax,
known losses and owning tests.

## Unencodable

Source has more than one answer. Ask before deciding.

- Where a new ORM-cockpit test belongs. Centralized tests and colocated tests
  both exist (FINDINGS 4.15); test mechanics belong to `dora-testing`.
- Whether the caller-supplied dialect or the syntax-declared dialect wins when
  they disagree. Drizzle warns and parses each table using its actual builder;
  Prisma derives its dialect from the datasource provider; the converter uses
  the selected option.
- Whether a fourth `Dialect` should exist. The IR deliberately collapses every
  supported engine onto `postgres`, `mysql` or `sqlite`; adding a member is an
  ecosystem-wide contract change, not a local parser edit.
- Whether linked project reads should keep swallowing every command failure as
  missing input. `createTauriProjectReader` does that today; changing the error
  model also changes the Tauri boundary and the linking UX.

## Workflow

1. Identify the layer: discovery, IR, producer/parser, converter parser,
   converter emitter, or React orchestration. Keep the change in that layer
   unless the contract itself must move.
2. For an IR change, update `packages/studio/src/features/orm-cockpit/ir/types.ts`
   additively, then enumerate every producer and consumer from `reference.md`.
   Do not start from one parser and leave the other representations behind.
3. For a parser change, add the smallest static recognition rule. Preserve
   unknown syntax as a warning or a coded failure; never evaluate project code
   to learn what it means.
4. For a converter change, extend the shared contract first when the supported
   surface genuinely grows. Parse into the relevant IR, emit from it, and keep
   entry points total and non-throwing.
5. Add a focused fixture for the new construct in both directions when it can
   round-trip. Pin warnings and error codes as part of the output.
6. Run the ORM-cockpit suite, then the studio typecheck and lint. A converter
   change is unfinished until the round-trip tests still pass.

## Invariants

**`SchemaIR` is the only schema pivot and is frozen additively.**
`packages/studio/src/features/orm-cockpit/ir/types.ts` is imported by the live
mapper, both ORM parsers, the diff, the migration generator and the schema
converter. Never redefine a near-copy downstream, remove a field, or change a
field's meaning in place. A new field is optional unless every producer can
populate it in the same change.

**The schema dialect set is exactly Postgres, MySQL and SQLite.** `Dialect` is
`'postgres' | 'mysql' | 'sqlite'`. `deriveDialect` in
`packages/studio/src/features/orm-cockpit/components/use-orm-cockpit.ts` folds
MySQL and MariaDB onto MySQL, SQLite, libSQL and DuckDB onto SQLite, and the
remaining connection types onto Postgres. Converter options, type normalization
and emitters all switch on the same three values. Do not branch on a Dora engine
inside an IR parser or converter.

**Every producer emits deterministic collection order.** Tables, columns and
indexes sort by name; foreign keys sort by referenced table and local columns.
Primary-key column order, index column order and foreign-key column pairing are
semantic and stay in declaration order. Sorting those inner arrays makes a
composite constraint different while appearing stable.

**Unknown is safer than a confident lie.** `normalizeDbType` returns `'unknown'`
for anything it cannot identify conservatively. Drizzle builder parsing and
Prisma scalar/native-type parsing follow the same rule. An unknown type reaches
the diff as reviewable uncertainty; a wrong normalized type can generate a
destructive alter with false confidence. Extend normalization only with a
fixture for each affected dialect.

**Type parameters compare only when both sides know them.** `ColumnIR.typeParams`
captures length, precision/scale or vector dimensions as compact text for
`varchar`, `decimal` and `vector`. A producer that cannot recover a parameter
leaves it undefined. Never synthesize a default width just to make two sides
comparable.

**The live mapper consumes the generated snake-case schema shape defensively.**
`fromLiveSchema` maps `DatabaseSchema` without mutating it, prefers ordered
`primary_key_columns`, falls back to per-column `is_primary_key`, removes the
implicit primary-key index, groups per-column foreign-key metadata, preserves a
meaningful schema and normalizes whitespace-only defaults to null. A backend
introspection change must still produce an equivalent IR.

**Drizzle parsing is static TypeScript AST inspection.** `parseDrizzleSchema`
uses `ts.createSourceFile`; the converter parses query chains from the same AST.
Project code is never imported, bundled or executed. Direct
`pgTable`/`mysqlTable`/`sqliteTable` declarations are the recognized unit.
Helper-wrapped factories and barrel re-exports remain warnings unless static
support is deliberately added.

**A Drizzle builder chooses the table dialect.** The caller dialect is a
comparison target, not permission to reinterpret `mysqlTable` as Postgres.
When they disagree the parser warns and parses using the actual builder. Column
builders and modifiers are read from their syntax; runtime default functions
become `'unknown'` rather than being called.

**Prisma parsing stays renderer-safe and dependency-free.**
`parsePrismaSchema` is a focused line/block parser because Prisma internals are
Node-only and filesystem-heavy. It derives the dialect from the datasource,
maps models and scalar fields, treats relation fields as constraints rather
than columns, honors `@map` and `@@map`, preserves compound constraint order,
and warns on unsupported attributes. Do not add `@prisma/internals` or shell out
to Prisma from the renderer.

**Multi-file input is assembled at the orchestration boundary.** Drizzle accepts
the detected `SchemaFile[]` directly. Prisma files are concatenated by
`useOrmCockpit` before parsing. Project discovery owns finding those files;
parsers do not read the filesystem.

**Project detection is pure over `ProjectReader`.** `detectOrm` takes injected
`readFile` and `listDir` functions, detects root and common workspace packages,
deduplicates by path, ignores dependency/build directories, and caps recursive
glob walks. Tauri access lives in `link-api.ts`; demo access lives in
`demo-project.ts`. Do not import filesystem or Tauri APIs into the detector.

**The converter contract is the only public conversion surface.**
`packages/studio/src/features/orm-cockpit/converters/contract.ts` owns
`ConvertOptions`, `ConvertResult`, error codes, `SchemaIR`, `QueryIR` and the
operator sets. Both directions and the UI import those types. Converter entry
points return `ok: false`; unsupported input is never an exception and never an
invented approximation.

**Errors stop conversion; warnings preserve an honest partial conversion.**
Empty input, syntax errors, unsupported inseparable constructs and unsupported
dialects are coded failures. Lossy type mappings, named runtime placeholders and
dialect degradations are warnings on a successful result. A severable construct
may be skipped only when the warning names what was lost.

**Surface detection is syntax-driven and may be pinned.** Drizzle query chains
on `db` or `tx` win over table declarations in the same snippet; otherwise
table builders select schema conversion. SQL chooses schema versus query from
its leading keyword. `ConvertOptions.surface` overrides detection but does not
make invalid syntax valid.

**`QueryIR` is a closed, typed grammar.** It represents select, insert, update
and delete; joins, grouping, ordering and paging; and only the operators exported
by the contract. A new query feature is incomplete until both parsers, both
emitters and round-trip fixtures understand it. Do not smuggle raw SQL fragments
through the IR.

**Emission is dialect-correct and deterministic.** MySQL identifiers use
backticks; Postgres and SQLite use double quotes. Boolean literals, identity
syntax, returning support and type spellings follow the selected dialect.
`ilike` outside Postgres degrades to `LIKE` with a warning. Runtime values emit
named placeholders with a warning; they are never interpolated or evaluated.
The same source and options must produce byte-identical output.

**Schema and query round trips have different promises.** Query conversions are
expected to return byte-identical canonical SQL after a round trip. Schema
round trips are semantic because declaration order and equivalent type spelling
normalize through `SchemaIR`. Test the promise that belongs to the surface
instead of snapshotting incidental formatting.

**The cockpit compares live as `from` and code as `to`.** `useOrmCockpit`
parses code, introspects live, then calls `diffSchema(live, code)`. Reversing
those arguments reverses added and removed meaning and therefore migration
direction. Its monotonic run id guards every async analysis chain; a stale link
or introspection result must not replace a newer one.

**The converter UI adds timing, not semantics.** Pure reducer and conversion
logic lives in
`packages/studio/src/features/orm-cockpit/components/converter-state.ts`;
`packages/studio/src/features/orm-cockpit/components/use-converter.ts` adds the
300 ms debounce and React wiring. A parser or emitter rule does not belong in a
component or effect.

## Known gaps

- Drizzle does not follow barrel re-exports or helper-wrapped table factories.
- Prisma parsing is intentionally partial and does not model every native type,
  block attribute or connector.
- `deriveDialect` maps connection types beyond the parser's documented database
  families onto one of three dialects; it has no unsupported result.
- Linked project command failures often collapse to "missing" because the
  Tauri-backed reader returns null or an empty list on failure.
- The converter supports a deliberately closed SQL/Drizzle grammar; CTEs,
  aggregates, window functions and raw SQL templates are outside it.

## Common mistakes

- Adding a field to a local parser result instead of extending `SchemaIR`
  additively and updating every producer.
- Mapping an unfamiliar type to the closest-looking normalized type instead of
  `'unknown'`.
- Sorting composite key columns and changing their meaning.
- Executing a Drizzle schema or adding Prisma internals to make parsing easier.
- Reading files from inside a parser instead of passing `SchemaFile[]` or text.
- Throwing from a converter entry point or returning successful output for an
  inseparable unsupported construct.
- Adding a `QueryIR` operation to one direction only.
- Changing emitted formatting without updating round-trip expectations.
- Reversing the live/code arguments to `diffSchema`.
- Putting conversion decisions in the debounced React hook.
- Changing migration risk or preview behavior here instead of invoking
  `dora-migration-safety`.

## Verification

From the repository root:

```bash
bun run --cwd packages/studio test
bun run --cwd packages/studio typecheck
bun run test:desktop
bun run lint
```

The shared Vitest configuration means the two test commands currently discover
the same repository-wide TypeScript suite. Keep both in the verification list
because they are the package-local and CI entry points respectively.

## Definition of done

- Any IR change is additive and every producer and consumer in `reference.md`
  was updated or explicitly ruled out.
- Parser changes remain static, deterministic and renderer-safe; unknown input
  becomes a warning or coded failure rather than executed code or a guess.
- Collection sorting is stable without changing semantic column order.
- Converter changes go through the shared contract and are implemented in both
  directions when the surface is bidirectional.
- Successful lossy output carries a specific warning; inseparable unsupported
  input returns a coded failure.
- Query round trips remain byte-stable and schema round trips remain
  semantically stable.
- The cockpit still diffs live to code and guards stale async analysis.
- The four verification commands pass.

See `reference.md` for the complete producer/consumer map, syntax matrix,
dialect behavior and test ownership.
