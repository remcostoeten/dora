/**
 * Migration generation — turn a {@link SchemaDiff} into previewable, dialect-
 * correct SQL DDL. v1 target: raw SQL (`up` + best-effort `down`). This module
 * NEVER applies migrations; the cockpit hands the `up` text to the SQL console
 * so the user runs it with the normal prod-safety guardrails.
 *
 * Guard rails (the whole point of "preview, don't auto-apply"):
 * - `destructive` ops are emitted live but under a `-- ⚠ DESTRUCTIVE` banner and
 *   grouped last, so the UI can require explicit opt-in before including them.
 * - `review` ops are emitted COMMENTED OUT with a `-- REVIEW:` reason, so the
 *   user consciously enables them (e.g. unknown type mappings, SQLite ALTERs).
 * - `down` is best-effort; where it cannot be exact (data loss isn't
 *   reversible) it says so rather than pretending reversibility.
 *
 * Note on inputs: a `SchemaDiff` intentionally omits primary keys (the IR keeps
 * PK at table level) and table schemas. For full-fidelity `CREATE TABLE`
 * (primary keys, SERIAL/AUTOINCREMENT) pass the source/target IRs via
 * `context`; without them we infer a single-column PK from an autoIncrement
 * column and warn.
 */

import type {
	ColumnIR,
	Dialect,
	ForeignKeyIR,
	IndexIR,
	NormalizedType,
	SchemaIR,
	TableIR,
} from '@studio/features/orm-cockpit/ir/types'
import type {
	Change,
	ColumnDiff,
	SchemaDiff,
	TableDiff,
} from '@studio/features/orm-cockpit/diff/types'

export type MigrationContext = { from?: SchemaIR; to?: SchemaIR }

export type MigrationResult = { up: string; down: string; warnings: string[] }

const DESTRUCTIVE_BANNER = '-- ⚠ DESTRUCTIVE: drops or rewrites data — review before running'

type Section = 'create' | 'additive' | 'destructive'

type Stmt = {
	section: Section
	/** Forward SQL. */
	sql: string
	/** Best-effort reverse SQL for the `down` script, if reversible. */
	reverse?: string
	/** When set, the statement is emitted commented out under `-- REVIEW: <note>`. */
	review?: string
	/** Appended after the reverse statement in `down` to flag lossy/inexact reversal. */
	reverseCaveat?: string
}

export function generateMigrationSql(
	diff: SchemaDiff,
	dialect: Dialect,
	context: MigrationContext = {},
): MigrationResult {
	const warnings: string[] = []
	const stmts: Stmt[] = []

	const toMap = indexByName(context.to?.tables ?? [])
	const fromMap = indexByName(context.from?.tables ?? [])

	for (const table of diff.tables) {
		if (table.kind === 'added') {
			emitCreateTable(table, dialect, toMap.get(table.name), stmts, warnings)
		} else if (table.kind === 'removed') {
			emitDropTable(table, dialect, fromMap.get(table.name), stmts, warnings)
		} else {
			emitAlterTable(table, dialect, stmts, warnings)
		}
	}

	return assemble(stmts, dialect, warnings)
}

// ---------------------------------------------------------------------------
// Table-level emitters
// ---------------------------------------------------------------------------

