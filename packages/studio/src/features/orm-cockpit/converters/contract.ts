/**
 * Converter contract — the shared surface for the deterministic (non-AI)
 * Drizzle ↔ SQL converters (#162). Both directions and the UI import ONLY from
 * this module; implementations live beside it:
 *
 *   converters/drizzle-to-sql.ts  — implements {@link DrizzleToSql}
 *   converters/sql-to-drizzle.ts  — implements {@link SqlToDrizzle}
 *
 * Two conversion surfaces, auto-detected from the input unless pinned:
 *
 * SCHEMA — Drizzle table definitions ↔ SQL DDL. Pivots through the frozen
 * {@link SchemaIR}: Drizzle→SQL reuses `parsers/drizzle/parse-drizzle-schema`
 * and the DDL emission rules of `migration/generate-sql` (quoting, SQL_TYPES,
 * SERIAL/AUTOINCREMENT handling); SQL→Drizzle parses DDL into `SchemaIR` and
 * emits idiomatic `pgTable`/`mysqlTable`/`sqliteTable` code.
 *
 * QUERY — Drizzle query-builder calls ↔ SQL DML. Pivots through {@link QueryIR}
 * below. Supported query shapes: select (joins, where, orderBy, groupBy,
 * limit/offset), insert (values, returning), update (set, where, returning),
 * delete (where, returning). Supported operators are exactly
 * {@link COMPARISON_OPERATORS} + {@link LOGICAL_OPERATORS} — the set the
 * Drizzle LSP already completes (see drizzle-runner/utils/lsp-patterns.ts).
 *
 * Anything outside this surface MUST NOT throw or guess: return `ok: false`
 * with an `unsupported-construct` error (or convert the rest and attach a
 * warning, when the unknown part is severable). Determinism is the contract:
 * same input + options → byte-identical output.
 */

import type { Dialect, SchemaIR } from '@studio/features/orm-cockpit/ir/types'

export type { Dialect, SchemaIR }

export type ConversionSurface = 'schema' | 'query'

export type ConvertOptions = {
	dialect: Dialect
	/** Pin the surface; when omitted the converter auto-detects it from the input. */
	surface?: ConversionSurface
}

export type ConvertErrorCode =
	| 'empty-input'
	| 'parse-error'
	| 'unsupported-construct'
	| 'unsupported-dialect'

export type ConvertError = {
	code: ConvertErrorCode
	/** Human-readable, names the offending construct, e.g. `".having() is not supported"`. */
	message: string
	/** 1-based line in the input, when attributable. */
	line?: number
}

export type ConvertSuccess = {
	ok: true
	/** Detected (or pinned) surface the input was converted as. */
	surface: ConversionSurface
	output: string
	/** Non-fatal notes: lossy mappings, skipped severable constructs, dialect caveats. */
	warnings: string[]
}

export type ConvertFailure = {
	ok: false
	errors: ConvertError[]
}

export type ConvertResult = ConvertSuccess | ConvertFailure

/** Drizzle TypeScript source (schema file or query snippet) → SQL text. */
export type DrizzleToSql = (source: string, options: ConvertOptions) => ConvertResult

/** SQL text (DDL script or DML statement) → Drizzle TypeScript source. */
export type SqlToDrizzle = (source: string, options: ConvertOptions) => ConvertResult

// ---------------------------------------------------------------------------
// Query IR — the pivot for the QUERY surface. Both directions parse INTO this
// and emit FROM it, so round-trips are exact by construction.
// ---------------------------------------------------------------------------

export const COMPARISON_OPERATORS = [
	'eq',
	'ne',
	'gt',
	'gte',
	'lt',
	'lte',
	'like',
	'ilike',
	'inArray',
	'notInArray',
	'between',
	'notBetween',
	'isNull',
	'isNotNull',
] as const

export const LOGICAL_OPERATORS = ['and', 'or', 'not', 'exists', 'notExists'] as const

export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number]

export type LogicalOperator = (typeof LOGICAL_OPERATORS)[number]

export type QueryValue =
	| { kind: 'string'; value: string }
	| { kind: 'number'; value: number }
	| { kind: 'boolean'; value: boolean }
	| { kind: 'null' }
	/** A bind placeholder (`$1` / `?` / a referenced JS variable), kept by name. */
	| { kind: 'param'; name: string }

export type ColumnRef = {
	/** Table (or alias) qualifier; omitted when the query is single-table. */
	table?: string
	column: string
}

export type Condition =
	| { op: 'and' | 'or'; conditions: Condition[] }
	| { op: 'not'; condition: Condition }
	| { op: 'exists' | 'notExists'; query: SelectQuery }
	| { op: 'isNull' | 'isNotNull'; column: ColumnRef }
	| { op: 'inArray' | 'notInArray'; column: ColumnRef; values: QueryValue[] }
	| { op: 'between' | 'notBetween'; column: ColumnRef; low: QueryValue; high: QueryValue }
	| {
			op: Exclude<ComparisonOperator, 'inArray' | 'notInArray' | 'between' | 'notBetween' | 'isNull' | 'isNotNull'>
			column: ColumnRef
			/** A literal/param, or a column for column-to-column comparisons (join-style eq). */
			value: QueryValue | { kind: 'column'; ref: ColumnRef }
	  }

export type JoinKind = 'inner' | 'left' | 'right' | 'full'

export type Join = {
	kind: JoinKind
	table: string
	on: Condition
}

export type OrderBy = {
	column: ColumnRef
	direction: 'asc' | 'desc'
}

export type SelectQuery = {
	kind: 'select'
	from: string
	/** Empty array means `SELECT *` / bare `db.select()`. */
	columns: ColumnRef[]
	joins: Join[]
	where?: Condition
	groupBy: ColumnRef[]
	orderBy: OrderBy[]
	limit?: number
	offset?: number
}

export type InsertQuery = {
	kind: 'insert'
	into: string
	/** One entry per row; keys are DB column names, insertion order preserved. */
	rows: Record<string, QueryValue>[]
	returning: ColumnRef[]
}

export type UpdateQuery = {
	kind: 'update'
	table: string
	set: Record<string, QueryValue>
	where?: Condition
	returning: ColumnRef[]
}

export type DeleteQuery = {
	kind: 'delete'
	from: string
	where?: Condition
	returning: ColumnRef[]
}

export type QueryIR = SelectQuery | InsertQuery | UpdateQuery | DeleteQuery
