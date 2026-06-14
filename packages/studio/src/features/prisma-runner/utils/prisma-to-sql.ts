import type { DatabaseSchema, TableInfo } from '@studio/lib/bindings'
import { modelKeyToTable } from './model-mapper'

export type Dialect = 'postgresql' | 'mysql' | 'sqlite'

export type TranslationResult =
	| { sql: string; params: unknown[] }
	| { error: string; hint?: string }

type JsonObject = { [key: string]: JsValue }
type JsValue = string | number | boolean | null | JsValue[] | JsonObject

type TranslateError = { error: string; hint?: string }

function isError(value: unknown): value is TranslateError {
	return typeof value === 'object' && value !== null && 'error' in value
}

class ParamBuilder {
	private values: unknown[] = []
	constructor(private dialect: Dialect) {}

	add(value: unknown): string {
		this.values.push(value)
		if (this.dialect === 'postgresql') return `$${this.values.length}`
		return '?'
	}

	list(): unknown[] {
		return this.values
	}
}

function quoteIdent(name: string, dialect: Dialect): string {
	if (dialect === 'mysql') return '`' + name.replace(/`/g, '``') + '`'
	return '"' + name.replace(/"/g, '""') + '"'
}

function serializeBoolean(value: boolean, dialect: Dialect): boolean | number {
	if (dialect === 'postgresql') return value
	return value ? 1 : 0
}

// Tolerant recursive-descent parser for JS object-literal argument substrings.
// Handles unquoted keys, single/double/backtick quotes, numbers, booleans,
// null, arrays, and nested objects. Never executes input.
class JsLiteralParser {
	private pos = 0
	constructor(private src: string) {}

	parse(): JsValue {
		this.skipWs()
		const value = this.parseValue()
		this.skipWs()
		if (this.pos !== this.src.length) {
			throw new Error('Unexpected trailing characters in argument literal.')
		}
		return value
	}

	private skipWs(): void {
		while (this.pos < this.src.length) {
			const ch = this.src[this.pos]
			if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
				this.pos++
				continue
			}
			break
		}
	}

	private parseValue(): JsValue {
		this.skipWs()
		const ch = this.src[this.pos]
		if (ch === '{') return this.parseObject()
		if (ch === '[') return this.parseArray()
		if (ch === "'" || ch === '"' || ch === '`') return this.parseString(ch)
		return this.parseLiteral()
	}

	private parseObject(): JsonObject {
		const obj: JsonObject = {}
		this.pos++
		this.skipWs()
		if (this.src[this.pos] === '}') {
			this.pos++
			return obj
		}
		for (;;) {
			this.skipWs()
			const key = this.parseKey()
			this.skipWs()
			if (this.src[this.pos] !== ':') {
				throw new Error('Expected ":" after object key.')
			}
			this.pos++
			const value = this.parseValue()
			obj[key] = value
			this.skipWs()
			const next = this.src[this.pos]
			if (next === ',') {
				this.pos++
				this.skipWs()
				if (this.src[this.pos] === '}') {
					this.pos++
					return obj
				}
				continue
			}
			if (next === '}') {
				this.pos++
				return obj
			}
			throw new Error('Expected "," or "}" in object.')
		}
	}

	private parseKey(): string {
		const ch = this.src[this.pos]
		if (ch === "'" || ch === '"' || ch === '`') return this.parseString(ch)
		const start = this.pos
		while (this.pos < this.src.length && /[A-Za-z0-9_$]/.test(this.src[this.pos])) {
			this.pos++
		}
		if (this.pos === start) throw new Error('Expected object key.')
		return this.src.slice(start, this.pos)
	}

	private parseArray(): JsValue[] {
		const arr: JsValue[] = []
		this.pos++
		this.skipWs()
		if (this.src[this.pos] === ']') {
			this.pos++
			return arr
		}
		for (;;) {
			const value = this.parseValue()
			arr.push(value)
			this.skipWs()
			const next = this.src[this.pos]
			if (next === ',') {
				this.pos++
				this.skipWs()
				if (this.src[this.pos] === ']') {
					this.pos++
					return arr
				}
				continue
			}
			if (next === ']') {
				this.pos++
				return arr
			}
			throw new Error('Expected "," or "]" in array.')
		}
	}

	private parseString(quote: string): string {
		this.pos++
		let out = ''
		while (this.pos < this.src.length) {
			const ch = this.src[this.pos]
			if (ch === '\\') {
				const next = this.src[this.pos + 1]
				const escapes: Record<string, string> = {
					n: '\n',
					t: '\t',
					r: '\r',
					'\\': '\\',
					"'": "'",
					'"': '"',
					'`': '`'
				}
				out += escapes[next] ?? next
				this.pos += 2
				continue
			}
			if (ch === quote) {
				this.pos++
				return out
			}
			out += ch
			this.pos++
		}
		throw new Error('Unterminated string literal.')
	}

	private parseLiteral(): JsValue {
		const start = this.pos
		while (this.pos < this.src.length && /[A-Za-z0-9_.+\-]/.test(this.src[this.pos])) {
			this.pos++
		}
		const token = this.src.slice(start, this.pos)
		if (token === 'true') return true
		if (token === 'false') return false
		if (token === 'null') return null
		if (token === 'undefined') return null
		if (/^[+-]?\d+(?:\.\d+)?$/.test(token)) return Number(token)
		throw new Error(`Unsupported literal value: ${token}`)
	}
}

function parseArgsObject(source: string): JsonObject | TranslateError {
	const trimmed = source.trim()
	if (!trimmed) return {}
	try {
		const parsed = new JsLiteralParser(trimmed).parse()
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			return { error: 'Method argument must be an object literal.' }
		}
		return parsed
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to parse argument.'
		return { error: `Could not parse query argument: ${message}` }
	}
}

