/**
 * A single SQL DML statement → the converter contract's {@link QueryIR}.
 *
 * Recursive descent over the closed grammar the contract models: SELECT (joins,
 * where, group by, order by, limit/offset), INSERT … VALUES [RETURNING], UPDATE
 * … SET … WHERE, DELETE … WHERE. Everything else (CTEs, UNION, HAVING, window
 * functions, aggregates or aliases in the select list, subqueries outside
 * EXISTS) raises `unsupported-construct` naming the construct.
 */

import type { Dialect } from '@studio/features/orm-cockpit/ir/types'
import type {
	ColumnRef,
	Condition,
	DeleteQuery,
	InsertQuery,
	Join,
	JoinKind,
	OrderBy,
	QueryIR,
	QueryValue,
	SelectQuery,
	UpdateQuery
} from '@studio/features/orm-cockpit/converters/contract'
import {
	TokenStream,
	describe,
	parseError,
	unsupported
} from '@studio/features/orm-cockpit/converters/sql-to-drizzle-lexer'

export type TQueryPlan = {
	query: QueryIR
	warnings: string[]
}

/**
 * `RETURNING *` / bare `.returning()` sentinel — an empty `returning` array
 * means "no RETURNING clause", so the star needs its own encoding. Shared with
 * the Drizzle→SQL direction so query round-trips are exact.
 */
export const RETURNING_ALL: ColumnRef = { column: '*' }

type TRefSite = {
	ref: ColumnRef
	/** 0 for the outer statement, 1+ inside an EXISTS subquery. */
	depth: number
}

type TParseState = {
	dialect: Dialect
	warnings: string[]
	/** alias (or table name) → real table name, for the statement being parsed. */
	scope: Map<string, string>
	/** Every ColumnRef produced, so qualifiers can be resolved in one pass. */
	refs: TRefSite[]
	depth: number
}

const JOIN_KEYWORDS: Record<string, JoinKind> = {
	INNER: 'inner',
	LEFT: 'left',
	RIGHT: 'right',
	FULL: 'full',
	JOIN: 'inner'
}

export function parseDmlStatement(stream: TokenStream, dialect: Dialect): TQueryPlan {
	const state: TParseState = { dialect, warnings: [], scope: new Map(), refs: [], depth: 0 }

	if (stream.isKeyword('WITH')) {
		unsupported('common table expressions (WITH) are not supported', stream.line)
	}

	let query: QueryIR
	if (stream.isKeyword('SELECT')) {
		query = parseSelect(stream, state)
	} else if (stream.isKeyword('INSERT')) {
		query = parseInsert(stream, state)
	} else if (stream.isKeyword('UPDATE')) {
		query = parseUpdate(stream, state)
	} else if (stream.isKeyword('DELETE')) {
		query = parseDelete(stream, state)
	} else {
		unsupported(
			`expected SELECT, INSERT, UPDATE or DELETE but found ${describe(stream.peek())}`,
			stream.line
		)
	}

	resolveRefs(state, query)

	stream.matchPunct(';')
	if (!stream.atEof()) {
		state.warnings.push(
			'the query surface converts one statement at a time; only the first statement was converted'
		)
	}

	return { query, warnings: state.warnings }
}

// ---------------------------------------------------------------------------
// SELECT
// ---------------------------------------------------------------------------

function parseSelect(stream: TokenStream, state: TParseState): SelectQuery {
	stream.expectKeyword('SELECT')
	if (stream.isKeyword('DISTINCT')) {
		unsupported('SELECT DISTINCT is not supported', stream.line)
	}
	stream.matchKeyword('ALL')

	const columns = parseSelectList(stream, state)

	stream.expectKeyword('FROM')
	const from = parseTableRef(stream, state)

	const joins: Join[] = []
	for (;;) {
		const join = parseJoin(stream, state)
		if (!join) {
			break
		}
		joins.push(join)
	}

	const query: SelectQuery = { kind: 'select', from, columns, joins, groupBy: [], orderBy: [] }

	if (stream.matchKeyword('WHERE')) {
		query.where = parseCondition(stream, state)
	}
	if (stream.matchKeywordSequence('GROUP', 'BY')) {
		do {
			query.groupBy.push(parseColumnRef(stream, state))
		} while (stream.matchPunct(','))
	}
	if (stream.isKeyword('HAVING')) {
		unsupported('HAVING is not supported', stream.line)
	}
	if (stream.matchKeywordSequence('ORDER', 'BY')) {
		do {
			query.orderBy.push(parseOrderBy(stream, state))
		} while (stream.matchPunct(','))
	}
	parseLimitOffset(stream, query, state)

	if (stream.isAnyKeyword(['UNION', 'INTERSECT', 'EXCEPT'])) {
		unsupported(`${stream.peek().value.toUpperCase()} is not supported`, stream.line)
	}
	return query
}

