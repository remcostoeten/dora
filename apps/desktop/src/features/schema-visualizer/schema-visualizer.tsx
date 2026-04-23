import {
	Background,
	Controls,
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAdapter } from '@/core/data-provider'
import { getAdapterError } from '@/core/data-provider/types'
import type { DatabaseSchema } from '@/lib/bindings'
import { EmptyState } from '@/shared/ui/empty-state'
import { TableNode } from './components/table-node'
import { SchemaToolbar } from './components/schema-toolbar'
import { useSchemaGraph, type TableNodeData } from './hooks/use-schema-graph'

type Props = {
	activeConnectionId: string | undefined
}

const NODE_TYPES: NodeTypes = {
	tableNode: TableNode,
}

function SchemaVisualizerInner({ activeConnectionId }: Props) {
	const adapter = useAdapter()
	const [schema, setSchema] = useState<DatabaseSchema | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [showMinimap, setShowMinimap] = useState(true)

	const fetchSchema = useCallback(async () => {
		if (!activeConnectionId) {
			setSchema(null)
			return
		}
		setIsLoading(true)
		setError(null)
		try {
			await adapter.connectToDatabase(activeConnectionId)
			const res = await adapter.getSchema(activeConnectionId)
			if (res.ok) {
				setSchema(res.data)
			} else {
				setError(getAdapterError(res))
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		} finally {
			setIsLoading(false)
		}
	}, [activeConnectionId, adapter])

	useEffect(() => {
		fetchSchema()
	}, [fetchSchema])

	const { nodes: graphNodes, edges: graphEdges } = useSchemaGraph(schema, search)

	const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(graphNodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(graphEdges)

	useEffect(() => {
		setNodes(graphNodes)
	}, [graphNodes, setNodes])

	useEffect(() => {
		setEdges(graphEdges)
	}, [graphEdges, setEdges])

	const visibleCounts = useMemo(() => {
		const visibleNodes = nodes.filter((n) => !n.hidden)
		const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))
		const visibleEdges = edges.filter(
			(e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target),
		)
		return { tables: visibleNodes.length, edges: visibleEdges.length }
	}, [nodes, edges])

	function handleExportJson() {
		if (!schema) return
		const blob = new Blob([JSON.stringify(schema, null, 2)], {
			type: 'application/json',
		})
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'schema.json'
		a.click()
		URL.revokeObjectURL(url)
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
				onRefresh={fetchSchema}
				onExportJson={handleExportJson}
				tableCount={visibleCounts.tables}
				edgeCount={visibleCounts.edges}
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
						nodeTypes={NODE_TYPES}
						fitView
						fitViewOptions={{ padding: 0.2 }}
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
								nodeColor='var(--sidebar-accent)'
								maskColor='rgba(0,0,0,0.3)'
							/>
						)}
					</ReactFlow>
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
