/**
 * QUERY surface of the Drizzle→SQL converter: parse a Drizzle query-builder
 * snippet into the contract's {@link QueryIR}.
 *
 * STATIC ONLY — the snippet is walked as a TypeScript AST (`ts.createSourceFile`)
 * and never executed, mirroring `parsers/drizzle/parse-drizzle-schema`. Anything
 * outside the supported surface (`.having()`, `sql``…``, set operations, …) is
 * reported as an `unsupported-construct` error naming the construct rather than
 * guessed at.
 */

import ts from 'typescript'
import {
	COMPARISON_OPERATORS,
	LOGICAL_OPERATORS,
	type ColumnRef,
	type Condition,
	type ConvertError,
	type DeleteQuery,
	type InsertQuery,
	type JoinKind,
	type OrderBy,
	type QueryIR,
	type QueryValue,
	type SelectQuery,
	type UpdateQuery,
} from '@studio/features/orm-cockpit/converters/contract'
import {
	collectTableSymbols,
	type TableSymbol,
} from '@studio/features/orm-cockpit/converters/drizzle-to-sql-symbols'

export type QueryParseResult =
	| { ok: true; query: QueryIR; warnings: string[] }
	| { ok: false; errors: ConvertError[] }

const QUERY_ROOTS = new Set(['db', 'tx'])

const JOIN_STEPS: Record<string, JoinKind> = {
	innerJoin: 'inner',
	leftJoin: 'left',
	rightJoin: 'right',
	fullJoin: 'full',
}

const COMPARISONS = new Set<string>(COMPARISON_OPERATORS)
const LOGICALS = new Set<string>(LOGICAL_OPERATORS)

type TStep = { name: string; args: ts.NodeArray<ts.Expression>; node: ts.CallExpression }

type TCtx = {
	source: ts.SourceFile
	symbols: Map<string, TableSymbol>
	errors: ConvertError[]
	warnings: string[]
}

/** True when the snippet contains a `db.`/`tx.` query-builder chain. */
export function hasQueryChain(source: ts.SourceFile): boolean {
	return findQueryChains(source).length > 0
}

/** Parse the first `db.`/`tx.` chain in `source` into a {@link QueryIR}. */
export function parseDrizzleQuery(source: ts.SourceFile): QueryParseResult {
	const chains = findQueryChains(source)
	if (chains.length === 0) {
		return {
			ok: false,
			errors: [{ code: 'parse-error', message: 'no Drizzle query-builder chain (`db.…`) was found' }],
		}
	}

	const ctx: TCtx = {
		source,
		symbols: collectTableSymbols(source),
		errors: [],
		warnings: [],
	}
	if (chains.length > 1) {
		ctx.warnings.push(
			`${chains.length} queries were found; only the first was converted.`,
		)
	}

	const query = parseChain(chains[0], ctx)
	if (!query || ctx.errors.length > 0) {
		return { ok: false, errors: ctx.errors.length > 0 ? ctx.errors : [unsupported('query', chains[0], ctx)] }
	}
	return { ok: true, query, warnings: ctx.warnings }
}

// ---------------------------------------------------------------------------
// Chain discovery
// ---------------------------------------------------------------------------

function findQueryChains(source: ts.SourceFile): ts.CallExpression[] {
	const found: ts.CallExpression[] = []

	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node) && chainRoot(node) !== null) {
			found.push(node)
			return
		}
		node.forEachChild(visit)
	}

	source.forEachChild(visit)
	return found
}

function chainRoot(call: ts.CallExpression): string | null {
	let current: ts.Node = call
	while (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) {
		current = current.expression
	}
	if (ts.isIdentifier(current) && QUERY_ROOTS.has(current.text)) {
		return current.text
	}
	return null
}

function unwindSteps(call: ts.CallExpression): TStep[] {
	const steps: TStep[] = []
	let current: ts.Expression = call
	while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
		steps.unshift({ name: current.expression.name.text, args: current.arguments, node: current })
		current = current.expression.expression
	}
	return steps
}

// ---------------------------------------------------------------------------
// Statement parsing
// ---------------------------------------------------------------------------

function parseChain(call: ts.CallExpression, ctx: TCtx): QueryIR | null {
	const steps = unwindSteps(call)
	if (steps.length === 0) {
		ctx.errors.push(unsupported('query shape', call, ctx))
		return null
	}

	switch (steps[0].name) {
		case 'select':
			return parseSelect(steps, ctx)
		case 'insert':
			return parseInsert(steps, ctx)
		case 'update':
			return parseUpdate(steps, ctx)
		case 'delete':
			return parseDelete(steps, ctx)
		default:
			ctx.errors.push(unsupported(`.${steps[0].name}()`, steps[0].node, ctx))
			return null
	}
}

