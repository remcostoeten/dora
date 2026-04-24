import { MarkerType, type Edge, type Node } from '@xyflow/react'
import { useMemo } from 'react'
import type { ColumnInfo, DatabaseSchema, IndexInfo, TableInfo } from '@/lib/bindings'

export type SearchState = 'default' | 'match' | 'context' | 'dim'

export type TableNodeData = {
	tableId: string
	tableName: string
	schema: string
	columns: ColumnInfo[]
	primaryKeyColumns: string[]
	indexes: IndexInfo[]
	rowCountEstimate: number | null
	searchState: SearchState
	matchedColumns: string[]
}

export type RelationshipKind = 'one-to-many' | 'one-to-one' | 'many-to-many'

export type RelationshipEdgeData = {
	cardinality: '1:N' | '1:1' | 'N:M'
	descriptor: string
	sourceColumn: string
	targetColumn: string
	sourceTableName: string
	targetTableName: string
	relationKind: RelationshipKind
	viaTable?: string
	isOptional: boolean
	isSelfReference: boolean
	searchState: SearchState
}

type RelationshipEdge = Edge<RelationshipEdgeData, 'relationshipEdge'>

export type SearchSummary = {
	matchedTables: number
	relatedTables: number
	relationships: number
}

type SchemaGraph = {
	nodes: Node<TableNodeData>[]
	edges: RelationshipEdge[]
	searchSummary: SearchSummary | null
}

type BaseGraph = SchemaGraph & {
	directRelationMap: Map<string, Set<string>>
	tableLookup: Map<string, TableInfo>
}

type SearchQuery = {
	terms: string[]
	table?: string
	schema?: string
	column?: string
	type?: string
	flags: Set<string>
}

const NODE_WIDTH = 260
const ROW_HEIGHT = 24
const HEADER_HEIGHT = 36
const EPHEMERAL_JOIN_COLUMNS = new Set([
	'created_at',
	'updated_at',
	'deleted_at',
	'sort_order',
	'position',
])

export function getTableId(tableName: string, schemaName?: string | null) {
	return schemaName ? `${schemaName}.${tableName}` : tableName
}

function includesTerm(value: string | null | undefined, term: string) {
	return !!value && value.toLowerCase().includes(term)
}

function parseSearch(searchTerm: string): SearchQuery {
	const query: SearchQuery = { terms: [], flags: new Set() }
	searchTerm
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.forEach((part) => {
			const [key, ...valueParts] = part.split(':')
			const value = valueParts.join(':')
			if (value && ['table', 'schema', 'column', 'type'].includes(key)) {
				query[key as 'table' | 'schema' | 'column' | 'type'] = value
				return
			}
			if (['pk', 'fk', 'nullable', 'index', 'noindex'].includes(part)) {
				query.flags.add(part)
				return
			}
			query.terms.push(part)
		})
	return query
}

function columnIndexed(table: TableInfo, columnName: string) {
	return (
		table.primary_key_columns?.includes(columnName) ||
		table.indexes?.some((index) => index.column_names.includes(columnName)) ||
		false
	)
}

function isColumnUnique(
	table: TableInfo,
	columnName: string,
	globalUniqueColumns: Set<string>,
) {
	if (table.primary_key_columns?.includes(columnName)) return true
	if (
		table.indexes?.some(
			(index) =>
				(index.is_unique || index.is_primary) &&
				index.column_names.length === 1 &&
				index.column_names[0] === columnName,
		)
	) {
		return true
	}
	return (
		globalUniqueColumns.has(columnName) ||
		globalUniqueColumns.has(`${table.name}.${columnName}`) ||
		globalUniqueColumns.has(`${table.schema}.${table.name}.${columnName}`)
	)
}

function isJoinTable(table: TableInfo, fkColumns: ColumnInfo[]) {
	if (fkColumns.length < 2) return false
	const referencedTables = new Set(
		fkColumns.map((column) =>
			getTableId(
				column.foreign_key?.referenced_table ?? '',
				column.foreign_key?.referenced_schema,
			),
		),
	)
	if (referencedTables.size < 2) return false

	const significantColumns = table.columns.filter((column) => {
		if (column.foreign_key) return false
		if (table.primary_key_columns?.includes(column.name)) return false
		return !EPHEMERAL_JOIN_COLUMNS.has(column.name)
	})
	const hasCompositeJoinKey =
		table.indexes?.some(
			(index) =>
				(index.is_unique || index.is_primary) &&
				fkColumns.every((column) => index.column_names.includes(column.name)),
		) ?? false

	return significantColumns.length === 0 && hasCompositeJoinKey
}

