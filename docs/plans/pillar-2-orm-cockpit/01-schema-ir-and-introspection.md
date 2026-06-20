# Plan 01: Schema IR + live-DB mapper (FOUNDATION — do first)

**Effort:** M. **Blocks:** 02, 03, 05, 06, 07. **Depends on:** nothing.

Defines the normalized **Schema IR** that everything compares against, and maps
the live DB's `DatabaseSchema` into it. **Land this first and freeze the types** —
every other Pillar-2 plan imports them.

## Files (owned)

`packages/studio/src/features/orm-cockpit/ir/`
- `types.ts` — the IR (below).
- `from-live-schema.ts` — `DatabaseSchema` → `SchemaIR`.
- `normalize-type.ts` — dialect-aware type normalization (the crux).
- `__tests__/from-live-schema.test.ts`.

## The IR (stable contract — design carefully, then freeze)

```ts
export type Dialect = 'postgres' | 'mysql' | 'sqlite'

export type SchemaIR = {
  dialect: Dialect
  tables: TableIR[]            // sorted by name for stable diffs
}

export type TableIR = {
  name: string
  schema?: string              // pg schema; default 'public'
  columns: ColumnIR[]          // sorted by name
  primaryKey: string[]         // ordered column names
  indexes: IndexIR[]           // sorted by name
  foreignKeys: ForeignKeyIR[]  // sorted
}

export type ColumnIR = {
  name: string
  type: NormalizedType         // see normalize-type.ts
  rawType: string              // original, for display + fallback comparison
  nullable: boolean
  default: string | null       // normalized textual default, or null
  autoIncrement: boolean
}

export type IndexIR = { name: string; columns: string[]; unique: boolean }
export type ForeignKeyIR = {
  columns: string[]; refTable: string; refColumns: string[]
  onDelete?: string; onUpdate?: string
}
```

## Normalized types (`normalize-type.ts`) — the crux

Map raw DB/ORM types to a small canonical set so semantically-equal columns
don't show as drift:

```ts
export type NormalizedType =
  | 'int' | 'bigint' | 'smallint'
  | 'float' | 'double' | 'decimal'
  | 'bool'
  | 'text' | 'varchar'
  | 'uuid' | 'json' | 'jsonb'
  | 'timestamp' | 'timestamptz' | 'date' | 'time'
  | 'bytes'
  | 'unknown'                  // anything we can't confidently map
```

- Provide `normalizeDbType(rawType, dialect): NormalizedType` here. Reference the
  reverse mapping in `apps/desktop/src-tauri/src/database/services/schema_export.rs`
  (`get_drizzle_type`) for the type vocabulary each dialect emits.
- **Conservative rule:** unknown → `'unknown'`, and the diff (plan 05) must treat
  `unknown` vs anything as "review", never as a confident change.

## The live mapper (`from-live-schema.ts`)

Map the bindings `DatabaseSchema` → `SchemaIR`. Field references (verified in
`apps/desktop/src-tauri/src/database/types.rs`, exposed in
`packages/studio/src/lib/bindings.ts`):

- `DatabaseSchema { tables: TableInfo[], schemas, uniqueColumns }`
- `TableInfo { name, schema, columns: ColumnInfo[], primaryKeyColumns: string[],
  indexes: IndexInfo[], rowCountEstimate }`
- `ColumnInfo { name, dataType, isNullable, defaultValue, isPrimaryKey,
  isAutoIncrement, foreignKey: ForeignKeyInfo | null }`
- `ForeignKeyInfo { referencedTable, referencedColumn, referencedSchema }`
- `IndexInfo { name, columnNames, isUnique, isPrimary }`

Mapping notes:
- `ColumnIR.type = normalizeDbType(col.dataType, dialect)`, `rawType = col.dataType`.
- `primaryKey = table.primaryKeyColumns` (preserve order).
- `foreignKeys`: fold per-column `ColumnInfo.foreignKey` into `ForeignKeyIR`
  (group by ref table); the live schema carries FKs per column, so collect them.
- Skip primary-key indexes when an explicit PK already exists, to avoid
  double-counting (check `IndexInfo.isPrimary`).
- Sort tables/columns/indexes by name for deterministic diffs.

## Acceptance criteria

- [ ] `SchemaIR` + sub-types exported and documented as the frozen contract.
- [ ] `fromLiveSchema(databaseSchema, dialect): SchemaIR` implemented.
- [ ] `normalizeDbType` covers the types each shipped dialect emits; unknowns
      fall to `'unknown'`.
- [ ] Unit tests: a representative `DatabaseSchema` fixture (pg + sqlite) maps to
      the expected IR; FKs grouped; PK order preserved; deterministic ordering.
- [ ] `bun run typecheck` clean.

## Risks

- **Type normalization is where false diffs are born.** Keep the canonical set
  small and bias to `'unknown'` (→ "review") over guessing. This is the single
  most important design call in Pillar 2.
- Defaults differ wildly (`now()` vs `CURRENT_TIMESTAMP` vs `defaultNow()`).
  Normalize a *small* set of well-known defaults; everything else compares as
  raw text and, on mismatch, is flagged "review" rather than auto-altered.