function emitCreateTable(
	table: TableDiff,
	dialect: Dialect,
	target: TableIR | undefined,
	stmts: Stmt[],
	warnings: string[],
): void {
	// Prefer the authoritative target IR (carries the primary key); otherwise
	// synthesize from the diff's added columns and infer the PK.
	const columns = target?.columns ?? collectAddedColumns(table)
	const primaryKey = resolvePrimaryKey(table.name, target, columns, warnings)

	const lines: string[] = columns.map(function (col) {
		return `    ${columnDefinition(col, dialect, primaryKey, warnings)}`
	})

	if (primaryKey.length > 1) {
		lines.push(`    PRIMARY KEY (${primaryKey.map((c) => quote(c, dialect)).join(', ')})`)
	}

	// SQLite can't ALTER ADD a foreign key, so inline FKs into CREATE.
	const inlineFks = dialect === 'sqlite'
	if (inlineFks) {
		for (const fk of changeAfters(table.foreignKeys)) {
			lines.push(`    ${inlineForeignKey(fk, dialect)}`)
		}
	}

	const sql = `CREATE TABLE ${quote(table.name, dialect)} (\n${lines.join(',\n')}\n);`
	stmts.push({ section: 'create', sql, reverse: `DROP TABLE ${quote(table.name, dialect)};` })

	// Indexes for the new table (added in the additive pass, after all creates).
	for (const idx of changeAfters(table.indexes)) {
		emitCreateIndex(table.name, idx, dialect, stmts)
	}

	// pg/mysql add FKs via ALTER after creates; sqlite already inlined them.
	if (!inlineFks) {
		for (const fk of changeAfters(table.foreignKeys)) {
			emitAddForeignKey(table.name, fk, dialect, stmts)
		}
	}
}

function emitDropTable(
	table: TableDiff,
	dialect: Dialect,
	source: TableIR | undefined,
	stmts: Stmt[],
	warnings: string[],
): void {
	// Best-effort recreate for `down`: prefer the source IR, else rebuild from
	// the diff's `before` columns (loses PK fidelity → warn).
	const columns = source?.columns ?? collectRemovedColumns(table)
	const primaryKey = source?.primaryKey ?? inferPrimaryKey(columns)
	const recreate = buildCreateTableSql(table.name, columns, primaryKey, dialect)

	stmts.push({
		section: 'destructive',
		sql: `DROP TABLE ${quote(table.name, dialect)};`,
		reverse: recreate,
		reverseCaveat: 'data dropped with the table cannot be restored',
	})
	if (source === undefined) {
		warnings.push(
			`down: recreate of dropped table "${table.name}" is best-effort (no source schema provided); primary key / constraints may be incomplete.`,
		)
	}
}

function emitAlterTable(
	table: TableDiff,
	dialect: Dialect,
	stmts: Stmt[],
	warnings: string[],
): void {
	for (const col of table.columns) {
		if (col.kind === 'added') {
			emitAddColumn(table.name, col, dialect, stmts)
		} else if (col.kind === 'removed') {
			emitDropColumn(table.name, col, dialect, stmts)
		} else {
			emitAlterColumn(table.name, col, dialect, stmts, warnings)
		}
	}

	for (const change of table.indexes) {
		emitIndexChange(table.name, change, dialect, stmts)
	}
	for (const change of table.foreignKeys) {
		emitForeignKeyChange(table.name, change, dialect, stmts, warnings)
	}
}

// ---------------------------------------------------------------------------
// Column emitters
// ---------------------------------------------------------------------------

function emitAddColumn(tableName: string, col: ColumnDiff, dialect: Dialect, stmts: Stmt[]): void {
	const after = col.after as ColumnIR
	const def = columnDefinition(after, dialect, [], [])
	const sql = `ALTER TABLE ${quote(tableName, dialect)} ADD COLUMN ${def};`
	const reverse = `ALTER TABLE ${quote(tableName, dialect)} DROP COLUMN ${quote(after.name, dialect)};`
	// NOT NULL without default on an existing table can't satisfy old rows.
	if (col.confidence === 'destructive') {
		stmts.push({
			section: 'destructive',
			sql,
			reverse,
			reverseCaveat: 'adding NOT NULL without default fails on a non-empty table',
		})
	} else {
		stmts.push({ section: 'additive', sql, reverse })
	}
}