function findTable(schema: DatabaseSchema, tableName: string): TableInfo | undefined {
	return schema.tables.find(function (t) {
		return t.name === tableName
	})
}

function columnExists(table: TableInfo, column: string): boolean {
	return table.columns.some(function (c) {
		return c.name === column
	})
}

function primaryKeyColumn(table: TableInfo): string {
	if (table.primary_key_columns && table.primary_key_columns.length > 0) {
		return table.primary_key_columns[0]
	}
	const pk = table.columns.find(function (c) {
		return c.is_primary_key
	})
	return pk ? pk.name : 'id'
}

const COMPARISON_OPS: Record<string, string> = {
	equals: '=',
	not: '!=',
	lt: '<',
	lte: '<=',
	gt: '>',
	gte: '>='
}

function buildFieldCondition(
	field: string,
	value: JsValue,
	table: TableInfo,
	dialect: Dialect,
	params: ParamBuilder
): string | TranslateError {
	if (!columnExists(table, field)) {
		return { error: `Unknown column "${field}" on table "${table.name}".` }
	}
	const ident = quoteIdent(field, dialect)

	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		if (value === null) return `${ident} IS NULL`
		return `${ident} = ${params.add(serializeValue(value, dialect))}`
	}

	const clauses: string[] = []
	for (const [op, operand] of Object.entries(value)) {
		if (op in COMPARISON_OPS) {
			if (operand === null) {
				clauses.push(op === 'not' ? `${ident} IS NOT NULL` : `${ident} IS NULL`)
				continue
			}
			clauses.push(`${ident} ${COMPARISON_OPS[op]} ${params.add(serializeValue(operand, dialect))}`)
			continue
		}
		if (op === 'in' || op === 'notIn') {
			if (!Array.isArray(operand)) {
				return { error: `Operator "${op}" requires an array value.` }
			}
			if (operand.length === 0) {
				clauses.push(op === 'in' ? '1 = 0' : '1 = 1')
				continue
			}
			const placeholders = operand.map(function (item) {
				return params.add(serializeValue(item, dialect))
			})
			const keyword = op === 'in' ? 'IN' : 'NOT IN'
			clauses.push(`${ident} ${keyword} (${placeholders.join(', ')})`)
			continue
		}
		if (op === 'contains' || op === 'startsWith' || op === 'endsWith') {
			if (typeof operand !== 'string' && typeof operand !== 'number') {
				return { error: `Operator "${op}" requires a string value.` }
			}
			const raw = String(operand)
			const pattern =
				op === 'contains' ? `%${raw}%` : op === 'startsWith' ? `${raw}%` : `%${raw}`
			clauses.push(`${ident} LIKE ${params.add(pattern)}`)
			continue
		}
		return { error: `Unsupported where operator "${op}".` }
	}

	if (clauses.length === 0) return '1 = 1'
	if (clauses.length === 1) return clauses[0]
	return `(${clauses.join(' AND ')})`
}

