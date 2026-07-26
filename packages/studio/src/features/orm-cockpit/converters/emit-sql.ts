/**
 * QueryIR → SQL DML. This is the second half of the QUERY surface and is kept
 * standalone so both converter directions (and round-trip tests) can pivot
 * through {@link QueryIR} without importing a parser.
 *
 * Dialect rules applied here: identifier quoting (backticks on MySQL, double
 * quotes elsewhere), booleans (`TRUE`/`FALSE` on Postgres, `1`/`0` elsewhere),
 * `ILIKE` (Postgres only — other dialects degrade to `LIKE` with a warning) and
 * single-quote escaping by doubling.
 */

import type {
	ColumnRef,
	Condition,
	DeleteQuery,
	Dialect,
	InsertQuery,
	JoinKind,
	QueryIR,
	QueryValue,
	SelectQuery,
	UpdateQuery,
} from '@studio/features/orm-cockpit/converters/contract'

const JOIN_KEYWORDS: Record<JoinKind, string> = {
	inner: 'INNER JOIN',
	left: 'LEFT JOIN',
	right: 'RIGHT JOIN',
	full: 'FULL JOIN',
}

const COMPARISON_SYMBOLS: Record<string, string> = {
	eq: '=',
	ne: '<>',
	gt: '>',
	gte: '>=',
	lt: '<',
	lte: '<=',
	like: 'LIKE',
	ilike: 'ILIKE',
}

/** Render a {@link QueryIR} as a single dialect-correct SQL statement. */
export function emitSql(query: QueryIR, dialect: Dialect, warnings: string[] = []): string {
	switch (query.kind) {
		case 'select':
			return emitSelect(query, dialect, warnings)
		case 'insert':
			return emitInsert(query, dialect, warnings)
		case 'update':
			return emitUpdate(query, dialect, warnings)
		case 'delete':
			return emitDelete(query, dialect, warnings)
	}
}

function emitSelect(query: SelectQuery, dialect: Dialect, warnings: string[]): string {
	const projection =
		query.columns.length === 0
			? '*'
			: query.columns.map((c) => columnSql(c, dialect)).join(', ')

	const parts: string[] = [`SELECT ${projection}`, `FROM ${quote(query.from, dialect)}`]

	for (const join of query.joins) {
		parts.push(
			`${JOIN_KEYWORDS[join.kind]} ${quote(join.table, dialect)} ON ${conditionSql(join.on, dialect, warnings)}`,
		)
	}
	if (query.where) {
		parts.push(`WHERE ${conditionSql(query.where, dialect, warnings)}`)
	}
	if (query.groupBy.length > 0) {
		parts.push(`GROUP BY ${query.groupBy.map((c) => columnSql(c, dialect)).join(', ')}`)
	}
	if (query.orderBy.length > 0) {
		const cols = query.orderBy.map(function (o) {
			return `${columnSql(o.column, dialect)} ${o.direction.toUpperCase()}`
		})
		parts.push(`ORDER BY ${cols.join(', ')}`)
	}
	if (query.limit !== undefined) {
		parts.push(`LIMIT ${query.limit}`)
	}
	if (query.offset !== undefined) {
		parts.push(`OFFSET ${query.offset}`)
	}
	return `${parts.join(' ')};`
}

function emitInsert(query: InsertQuery, dialect: Dialect, warnings: string[]): string {
	const columns: string[] = []
	for (const row of query.rows) {
		for (const key of Object.keys(row)) {
			if (!columns.includes(key)) {
				columns.push(key)
			}
		}
	}

	const rows = query.rows.map(function (row) {
		const cells = columns.map(function (col) {
			const value = row[col]
			if (value === undefined) {
				warnings.push(`insert: column "${col}" is missing from a row; emitted as NULL.`)
				return 'NULL'
			}
			return valueSql(value, dialect, warnings)
		})
		return `(${cells.join(', ')})`
	})

	const head = `INSERT INTO ${quote(query.into, dialect)} (${columns.map((c) => quote(c, dialect)).join(', ')})`
	return `${head} VALUES ${rows.join(', ')}${returningSql(query.returning, dialect)};`
}

function emitUpdate(query: UpdateQuery, dialect: Dialect, warnings: string[]): string {
	const assignments = Object.keys(query.set).map(function (col) {
		return `${quote(col, dialect)} = ${valueSql(query.set[col], dialect, warnings)}`
	})
	const parts = [`UPDATE ${quote(query.table, dialect)}`, `SET ${assignments.join(', ')}`]
	if (query.where) {
		parts.push(`WHERE ${conditionSql(query.where, dialect, warnings)}`)
	}
	return `${parts.join(' ')}${returningSql(query.returning, dialect)};`
}

