import type { Edge, Node } from '@xyflow/react'
import { useMemo } from 'react'
import type { ColumnInfo, DatabaseSchema, IndexInfo, TableInfo } from '@studio/lib/bindings'

export type SearchState = 'default' | 'match' | 'context' | 'dim'
export type PulseState = 'idle' | 'insert' | 'update' | 'delete'
export type FocusState = 'none' | 'selected' | 'related' | 'dim'
export type SchemaHue = 'blue' | 'emerald' | 'orange' | 'purple' | 'red'

export type SchemaGroup = {
	id: string
	label: string
	hue: SchemaHue | null
	tableIds: string[]
}

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
	/** Live monitor pulse — set when the LiveMonitor detects a change on this table */
	pulseState: PulseState
	groupId: string
	groupLabel: string
	hue: SchemaHue | null
	width: number
	referenceHues: Record<string, SchemaHue | null>
	focusState: FocusState
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
	isActive: boolean
	isDimmed: boolean
	searchState: SearchState
	hue: SchemaHue | null
	sourceColumnIndex: number
	targetColumnIndex: number
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
	groups: SchemaGroup[]
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

export const NODE_HEADER_HEIGHT = 46
export const NODE_LIST_PADDING_TOP = 4
export const NODE_ROW_HEIGHT = 24
const NODE_LIST_PADDING_BOTTOM = 6
const COLUMN_GAP = 120
const STACK_GAP = 40
const GROUP_GAP = 120
const MAX_STACK = 6
const UNLINKED_PER_ROW = 4
const HUES: SchemaHue[] = ['blue', 'emerald', 'orange', 'purple', 'red']
const EPHEMERAL_JOIN_COLUMNS = new Set([
	'created_at',
	'updated_at',
	'deleted_at',
	'sort_order',
	'position'
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

function isColumnUnique(table: TableInfo, columnName: string, globalUniqueColumns: Set<string>) {
	if (table.primary_key_columns?.includes(columnName)) return true
	if (
		table.indexes?.some(
			(index) =>
				(index.is_unique || index.is_primary) &&
				index.column_names.length === 1 &&
				index.column_names[0] === columnName
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
				column.foreign_key?.referenced_schema
			)
		)
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
				fkColumns.every((column) => index.column_names.includes(column.name))
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
					includesTerm(column.foreign_key?.referenced_column, term)
			)
		})
		.map((column) => column.name)

	const tableMatches = search.terms.every(
		(term) => includesTerm(table.name, term) || includesTerm(table.schema, term)
	)
	const columnOnlySearch = Boolean(search.column) || Boolean(search.type) || search.flags.size > 0

	return {
		matches: matchedColumns.length > 0 || (!columnOnlySearch && tableMatches),
		matchedColumns
	}
}

/**
 * @name getNodeHeight
 * @description Height in pixels of a table node with the given column count, matching the node's CSS.
 * @example getNodeHeight(9) // 274
 */
export function getNodeHeight(columnCount: number) {
	return (
		NODE_HEADER_HEIGHT +
		NODE_LIST_PADDING_TOP +
		columnCount * NODE_ROW_HEIGHT +
		NODE_LIST_PADDING_BOTTOM +
		2
	)
}

function getNodeWidth(table: TableInfo) {
	const longestName = Math.max(0, ...table.columns.map((column) => column.name.length))
	const longestType = Math.max(
		0,
		...table.columns.map((column) => column.data_type.length + (column.is_nullable ? 1 : 0))
	)
	const header = table.name.length * 7.3 + 64
	return Math.round(
		Math.min(340, Math.max(232, 58 + longestName * 7 + longestType * 6.4, header))
	)
}

function getReferencedIds(table: TableInfo, tableLookup: Map<string, TableInfo>) {
	const selfId = getTableId(table.name, table.schema)
	const ids = new Set<string>()
	table.columns.forEach((column) => {
		if (!column.foreign_key) return
		const targetId = getTableId(
			column.foreign_key.referenced_table,
			column.foreign_key.referenced_schema
		)
		if (targetId !== selfId && tableLookup.has(targetId)) ids.add(targetId)
	})
	return ids
}