function parseSelectList(stream: TokenStream, state: TParseState): ColumnRef[] {
	const columns: ColumnRef[] = []
	let star = false

	do {
		const line = stream.line
		if (stream.matchPunct('*')) {
			star = true
			continue
		}
		if (stream.peek().kind === 'number' && state.depth > 0) {
			// `EXISTS (SELECT 1 FROM …)` — the projection is irrelevant.
			stream.next()
			star = true
			continue
		}
		if (!stream.isIdentifier()) {
			unsupported(`unsupported select-list item ${describe(stream.peek())}`, line)
		}
		if (stream.isPunct('(', 1)) {
			const name = stream.peek().value
			if (followedByOver(stream)) {
				unsupported(`window functions are not supported (found "${name}() OVER")`, line)
			}
			unsupported(
				`function calls in the select list are not supported (found "${name}()")`,
				line
			)
		}
		if (stream.isPunct('.', 1) && stream.isPunct('*', 2)) {
			stream.next()
			stream.next()
			stream.next()
			star = true
			continue
		}
		const ref = parseColumnRef(stream, state)
		if (stream.isKeyword('AS') || (stream.isIdentifier() && !stream.isAnyKeyword(['FROM']))) {
			unsupported(
				`column aliases in the select list are not supported ("${ref.column}")`,
				line
			)
		}
		columns.push(ref)
	} while (stream.matchPunct(','))

	if (star && columns.length > 0) {
		unsupported(
			'mixing * with explicit columns in the select list is not supported',
			stream.line
		)
	}
	return star ? [] : columns
}

/** Peek past `fn( … )` to see whether an `OVER` window clause follows. */
function followedByOver(stream: TokenStream): boolean {
	const start = stream.position
	stream.next()
	let depth = 0
	do {
		const token = stream.next()
		if (token.kind === 'eof') {
			stream.reset(start)
			return false
		}
		if (token.value === '(') {
			depth += 1
		} else if (token.value === ')') {
			depth -= 1
		}
	} while (depth > 0)
	const isOver = stream.isKeyword('OVER')
	stream.reset(start)
	return isOver
}

function parseTableRef(stream: TokenStream, state: TParseState): string {
	const line = stream.line
	if (stream.isPunct('(')) {
		unsupported('subqueries in FROM are not supported', line)
	}
	let name = stream.identifier()
	if (stream.matchPunct('.')) {
		name = stream.identifier()
	}
	state.scope.set(name, name)

	const aliased = stream.matchKeyword('AS')
	if (stream.isIdentifier() && (aliased || !isClauseKeyword(stream))) {
		const alias = stream.identifier()
		state.scope.set(alias, name)
		if (alias !== name) {
			state.warnings.push(
				`table alias "${alias}" resolved to "${name}"; Drizzle query-builder code references the table export directly`
			)
		}
	}
	return name
}

const CLAUSE_KEYWORDS = [
	'WHERE',
	'GROUP',
	'ORDER',
	'LIMIT',
	'OFFSET',
	'HAVING',
	'JOIN',
	'INNER',
	'LEFT',
	'RIGHT',
	'FULL',
	'CROSS',
	'ON',
	'UNION',
	'INTERSECT',
	'EXCEPT',
	'SET',
	'VALUES',
	'RETURNING',
	'AND',
	'OR',
	'AS'
]

function isClauseKeyword(stream: TokenStream): boolean {
	return stream.isAnyKeyword(CLAUSE_KEYWORDS)
}

function parseJoin(stream: TokenStream, state: TParseState): Join | null {
	if (stream.isKeyword('CROSS')) {
		unsupported('CROSS JOIN is not supported', stream.line)
	}
	if (stream.isKeyword('NATURAL')) {
		unsupported('NATURAL JOIN is not supported', stream.line)
	}

	let kind: JoinKind | null = null
	const start = stream.position
	if (stream.isAnyKeyword(['INNER', 'LEFT', 'RIGHT', 'FULL'])) {
		kind = JOIN_KEYWORDS[stream.peek().value.toUpperCase()]
		stream.next()
		stream.matchKeyword('OUTER')
		if (!stream.matchKeyword('JOIN')) {
			stream.reset(start)
			return null
		}
	} else if (stream.matchKeyword('JOIN')) {
		kind = 'inner'
	} else {
		return null
	}

	const table = parseTableRef(stream, state)
	stream.expectKeyword('ON')
	const on = parseCondition(stream, state)
	return { kind, table, on }
}

