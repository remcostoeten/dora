# ORM cockpit reference

Read the section that matches the change. The tables describe the source as it
exists; unsupported entries are boundaries, not invitations to guess.

## Schema IR

| Type | Contract |
| --- | --- |
| `Dialect` | `postgres`, `mysql`, `sqlite` |
| `SchemaIR` | One dialect and tables sorted by name |
| `TableIR` | Name, optional schema, sorted columns, ordered primary key, sorted indexes and foreign keys |
| `ColumnIR` | Canonical type, raw type, optional parameters, nullability, textual default, auto-increment |
| `IndexIR` | Stable name, ordered columns, uniqueness |
| `ForeignKeyIR` | Ordered local and referenced columns, referenced table, optional actions |
| `NormalizedType` | Small conservative set ending in `unknown` |

### Schema producers

| Producer | Input | Dialect source | Important behavior |
| --- | --- | --- | --- |
| `ir/from-live-schema.ts` | Generated `DatabaseSchema` | Caller | PK list preference, implicit PK-index removal, per-column FK folding |
| `parsers/drizzle/parse-drizzle-schema.ts` | `SchemaFile[]` | Caller plus actual table builder | Static TS AST, warnings per file/table, direct builders only |
| `parsers/prisma/parse-prisma-schema.ts` | Concatenated Prisma text | Datasource provider | Hand-written block parser, relation fields excluded from columns |
| `converters/sql-to-drizzle-ddl.ts` | Tokenized SQL DDL | Converter option | Produces a schema plan consumed by the Drizzle emitter |

### Schema consumers

- `diff/diff-schema.ts`
- `migration/generate-sql.ts`
- `converters/drizzle-to-sql-schema.ts`
- `converters/sql-to-drizzle-emit-schema.ts`
- `components/use-orm-cockpit.ts`

Any field change starts at `ir/types.ts` and audits every row above.

## Type normalization

| Canonical type | Representative inputs |
| --- | --- |
| `int`, `smallint`, `bigint` | integer aliases, serial families, MySQL integer widths |
| `float`, `double`, `decimal` | real/float variants, numeric/decimal/money |
| `bool` | booleans and MySQL `tinyint(1)` |
| `text`, `varchar` | text/char/varchar families and Prisma String |
| `uuid` | Postgres UUID and Prisma UUID native type |
| `json`, `jsonb` | Dialect-specific JSON variants |
| `timestamp`, `timestamptz`, `date`, `time` | Ordered time/date matching |
| `bytes` | bytea/blob/binary families |
| `vector` | Exact `vector` or `vector(...)`, not other vector-like types |
| `unknown` | Anything not confidently recognized |

Only `varchar`, `decimal` and `vector` currently retain `typeParams`.

## Project discovery

`link/detect-orm.ts` searches:

- Drizzle config names at a candidate root;
- schema entries statically read from `schema:` in the config;
- common Drizzle fallback files and directories;
- Prisma's conventional file, package `prisma.schema`, and multi-file schema
  directory;
- the linked root plus common and declared workspace packages.

It ignores dependency, VCS, build, output and coverage directories. Recursive
glob walking stops at depth 12. `ProjectReader` is the pure boundary;
`link/link-api.ts` supplies Tauri-backed commands and `link/demo-project.ts`
supplies browser demo data.

## Drizzle schema parser

Recognized table heads:

- `pgTable`
- `mysqlTable`
- `sqliteTable`

Recognized column information includes common scalar builders, explicit database
names, length/precision/dimensions, primary key, nullability, literal/default-now
defaults, auto-increment and identity, uniqueness and references.

The third table argument supports object or array-returning configuration for
composite primary keys, indexes, unique indexes and foreign keys.

Warnings preserve these gaps:

- barrel re-exports;
- helper-wrapped factories;
- computed names or keys;
- non-object column maps;
- runtime default functions;
- unresolved references and table configuration;
- unknown builders.

## Prisma parser

The parser recognizes datasource, generator, model, enum, type and view blocks,
but only models become tables. It supports:

- datasource providers for Postgres/CockroachDB, MySQL and SQLite;
- common scalar and native types;
- optional fields and auto-increment/default forms;
- field and model mapping;
- scalar uniqueness and primary keys;
- compound primary keys, indexes and unique constraints;
- owning-side relations with referenced columns and actions;
- enums as text with a warning.

It warns or degrades conservatively for unknown providers, scalar lists,
unrecognized scalar/native types, generated defaults and unmodeled block
attributes.

## Converter contract

Entry points:

- `convertDrizzleToSql(source, options)`
- `convertSqlToDrizzle(source, options)`

Results are either:

- success with surface, output and warnings; or
- failure with one or more coded errors.

Error codes:

| Code | Meaning |
| --- | --- |
| `empty-input` | No meaningful source |
| `parse-error` | Syntax or surface detection failed |
| `unsupported-construct` | Input is valid but outside the closed grammar |
| `unsupported-dialect` | Option is not one of the three IR dialects |

## Conversion surfaces

| Surface | Drizzle to SQL | SQL to Drizzle |
| --- | --- | --- |
| Schema | Parse table declarations to `SchemaIR`, emit dialect DDL | Parse DDL to a schema plan, emit table declarations |
| Query | Parse `db`/`tx` chains to `QueryIR`, call `emitSql` | Parse one DML statement to `QueryIR`, emit a Drizzle chain |

`QueryIR` supports select, insert, update and delete; inner/left/right/full
joins; where/group/order/limit/offset; returning; and the comparison/logical
operators exported from `converters/contract.ts`.

Explicitly unsupported examples include CTEs, aggregates, HAVING, window
functions and raw SQL templates.

## Dialect emission

| Concern | Postgres | MySQL | SQLite |
| --- | --- | --- | --- |
| Identifier quotes | `"` | backtick | `"` |
| Boolean literal | `TRUE` / `FALSE` | `1` / `0` | `1` / `0` |
| `ILIKE` | Native | `LIKE` plus warning | `LIKE` plus warning |
| Identity | Serial/identity family | Auto increment | Integer primary-key auto increment |
| Schema | Preserved/default public | No Postgres schema semantics | No schema |

Runtime parameter references emit named placeholders and warnings. String
literals escape a quote by doubling it.

## Owning tests

| Contract | Tests |
| --- | --- |
| Live mapping and normalization | `__tests__/packages/studio/orm-cockpit/from-live-schema.test.ts` |
| Drizzle schema parsing | `__tests__/packages/studio/orm-cockpit/drizzle/parse-drizzle-schema.test.ts` |
| Prisma parsing | `__tests__/packages/studio/orm-cockpit/prisma/parse-prisma-schema.test.ts` |
| Project detection | `__tests__/packages/studio/orm-cockpit/link/detect-orm.test.ts` |
| Drizzle to SQL | `__tests__/packages/studio/orm-cockpit/converters/drizzle-to-sql.test.ts` |
| SQL to Drizzle | `__tests__/packages/studio/orm-cockpit/converters/sql-to-drizzle.test.ts` |
| Round trips | `__tests__/packages/studio/orm-cockpit/converters/round-trip.test.ts` |
| Converter reducer | `__tests__/packages/studio/orm-cockpit/converters/ui-converter-state.test.ts` |
| Full cockpit composition | `__tests__/packages/studio/orm-cockpit/components/cockpit-pipeline.acceptance.test.ts` |

Converter fixtures live under
`__tests__/packages/studio/orm-cockpit/converters/fixtures/`.