function buildGroups(tables: TableInfo[], tableLookup: Map<string, TableInfo>): SchemaGroup[] {
	const schemaNames = Array.from(new Set(tables.map((table) => table.schema || '')))
	if (schemaNames.length > 1) {
		return schemaNames.map((schemaName, index) => ({
			id: `schema:${schemaName}`,
			label: schemaName || 'default',
			hue: HUES[index % HUES.length],
			tableIds: tables
				.filter((table) => (table.schema || '') === schemaName)
				.map((table) => getTableId(table.name, table.schema))
		}))
	}

	const neighbors = new Map<string, Set<string>>()
	const incoming = new Map<string, number>()
	tables.forEach((table) => {
		const id = getTableId(table.name, table.schema)
		if (!neighbors.has(id)) neighbors.set(id, new Set())
		getReferencedIds(table, tableLookup).forEach((targetId) => {
			neighbors.get(id)?.add(targetId)
			if (!neighbors.has(targetId)) neighbors.set(targetId, new Set())
			neighbors.get(targetId)?.add(id)
			incoming.set(targetId, (incoming.get(targetId) ?? 0) + 1)
		})
	})

	const seen = new Set<string>()
	const components: string[][] = []
	const unlinked: string[] = []
	tables.forEach((table) => {
		const startId = getTableId(table.name, table.schema)
		if (seen.has(startId)) return
		const component: string[] = []
		const queue = [startId]
		seen.add(startId)
		while (queue.length > 0) {
			const id = queue.shift() as string
			component.push(id)
			neighbors.get(id)?.forEach((next) => {
				if (seen.has(next)) return
				seen.add(next)
				queue.push(next)
			})
		}
		if (component.length === 1) unlinked.push(startId)
		else components.push(component)
	})

	components.sort((a, b) => b.length - a.length)
	const groups: SchemaGroup[] = components.map((component, index) => {
		const hub = component.reduce((best, id) =>
			(incoming.get(id) ?? 0) > (incoming.get(best) ?? 0) ? id : best
		)
		return {
			id: `cluster:${hub}`,
			label: tableLookup.get(hub)?.name ?? hub,
			hue: HUES[index % HUES.length],
			tableIds: component
		}
	})
	if (unlinked.length > 0) {
		groups.push({ id: 'unlinked', label: 'Unlinked', hue: null, tableIds: unlinked })
	}
	return groups
}

function getDepths(ids: string[], tableLookup: Map<string, TableInfo>) {
	const inGroup = new Set(ids)
	const depths = new Map<string, number>()
	const visiting = new Set<string>()

	function visit(id: string): number {
		const known = depths.get(id)
		if (known !== undefined) return known
		if (visiting.has(id)) return 0
		visiting.add(id)
		const table = tableLookup.get(id)
		let depth = 0
		if (table) {
			getReferencedIds(table, tableLookup).forEach((targetId) => {
				if (inGroup.has(targetId)) depth = Math.max(depth, visit(targetId) + 1)
			})
		}
		visiting.delete(id)
		depths.set(id, depth)
		return depth
	}

	ids.forEach(visit)
	return depths
}

function layoutGroups(
	groups: SchemaGroup[],
	tableLookup: Map<string, TableInfo>,
	widths: Map<string, number>
) {
	const positions = new Map<string, { x: number; y: number }>()
	const heightOf = (id: string) => getNodeHeight(tableLookup.get(id)?.columns.length ?? 0)
	let top = 0

	groups.forEach((group) => {
		const columns: string[][] = []
		if (group.id === 'unlinked') {
			for (let index = 0; index < group.tableIds.length; index += UNLINKED_PER_ROW) {
				group.tableIds.slice(index, index + UNLINKED_PER_ROW).forEach((id, column) => {
					columns[column] = [...(columns[column] ?? []), id]
				})
			}
		} else {
			const depths = getDepths(group.tableIds, tableLookup)
			const byDepth: string[][] = []
			group.tableIds.forEach((id) => {
				const depth = depths.get(id) ?? 0
				byDepth[depth] = [...(byDepth[depth] ?? []), id]
			})
			byDepth.filter(Boolean).forEach((ids) => {
				for (let index = 0; index < ids.length; index += MAX_STACK) {
					columns.push(ids.slice(index, index + MAX_STACK))
				}
			})
		}

		let left = 0
		let bandHeight = 0
		columns.forEach((ids) => {
			let y = top
			let columnWidth = 0
			ids.forEach((id) => {
				positions.set(id, { x: left, y })
				y += heightOf(id) + STACK_GAP
				columnWidth = Math.max(columnWidth, widths.get(id) ?? 240)
			})
			bandHeight = Math.max(bandHeight, y - top - STACK_GAP)
			left += columnWidth + COLUMN_GAP
		})
		top += bandHeight + GROUP_GAP
	})

	return positions
}