function emitDropColumn(tableName: string, col: ColumnDiff, dialect: Dialect, stmts: Stmt[]): void {
	const before = col.before as ColumnIR
	stmts.push({
		section: 'destructive',
		sql: `ALTER TABLE ${quote(tableName, dialect)} DROP COLUMN ${quote(before.name, dialect)};`,
		reverse: `ALTER TABLE ${quote(tableName, dialect)} ADD COLUMN ${columnDefinition(before, dialect, [], [])};`,
		reverseCaveat: 'column data is lost on drop and cannot be restored',
	})
}

function emitAlterColumn(
	tableName: string,
	col: ColumnDiff,
	dialect: Dialect,
	stmts: Stmt[],
	warnings: string[],
): void {
	const before = col.before as ColumnIR
	const after = col.after as ColumnIR
	const reason = alterReason(col)

	// SQLite cannot ALTER COLUMN type/nullability — it needs a table rebuild.
	if (dialect === 'sqlite') {
		stmts.push({
			section: 'additive',
			sql: `ALTER TABLE ${quote(tableName, dialect)} /* ALTER COLUMN ${quote(after.name, dialect)} */`,
			review: `SQLite cannot ALTER a column in place — rebuild the table (create new, copy, drop, rename). Change: ${reason}`,
		})
		warnings.push(
			`"${tableName}.${after.name}": SQLite column change requires a table rebuild; emitted as REVIEW.`,
		)
		return
	}

	const t = quote(tableName, dialect)
	const c = quote(after.name, dialect)
	const fields = col.changedFields ?? []

	if (fields.includes('type')) {
		const typeSql =
			dialect === 'mysql'
				? `ALTER TABLE ${t} MODIFY COLUMN ${columnDefinition(after, dialect, [], [])};`
				: `ALTER TABLE ${t} ALTER COLUMN ${c} TYPE ${typeToken(after, dialect, warnings)};`
		const reverseTypeSql =
			dialect === 'mysql'
				? `ALTER TABLE ${t} MODIFY COLUMN ${columnDefinition(before, dialect, [], [])};`
				: `ALTER TABLE ${t} ALTER COLUMN ${c} TYPE ${typeToken(before, dialect, warnings)};`
		const stmt: Stmt = {
			section: col.confidence === 'destructive' ? 'destructive' : 'additive',
			sql: typeSql,
			reverse: reverseTypeSql,
		}
		// Uncertain type changes are emitted for review rather than run blindly.
		if (col.confidence === 'review') {
			stmt.review = `type change ${before.rawType} → ${after.rawType} may be lossy or need a USING cast`
		}
		if (col.confidence === 'destructive') {
			stmt.reverseCaveat = 'narrowing type change may have truncated data'
		}
		stmts.push(stmt)
	}

	// pg-only per-aspect tweaks for nullability/default (mysql's MODIFY above
	// already carries the full definition).
	if (dialect === 'postgres') {
		if (fields.includes('nullable')) {
			stmts.push({
				section: after.nullable ? 'additive' : 'destructive',
				sql: `ALTER TABLE ${t} ALTER COLUMN ${c} ${after.nullable ? 'DROP NOT NULL' : 'SET NOT NULL'};`,
				reverse: `ALTER TABLE ${t} ALTER COLUMN ${c} ${after.nullable ? 'SET NOT NULL' : 'DROP NOT NULL'};`,
				reverseCaveat: after.nullable ? undefined : 'SET NOT NULL fails if existing rows are NULL',
			})
		}
		if (fields.includes('default')) {
			const setDefault =
				after.default === null
					? `ALTER TABLE ${t} ALTER COLUMN ${c} DROP DEFAULT;`
					: `ALTER TABLE ${t} ALTER COLUMN ${c} SET DEFAULT ${mapDefault(after.default, dialect)};`
			const reverseDefault =
				before.default === null
					? `ALTER TABLE ${t} ALTER COLUMN ${c} DROP DEFAULT;`
					: `ALTER TABLE ${t} ALTER COLUMN ${c} SET DEFAULT ${mapDefault(before.default, dialect)};`
			stmts.push({ section: 'additive', sql: setDefault, reverse: reverseDefault })
		}
	}
}