function emitDelete(query: DeleteQuery, dialect: Dialect, warnings: string[]): string {
	const parts = [`DELETE FROM ${quote(query.from, dialect)}`]
	if (query.where) {
		parts.push(`WHERE ${conditionSql(query.where, dialect, warnings)}`)
	}
	return `${parts.join(' ')}${returningSql(query.returning, dialect)};`
}

function returningSql(returning: ColumnRef[], dialect: Dialect): string {
	if (returning.length === 0) {
		return ''
	}
	if (returning.length === 1 && returning[0].column === '*') {
		return ' RETURNING *'
	}
	return ` RETURNING ${returning.map((c) => columnSql(c, dialect)).join(', ')}`
}

function conditionSql(condition: Condition, dialect: Dialect, warnings: string[]): string {
	switch (condition.op) {
		case 'and':
		case 'or': {
			const keyword = condition.op.toUpperCase()
			const parts = condition.conditions.map(function (c) {
				return needsParens(c) ? `(${conditionSql(c, dialect, warnings)})` : conditionSql(c, dialect, warnings)
			})
			return parts.join(` ${keyword} `)
		}
		case 'not':
			return `NOT (${conditionSql(condition.condition, dialect, warnings)})`
		case 'exists':
			return `EXISTS (${stripTrailingSemicolon(emitSelect(condition.query, dialect, warnings))})`
		case 'notExists':
			return `NOT EXISTS (${stripTrailingSemicolon(emitSelect(condition.query, dialect, warnings))})`
		case 'isNull':
			return `${columnSql(condition.column, dialect)} IS NULL`
		case 'isNotNull':
			return `${columnSql(condition.column, dialect)} IS NOT NULL`
		case 'inArray':
		case 'notInArray': {
			const keyword = condition.op === 'inArray' ? 'IN' : 'NOT IN'
			const values = condition.values.map((v) => valueSql(v, dialect, warnings)).join(', ')
			return `${columnSql(condition.column, dialect)} ${keyword} (${values})`
		}
		case 'between':
		case 'notBetween': {
			const keyword = condition.op === 'between' ? 'BETWEEN' : 'NOT BETWEEN'
			const low = valueSql(condition.low, dialect, warnings)
			const high = valueSql(condition.high, dialect, warnings)
			return `${columnSql(condition.column, dialect)} ${keyword} ${low} AND ${high}`
		}
		default: {
			const symbol = resolveComparison(condition.op, dialect, warnings)
			const right =
				condition.value.kind === 'column'
					? columnSql(condition.value.ref, dialect)
					: valueSql(condition.value, dialect, warnings)
			return `${columnSql(condition.column, dialect)} ${symbol} ${right}`
		}
	}
}

function resolveComparison(op: string, dialect: Dialect, warnings: string[]): string {
	if (op === 'ilike' && dialect !== 'postgres') {
		warnings.push(`ilike() has no ${dialect} equivalent; emitted as a case-sensitive LIKE.`)
		return 'LIKE'
	}
	return COMPARISON_SYMBOLS[op]
}

function needsParens(condition: Condition): boolean {
	return condition.op === 'and' || condition.op === 'or'
}

function stripTrailingSemicolon(sql: string): string {
	return sql.endsWith(';') ? sql.slice(0, -1) : sql
}

function columnSql(ref: ColumnRef, dialect: Dialect): string {
	if (ref.column === '*') {
		return ref.table ? `${quote(ref.table, dialect)}.*` : '*'
	}
	return ref.table ? `${quote(ref.table, dialect)}.${quote(ref.column, dialect)}` : quote(ref.column, dialect)
}

function valueSql(value: QueryValue, dialect: Dialect, warnings: string[]): string {
	switch (value.kind) {
		case 'string':
			return `'${value.value.replace(/'/g, "''")}'`
		case 'number':
			return String(value.value)
		case 'boolean':
			if (dialect === 'postgres') {
				return value.value ? 'TRUE' : 'FALSE'
			}
			return value.value ? '1' : '0'
		case 'null':
			return 'NULL'
		case 'param':
			warnings.push(
				`"${value.name}" is a runtime value; emitted as the named placeholder ":${value.name}" — bind it before running.`,
			)
			return `:${value.name}`
	}
}

function quote(name: string, dialect: Dialect): string {
	return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
}