function buildBaseGraph(schema: DatabaseSchema | null): BaseGraph {
	if (!schema || schema.tables.length === 0) {
		return {
			nodes: [],
			edges: [],
			groups: [],
			searchSummary: null,
			directRelationMap: new Map(),
			tableLookup: new Map()
		}
	}

	const tables = schema.tables
	const globalUniqueColumns = new Set(schema.unique_columns)
	const tableLookup = new Map(
		tables.map((table) => [getTableId(table.name, table.schema), table])
	)
	const directRelationMap = new Map<string, Set<string>>()
	tables.forEach((table) => {
		const sourceId = getTableId(table.name, table.schema)
		table.columns.forEach((column) => {
			if (!column.foreign_key) return
			const targetId = getTableId(
				column.foreign_key.referenced_table,
				column.foreign_key.referenced_schema
			)
			if (!tableLookup.has(targetId)) return
			if (!directRelationMap.has(sourceId)) directRelationMap.set(sourceId, new Set())
			if (!directRelationMap.has(targetId)) directRelationMap.set(targetId, new Set())
			directRelationMap.get(sourceId)?.add(targetId)
			directRelationMap.get(targetId)?.add(sourceId)
		})
	})

	const groups = buildGroups(tables, tableLookup)
	const tableGroup = new Map<string, SchemaGroup>()
	groups.forEach((group) => group.tableIds.forEach((id) => tableGroup.set(id, group)))
	const widths = new Map(
		tables.map((table) => [getTableId(table.name, table.schema), getNodeWidth(table)])
	)
	const positions = layoutGroups(groups, tableLookup, widths)

	const nodes: Node<TableNodeData>[] = tables.map((table) => {
		const tableId = getTableId(table.name, table.schema)
		const group = tableGroup.get(tableId)
		const referenceHues: Record<string, SchemaHue | null> = {}
		table.columns.forEach((column) => {
			if (!column.foreign_key) return
			const targetId = getTableId(
				column.foreign_key.referenced_table,
				column.foreign_key.referenced_schema
			)
			referenceHues[column.name] = tableGroup.get(targetId)?.hue ?? null
		})
		return {
			id: tableId,
			type: 'tableNode',
			position: positions.get(tableId) ?? { x: 0, y: 0 },
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
				pulseState: 'idle',
				groupId: group?.id ?? 'unlinked',
				groupLabel: group?.label ?? 'Unlinked',
				hue: group?.hue ?? null,
				width: widths.get(tableId) ?? 240,
				referenceHues,
				focusState: 'none'
			}
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
				data: {
					cardinality:
						relationKind === 'many-to-many'
							? 'N:M'
							: relationKind === 'one-to-one'
								? '1:1'
								: '1:N',
					descriptor:
						relationKind === 'many-to-many'
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
					isActive: false,
					isDimmed: false,
					searchState: 'default',
					hue: tableGroup.get(tableId)?.hue ?? null,
					sourceColumnIndex: table.columns.indexOf(column),
					targetColumnIndex: Math.max(
						0,
						targetTable.columns.findIndex(
							(targetColumn) => targetColumn.name === fk.referenced_column
						)
					)
				}
			})
		})
	})

	return { nodes, edges, groups, searchSummary: null, directRelationMap, tableLookup }
}

export function useSchemaGraph(schema: DatabaseSchema | null, searchTerm: string): SchemaGraph {
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
				groups: baseGraph.groups,
				searchSummary: null
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
					matchedColumns: matchedColumnsByTable.get(node.id) ?? []
				}
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
				data: edge.data ? { ...edge.data, searchState } : edge.data
			}
		})

		return {
			nodes,
			edges,
			groups: baseGraph.groups,
			searchSummary: {
				matchedTables: matchedTableIds.size,
				relatedTables: relatedTableIds.size,
				relationships: edges.filter((edge) => edge.data?.searchState !== 'dim').length
			}
		}
	}, [baseGraph, searchTerm])
}
