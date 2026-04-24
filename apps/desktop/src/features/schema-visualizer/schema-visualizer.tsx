import {
	Background,
	Controls,
	type EdgeTypes,
	MiniMap,
	ReactFlow,
	ReactFlowProvider,
	useEdgesState,
	useNodesState,
	type Edge,
	type Node,
	type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Network, AlertCircle } from 'lucide-react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { convertSchemaToDrizzle } from '@/core/data-generation/sql-to-drizzle'
import { useAdapter } from '@/core/data-provider'
import { getAdapterError } from '@/core/data-provider/types'
import type { DatabaseSchema } from '@/lib/bindings'
import { EmptyState } from '@/shared/ui/empty-state'
import { getTableRefId } from '@/shared/utils/table-ref'
import { RelationshipEdge } from './components/relationship-edge'
import { SchemaDetailsPanel } from './components/schema-details-panel'
import { TableNode } from './components/table-node'
import { SchemaToolbar } from './components/schema-toolbar'
import {
	useSchemaGraph,
	type RelationshipEdgeData,
	type TableNodeData,
} from './hooks/use-schema-graph'

type Props = {
	activeConnectionId: string | undefined
	onOpenTable?: (tableId: string, tableName: string) => void
}

const NODE_TYPES: NodeTypes = {
	tableNode: TableNode,
}

const EDGE_TYPES: EdgeTypes = {
	relationshipEdge: RelationshipEdge,
}

function downloadTextFile(filename: string, content: string, type: string) {
	const blob = new Blob([content], { type })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = filename
	a.click()
	URL.revokeObjectURL(url)
}

function escapeXml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

function buildDiagramSvg(
	nodes: Node<TableNodeData>[],
	edges: Edge<RelationshipEdgeData>[],
) {
	const nodeWidth = 260
	const headerHeight = 34
	const rowHeight = 24
	const padding = 80
	const nodeHeights = new Map(
		nodes.map((node) => [
			node.id,
			headerHeight + node.data.columns.length * rowHeight,
		]),
	)
	const minX = Math.min(...nodes.map((node) => node.position.x), 0)
	const minY = Math.min(...nodes.map((node) => node.position.y), 0)
	const maxX = Math.max(...nodes.map((node) => node.position.x + nodeWidth), nodeWidth)
	const maxY = Math.max(
		...nodes.map((node) => node.position.y + (nodeHeights.get(node.id) ?? 120)),
		120,
	)
	const width = maxX - minX + padding * 2
	const height = maxY - minY + padding * 2
	const offsetX = padding - minX
	const offsetY = padding - minY
	const nodeLookup = new Map(nodes.map((node) => [node.id, node]))

	const edgeMarkup = edges
		.map((edge) => {
			const source = nodeLookup.get(edge.source)
			const target = nodeLookup.get(edge.target)
			if (!source || !target) return ''
			const sourceHeight = nodeHeights.get(source.id) ?? 120
			const targetHeight = nodeHeights.get(target.id) ?? 120
			const x1 = source.position.x + offsetX + nodeWidth
			const y1 = source.position.y + offsetY + sourceHeight / 2
			const x2 = target.position.x + offsetX
			const y2 = target.position.y + offsetY + targetHeight / 2
			const midX = x1 + (x2 - x1) / 2
			return `<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" fill="none" stroke="#7c6ff6" stroke-opacity="0.66" stroke-width="1.8" />`
		})
		.join('')

	const nodeMarkup = nodes
		.map((node) => {
			const x = node.position.x + offsetX
			const y = node.position.y + offsetY
			const height = nodeHeights.get(node.id) ?? 120
			const rows = node.data.columns
				.map((column, index) => {
					const rowY = y + headerHeight + index * rowHeight
					return `<text x="${x + 14}" y="${rowY + 16}" fill="#d7d7dd" font-family="monospace" font-size="11">${escapeXml(column.name)}</text><text x="${x + nodeWidth - 14}" y="${rowY + 16}" fill="#85858f" text-anchor="end" font-family="monospace" font-size="10">${escapeXml(column.data_type)}</text>`
				})
				.join('')
			return `<g><rect x="${x}" y="${y}" width="${nodeWidth}" height="${height}" rx="6" fill="#17171d" stroke="#33333b"/><rect x="${x}" y="${y}" width="${nodeWidth}" height="${headerHeight}" rx="6" fill="#202029"/><text x="${x + 14}" y="${y + 22}" fill="#f1f1f3" font-family="system-ui, sans-serif" font-size="12" font-weight="600">${escapeXml(node.data.tableName)}</text>${rows}</g>`
		})
		.join('')

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#0f0f14"/>${edgeMarkup}${nodeMarkup}</svg>`
}