function buildWhere(
	where: JsonObject,
	table: TableInfo,
	dialect: Dialect,
	params: ParamBuilder
): string | TranslateError {
	const clauses: string[] = []
	for (const [key, value] of Object.entries(where)) {
		if (key === 'AND' || key === 'OR') {
			if (!Array.isArray(value)) {
				return { error: `"${key}" must be an array of conditions.` }
			}
			const sub: string[] = []
			for (const cond of value) {
				if (typeof cond !== 'object' || cond === null || Array.isArray(cond)) {
					return { error: `"${key}" entries must be objects.` }
				}
				const built = buildWhere(cond, table, dialect, params)
				if (isError(built)) return built
				sub.push(built)
			}
			if (sub.length === 0) continue
			const joiner = key === 'AND' ? ' AND ' : ' OR '
			clauses.push(`(${sub.join(joiner)})`)
			continue
		}
		if (key === 'NOT') {
			if (typeof value !== 'object' || value === null || Array.isArray(value)) {
				return { error: '"NOT" must be an object of conditions.' }
			}
			const built = buildWhere(value, table, dialect, params)
			if (isError(built)) return built
			clauses.push(`NOT (${built})`)
			continue
		}
		const condition = buildFieldCondition(key, value, table, dialect, params)
		if (isError(condition)) return condition
		clauses.push(condition)
	}

	if (clauses.length === 0) return '1 = 1'
	return clauses.join(' AND ')
}

function serializeValue(value: JsValue, dialect: Dialect): unknown {
	if (typeof value === 'boolean') return serializeBoolean(value, dialect)
	return value
}

function buildOrderBy(
	orderBy: JsValue,
	table: TableInfo,
	dialect: Dialect
): string | TranslateError {
	const entries: JsonObject[] = []
	if (Array.isArray(orderBy)) {
		for (const item of orderBy) {
			if (typeof item !== 'object' || item === null || Array.isArray(item)) {
				return { error: 'orderBy array entries must be objects.' }
			}
			entries.push(item)
		}
	} else if (typeof orderBy === 'object' && orderBy !== null) {
		entries.push(orderBy)
	} else {
		return { error: 'orderBy must be an object or array of objects.' }
	}

	const parts: string[] = []
	for (const entry of entries) {
		for (const [field, dir] of Object.entries(entry)) {
			if (!columnExists(table, field)) {
				return { error: `Unknown column "${field}" in orderBy.` }
			}
			if (dir !== 'asc' && dir !== 'desc') {
				return { error: `orderBy direction must be "asc" or "desc", got "${String(dir)}".` }
			}
			parts.push(`${quoteIdent(field, dialect)} ${dir.toUpperCase()}`)
		}
	}
	if (parts.length === 0) return { error: 'orderBy must specify at least one column.' }
	return parts.join(', ')
}

function buildSelectColumns(
	select: JsValue,
	table: TableInfo,
	dialect: Dialect
): string | TranslateError {
	if (typeof select !== 'object' || select === null || Array.isArray(select)) {
		return { error: 'select must be an object.' }
	}
	const cols: string[] = []
	for (const [field, enabled] of Object.entries(select)) {
		if (enabled !== true) continue
		if (!columnExists(table, field)) {
			return { error: `Unknown column "${field}" in select.` }
		}
		cols.push(`${quoteIdent(table.name, dialect)}.${quoteIdent(field, dialect)}`)
	}
	if (cols.length === 0) return { error: 'select must enable at least one column.' }
	return cols.join(', ')
}