// ---------------------------------------------------------------------------
// Index & FK emitters
// ---------------------------------------------------------------------------

function emitCreateIndex(tableName: string, idx: IndexIR, dialect: Dialect, stmts: Stmt[]): void {
	const cols = idx.columns.map((c) => quote(c, dialect)).join(', ')
	const unique = idx.unique ? 'UNIQUE ' : ''
	stmts.push({
		section: 'additive',
		sql: `CREATE ${unique}INDEX ${quote(idx.name, dialect)} ON ${quote(tableName, dialect)} (${cols});`,
		reverse: dropIndexSql(tableName, idx.name, dialect),
	})
}

function emitIndexChange(
	tableName: string,
	change: Change<IndexIR>,
	dialect: Dialect,
	stmts: Stmt[],
): void {
	if (change.kind === 'added') {
		emitCreateIndex(tableName, change.after as IndexIR, dialect, stmts)
		return
	}
	if (change.kind === 'removed') {
		const before = change.before as IndexIR
		stmts.push({
			section: 'additive',
			sql: dropIndexSql(tableName, before.name, dialect),
			reverse: createIndexSql(tableName, before, dialect),
		})
		return
	}
	// changed → drop + recreate
	const before = change.before as IndexIR
	const after = change.after as IndexIR
	stmts.push({
		section: 'additive',
		sql: dropIndexSql(tableName, before.name, dialect),
		reverse: createIndexSql(tableName, before, dialect),
	})
	emitCreateIndex(tableName, after, dialect, stmts)
}

function emitAddForeignKey(
	tableName: string,
	fk: ForeignKeyIR,
	dialect: Dialect,
	stmts: Stmt[],
): void {
	const name = fkConstraintName(tableName, fk)
	stmts.push({
		section: 'additive',
		sql: addForeignKeySql(tableName, fk, dialect),
		reverse: dropForeignKeySql(tableName, name, dialect),
	})
}

function emitForeignKeyChange(
	tableName: string,
	change: Change<ForeignKeyIR>,
	dialect: Dialect,
	stmts: Stmt[],
	warnings: string[],
): void {
	if (dialect === 'sqlite') {
		warnings.push(
			`"${tableName}": SQLite cannot ALTER foreign keys; FK change emitted as REVIEW (needs a table rebuild).`,
		)
		stmts.push({
			section: 'additive',
			sql: `-- foreign key change on ${quote(tableName, dialect)}`,
			review: 'SQLite cannot add/drop a foreign key in place — rebuild the table to apply it.',
		})
		return
	}

	if (change.kind === 'added') {
		emitAddForeignKey(tableName, change.after as ForeignKeyIR, dialect, stmts)
		return
	}
	if (change.kind === 'removed') {
		const before = change.before as ForeignKeyIR
		const name = fkConstraintName(tableName, before)
		stmts.push({
			section: 'additive',
			sql: dropForeignKeySql(tableName, name, dialect),
			reverse: addForeignKeySql(tableName, before, dialect),
		})
		return
	}
	// changed → drop + add
	const before = change.before as ForeignKeyIR
	const after = change.after as ForeignKeyIR
	stmts.push({
		section: 'additive',
		sql: dropForeignKeySql(tableName, fkConstraintName(tableName, before), dialect),
		reverse: addForeignKeySql(tableName, before, dialect),
	})
	emitAddForeignKey(tableName, after, dialect, stmts)
}

// ---------------------------------------------------------------------------
// SQL fragment builders
// ---------------------------------------------------------------------------

function buildCreateTableSql(
	tableName: string,
	columns: ColumnIR[],
	primaryKey: string[],
	dialect: Dialect,
): string {
	const lines = columns.map(function (col) {
		return `    ${columnDefinition(col, dialect, primaryKey, [])}`
	})
	if (primaryKey.length > 1) {
		lines.push(`    PRIMARY KEY (${primaryKey.map((c) => quote(c, dialect)).join(', ')})`)
	}
	return `CREATE TABLE ${quote(tableName, dialect)} (\n${lines.join(',\n')}\n);`
}