function SchemaVisualizerInner({ activeConnectionId, onOpenTable }: Props) {
	const adapter = useAdapter()
	const { toast } = useToast()
	const [schema, setSchema] = useState<DatabaseSchema | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const deferredSearch = useDeferredValue(search)
	const [showMinimap, setShowMinimap] = useState(true)
	const [editMode, setEditMode] = useState(false)
	const [selectedTable, setSelectedTable] = useState<TableNodeData | null>(null)
	const [sqlSource, setSqlSource] = useState('')

	const fetchSchema = useCallback(
		async (signal: AbortSignal) => {
			if (signal.aborted) {
				return
			}

			if (!activeConnectionId) {
				// Clear schema when there is no active connection, but avoid updates on unmounted/aborted
				if (!signal.aborted) {
					setSchema(null)
					setError(null)
					setIsLoading(false)
				}
				return
			}

			if (signal.aborted) {
				return
			}

			setIsLoading(true)
			setError(null)

			try {
				await adapter.connectToDatabase(activeConnectionId)
				if (signal.aborted) {
					return
				}

				const res = await adapter.getSchema(activeConnectionId)
				if (signal.aborted) {
					return
				}

				if (res.ok) {
					setSchema(res.data)
				} else {
					setError(getAdapterError(res))
				}
			} catch (e) {
				if (!signal.aborted) {
					setError(e instanceof Error ? e.message : String(e))
				}
			} finally {
				if (!signal.aborted) {
					setIsLoading(false)
				}
			}
		},
		[activeConnectionId, adapter],
	)

	useEffect(() => {
		const controller = new AbortController()

		void fetchSchema(controller.signal)

		return () => {
			controller.abort()
		}
	}, [fetchSchema])

	const {
		nodes: graphNodes,
		edges: graphEdges,
		searchSummary,
	} = useSchemaGraph(schema, deferredSearch)
	const positionStorageKey = activeConnectionId
		? `dora:schema-visualizer:positions:${activeConnectionId}`
		: null
	const positionedGraphNodes = useMemo(() => {
		if (!positionStorageKey) return graphNodes
		try {
			const raw = localStorage.getItem(positionStorageKey)
			if (!raw) return graphNodes
			const positions = JSON.parse(raw) as Record<string, { x: number; y: number }>
			return graphNodes.map((node) => ({
				...node,
				position: positions[node.id] ?? node.position,
			}))
		} catch {
			return graphNodes
		}
	}, [graphNodes, positionStorageKey])

	const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(positionedGraphNodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState<
		Edge<RelationshipEdgeData>
	>(graphEdges)

	useEffect(() => {
		setNodes(positionedGraphNodes)
	}, [positionedGraphNodes, setNodes])

	useEffect(() => {
		setEdges(graphEdges)
	}, [graphEdges, setEdges])

	useEffect(() => {
		if (!selectedTable) return
		const nextTable = positionedGraphNodes.find((node) => node.id === selectedTable.tableId)
		setSelectedTable(nextTable?.data ?? null)
	}, [positionedGraphNodes, selectedTable?.tableId])

	useEffect(() => {
		if (!activeConnectionId || !selectedTable) {
			setSqlSource('')
			return
		}
		let cancelled = false
		adapter.getDatabaseDDL(activeConnectionId).then((result) => {
			if (cancelled) return
			setSqlSource(result.ok ? result.data : '')
		})
		return () => {
			cancelled = true
		}
	}, [activeConnectionId, adapter, selectedTable])

	const visibleCounts = useMemo(() => {
		if (searchSummary) {
			return {
				tables: searchSummary.matchedTables,
				relatedTables: searchSummary.relatedTables,
				edges: searchSummary.relationships,
				isSearchResult: true,
			}
		}

		return {
			tables: nodes.length,
			relatedTables: 0,
			edges: edges.length,
			isSearchResult: false,
		}
	}, [nodes.length, edges.length, searchSummary])

	function handleExportJson() {
		if (!schema) return
		downloadTextFile('schema.json', JSON.stringify(schema, null, 2), 'application/json')
	}

	function handleExportSvg() {
		downloadTextFile('schema-diagram.svg', buildDiagramSvg(nodes, edges), 'image/svg+xml')
	}

	async function handleExportPng() {
		const svg = buildDiagramSvg(nodes, edges)
		const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
		const image = new Image()
		image.onload = function () {
			const canvas = document.createElement('canvas')
			canvas.width = image.width
			canvas.height = image.height
			const context = canvas.getContext('2d')
			context?.drawImage(image, 0, 0)
			URL.revokeObjectURL(url)
			canvas.toBlob(function (blob) {
				if (!blob) return
				const pngUrl = URL.createObjectURL(blob)
				const a = document.createElement('a')
				a.href = pngUrl
				a.download = 'schema-diagram.png'
				a.click()
				URL.revokeObjectURL(pngUrl)
			}, 'image/png')
		}
		image.src = url
	}

	async function handleExportSql() {
		if (!activeConnectionId) return
		const result = await adapter.getDatabaseDDL(activeConnectionId)
		if (!result.ok) {
			toast({ title: 'Export failed', description: getAdapterError(result), variant: 'destructive' })
			return
		}
		downloadTextFile('schema.sql', result.data, 'text/sql')
	}

	function handleExportDrizzle() {
		if (!schema) return
		downloadTextFile('schema.ts', convertSchemaToDrizzle(schema), 'text/typescript')
	}

	function handleCopySql() {
		if (!sqlSource) return
		navigator.clipboard.writeText(sqlSource)
		toast({ title: 'SQL copied' })
	}

	function handleCopyDrizzle() {
		if (!schema) return
		navigator.clipboard.writeText(convertSchemaToDrizzle(schema))
		toast({ title: 'Drizzle schema copied' })
	}

	function handleOpenSelectedTable() {
		if (!selectedTable) return
		const tableId = getTableRefId({
			name: selectedTable.tableName,
			schema: selectedTable.schema || null,
		})
		onOpenTable?.(tableId, selectedTable.tableName)
	}

	function handlePersistNodePositions(nextNodes: Node<TableNodeData>[]) {
		if (!positionStorageKey) return
		const positions = nextNodes.reduce<Record<string, { x: number; y: number }>>(
			(acc, node) => {
				acc[node.id] = node.position
				return acc
			},
			{},
		)
		localStorage.setItem(positionStorageKey, JSON.stringify(positions))
	}

	if (!activeConnectionId) {
		return (
			<EmptyState
				icon={<Network className='h-16 w-16' />}
				title='No Connection'
				description='Select a database connection to visualize its schema.'
			/>
		)
	}

	return (
		<div className='schema-visualizer flex flex-col h-full bg-background'>
			<SchemaToolbar
				search={search}
				onSearchChange={setSearch}
				showMinimap={showMinimap}
				onToggleMinimap={() => setShowMinimap((v) => !v)}
				editMode={editMode}
				onToggleEditMode={() => setEditMode((value) => !value)}
				onRefresh={fetchSchema}
				onExportJson={handleExportJson}
				onExportSvg={handleExportSvg}
				onExportPng={handleExportPng}
				onExportSql={handleExportSql}
				onExportDrizzle={handleExportDrizzle}
				tableCount={visibleCounts.tables}
				relatedTableCount={visibleCounts.relatedTables}
				edgeCount={visibleCounts.edges}
				isSearchResult={visibleCounts.isSearchResult}
				isLoading={isLoading}
			/>

			<div className='flex-1 relative'>
				{error ? (
					<div className='flex items-center justify-center h-full p-4'>
						<div className='inline-flex items-center gap-2 text-destructive text-sm font-mono bg-destructive/10 px-4 py-3 rounded-md border border-destructive/20 max-w-lg'>
							<AlertCircle className='h-4 w-4 shrink-0' />
							<span>{error}</span>
						</div>
					</div>
				) : !schema || schema.tables.length === 0 ? (
					isLoading ? (
						<div className='flex items-center justify-center h-full text-muted-foreground text-sm'>
							Loading schema...
						</div>
					) : (
						<EmptyState
							icon={<Network className='h-16 w-16' />}
							title='No Tables'
							description='This database has no tables to visualize.'
						/>
					)
				) : (
					<ReactFlow
						nodes={nodes}
						edges={edges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onNodeClick={(_, node) => setSelectedTable(node.data as TableNodeData)}
						onNodeDragStop={(_, __, nextNodes) =>
							handlePersistNodePositions(nextNodes ?? nodes)
						}
						onPaneClick={() => setSelectedTable(null)}
						nodeTypes={NODE_TYPES}
						edgeTypes={EDGE_TYPES}
						nodesDraggable={editMode}
						onlyRenderVisibleElements
						fitView
						fitViewOptions={{ padding: 0.12 }}
						minZoom={0.1}
						maxZoom={2}
						proOptions={{ hideAttribution: true }}
					>
						<Background gap={16} size={1} />
						<Controls showInteractive={false} />
						{showMinimap && (
							<MiniMap
								pannable
								zoomable
								nodeColor='hsl(220 10% 28%)'
								maskColor='rgba(0,0,0,0.42)'
							/>
						)}
					</ReactFlow>
				)}
				{selectedTable && (
					<SchemaDetailsPanel
						table={selectedTable}
						onClose={() => setSelectedTable(null)}
						onOpenTable={handleOpenSelectedTable}
						onExportSvg={handleExportSvg}
						onExportPng={handleExportPng}
						onExportSql={handleExportSql}
						onExportDrizzle={handleExportDrizzle}
						sqlSource={sqlSource}
						drizzleSource={schema ? convertSchemaToDrizzle(schema) : ''}
						onCopySql={handleCopySql}
						onCopyDrizzle={handleCopyDrizzle}
					/>
				)}
			</div>
		</div>
	)
}

export function SchemaVisualizer(props: Props) {
	return (
		<ReactFlowProvider>
			<SchemaVisualizerInner {...props} />
		</ReactFlowProvider>
	)
}