function parseOrderBy(stream: TokenStream, state: TParseState): OrderBy {
	const column = parseColumnRef(stream, state)
	let direction: 'asc' | 'desc' = 'asc'
	if (stream.matchKeyword('DESC')) {
		direction = 'desc'
	} else {
		stream.matchKeyword('ASC')
	}
	if (
		stream.matchKeywordSequence('NULLS', 'FIRST') ||
		stream.matchKeywordSequence('NULLS', 'LAST')
	) {
		state.warnings.push(
			'NULLS FIRST/LAST is dropped — the query IR has no ordering nulls option'
		)
	}
	return { column, direction }
}

function parseLimitOffset(stream: TokenStream, query: SelectQuery, state: TParseState): void {
	if (stream.matchKeyword('LIMIT')) {
		const first = parseIntegerLiteral(stream)
		if (stream.matchPunct(',')) {
			// MySQL's `LIMIT offset, count`.
			query.offset = first
			query.limit = parseIntegerLiteral(stream)
		} else {
			query.limit = first
		}
	}
	if (stream.matchKeyword('OFFSET')) {
		query.offset = parseIntegerLiteral(stream)
		stream.matchKeyword('ROW')
		stream.matchKeyword('ROWS')
	}
	if (stream.isKeyword('FETCH')) {
		unsupported('FETCH FIRST/NEXT is not supported; use LIMIT', stream.line)
	}
	if (state.dialect === 'sqlite' && query.offset !== undefined && query.limit === undefined) {
		state.warnings.push('OFFSET without LIMIT requires a LIMIT in SQLite')
	}
}

function parseIntegerLiteral(stream: TokenStream): number {
	const token = stream.peek()
	if (token.kind !== 'number' || token.value.includes('.')) {
		parseError(`expected an integer but found ${describe(token)}`, token.line)
	}
	stream.next()
	return Number(token.value)
}

// ---------------------------------------------------------------------------
// INSERT / UPDATE / DELETE
// ---------------------------------------------------------------------------

function parseInsert(stream: TokenStream, state: TParseState): InsertQuery {
	stream.expectKeyword('INSERT')
	stream.matchKeyword('IGNORE')
	stream.expectKeyword('INTO')
	const into = parseTableName(stream, state)

	if (!stream.isPunct('(')) {
		unsupported(
			'INSERT without an explicit column list is not supported — Drizzle .values() needs column names',
			stream.line
		)
	}
	stream.expectPunct('(')
	const columns: string[] = []
	do {
		columns.push(stream.identifier())
	} while (stream.matchPunct(','))
	stream.expectPunct(')')

	if (stream.isKeyword('SELECT')) {
		unsupported('INSERT ... SELECT is not supported', stream.line)
	}
	stream.expectKeyword('VALUES')

	const rows: Record<string, QueryValue>[] = []
	do {
		const line = stream.line
		stream.expectPunct('(')
		const values: QueryValue[] = []
		do {
			values.push(parseValue(stream))
		} while (stream.matchPunct(','))
		stream.expectPunct(')')
		if (values.length !== columns.length) {
			parseError(
				`row has ${values.length} values but ${columns.length} columns were listed`,
				line
			)
		}
		const row: Record<string, QueryValue> = {}
		columns.forEach(function (column, index) {
			row[column] = values[index]
		})
		rows.push(row)
	} while (stream.matchPunct(','))

	if (stream.isKeyword('ON')) {
		unsupported('ON CONFLICT / ON DUPLICATE KEY is not supported', stream.line)
	}

	return { kind: 'insert', into, rows, returning: parseReturning(stream, state) }
}

function parseUpdate(stream: TokenStream, state: TParseState): UpdateQuery {
	stream.expectKeyword('UPDATE')
	const table = parseTableName(stream, state)
	stream.expectKeyword('SET')

	const set: Record<string, QueryValue> = {}
	do {
		const column = stream.identifier()
		stream.expectPunct('=')
		set[column] = parseValue(stream)
	} while (stream.matchPunct(','))

	if (stream.isKeyword('FROM')) {
		unsupported('UPDATE ... FROM is not supported', stream.line)
	}

	const query: UpdateQuery = { kind: 'update', table, set, returning: [] }
	if (stream.matchKeyword('WHERE')) {
		query.where = parseCondition(stream, state)
	}
	query.returning = parseReturning(stream, state)
	return query
}