function parseSelect(steps: TStep[], ctx: TCtx, isSubquery = false): SelectQuery | null {
	const query: SelectQuery = {
		kind: 'select',
		from: '',
		columns: [],
		joins: [],
		groupBy: [],
		orderBy: [],
	}

	for (const step of steps) {
		const join = JOIN_STEPS[step.name]
		if (join) {
			const table = tableName(step.args[0], ctx)
			const on = step.args[1] ? parseCondition(step.args[1], ctx) : null
			if (table === null || on === null) {
				return null
			}
			query.joins.push({ kind: join, table, on })
			continue
		}

		switch (step.name) {
			case 'select': {
				if (step.args.length === 0) {
					break
				}
				const columns = parseProjection(step.args[0], ctx)
				if (columns === null) {
					return null
				}
				query.columns = columns
				break
			}
			case 'from': {
				const table = tableName(step.args[0], ctx)
				if (table === null) {
					return null
				}
				query.from = table
				break
			}
			case 'where': {
				const where = parseCondition(step.args[0], ctx)
				if (where === null) {
					return null
				}
				query.where = where
				break
			}
			case 'groupBy': {
				for (const arg of step.args) {
					const ref = parseColumnRef(arg, ctx)
					if (ref === null) {
						return null
					}
					query.groupBy.push(ref)
				}
				break
			}
			case 'orderBy': {
				for (const arg of step.args) {
					const order = parseOrderBy(arg, ctx)
					if (order === null) {
						return null
					}
					query.orderBy.push(order)
				}
				break
			}
			case 'limit': {
				const n = integerArg(step, ctx)
				if (n === null) {
					return null
				}
				query.limit = n
				break
			}
			case 'offset': {
				const n = integerArg(step, ctx)
				if (n === null) {
					return null
				}
				query.offset = n
				break
			}
			default:
				ctx.errors.push(unsupported(`.${step.name}()`, step.node, ctx))
				return null
		}
	}

	if (query.from.length === 0) {
		ctx.errors.push({
			code: 'parse-error',
			message: 'select query has no .from() table',
		})
		return null
	}

	// A correlated subquery needs its qualifiers to tell inner from outer columns.
	return query.joins.length === 0 && !isSubquery ? stripSelectQualifiers(query) : query
}

function parseInsert(steps: TStep[], ctx: TCtx): InsertQuery | null {
	const into = tableName(steps[0].args[0], ctx)
	if (into === null) {
		return null
	}
	const query: InsertQuery = { kind: 'insert', into, rows: [], returning: [] }

	for (const step of steps.slice(1)) {
		switch (step.name) {
			case 'values': {
				const rows = parseInsertRows(step, ctx)
				if (rows === null) {
					return null
				}
				query.rows = rows
				break
			}
			case 'returning': {
				const returning = parseReturning(step, ctx)
				if (returning === null) {
					return null
				}
				query.returning = returning
				break
			}
			default:
				ctx.errors.push(unsupported(`.${step.name}()`, step.node, ctx))
				return null
		}
	}

	if (query.rows.length === 0) {
		ctx.errors.push({ code: 'parse-error', message: 'insert query has no .values() rows' })
		return null
	}
	return query
}

function parseUpdate(steps: TStep[], ctx: TCtx): UpdateQuery | null {
	const table = tableName(steps[0].args[0], ctx)
	if (table === null) {
		return null
	}
	const query: UpdateQuery = { kind: 'update', table, set: {}, returning: [] }

	for (const step of steps.slice(1)) {
		switch (step.name) {
			case 'set': {
				const assignments = parseAssignments(step.args[0], ctx)
				if (assignments === null) {
					return null
				}
				query.set = assignments
				break
			}
			case 'where': {
				const where = parseCondition(step.args[0], ctx)
				if (where === null) {
					return null
				}
				query.where = stripConditionQualifiers(where)
				break
			}
			case 'returning': {
				const returning = parseReturning(step, ctx)
				if (returning === null) {
					return null
				}
				query.returning = returning
				break
			}
			default:
				ctx.errors.push(unsupported(`.${step.name}()`, step.node, ctx))
				return null
		}
	}

	if (Object.keys(query.set).length === 0) {
		ctx.errors.push({ code: 'parse-error', message: 'update query has no .set() assignments' })
		return null
	}
	return query
}

