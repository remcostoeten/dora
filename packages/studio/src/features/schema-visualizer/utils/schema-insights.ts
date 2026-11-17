import type { ColumnInfo, DatabaseSchema, TableInfo } from '@studio/lib/bindings'
import { convertSchemaToDrizzle } from '@studio/core/data-generation/sql-to-drizzle'
import type { RelationshipEdgeData, TableNodeData } from '../hooks/use-schema-graph'

export type CheckLevel = 'warn' | 'notice' | 'info' | 'ok'

export type TableCheck = {
	level: CheckLevel
	title: string
	body: string
	column?: string
}

type TableShape = Pick<TableNodeData, 'columns' | 'primaryKeyColumns' | 'indexes'>

/**
 * @name isPrimaryKeyColumn
 * @description Whether a column belongs to the table's primary key, from either the column flag or the key list.
 * @example isPrimaryKeyColumn(table, column) // true for users.id
 */
export function isPrimaryKeyColumn(table: TableShape, column: ColumnInfo) {
	return Boolean(column.is_primary_key) || table.primaryKeyColumns.includes(column.name)
}

/**
 * @name isIndexedColumn
 * @description Whether a column is the leading column of the primary key or of any index.
 * @example isIndexedColumn(table, column) // true for posts.author_id when an index covers it
 */
export function isIndexedColumn(table: TableShape, column: ColumnInfo) {
	if (table.primaryKeyColumns[0] === column.name) return true
	if (column.is_primary_key && table.primaryKeyColumns.length === 0) return true
	return table.indexes.some((index) => index.column_names[0] === column.name)
}

/**
 * @name formatCount
 * @description Count with a singular or plural noun.
 * @example formatCount(3, 'table') // '3 tables'
 */
export function formatCount(count: number, noun: string) {
	return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * @name getTableChecks
 * @description Structural warnings for one table: a missing primary key, unindexed foreign keys and missing indexes.
 * @example getTableChecks(table, { isOnlyTable: false })
 */
export function getTableChecks(
	table: TableNodeData,
	options: { hasRelationships: boolean; isOnlyTable: boolean }
): TableCheck[] {
	const checks: TableCheck[] = []
	if (!table.columns.some((column) => isPrimaryKeyColumn(table, column))) {
		checks.push({
			level: 'warn',
			title: 'No primary key',
			body: 'Dora can read this table, but cannot update or delete single rows safely.'
		})
	}
	table.columns.forEach((column) => {
		if (!column.foreign_key || isIndexedColumn(table, column)) return
		checks.push({
			level: 'notice',
			column: column.name,
			title: `${column.name} has no index`,
			body: `Joins from ${column.foreign_key.referenced_table} to ${table.tableName} scan the whole table.`
		})
	})
	if (options.isOnlyTable && !options.hasRelationships) {
		checks.push({
			level: 'info',
			title: 'No relationships',
			body: 'This table references nothing and nothing references it, so the map has no lines to draw.'
		})
	}
	if (
		table.columns.length > 0 &&
		!table.columns.some((column) => isIndexedColumn(table, column))
	) {
		checks.push({
			level: 'info',
			title: 'No indexes',
			body: 'Every lookup scans the full table.'
		})
	}
	return checks
}

export type TableRelations = {
	outgoing: RelationshipEdgeData[]
	incoming: RelationshipEdgeData[]
}

/**
 * @name getRelationsByTable
 * @description Outgoing and incoming relationships per table id.
 * @example getRelationsByTable(edges).get('public.users')?.incoming.length
 */
export function getRelationsByTable(
	edges: { source: string; target: string; data?: RelationshipEdgeData }[]
) {
	const relations = new Map<string, TableRelations>()
	function entry(id: string) {
		let value = relations.get(id)
		if (!value) {
			value = { outgoing: [], incoming: [] }
			relations.set(id, value)
		}
		return value
	}
	edges.forEach((edge) => {
		if (!edge.data) return
		entry(edge.source).outgoing.push(edge.data)
		entry(edge.target).incoming.push(edge.data)
	})
	return relations
}

function quoteIdentifier(name: string) {
	return `"${name.replace(/"/g, '""')}"`
}

/**
 * @name buildCreateTableSql
 * @description A readable CREATE TABLE statement for one table from its introspected columns, keys and indexes.
 * @example buildCreateTableSql(table)
 */
export function buildCreateTableSql(table: TableNodeData) {
	const lines = table.columns.map((column) => {
		const parts = [`  ${quoteIdentifier(column.name)} ${column.data_type}`]
		if (!column.is_nullable) parts.push('NOT NULL')
		if (column.default_value !== null && column.default_value !== '') {
			parts.push(`DEFAULT ${column.default_value}`)
		}
		if (column.foreign_key) {
			parts.push(
				`REFERENCES ${quoteIdentifier(column.foreign_key.referenced_table)} (${quoteIdentifier(column.foreign_key.referenced_column)})`
			)
		}
		return parts.join(' ')
	})
	const primaryKey = table.columns
		.filter((column) => isPrimaryKeyColumn(table, column))
		.map((column) => quoteIdentifier(column.name))
	if (primaryKey.length > 0) lines.push(`  PRIMARY KEY (${primaryKey.join(', ')})`)

	const qualifiedName =
		table.schema && table.schema !== 'main' && table.schema !== 'public'
			? `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.tableName)}`
			: quoteIdentifier(table.tableName)
	const indexes = table.indexes
		.filter((index) => !index.is_primary)
		.map(
			(index) =>
				`CREATE ${index.is_unique ? 'UNIQUE ' : ''}INDEX ${quoteIdentifier(index.name)} ON ${qualifiedName} (${index.column_names.map(quoteIdentifier).join(', ')});`
		)
	return [`CREATE TABLE ${qualifiedName} (\n${lines.join(',\n')}\n);`, ...indexes].join('\n\n')
}

/**
 * @name buildTableDrizzle
 * @description Drizzle schema source for a single table of the loaded schema.
 * @example buildTableDrizzle(schema, 'public.users')
 */
export function buildTableDrizzle(schema: DatabaseSchema, table: TableNodeData) {
	const match = schema.tables.find(
		(candidate: TableInfo) =>
			candidate.name === table.tableName && candidate.schema === table.schema
	)
	if (!match) return ''
	return convertSchemaToDrizzle({ ...schema, tables: [match] })
}