function getTableMatches(table: TableInfo, search: SearchQuery, hasSearch: boolean) {
	if (!hasSearch) return { matches: true, matchedColumns: [] as string[] }
	if (search.table && !includesTerm(table.name, search.table)) {
		return { matches: false, matchedColumns: [] as string[] }
	}
	if (search.schema && !includesTerm(table.schema, search.schema)) {
		return { matches: false, matchedColumns: [] as string[] }
	}

	const matchedColumns = table.columns
		.filter((column) => {
			const isPk = column.is_primary_key || table.primary_key_columns?.includes(column.name)
			const isFk = Boolean(column.foreign_key)
			if (search.column && !includesTerm(column.name, search.column)) return false
			if (search.type && !includesTerm(column.data_type, search.type)) return false
			if (search.flags.has('pk') && !isPk) return false
			if (search.flags.has('fk') && !isFk) return false
			if (search.flags.has('nullable') && !column.is_nullable) return false
			if (search.flags.has('index') && !columnIndexed(table, column.name)) return false
			if (search.flags.has('noindex') && columnIndexed(table, column.name)) return false
			return search.terms.every(
				(term) =>
					includesTerm(column.name, term) ||
					includesTerm(column.data_type, term) ||
					includesTerm(column.foreign_key?.referenced_table, term) ||
					includesTerm(column.foreign_key?.referenced_column, term),
			)
		})
		.map((column) => column.name)

	const tableMatches = search.terms.every(
		(term) => includesTerm(table.name, term) || includesTerm(table.schema, term),
	)
	const columnOnlySearch =
		Boolean(search.column) ||
		Boolean(search.type) ||
		search.flags.size > 0

	return {
		matches: matchedColumns.length > 0 || (!columnOnlySearch && tableMatches),
		matchedColumns,
	}
}

function buildBaseGraph(schema: DatabaseSchema | null): BaseGraph {
	if (!schema || schema.tables.length === 0) {
		return {
			nodes: [],
			edges: [],
			searchSummary: null,
			directRelationMap: new Map(),
			tableLookup: new Map(),
		}
	}

	const tables = schema.tables
	const globalUniqueColumns = new Set(schema.unique_columns)
	const tableLookup = new Map(
		tables.map((table) => [getTableId(table.name, table.schema), table]),
	)
	const cols = Math.max(1, Math.ceil(Math.sqrt(tables.length)))
	const hGap = NODE_WIDTH + 72
	const rowHeights = Array.from({ length: Math.ceil(tables.length / cols) }, (_, row) => {
		const rowTables = tables.slice(row * cols, row * cols + cols)
		const tallestTable = Math.max(...rowTables.map((table) => table.columns.length), 1)
		return HEADER_HEIGHT + tallestTable * ROW_HEIGHT + 72
	})
	const rowOffsets = rowHeights.reduce<number[]>((offsets, height, index) => {
		offsets[index + 1] = offsets[index] + height
		return offsets
	}, [0])

	const directRelationMap = new Map<string, Set<string>>()
	tables.forEach((table) => {
		const sourceId = getTableId(table.name, table.schema)
		table.columns.forEach((column) => {
			if (!column.foreign_key) return
			const targetId = getTableId(
				column.foreign_key.referenced_table,
				column.foreign_key.referenced_schema,
			)
			if (!tableLookup.has(targetId)) return
			if (!directRelationMap.has(sourceId)) directRelationMap.set(sourceId, new Set())
			if (!directRelationMap.has(targetId)) directRelationMap.set(targetId, new Set())
			directRelationMap.get(sourceId)?.add(targetId)
			directRelationMap.get(targetId)?.add(sourceId)
		})
	})

	const nodes: Node<TableNodeData>[] = tables.map((table, index) => {
		const col = index % cols
		const row = Math.floor(index / cols)
		const tableId = getTableId(table.name, table.schema)
		return {
			id: tableId,
			type: 'tableNode',
			position: { x: col * hGap, y: rowOffsets[row] },
			data: {
				tableId,
				tableName: table.name,
				schema: table.schema,
				columns: table.columns,
				primaryKeyColumns: table.primary_key_columns ?? [],
				indexes: table.indexes ?? [],
				rowCountEstimate: table.row_count_estimate ?? null,
				searchState: 'default',
				matchedColumns: [],
			},
		}
	})

	const edges: RelationshipEdge[] = []
	tables.forEach((table) => {
		const tableId = getTableId(table.name, table.schema)
		const fkColumns = table.columns.filter((column) => column.foreign_key)
		const joinTable = isJoinTable(table, fkColumns)
		table.columns.forEach((column) => {
			if (!column.foreign_key) return
			const fk = column.foreign_key
			const targetTableId = getTableId(fk.referenced_table, fk.referenced_schema)
			const targetTable = tableLookup.get(targetTableId)
			if (!targetTable) return
			const uniqueSource = isColumnUnique(table, column.name, globalUniqueColumns)
			const relationKind: RelationshipKind = joinTable
				? 'many-to-many'
				: uniqueSource
					? 'one-to-one'
					: 'one-to-many'
			edges.push({
				id: `${tableId}-${column.name}->${targetTableId}-${fk.referenced_column}`,
				source: tableId,
				target: targetTableId,
				sourceHandle: `${tableId}__${column.name}__source`,
				targetHandle: `${targetTableId}__${fk.referenced_column}__target`,
				type: 'relationshipEdge',
				animated: false,
				markerEnd: {
					type: MarkerType.ArrowClosed,
					color: 'hsl(246 68% 64%)',
					width: 16,
					height: 16,
				},
				style: { stroke: 'hsl(246 68% 64%)', strokeWidth: 1.8 },
				data: {
					cardinality:
						relationKind === 'many-to-many'
							? 'N:M'
							: relationKind === 'one-to-one'
								? '1:1'
								: '1:N',
					descriptor: relationKind === 'many-to-many'
						? 'join table'
						: relationKind === 'one-to-one'
							? 'unique foreign key'
							: 'foreign key',
					sourceColumn: column.name,
					targetColumn: fk.referenced_column,
					sourceTableName: table.name,
					targetTableName: targetTable.name,
					relationKind,
					viaTable: joinTable ? table.name : undefined,
					isOptional: column.is_nullable,
					isSelfReference: tableId === targetTableId,
					searchState: 'default',
				},
			})
		})
	})

	return { nodes, edges, searchSummary: null, directRelationMap, tableLookup }
}