function parseDelete(stream: TokenStream, state: TParseState): DeleteQuery {
	stream.expectKeyword('DELETE')
	stream.expectKeyword('FROM')
	const from = parseTableName(stream, state)

	const query: DeleteQuery = { kind: 'delete', from, returning: [] }
	if (stream.matchKeyword('WHERE')) {
		query.where = parseCondition(stream, state)
	}
	query.returning = parseReturning(stream, state)
	return query
}

function parseTableName(stream: TokenStream, state: TParseState): string {
	let name = stream.identifier()
	if (stream.matchPunct('.')) {
		name = stream.identifier()
	}
	state.scope.set(name, name)
	return name
}

function parseReturning(stream: TokenStream, state: TParseState): ColumnRef[] {
	const line = stream.line
	if (!stream.matchKeyword('RETURNING')) {
		return []
	}
	if (state.dialect === 'mysql') {
		state.warnings.push(
			'MySQL has no RETURNING clause; the emitted .returning() will not run on MySQL'
		)
	}
	if (stream.matchPunct('*')) {
		return [{ ...RETURNING_ALL }]
	}
	const columns: ColumnRef[] = []
	do {
		if (stream.isPunct('(', 1)) {
			unsupported('function calls in RETURNING are not supported', line)
		}
		columns.push(parseColumnRef(stream, state))
	} while (stream.matchPunct(','))
	return columns
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

function parseCondition(stream: TokenStream, state: TParseState): Condition {
	return parseOr(stream, state)
}

function parseOr(stream: TokenStream, state: TParseState): Condition {
	const conditions = [parseAnd(stream, state)]
	while (stream.matchKeyword('OR')) {
		conditions.push(parseAnd(stream, state))
	}
	return conditions.length === 1 ? conditions[0] : { op: 'or', conditions }
}

function parseAnd(stream: TokenStream, state: TParseState): Condition {
	const conditions = [parseNot(stream, state)]
	while (stream.matchKeyword('AND')) {
		conditions.push(parseNot(stream, state))
	}
	return conditions.length === 1 ? conditions[0] : { op: 'and', conditions }
}

function parseNot(stream: TokenStream, state: TParseState): Condition {
	if (stream.matchKeyword('NOT')) {
		if (stream.isKeyword('EXISTS')) {
			stream.next()
			return { op: 'notExists', query: parseSubSelect(stream, state) }
		}
		return { op: 'not', condition: parseNot(stream, state) }
	}
	return parsePrimaryCondition(stream, state)
}

function parsePrimaryCondition(stream: TokenStream, state: TParseState): Condition {
	if (stream.matchKeyword('EXISTS')) {
		return { op: 'exists', query: parseSubSelect(stream, state) }
	}
	if (stream.isPunct('(')) {
		const start = stream.position
		stream.next()
		if (stream.isKeyword('SELECT')) {
			stream.reset(start)
			unsupported('scalar subqueries are only supported inside EXISTS', stream.line)
		}
		const condition = parseCondition(stream, state)
		stream.expectPunct(')')
		return condition
	}
	return parseComparison(stream, state)
}

function parseSubSelect(stream: TokenStream, state: TParseState): SelectQuery {
	stream.expectPunct('(')
	state.depth += 1
	const inner = parseSelect(stream, state)
	state.depth -= 1
	stream.expectPunct(')')
	return inner
}

const COMPARISON_PUNCT: Record<string, 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte'> = {
	'=': 'eq',
	'!=': 'ne',
	'<>': 'ne',
	'<': 'lt',
	'<=': 'lte',
	'>': 'gt',
	'>=': 'gte'
}