function columnDefinition(
	col: ColumnIR,
	dialect: Dialect,
	primaryKey: string[],
	warnings: string[],
): string {
	const isSinglePk = primaryKey.length === 1 && primaryKey[0] === col.name
	const intFamily = isIntFamily(col.type)

	// SQLite rowid alias: INTEGER PRIMARY KEY AUTOINCREMENT.
	if (dialect === 'sqlite' && isSinglePk && col.autoIncrement && intFamily) {
		return `${quote(col.name, dialect)} INTEGER PRIMARY KEY AUTOINCREMENT`
	}

	const parts: string[] = [quote(col.name, dialect), typeToken(col, dialect, warnings)]

	if (isSinglePk && dialect !== 'mysql') {
		parts.push('PRIMARY KEY')
	}
	if (!col.nullable && !isSinglePk) {
		parts.push('NOT NULL')
	}
	if (dialect === 'mysql' && col.autoIncrement && intFamily) {
		parts.push('AUTO_INCREMENT')
	}
	if (isSinglePk && dialect === 'mysql') {
		parts.push('PRIMARY KEY')
	}
	const emitDefault =
		col.default !== null && col.type !== 'unknown' && !(col.autoIncrement && intFamily)
	if (emitDefault) {
		parts.push(`DEFAULT ${mapDefault(col.default as string, dialect)}`)
	}

	return parts.join(' ')
}

/** The DDL type token for a column (handles pg SERIAL + unknown→rawType). */
function typeToken(col: ColumnIR, dialect: Dialect, warnings: string[]): string {
	if (col.type === 'unknown') {
		warnings.push(`column "${col.name}": unknown type, emitting raw type "${col.rawType}" verbatim.`)
		return col.rawType.length > 0 ? col.rawType : fallbackType(dialect)
	}
	if (dialect === 'postgres' && col.autoIncrement && isIntFamily(col.type)) {
		return col.type === 'bigint' ? 'BIGSERIAL' : col.type === 'smallint' ? 'SMALLSERIAL' : 'SERIAL'
	}
	return SQL_TYPES[dialect][col.type]
}

function inlineForeignKey(fk: ForeignKeyIR, dialect: Dialect): string {
	const cols = fk.columns.map((c) => quote(c, dialect)).join(', ')
	const refCols = fk.refColumns.map((c) => quote(c, dialect)).join(', ')
	return `FOREIGN KEY (${cols}) REFERENCES ${quote(fk.refTable, dialect)} (${refCols})${fkActions(fk)}`
}

function addForeignKeySql(tableName: string, fk: ForeignKeyIR, dialect: Dialect): string {
	const cols = fk.columns.map((c) => quote(c, dialect)).join(', ')
	const refCols = fk.refColumns.map((c) => quote(c, dialect)).join(', ')
	return `ALTER TABLE ${quote(tableName, dialect)} ADD CONSTRAINT ${quote(fkConstraintName(tableName, fk), dialect)} FOREIGN KEY (${cols}) REFERENCES ${quote(fk.refTable, dialect)} (${refCols})${fkActions(fk)};`
}

function dropForeignKeySql(tableName: string, constraintName: string, dialect: Dialect): string {
	if (dialect === 'mysql') {
		return `ALTER TABLE ${quote(tableName, dialect)} DROP FOREIGN KEY ${quote(constraintName, dialect)};`
	}
	return `ALTER TABLE ${quote(tableName, dialect)} DROP CONSTRAINT ${quote(constraintName, dialect)};`
}

function createIndexSql(tableName: string, idx: IndexIR, dialect: Dialect): string {
	const cols = idx.columns.map((c) => quote(c, dialect)).join(', ')
	const unique = idx.unique ? 'UNIQUE ' : ''
	return `CREATE ${unique}INDEX ${quote(idx.name, dialect)} ON ${quote(tableName, dialect)} (${cols});`
}