function parseDelete(steps: TStep[], ctx: TCtx): DeleteQuery | null {
	const from = tableName(steps[0].args[0], ctx)
	if (from === null) {
		return null
	}
	const query: DeleteQuery = { kind: 'delete', from, returning: [] }

	for (const step of steps.slice(1)) {
		switch (step.name) {
			case 'where': {
				const where = parseCondition(step.args[0], ctx)
				if (where === null) {
					return null
				}
				query.where = stripConditionQualifiers(where)
				break
			}
			case 'returning': {
				const returning = parseReturning(step, ctx)
				if (returning === null) {
					return null
				}
				query.returning = returning
				break
			}
			default:
				ctx.errors.push(unsupported(`.${step.name}()`, step.node, ctx))
				return null
		}
	}
	return query
}

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

function parseProjection(arg: ts.Expression, ctx: TCtx): ColumnRef[] | null {
	if (!ts.isObjectLiteralExpression(arg)) {
		ctx.errors.push(unsupported('select() projection that is not an object literal', arg, ctx))
		return null
	}
	const columns: ColumnRef[] = []
	for (const prop of arg.properties) {
		if (ts.isShorthandPropertyAssignment(prop)) {
			ctx.errors.push(unsupported('shorthand select() projection entry', prop, ctx))
			return null
		}
		if (!ts.isPropertyAssignment(prop)) {
			ctx.errors.push(unsupported('non-standard select() projection entry', prop, ctx))
			return null
		}
		const ref = parseColumnRef(prop.initializer, ctx)
		if (ref === null) {
			return null
		}
		columns.push(ref)
	}
	return columns
}

function parseInsertRows(step: TStep, ctx: TCtx): Record<string, QueryValue>[] | null {
	const arg = step.args[0]
	if (!arg) {
		ctx.errors.push({ code: 'parse-error', message: '.values() was called without arguments' })
		return null
	}
	const literals = ts.isArrayLiteralExpression(arg) ? Array.from(arg.elements) : [arg]
	const rows: Record<string, QueryValue>[] = []
	for (const literal of literals) {
		const row = parseAssignments(literal, ctx)
		if (row === null) {
			return null
		}
		rows.push(row)
	}
	return rows
}

function parseAssignments(
	arg: ts.Expression | undefined,
	ctx: TCtx,
): Record<string, QueryValue> | null {
	if (!arg || !ts.isObjectLiteralExpression(arg)) {
		ctx.errors.push(unsupported('a values/set argument that is not an object literal', arg ?? ctx.source, ctx))
		return null
	}
	const out: Record<string, QueryValue> = {}
	for (const prop of arg.properties) {
		if (!ts.isPropertyAssignment(prop)) {
			ctx.errors.push(unsupported('non-standard values/set entry', prop, ctx))
			return null
		}
		const key = propertyName(prop.name)
		if (key === null) {
			ctx.errors.push(unsupported('a computed values/set key', prop, ctx))
			return null
		}
		const value = parseValue(prop.initializer, ctx)
		if (value === null) {
			return null
		}
		out[key] = value
	}
	return out
}

function parseReturning(step: TStep, ctx: TCtx): ColumnRef[] | null {
	if (step.args.length === 0) {
		return [{ column: '*' }]
	}
	const columns = parseProjection(step.args[0], ctx)
	if (columns === null) {
		return null
	}
	return columns.map(function (ref) {
		return { column: ref.column }
	})
}

function parseOrderBy(arg: ts.Expression, ctx: TCtx): OrderBy | null {
	if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
		const name = arg.expression.text
		if (name === 'asc' || name === 'desc') {
			const ref = parseColumnRef(arg.arguments[0], ctx)
			return ref === null ? null : { column: ref, direction: name }
		}
		ctx.errors.push(unsupported(`${name}() inside .orderBy()`, arg, ctx))
		return null
	}
	const ref = parseColumnRef(arg, ctx)
	return ref === null ? null : { column: ref, direction: 'asc' }
}