function parseComparison(stream: TokenStream, state: TParseState): Condition {
	const line = stream.line
	if (!stream.isIdentifier()) {
		unsupported(`unsupported condition operand ${describe(stream.peek())}`, line)
	}
	if (stream.isPunct('(', 1)) {
		unsupported(
			`function calls in conditions are not supported ("${stream.peek().value}()")`,
			line
		)
	}
	const column = parseColumnRef(stream, state)

	if (stream.matchKeyword('IS')) {
		const negated = stream.matchKeyword('NOT')
		stream.expectKeyword('NULL')
		return { op: negated ? 'isNotNull' : 'isNull', column }
	}

	const negated = stream.matchKeyword('NOT')

	if (stream.matchKeyword('IN')) {
		stream.expectPunct('(')
		if (stream.isKeyword('SELECT')) {
			unsupported('IN (SELECT …) is not supported; use EXISTS', stream.line)
		}
		const values: QueryValue[] = []
		do {
			values.push(parseValue(stream))
		} while (stream.matchPunct(','))
		stream.expectPunct(')')
		return { op: negated ? 'notInArray' : 'inArray', column, values }
	}

	if (stream.matchKeyword('BETWEEN')) {
		const low = parseValue(stream)
		stream.expectKeyword('AND')
		const high = parseValue(stream)
		return { op: negated ? 'notBetween' : 'between', column, low, high }
	}

	if (stream.matchKeyword('LIKE')) {
		const value = parseValue(stream)
		const condition: Condition = { op: 'like', column, value }
		return negated ? { op: 'not', condition } : condition
	}

	if (stream.matchKeyword('ILIKE')) {
		if (state.dialect !== 'postgres') {
			state.warnings.push(
				'ilike() is a Postgres operator; it has no equivalent in this dialect'
			)
		}
		const value = parseValue(stream)
		const condition: Condition = { op: 'ilike', column, value }
		return negated ? { op: 'not', condition } : condition
	}

	if (negated) {
		unsupported(`NOT must be followed by IN, BETWEEN, LIKE or ILIKE`, stream.line)
	}

	const token = stream.peek()
	const op = token.kind === 'punct' ? COMPARISON_PUNCT[token.value] : undefined
	if (!op) {
		unsupported(`unsupported comparison operator ${describe(token)}`, token.line)
	}
	stream.next()
	const value = parseOperand(stream, state)
	return { op, column, value }
}

function parseOperand(
	stream: TokenStream,
	state: TParseState
): QueryValue | { kind: 'column'; ref: ColumnRef } {
	if (stream.isIdentifier() && !stream.isAnyKeyword(['TRUE', 'FALSE', 'NULL'])) {
		if (stream.isPunct('(', 1)) {
			unsupported(
				`function calls in conditions are not supported ("${stream.peek().value}()")`,
				stream.line
			)
		}
		return { kind: 'column', ref: parseColumnRef(stream, state) }
	}
	return parseValue(stream)
}

function parseValue(stream: TokenStream): QueryValue {
	const token = stream.peek()
	if (token.kind === 'string') {
		stream.next()
		return { kind: 'string', value: token.value }
	}
	if (token.kind === 'number') {
		stream.next()
		return { kind: 'number', value: Number(token.value) }
	}
	if (token.kind === 'param') {
		stream.next()
		return { kind: 'param', name: token.value }
	}
	if (stream.isPunct('-') && stream.peek(1).kind === 'number') {
		stream.next()
		return { kind: 'number', value: -Number(stream.next().value) }
	}
	if (stream.isKeyword('TRUE') || stream.isKeyword('FALSE')) {
		return { kind: 'boolean', value: stream.next().value.toUpperCase() === 'TRUE' }
	}
	if (stream.isKeyword('NULL')) {
		stream.next()
		return { kind: 'null' }
	}
	if (stream.isKeyword('DEFAULT')) {
		unsupported('DEFAULT as a value is not supported', token.line)
	}
	if (stream.isIdentifier() && stream.isPunct('(', 1)) {
		unsupported(`function calls in values are not supported ("${token.value}()")`, token.line)
	}
	if (stream.isKeyword('CURRENT_TIMESTAMP')) {
		unsupported(
			'CURRENT_TIMESTAMP as a value is not supported; bind it as a parameter',
			token.line
		)
	}
	return unsupported(`unsupported value ${describe(token)}`, token.line)
}

function parseColumnRef(stream: TokenStream, state: TParseState): ColumnRef {
	let qualifier: string | undefined
	let column = stream.identifier()
	if (stream.matchPunct('.')) {
		qualifier = column
		column = stream.identifier()
	}
	if (stream.matchPunct('.')) {
		qualifier = column
		column = stream.identifier()
	}
	const ref: ColumnRef = qualifier === undefined ? { column } : { table: qualifier, column }
	state.refs.push({ ref, depth: state.depth })
	return ref
}

/**
 * Rewrite alias qualifiers to real table names, and drop the qualifier for
 * single-table statements (the IR omits it there by contract). Refs inside an
 * EXISTS subquery keep theirs — they may be correlated to the outer table.
 */
function resolveRefs(state: TParseState, query: QueryIR): void {
	const strippable = query.kind !== 'select' || query.joins.length === 0

	for (const site of state.refs) {
		if (site.ref.table === undefined) {
			continue
		}
		const resolved = state.scope.get(site.ref.table)
		if (resolved === undefined) {
			parseError(`unknown table or alias "${site.ref.table}"`, 1)
		}
		site.ref.table = resolved
		if (strippable && site.depth === 0) {
			delete site.ref.table
		}
	}
}