function buildInclude(
	include: JsValue,
	table: TableInfo,
	schema: DatabaseSchema,
	dialect: Dialect
): string | TranslateError {
	if (typeof include !== 'object' || include === null || Array.isArray(include)) {
		return { error: 'include must be an object.' }
	}
	const joins: string[] = []
	for (const [relationKey, spec] of Object.entries(include)) {
		if (spec !== true) {
			if (typeof spec === 'object' && spec !== null && !Array.isArray(spec)) {
				return {
					error: 'Nested include is not supported.',
					hint: 'Nested include is not supported. Use prisma.$queryRaw`...` for this query.'
				}
			}
			return { error: `Unsupported include value for "${relationKey}".` }
		}

		const relatedTable = resolveRelationTable(relationKey, schema)
		if (!relatedTable) {
			return { error: `Could not resolve relation "${relationKey}" to a table.` }
		}

		const join = resolveJoin(table, relatedTable, dialect)
		if (!join) {
			return {
				error: `No foreign key found linking "${table.name}" and "${relatedTable.name}".`
			}
		}
		joins.push(join)
	}
	return joins.join(' ')
}

function resolveRelationTable(relationKey: string, schema: DatabaseSchema): TableInfo | undefined {
	const direct = modelKeyToTable(relationKey, schema)
	if (direct) {
		const table = findTable(schema, direct)
		if (table) return table
	}
	const singularKey = relationKey.endsWith('s') ? relationKey.slice(0, -1) : relationKey
	const singular = modelKeyToTable(singularKey, schema)
	if (singular) {
		const table = findTable(schema, singular)
		if (table) return table
	}
	return schema.tables.find(function (t) {
		return t.name === relationKey || t.name === singularKey
	})
}

function resolveJoin(base: TableInfo, related: TableInfo, dialect: Dialect): string | null {
	for (const col of related.columns) {
		if (col.foreign_key && col.foreign_key.referenced_table === base.name) {
			return `LEFT JOIN ${quoteIdent(related.name, dialect)} ON ${quoteIdent(related.name, dialect)}.${quoteIdent(col.name, dialect)} = ${quoteIdent(base.name, dialect)}.${quoteIdent(col.foreign_key.referenced_column, dialect)}`
		}
	}
	for (const col of base.columns) {
		if (col.foreign_key && col.foreign_key.referenced_table === related.name) {
			return `LEFT JOIN ${quoteIdent(related.name, dialect)} ON ${quoteIdent(base.name, dialect)}.${quoteIdent(col.name, dialect)} = ${quoteIdent(related.name, dialect)}.${quoteIdent(col.foreign_key.referenced_column, dialect)}`
		}
	}
	return null
}

function hasRelationKeyInData(data: JsonObject, table: TableInfo): boolean {
	return Object.keys(data).some(function (key) {
		return !columnExists(table, key)
	})
}

const NESTED_WRITE_OPS = new Set(['connectOrCreate', 'upsert', 'connect', 'disconnect', 'create'])

function detectNestedWrite(data: JsonObject): boolean {
	for (const value of Object.values(data)) {
		if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
			for (const key of Object.keys(value)) {
				if (NESTED_WRITE_OPS.has(key)) return true
			}
		}
	}
	return false
}

function buildInsertValues(
	data: JsonObject,
	table: TableInfo,
	dialect: Dialect,
	params: ParamBuilder
): { columns: string[]; placeholders: string[] } | TranslateError {
	if (detectNestedWrite(data)) {
		return {
			error: 'Nested writes are not supported.',
			hint: 'Nested relation writes are not supported. Use prisma.$queryRaw`...` for this query.'
		}
	}
	if (hasRelationKeyInData(data, table)) {
		return {
			error: 'Relation fields in create/update data are not supported.',
			hint: 'Use prisma.$queryRaw`...` for queries that write relations.'
		}
	}
	const columns: string[] = []
	const placeholders: string[] = []
	for (const [field, value] of Object.entries(data)) {
		columns.push(quoteIdent(field, dialect))
		if (value === null) {
			placeholders.push('NULL')
			continue
		}
		if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
			return { error: `Unsupported value for column "${field}".` }
		}
		placeholders.push(params.add(serializeValue(value, dialect)))
	}
	return { columns, placeholders }
}