function parseCondition(arg: ts.Expression | undefined, ctx: TCtx): Condition | null {
	if (!arg) {
		ctx.errors.push({ code: 'parse-error', message: 'a condition was expected but missing' })
		return null
	}
	if (ts.isTaggedTemplateExpression(arg)) {
		ctx.errors.push(unsupported('sql`` template in a condition', arg, ctx))
		return null
	}
	if (!ts.isCallExpression(arg) || !ts.isIdentifier(arg.expression)) {
		ctx.errors.push(unsupported('a condition that is not an operator call', arg, ctx))
		return null
	}

	const op = arg.expression.text
	const args = arg.arguments

	if (LOGICALS.has(op)) {
		if (op === 'and' || op === 'or') {
			const conditions: Condition[] = []
			for (const child of args) {
				const parsed = parseCondition(child, ctx)
				if (parsed === null) {
					return null
				}
				conditions.push(parsed)
			}
			if (conditions.length === 0) {
				ctx.errors.push({ code: 'parse-error', message: `${op}() was called without conditions` })
				return null
			}
			return conditions.length === 1 ? conditions[0] : { op, conditions }
		}
		if (op === 'not') {
			const child = parseCondition(args[0], ctx)
			return child === null ? null : { op: 'not', condition: child }
		}
		const sub = parseSubquery(args[0], ctx)
		return sub === null ? null : { op: op as 'exists' | 'notExists', query: sub }
	}

	if (!COMPARISONS.has(op)) {
		ctx.errors.push(unsupported(`${op}()`, arg, ctx))
		return null
	}

	const column = parseColumnRef(args[0], ctx)
	if (column === null) {
		return null
	}

	if (op === 'isNull' || op === 'isNotNull') {
		return { op, column }
	}
	if (op === 'inArray' || op === 'notInArray') {
		const list = args[1]
		if (!list || !ts.isArrayLiteralExpression(list)) {
			ctx.errors.push(unsupported(`${op}() with a non-literal array`, list ?? arg, ctx))
			return null
		}
		const values: QueryValue[] = []
		for (const element of list.elements) {
			const value = parseValue(element, ctx)
			if (value === null) {
				return null
			}
			values.push(value)
		}
		return { op, column, values }
	}
	if (op === 'between' || op === 'notBetween') {
		const low = parseValue(args[1], ctx)
		const high = parseValue(args[2], ctx)
		if (low === null || high === null) {
			return null
		}
		return { op, column, low, high }
	}

	const right = parseComparisonValue(args[1], ctx)
	if (right === null) {
		return null
	}
	return {
		op: op as 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike',
		column,
		value: right,
	}
}

function parseSubquery(arg: ts.Expression | undefined, ctx: TCtx): SelectQuery | null {
	if (!arg || !ts.isCallExpression(arg) || chainRoot(arg) === null) {
		ctx.errors.push(unsupported('exists() without a db.select() subquery', arg ?? ctx.source, ctx))
		return null
	}
	const steps = unwindSteps(arg)
	if (steps.length === 0 || steps[0].name !== 'select') {
		ctx.errors.push(unsupported('exists() with a non-select subquery', arg, ctx))
		return null
	}
	return parseSelect(steps, ctx, true)
}

function parseComparisonValue(
	arg: ts.Expression | undefined,
	ctx: TCtx,
): QueryValue | { kind: 'column'; ref: ColumnRef } | null {
	// On the right of a comparison, `table.column` is the join-style column
	// reference; deeper accesses (`req.body.id`) are runtime values.
	if (arg && ts.isPropertyAccessExpression(arg) && ts.isIdentifier(arg.expression)) {
		const ref = parseColumnRef(arg, ctx)
		return ref === null ? null : { kind: 'column', ref }
	}
	return parseValue(arg, ctx)
}

function parseColumnRef(arg: ts.Expression | undefined, ctx: TCtx): ColumnRef | null {
	if (!arg) {
		ctx.errors.push({ code: 'parse-error', message: 'a column reference was expected but missing' })
		return null
	}
	if (!ts.isPropertyAccessExpression(arg) || !ts.isIdentifier(arg.expression)) {
		ctx.errors.push(unsupported('a column reference that is not `table.column`', arg, ctx))
		return null
	}
	const tableVar = arg.expression.text
	const columnKey = arg.name.text
	const symbol = ctx.symbols.get(tableVar)
	if (!symbol) {
		return { table: tableVar, column: columnKey }
	}
	return { table: symbol.table, column: symbol.columns.get(columnKey) ?? columnKey }
}

