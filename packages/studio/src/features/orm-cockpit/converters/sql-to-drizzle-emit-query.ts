/**
 * {@link QueryIR} → Drizzle query-builder TypeScript.
 *
 * Emits the chain the Drizzle LSP already completes (`db.select().from(t)
 * .where(and(eq(...), ...))`) plus the `drizzle-orm` operator import the chain
 * needs. Table exports are assumed to be in scope — the IR carries table names,
 * not module paths.
 */

import type { Dialect } from '@studio/features/orm-cockpit/ir/types'
import type {
	ColumnRef,
	Condition,
	DeleteQuery,
	InsertQuery,
	JoinKind,
	QueryIR,
	QueryValue,
	SelectQuery,
	UpdateQuery
} from '@studio/features/orm-cockpit/converters/contract'
import {
	camelCase,
	propertyKey,
	quoteString,
	sortedImportList,
	tableVarName
} from '@studio/features/orm-cockpit/converters/sql-to-drizzle-naming'

const JOIN_METHODS: Record<JoinKind, string> = {
	inner: 'innerJoin',
	left: 'leftJoin',
	right: 'rightJoin',
	full: 'fullJoin'
}

type TQueryContext = {
	dialect: Dialect
	imports: Set<string>
	/** Table the unqualified column refs belong to. */
	scope: string
}

export function emitQuery(
	query: QueryIR,
	dialect: Dialect,
	warnings: string[]
): { output: string; warnings: string[] } {
	const context: TQueryContext = { dialect, imports: new Set(), scope: primaryTable(query) }
	const chain = emitChain(query, context)
	const imports = sortedImportList(context.imports)
	const header =
		imports.length > 0 ? `import { ${imports.join(', ')} } from 'drizzle-orm'\n\n` : ''
	return { output: `${header}${chain}\n`, warnings }
}

function primaryTable(query: QueryIR): string {
	switch (query.kind) {
		case 'select':
			return query.from
		case 'insert':
			return query.into
		case 'update':
			return query.table
		case 'delete':
			return query.from
	}
}

function emitChain(query: QueryIR, context: TQueryContext): string {
	switch (query.kind) {
		case 'select':
			return joinChain(selectParts(query, context))
		case 'insert':
			return joinChain(insertParts(query, context))
		case 'update':
			return joinChain(updateParts(query, context))
		case 'delete':
			return joinChain(deleteParts(query, context))
	}
}

/** First two segments stay on the head line; the rest are indented one tab. */
function joinChain(parts: string[]): string {
	if (parts.length <= 2) {
		return parts.join('')
	}
	return `${parts[0]}${parts[1]}\n${parts
		.slice(2)
		.map((part) => `\t${part}`)
		.join('\n')}`
}

function selectParts(query: SelectQuery, context: TQueryContext): string[] {
	const previousScope = context.scope
	context.scope = query.from

	const projection =
		query.columns.length === 0
			? 'db.select()'
			: `db.select({ ${query.columns.map((ref) => `${propertyKey(camelCase(ref.column))}: ${columnExpression(ref, context)}`).join(', ')} })`

	const parts = [projection, `.from(${tableVarName(query.from)})`]

	for (const join of query.joins) {
		parts.push(
			`.${JOIN_METHODS[join.kind]}(${tableVarName(join.table)}, ${emitCondition(join.on, context)})`
		)
	}
	if (query.where) {
		parts.push(`.where(${emitCondition(query.where, context)})`)
	}
	if (query.groupBy.length > 0) {
		parts.push(
			`.groupBy(${query.groupBy.map((ref) => columnExpression(ref, context)).join(', ')})`
		)
	}
	if (query.orderBy.length > 0) {
		const terms = query.orderBy.map(function (entry) {
			context.imports.add(entry.direction)
			return `${entry.direction}(${columnExpression(entry.column, context)})`
		})
		parts.push(`.orderBy(${terms.join(', ')})`)
	}
	if (query.limit !== undefined) {
		parts.push(`.limit(${query.limit})`)
	}
	if (query.offset !== undefined) {
		parts.push(`.offset(${query.offset})`)
	}

	context.scope = previousScope
	return parts
}

function insertParts(query: InsertQuery, context: TQueryContext): string[] {
	const rows = query.rows.map(function (row) {
		return emitRow(row)
	})
	const values = rows.length === 1 ? rows[0] : `[${rows.join(', ')}]`
	const parts = [`db.insert(${tableVarName(query.into)})`, `.values(${values})`]
	appendReturning(parts, query.returning, context)
	return parts
}

function updateParts(query: UpdateQuery, context: TQueryContext): string[] {
	const parts = [`db.update(${tableVarName(query.table)})`, `.set(${emitRow(query.set)})`]
	if (query.where) {
		parts.push(`.where(${emitCondition(query.where, context)})`)
	}
	appendReturning(parts, query.returning, context)
	return parts
}

function deleteParts(query: DeleteQuery, context: TQueryContext): string[] {
	const parts = [`db.delete(${tableVarName(query.from)})`]
	if (query.where) {
		parts.push(`.where(${emitCondition(query.where, context)})`)
	}
	appendReturning(parts, query.returning, context)
	return parts
}

function appendReturning(parts: string[], returning: ColumnRef[], context: TQueryContext): void {
	if (returning.length === 0) {
		return
	}
	if (returning.length === 1 && returning[0].column === '*') {
		parts.push('.returning()')
		return
	}
	const entries = returning.map(function (ref) {
		return `${propertyKey(camelCase(ref.column))}: ${columnExpression(ref, context)}`
	})
	parts.push(`.returning({ ${entries.join(', ')} })`)
}

function emitRow(row: Record<string, QueryValue>): string {
	const entries = Object.entries(row).map(function ([column, value]) {
		return `${propertyKey(camelCase(column))}: ${emitValue(value)}`
	})
	return `{ ${entries.join(', ')} }`
}

function columnExpression(ref: ColumnRef, context: TQueryContext): string {
	return `${tableVarName(ref.table ?? context.scope)}.${camelCase(ref.column)}`
}

function emitValue(value: QueryValue): string {
	switch (value.kind) {
		case 'string':
			return quoteString(value.value)
		case 'number':
			return String(value.value)
		case 'boolean':
			return String(value.value)
		case 'null':
			return 'null'
		case 'param':
			return value.name
	}
}

function emitCondition(condition: Condition, context: TQueryContext): string {
	context.imports.add(condition.op)

	switch (condition.op) {
		case 'and':
		case 'or':
			return `${condition.op}(${condition.conditions.map((child) => emitCondition(child, context)).join(', ')})`
		case 'not':
			return `not(${emitCondition(condition.condition, context)})`
		case 'exists':
		case 'notExists':
			return `${condition.op}(${joinChain(selectParts(condition.query, context)).replace(/\n\t/g, '')})`
		case 'isNull':
		case 'isNotNull':
			return `${condition.op}(${columnExpression(condition.column, context)})`
		case 'inArray':
		case 'notInArray':
			return `${condition.op}(${columnExpression(condition.column, context)}, [${condition.values.map(emitValue).join(', ')}])`
		case 'between':
		case 'notBetween':
			return `${condition.op}(${columnExpression(condition.column, context)}, ${emitValue(condition.low)}, ${emitValue(condition.high)})`
		default:
			return `${condition.op}(${columnExpression(condition.column, context)}, ${
				condition.value.kind === 'column'
					? columnExpression(condition.value.ref, context)
					: emitValue(condition.value)
			})`
	}
}
