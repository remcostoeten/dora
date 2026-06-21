/**
 * Schema IR — the single normalized representation every Pillar-2 producer maps
 * INTO and every consumer operates ON.
 *
 *   live DB (Rust getDatabaseSchema) ─┐
 *   drizzle schema .ts ───────────────┼─► SchemaIR ─► diff ─► migration gen ─► UI
 *   schema.prisma ────────────────────┘
 *
 * THIS IS A FROZEN CONTRACT. Once shipped (#144), downstream plans (drizzle
 * parser, prisma parser, diff engine, migration gen, cockpit UI) import these
 * types and must not redefine them. Add fields only additively and only after
 * coordinating, because every producer/consumer keys off this shape.
 *
 * Collections (tables/columns/indexes/foreignKeys) are sorted by name by the
 * producers so two IRs diff deterministically.
 */

export type Dialect = 'postgres' | 'mysql' | 'sqlite'

/**
 * Canonical type set. Intentionally small: the diff engine compares normalized
 * types, so anything we cannot confidently map collapses to `'unknown'`, which
 * the diff treats as "review" rather than emitting a confident (and possibly
 * destructive) ALTER. Growing this set is a deliberate, conservative act.
 */
export type NormalizedType =
	| 'int'
	| 'bigint'
	| 'smallint'
	| 'float'
	| 'double'
	| 'decimal'
	| 'bool'
	| 'text'
	| 'varchar'
	| 'uuid'
	| 'json'
	| 'jsonb'
	| 'timestamp'
	| 'timestamptz'
	| 'date'
	| 'time'
	| 'bytes'
	| 'vector'
	| 'unknown'

export type ColumnIR = {
	name: string
	/** Canonical type used for confident comparison. */
	type: NormalizedType
	/** Original DB/ORM type, kept for display and fallback comparison. */
	rawType: string
	/**
	 * Normalized type parameters — length/precision/dimensions — as a compact
	 * string: `"255"` (varchar), `"10,2"` (decimal), `"1536"` (vector). Undefined
	 * when not captured on a side; the diff only compares params when BOTH sides
	 * carry them, so a missing value never fabricates drift.
	 */
	typeParams?: string
	nullable: boolean
	/** Normalized textual default, or null when there is none. */
	default: string | null
	autoIncrement: boolean
}

export type IndexIR = {
	name: string
	columns: string[]
	unique: boolean
}

export type ForeignKeyIR = {
	columns: string[]
	refTable: string
	refColumns: string[]
	onDelete?: string
	onUpdate?: string
}

export type TableIR = {
	name: string
	/** Postgres schema; defaults to 'public'. Empty/absent for SQLite. */
	schema?: string
	/** Sorted by name. */
	columns: ColumnIR[]
	/** Ordered primary-key column names (composite keys preserve order). */
	primaryKey: string[]
	/** Sorted by name; excludes the implicit primary-key index. */
	indexes: IndexIR[]
	/** Sorted by (refTable, columns). */
	foreignKeys: ForeignKeyIR[]
}

export type SchemaIR = {
	dialect: Dialect
	/** Sorted by name for stable diffs. */
	tables: TableIR[]
}