function dropIndexSql(tableName: string, indexName: string, dialect: Dialect): string {
	if (dialect === 'mysql') {
		return `DROP INDEX ${quote(indexName, dialect)} ON ${quote(tableName, dialect)};`
	}
	return `DROP INDEX ${quote(indexName, dialect)};`
}

function fkActions(fk: ForeignKeyIR): string {
	let out = ''
	if (fk.onDelete) {
		out += ` ON DELETE ${fk.onDelete}`
	}
	if (fk.onUpdate) {
		out += ` ON UPDATE ${fk.onUpdate}`
	}
	return out
}

function fkConstraintName(tableName: string, fk: ForeignKeyIR): string {
	return `${tableName}_${fk.columns.join('_')}_fkey`
}

function mapDefault(value: string, dialect: Dialect): string {
	const lower = value.trim().toLowerCase()
	if (lower === 'now()' || lower === 'current_timestamp' || lower === 'defaultnow()') {
		return dialect === 'postgres' ? 'NOW()' : 'CURRENT_TIMESTAMP'
	}
	if (lower === 'true' || lower === 'false') {
		if (dialect === 'postgres') {
			return lower.toUpperCase()
		}
		return lower === 'true' ? '1' : '0'
	}
	// Everything else passes through verbatim (function calls, literals, casts).
	return value
}