function selectClause(
	args: JsonObject,
	table: TableInfo,
	schema: DatabaseSchema,
	dialect: Dialect,
	params: ParamBuilder,
	extraLimit?: number
): TranslationResult {
	let columns = '*'
	if ('select' in args && 'include' in args) {
		return { error: 'Cannot use both select and include in the same query.' }
	}
	if ('select' in args) {
		const built = buildSelectColumns(args.select, table, dialect)
		if (isError(built)) return built
		columns = built
	}

	let joins = ''
	if ('include' in args) {
		const built = buildInclude(args.include, table, schema, dialect)
		if (isError(built)) return built
		joins = built
		if (columns === '*') columns = `${quoteIdent(table.name, dialect)}.*`
	}

	let sql = `SELECT ${columns} FROM ${quoteIdent(table.name, dialect)}`
	if (joins) sql += ` ${joins}`

	if ('where' in args) {
		const where = args.where
		if (typeof where !== 'object' || where === null || Array.isArray(where)) {
			return { error: 'where must be an object.' }
		}
		const built = buildWhere(where, table, dialect, params)
		if (isError(built)) return built
		sql += ` WHERE ${built}`
	}

	if ('orderBy' in args) {
		const built = buildOrderBy(args.orderBy, table, dialect)
		if (isError(built)) return built
		sql += ` ORDER BY ${built}`
	}

	let take: number | undefined
	if ('take' in args) {
		if (typeof args.take !== 'number') return { error: 'take must be a number.' }
		take = args.take
	}
	if (extraLimit !== undefined) take = extraLimit

	if (take !== undefined) sql += ` LIMIT ${take}`

	if ('skip' in args) {
		if (typeof args.skip !== 'number') return { error: 'skip must be a number.' }
		sql += ` OFFSET ${args.skip}`
	}

	return { sql, params: params.list() }
}

function whereClause(
	args: JsonObject,
	table: TableInfo,
	dialect: Dialect,
	params: ParamBuilder,
	required: boolean
): string | TranslateError {
	if (!('where' in args)) {
		if (required) return { error: 'This method requires a "where" argument.' }
		return ''
	}
	const where = args.where
	if (typeof where !== 'object' || where === null || Array.isArray(where)) {
		return { error: 'where must be an object.' }
	}
	const built = buildWhere(where, table, dialect, params)
	if (isError(built)) return built
	return ` WHERE ${built}`
}

const UNSUPPORTED_METHODS: Record<string, string> = {
	upsert: 'upsert is not supported.',
	aggregate: 'aggregate is not supported.',
	groupBy: 'groupBy is not supported.'
}

