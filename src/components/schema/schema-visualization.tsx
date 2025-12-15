'use client'

import { useCallback, useEffect, useState } from 'react'
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Loader2, Maximize2 } from 'lucide-react'
import { SchemaTableNode } from './schema-table-node'
import { useSchemaLayout, applyElkLayout } from '@/core/hooks/use-schema-layout'
import type { DatabaseSchema } from '@/types/database'
import { Button } from '@/components/ui/button'

const nodeTypes = {
    schemaTable: SchemaTableNode,
}

type SchemaVisualizationProps = {
    schema: DatabaseSchema | null
    connectionId: string | null
    connected: boolean
}

export function SchemaVisualization({
    schema,
    connectionId,
    connected,
}: SchemaVisualizationProps) {
    const { nodes: initialNodes, edges: initialEdges } = useSchemaLayout(schema)
    const [nodes, setNodes, onNodesChange] = useNodesState([])
    const [edges, setEdges, onEdgesChange] = useEdgesState([])
    const [isLayouting, setIsLayouting] = useState(false)

    // Apply ELK layout when schema changes
    useEffect(() => {
        if (initialNodes.length === 0) {
            setNodes([])
            setEdges([])
            return
        }

        setIsLayouting(true)
        applyElkLayout(initialNodes, initialEdges)
            .then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
                setNodes(layoutedNodes)
                setEdges(layoutedEdges)
            })
            .catch((error) => {
                console.error('Layout failed:', error)
                setNodes(initialNodes)
                setEdges(initialEdges)
            })
            .finally(() => {
                setIsLayouting(false)
            })
    }, [initialNodes, initialEdges, setNodes, setEdges])

    const handleFitView = useCallback(() => {
        // This will be handled by ReactFlow's fitView prop
    }, [])

    if (!connected) {
        return (
            <div className="flex h-full items-center justify-center bg-card">
                <div className="text-center">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">
                        No database connected
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Connect to a database to view its schema
                    </div>
                </div>
            </div>
        )
    }

    if (!schema || schema.tables.length === 0) {
        return (
            <div className="flex h-full items-center justify-center bg-card">
                <div className="text-center">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">
                        No tables found
                    </div>
                    <div className="text-xs text-muted-foreground">
                        This database appears to be empty
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="relative h-full w-full bg-card">
            {isLayouting && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm font-medium">Calculating layout...</span>
                    </div>
                </div>
            )}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                maxZoom={1.5}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                }}
                className="bg-background"
            >
                <Background color="var(--border)" gap={16} />
                <Controls className="border border-border bg-card shadow-lg" />
                <MiniMap
                    className="border border-border bg-card shadow-lg"
                    nodeColor={(node) => {
                        return 'var(--primary)'
                    }}
                    maskColor="rgba(0, 0, 0, 0.1)"
                />
            </ReactFlow>

            {/* Info Panel */}
            <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
                <div className="text-xs text-muted-foreground">
                    {nodes.length} {nodes.length === 1 ? 'table' : 'tables'} · {edges.length}{' '}
                    {edges.length === 1 ? 'relationship' : 'relationships'}
                </div>
            </div>
        </div>
    )
}