function quote(name: string, dialect: Dialect): string {
	return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function assemble(stmts: Stmt[], dialect: Dialect, warnings: string[]): MigrationResult {
	const wrap = dialect === 'postgres'
	const up = renderUp(stmts, wrap)
	const down = renderDown(stmts, wrap)
	if (dialect === 'mysql' && stmts.length > 0) {
		warnings.push('MySQL does not support transactional DDL; statements are not wrapped in a transaction and a failure mid-migration leaves a partial state.')
	}
	return { up, down, warnings }
}

function renderUp(stmts: Stmt[], wrap: boolean): string {
	const creates = stmts.filter((s) => s.section === 'create' && !s.review)
	const additive = stmts.filter((s) => s.section === 'additive' && !s.review)
	const destructive = stmts.filter((s) => s.section === 'destructive' && !s.review)
	const reviews = stmts.filter((s) => s.review)

	const blocks: string[] = []
	if (creates.length > 0) {
		blocks.push(creates.map((s) => s.sql).join('\n'))
	}
	if (additive.length > 0) {
		blocks.push(additive.map((s) => s.sql).join('\n'))
	}
	if (destructive.length > 0) {
		blocks.push([DESTRUCTIVE_BANNER, ...destructive.map((s) => s.sql)].join('\n'))
	}
	if (reviews.length > 0) {
		blocks.push(
			[
				'-- The following changes need review and are commented out. Enable them deliberately.',
				...reviews.map(renderReview),
			].join('\n\n'),
		)
	}

	if (blocks.length === 0) {
		return '-- No changes.'
	}

	const body = blocks.join('\n\n')
	return wrap ? `BEGIN;\n\n${body}\n\nCOMMIT;` : body
}

function renderDown(stmts: Stmt[], wrap: boolean): string {
	// Reverse order, only statements we can reverse and that aren't review-gated.
	const reversible = stmts.filter((s) => s.reverse && !s.review).reverse()
	if (reversible.length === 0) {
		return '-- No reversible statements.'
	}
	const lines = reversible.map(function (s) {
		return s.reverseCaveat ? `-- ⚠ ${s.reverseCaveat}\n${s.reverse}` : (s.reverse as string)
	})
	const body = lines.join('\n')
	return wrap ? `BEGIN;\n\n${body}\n\nCOMMIT;` : body
}

function renderReview(s: Stmt): string {
	const commented = s.sql
		.split('\n')
		.map((line) => `-- ${line}`)
		.join('\n')
	return `-- REVIEW: ${s.review}\n${commented}`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function alterReason(col: ColumnDiff): string {
	return (col.changedFields ?? []).join(', ') || 'modified'
}

function collectAddedColumns(table: TableDiff): ColumnIR[] {
	return table.columns
		.filter((c) => c.kind === 'added' && c.after !== undefined)
		.map((c) => c.after as ColumnIR)
}

function collectRemovedColumns(table: TableDiff): ColumnIR[] {
	return table.columns
		.filter((c) => c.before !== undefined)
		.map((c) => c.before as ColumnIR)
}

function resolvePrimaryKey(
	tableName: string,
	target: TableIR | undefined,
	columns: ColumnIR[],
	warnings: string[],
): string[] {
	if (target) {
		return target.primaryKey
	}
	const inferred = inferPrimaryKey(columns)
	if (inferred.length > 0) {
		warnings.push(
			`table "${tableName}": no schema provided — inferred primary key (${inferred.join(', ')}) from autoIncrement column.`,
		)
	} else {
		warnings.push(`table "${tableName}": no primary key could be determined from the diff.`)
	}
	return inferred
}

function inferPrimaryKey(columns: ColumnIR[]): string[] {
	const auto = columns.find((c) => c.autoIncrement)
	return auto ? [auto.name] : []
}

function changeAfters<T>(changes: Change<T>[]): T[] {
	return changes.filter((c) => c.after !== undefined).map((c) => c.after as T)
}

function indexByName(tables: TableIR[]): Map<string, TableIR> {
	const map = new Map<string, TableIR>()
	for (const table of tables) {
		map.set(table.name, table)
	}
	return map
}

function isIntFamily(type: NormalizedType): boolean {
	return type === 'int' || type === 'bigint' || type === 'smallint'
}

function fallbackType(dialect: Dialect): string {
	return dialect === 'postgres' ? 'TEXT' : dialect === 'mysql' ? 'TEXT' : 'TEXT'
}

const SQL_TYPES: Record<Dialect, Record<Exclude<NormalizedType, 'unknown'>, string>> = {
	postgres: {
		int: 'INTEGER',
		bigint: 'BIGINT',
		smallint: 'SMALLINT',
		float: 'REAL',
		double: 'DOUBLE PRECISION',
		decimal: 'NUMERIC',
		bool: 'BOOLEAN',
		text: 'TEXT',
		varchar: 'VARCHAR',
		uuid: 'UUID',
		json: 'JSON',
		jsonb: 'JSONB',
		timestamp: 'TIMESTAMP',
		timestamptz: 'TIMESTAMPTZ',
		date: 'DATE',
		time: 'TIME',
		bytes: 'BYTEA',
	},
	mysql: {
		int: 'INT',
		bigint: 'BIGINT',
		smallint: 'SMALLINT',
		float: 'FLOAT',
		double: 'DOUBLE',
		decimal: 'DECIMAL',
		bool: 'TINYINT(1)',
		text: 'TEXT',
		varchar: 'VARCHAR(255)',
		uuid: 'CHAR(36)',
		json: 'JSON',
		jsonb: 'JSON',
		timestamp: 'DATETIME',
		timestamptz: 'TIMESTAMP',
		date: 'DATE',
		time: 'TIME',
		bytes: 'BLOB',
	},
	sqlite: {
		int: 'INTEGER',
		bigint: 'INTEGER',
		smallint: 'INTEGER',
		float: 'REAL',
		double: 'REAL',
		decimal: 'REAL',
		bool: 'INTEGER',
		text: 'TEXT',
		varchar: 'TEXT',
		uuid: 'TEXT',
		json: 'TEXT',
		jsonb: 'TEXT',
		timestamp: 'TEXT',
		timestamptz: 'TEXT',
		date: 'TEXT',
		time: 'TEXT',
		bytes: 'BLOB',
	},
}