function translateMethod(
	modelKey: string,
	method: string,
	args: JsonObject,
	schema: DatabaseSchema,
	dialect: Dialect
): TranslationResult {
	const tableName = modelKeyToTable(modelKey, schema)
	if (!tableName) {
		return {
			error: `Unknown model "${modelKey}".`,
			hint: 'Check that the model name matches a table in the connected database.'
		}
	}
	const table = findTable(schema, tableName)
	if (!table) return { error: `Unknown model "${modelKey}".` }

	if (method in UNSUPPORTED_METHODS) {
		return {
			error: UNSUPPORTED_METHODS[method],
			hint: 'Use prisma.$queryRaw`...` for this query.'
		}
	}

	const params = new ParamBuilder(dialect)

	switch (method) {
		case 'findMany':
			return selectClause(args, table, schema, dialect, params)
		case 'findFirst':
			return selectClause(args, table, schema, dialect, params, 1)
		case 'findUnique': {
			const where = whereClause(args, table, dialect, params, true)
			if (isError(where)) return where
			return {
				sql: `SELECT * FROM ${quoteIdent(table.name, dialect)}${where} LIMIT 1`,
				params: params.list()
			}
		}
		case 'count': {
			const where = whereClause(args, table, dialect, params, false)
			if (isError(where)) return where
			return {
				sql: `SELECT COUNT(*) FROM ${quoteIdent(table.name, dialect)}${where}`,
				params: params.list()
			}
		}
		case 'create': {
			if (!('data' in args)) return { error: 'create requires a "data" argument.' }
			const data = args.data
			if (typeof data !== 'object' || data === null || Array.isArray(data)) {
				return { error: 'create data must be an object.' }
			}
			const values = buildInsertValues(data, table, dialect, params)
			if (isError(values)) return values
			let sql = `INSERT INTO ${quoteIdent(table.name, dialect)} (${values.columns.join(', ')}) VALUES (${values.placeholders.join(', ')})`
			if (dialect === 'postgresql') sql += ' RETURNING *'
			return { sql, params: params.list() }
		}
		case 'createMany': {
			if (!('data' in args)) return { error: 'createMany requires a "data" argument.' }
			const data = args.data
			if (!Array.isArray(data)) return { error: 'createMany data must be an array.' }
			if (data.length === 0) return { error: 'createMany data must not be empty.' }
			const columns = collectColumns(data, table)
			if (isError(columns)) return columns
			const rows: string[] = []
			for (const row of data) {
				if (typeof row !== 'object' || row === null || Array.isArray(row)) {
					return { error: 'createMany rows must be objects.' }
				}
				if (detectNestedWrite(row) || hasRelationKeyInData(row, table)) {
					return {
						error: 'Nested writes are not supported.',
						hint: 'Use prisma.$queryRaw`...` for this query.'
					}
				}
				const cells: string[] = []
				for (const col of columns) {
					const value = col in row ? row[col] : null
					if (value === null) {
						cells.push('NULL')
						continue
					}
					if (Array.isArray(value) || typeof value === 'object') {
						return { error: `Unsupported value for column "${col}".` }
					}
					cells.push(params.add(serializeValue(value, dialect)))
				}
				rows.push(`(${cells.join(', ')})`)
			}
			const cols = columns.map(function (c) {
				return quoteIdent(c, dialect)
			})
			let sql = `INSERT INTO ${quoteIdent(table.name, dialect)} (${cols.join(', ')}) VALUES ${rows.join(', ')}`
			if (dialect === 'postgresql') sql += ' RETURNING *'
			return { sql, params: params.list() }
		}
		case 'update':
		case 'updateMany': {
			if (!('data' in args)) return { error: `${method} requires a "data" argument.` }
			const data = args.data
			if (typeof data !== 'object' || data === null || Array.isArray(data)) {
				return { error: `${method} data must be an object.` }
			}
			const assignments = buildUpdateAssignments(data, table, dialect, params)
			if (isError(assignments)) return assignments
			const where = whereClause(args, table, dialect, params, method === 'update')
			if (isError(where)) return where
			return {
				sql: `UPDATE ${quoteIdent(table.name, dialect)} SET ${assignments.join(', ')}${where}`,
				params: params.list()
			}
		}
		case 'delete':
		case 'deleteMany': {
			const where = whereClause(args, table, dialect, params, method === 'delete')
			if (isError(where)) return where
			return {
				sql: `DELETE FROM ${quoteIdent(table.name, dialect)}${where}`,
				params: params.list()
			}
		}
		default:
			return {
				error: `Unsupported method "${method}".`,
				hint: 'Use prisma.$queryRaw`...` for this query.'
			}
	}
}

function collectColumns(rows: JsValue[], table: TableInfo): string[] | TranslateError {
	const set = new Set<string>()
	for (const row of rows) {
		if (typeof row !== 'object' || row === null || Array.isArray(row)) {
			return { error: 'createMany rows must be objects.' }
		}
		for (const key of Object.keys(row)) {
			if (!columnExists(table, key)) {
				return {
					error: `Unknown column "${key}" on table "${table.name}".`
				}
			}
			set.add(key)
		}
	}
	return Array.from(set)
}

function buildUpdateAssignments(
	data: JsonObject,
	table: TableInfo,
	dialect: Dialect,
	params: ParamBuilder
): string[] | TranslateError {
	if (detectNestedWrite(data)) {
		return {
			error: 'Nested writes are not supported.',
			hint: 'Use prisma.$queryRaw`...` for this query.'
		}
	}
	if (hasRelationKeyInData(data, table)) {
		return {
			error: 'Relation fields in update data are not supported.',
			hint: 'Use prisma.$queryRaw`...` for this query.'
		}
	}
	const assignments: string[] = []
	for (const [field, value] of Object.entries(data)) {
		const ident = quoteIdent(field, dialect)
		if (value === null) {
			assignments.push(`${ident} = NULL`)
			continue
		}
		if (Array.isArray(value) || typeof value === 'object') {
			return { error: `Unsupported value for column "${field}".` }
		}
		assignments.push(`${ident} = ${params.add(serializeValue(value, dialect))}`)
	}
	if (assignments.length === 0) return { error: 'update data must set at least one column.' }
	return assignments
}