export function useSchemaGraph(
	schema: DatabaseSchema | null,
	searchTerm: string,
): SchemaGraph {
	const baseGraph = useMemo(() => buildBaseGraph(schema), [schema])

	return useMemo(() => {
		const search = parseSearch(searchTerm)
		const hasSearch =
			search.terms.length > 0 ||
			Boolean(search.table || search.schema || search.column || search.type) ||
			search.flags.size > 0
		if (!hasSearch) {
			return {
				nodes: baseGraph.nodes,
				edges: baseGraph.edges,
				searchSummary: null,
			}
		}

		const matchedTableIds = new Set<string>()
		const matchedColumnsByTable = new Map<string, string[]>()
		baseGraph.tableLookup.forEach((table, tableId) => {
			const matches = getTableMatches(table, search, hasSearch)
			if (matches.matches) matchedTableIds.add(tableId)
			matchedColumnsByTable.set(tableId, matches.matchedColumns)
		})

		const relatedTableIds = new Set<string>()
		matchedTableIds.forEach((tableId) => {
			baseGraph.directRelationMap.get(tableId)?.forEach((neighborId) => {
				if (!matchedTableIds.has(neighborId)) relatedTableIds.add(neighborId)
			})
		})

		const nodes = baseGraph.nodes.map((node) => {
			const searchState: SearchState = matchedTableIds.has(node.id)
				? 'match'
				: relatedTableIds.has(node.id)
					? 'context'
					: 'dim'
			return {
				...node,
				data: {
					...node.data,
					searchState,
					matchedColumns: matchedColumnsByTable.get(node.id) ?? [],
				},
			}
		})

		const edges = baseGraph.edges.map((edge) => {
			const searchState: SearchState =
				matchedTableIds.has(edge.source) || matchedTableIds.has(edge.target)
					? 'match'
					: relatedTableIds.has(edge.source) || relatedTableIds.has(edge.target)
						? 'context'
						: 'dim'
			return {
				...edge,
				data: edge.data ? { ...edge.data, searchState } : edge.data,
			}
		})

		return {
			nodes,
			edges,
			searchSummary: {
				matchedTables: matchedTableIds.size,
				relatedTables: relatedTableIds.size,
				relationships: edges.filter((edge) => edge.data?.searchState !== 'dim').length,
			},
		}
	}, [baseGraph, searchTerm])
}
