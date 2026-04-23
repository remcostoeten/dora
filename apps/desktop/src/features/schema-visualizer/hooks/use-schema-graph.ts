import { useMemo } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { ColumnInfo, DatabaseSchema } from '@/lib/bindings'

export type TableNodeData = {
	tableName: string
	schema: string
	columns: ColumnInfo[]
	primaryKeyColumns: string[]
	rowCountEstimate: number | null
}

type SchemaGraph = {
	nodes: Node<TableNodeData>[]
	edges: Edge[]
}

const NODE_WIDTH = 280
const ROW_HEIGHT = 24
const HEADER_HEIGHT = 48

export function useSchemaGraph(
	schema: DatabaseSchema | null,
	searchTerm: string,
): SchemaGraph {
	return useMemo(function buildGraph(): SchemaGraph {
		if (!schema || schema.tables.length === 0) {
			return { nodes: [], edges: [] }
		}

		const tables = schema.tables
		const cols = Math.max(1, Math.ceil(Math.sqrt(tables.length)))
		const maxColumnsPerTable = Math.max(
			...tables.map((t) => t.columns.length),
			1,
		)
		const hGap = NODE_WIDTH + 80
		const vGap = HEADER_HEIGHT + maxColumnsPerTable * ROW_HEIGHT + 60

		const term = searchTerm.trim().toLowerCase()
		const nodes: Node<TableNodeData>[] = tables.map(function (table, i) {
			const col = i % cols
			const row = Math.floor(i / cols)
			const matches = term ? table.name.toLowerCase().includes(term) : true

			return {
				id: table.name,
				type: 'tableNode',
				position: { x: col * hGap, y: row * vGap },
				data: {
					tableName: table.name,
					schema: table.schema,
					columns: table.columns,
					primaryKeyColumns: table.primary_key_columns,
					rowCountEstimate: table.row_count_estimate,
				},
				hidden: !matches,
			}
		})

		const edges: Edge[] = []
		tables.forEach(function (table) {
			table.columns.forEach(function (column) {
				if (!column.foreign_key) return
				const fk = column.foreign_key
				const targetTable = tables.find(
					(t) => t.name === fk.referenced_table,
				)
				if (!targetTable) return

				edges.push({
					id: `${table.name}-${column.name}->${fk.referenced_table}-${fk.referenced_column}`,
					source: table.name,
					target: fk.referenced_table,
					sourceHandle: `${table.name}__${column.name}__source`,
					targetHandle: `${fk.referenced_table}__${fk.referenced_column}__target`,
					type: 'smoothstep',
					animated: false,
					label: column.name,
					labelStyle: { fontSize: 10 },
					labelBgPadding: [4, 2],
					labelBgStyle: {
						fill: 'var(--sidebar)',
						stroke: 'var(--sidebar-border)',
						strokeWidth: 1,
					},
					style: { stroke: 'var(--primary)', strokeWidth: 1.5 },
				})
			})
		})

		return { nodes, edges }
	}, [schema, searchTerm])
}