function parseValue(arg: ts.Expression | undefined, ctx: TCtx): QueryValue | null {
	if (!arg) {
		ctx.errors.push({ code: 'parse-error', message: 'a value was expected but missing' })
		return null
	}
	if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
		return { kind: 'string', value: arg.text }
	}
	if (ts.isNumericLiteral(arg)) {
		return { kind: 'number', value: Number(arg.text) }
	}
	if (ts.isPrefixUnaryExpression(arg) && ts.isNumericLiteral(arg.operand)) {
		const value = Number(arg.operand.text)
		return { kind: 'number', value: arg.operator === ts.SyntaxKind.MinusToken ? -value : value }
	}
	if (arg.kind === ts.SyntaxKind.TrueKeyword) {
		return { kind: 'boolean', value: true }
	}
	if (arg.kind === ts.SyntaxKind.FalseKeyword) {
		return { kind: 'boolean', value: false }
	}
	if (arg.kind === ts.SyntaxKind.NullKeyword) {
		return { kind: 'null' }
	}
	if (ts.isIdentifier(arg)) {
		return { kind: 'param', name: arg.text }
	}
	if (ts.isPropertyAccessExpression(arg)) {
		return { kind: 'param', name: nodeText(arg, ctx) }
	}
	if (ts.isTaggedTemplateExpression(arg)) {
		ctx.errors.push(unsupported('sql`` template as a value', arg, ctx))
		return null
	}
	ctx.errors.push(unsupported(`the expression \`${nodeText(arg, ctx)}\` as a value`, arg, ctx))
	return null
}

function tableName(arg: ts.Expression | undefined, ctx: TCtx): string | null {
	if (!arg) {
		ctx.errors.push({ code: 'parse-error', message: 'a table argument was expected but missing' })
		return null
	}
	if (!ts.isIdentifier(arg)) {
		ctx.errors.push(unsupported('a table argument that is not an identifier (subquery or alias)', arg, ctx))
		return null
	}
	return ctx.symbols.get(arg.text)?.table ?? arg.text
}

function integerArg(step: TStep, ctx: TCtx): number | null {
	const arg = step.args[0]
	if (arg && ts.isNumericLiteral(arg)) {
		return Number(arg.text)
	}
	ctx.errors.push(unsupported(`.${step.name}() with a non-literal argument`, arg ?? step.node, ctx))
	return null
}

// ---------------------------------------------------------------------------
// Qualifier stripping — the IR omits the table on single-table queries.
// ---------------------------------------------------------------------------

function stripSelectQualifiers(query: SelectQuery): SelectQuery {
	return {
		...query,
		columns: query.columns.map(stripRef),
		groupBy: query.groupBy.map(stripRef),
		orderBy: query.orderBy.map(function (o) {
			return { column: stripRef(o.column), direction: o.direction }
		}),
		where: query.where ? stripConditionQualifiers(query.where) : undefined,
	}
}

function stripConditionQualifiers(condition: Condition): Condition {
	switch (condition.op) {
		case 'and':
		case 'or':
			return { op: condition.op, conditions: condition.conditions.map(stripConditionQualifiers) }
		case 'not':
			return { op: 'not', condition: stripConditionQualifiers(condition.condition) }
		case 'exists':
		case 'notExists':
			return condition
		case 'isNull':
		case 'isNotNull':
			return { op: condition.op, column: stripRef(condition.column) }
		case 'inArray':
		case 'notInArray':
			return { op: condition.op, column: stripRef(condition.column), values: condition.values }
		case 'between':
		case 'notBetween':
			return {
				op: condition.op,
				column: stripRef(condition.column),
				low: condition.low,
				high: condition.high,
			}
		default:
			return {
				op: condition.op,
				column: stripRef(condition.column),
				value:
					condition.value.kind === 'column'
						? { kind: 'column', ref: stripRef(condition.value.ref) }
						: condition.value,
			}
	}
}

function stripRef(ref: ColumnRef): ColumnRef {
	return { column: ref.column }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unsupported(construct: string, node: ts.Node, ctx: TCtx): ConvertError {
	return {
		code: 'unsupported-construct',
		message: `${construct} is not supported`,
		line: lineOf(node, ctx),
	}
}

function lineOf(node: ts.Node, ctx: TCtx): number | undefined {
	try {
		return ctx.source.getLineAndCharacterOfPosition(node.getStart(ctx.source)).line + 1
	} catch {
		return undefined
	}
}

function nodeText(node: ts.Node, ctx: TCtx): string {
	try {
		return node.getText(ctx.source)
	} catch {
		return 'expression'
	}
}

function propertyName(name: ts.PropertyName): string | null {
	if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
		return name.text
	}
	return null
}