function translateRaw(template: string, dialect: Dialect): TranslationResult {
	const params: unknown[] = []
	let sql = ''
	let i = 0
	while (i < template.length) {
		if (template[i] === '\\') {
			sql += template[i] + (template[i + 1] ?? '')
			i += 2
			continue
		}
		if (template[i] === '$' && template[i + 1] === '{') {
			let depth = 1
			let j = i + 2
			while (j < template.length && depth > 0) {
				if (template[j] === '{') depth++
				else if (template[j] === '}') depth--
				if (depth === 0) break
				j++
			}
			const expr = template.slice(i + 2, j).trim()
			params.push(expr)
			sql += dialect === 'postgresql' ? `$${params.length}` : '?'
			i = j + 1
			continue
		}
		sql += template[i]
		i++
	}
	return { sql: sql.trim(), params }
}

function findMatchingParen(source: string, openIndex: number): number {
	let depth = 0
	let quote: string | null = null
	let escape = false
	for (let i = openIndex; i < source.length; i++) {
		const ch = source[i]
		if (escape) {
			escape = false
			continue
		}
		if (ch === '\\') {
			escape = true
			continue
		}
		if (quote) {
			if (ch === quote) quote = null
			continue
		}
		if (ch === "'" || ch === '"' || ch === '`') {
			quote = ch
			continue
		}
		if (ch === '(') depth++
		else if (ch === ')') {
			depth--
			if (depth === 0) return i
		}
	}
	return -1
}

function findMatchingBacktick(source: string, openIndex: number): number {
	let escape = false
	for (let i = openIndex + 1; i < source.length; i++) {
		const ch = source[i]
		if (escape) {
			escape = false
			continue
		}
		if (ch === '\\') {
			escape = true
			continue
		}
		if (ch === '`') return i
	}
	return -1
}

export function prismaToSql(
	code: string,
	schema: DatabaseSchema,
	dialect: Dialect
): TranslationResult {
	let source = code.trim()
	if (!source) return { error: 'Enter a Prisma query to execute.' }
	source = source.replace(/^await\s+/, '').replace(/;\s*$/, '').trim()
	source = source.replace(/^(?:const|let|var)\s+[A-Za-z0-9_$]+\s*=\s*/, '').trim()

	if (/^prisma\.\$transaction\b/.test(source)) {
		return {
			error: '$transaction is not supported.',
			hint: 'Run statements individually, or use prisma.$queryRaw`...`.'
		}
	}

	const rawMatch = source.match(/^prisma\.(\$queryRaw|\$executeRaw)\s*`/)
	if (rawMatch) {
		const backtickIndex = source.indexOf('`')
		const end = findMatchingBacktick(source, backtickIndex)
		if (end === -1) return { error: 'Unterminated $queryRaw template literal.' }
		const template = source.slice(backtickIndex + 1, end)
		return translateRaw(template, dialect)
	}

	if (/^prisma\.(\$queryRawUnsafe|\$executeRawUnsafe)\b/.test(source)) {
		return {
			error: '$queryRawUnsafe / $executeRawUnsafe are not supported.',
			hint: 'Use prisma.$queryRaw`...` with interpolation instead.'
		}
	}

	const callMatch = source.match(/^prisma\.([A-Za-z0-9_$]+)\.([A-Za-z0-9_$]+)\s*\(/)
	if (!callMatch) {
		return {
			error: 'Could not parse Prisma query.',
			hint: 'Expected prisma.<model>.<method>({ ... }) or prisma.$queryRaw`...`.'
		}
	}

	const modelKey = callMatch[1]
	const method = callMatch[2]
	const openParen = source.indexOf('(', callMatch[0].length - 1)
	const closeParen = findMatchingParen(source, openParen)
	if (closeParen === -1) {
		return { error: 'Unbalanced parentheses in Prisma query.' }
	}
	const argsSource = source.slice(openParen + 1, closeParen)

	const args = parseArgsObject(argsSource)
	if (isError(args)) return args

	return translateMethod(modelKey, method, args, schema, dialect)
}
