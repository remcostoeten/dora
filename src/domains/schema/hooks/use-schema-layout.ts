import { useCallback, useEffect, useState } from 'react'
import ReactFlow, {
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
} from 'reactflow'
import type { DatabaseSchema, TableInfo } from '../types'

export function useSchemaLayout(schema: DatabaseSchema | null) {
    const [nodes, setNodes] = useState<Node[]>([])
    const [edges, setEdges] = useState<Edge[]>([])

    useEffect(() => {
        if (!schema) {
            setNodes([])
            setEdges([])
            return
        }

        const generatedNodes: Node[] = []
        const generatedEdges: Edge[] = []

        // Create nodes for each table
        schema.tables.forEach((table, index) => {
            generatedNodes.push({
                id: `${table.schema}.${table.name}`,
                type: 'schemaTable',
                position: { x: index * 250, y: 0 },
                data: {
                    table,
                    onTableClick: () => {
                        console.log(`Table clicked: ${table.schema}.${table.name}`)
                    }
                }
            })
        })

        setNodes(generatedNodes)
        setEdges(generatedEdges)
    }, [schema])

    return {
        nodes,
        edges
    }
}

export async function applyElkLayout(
    nodes: Node[],
    edges: Edge[]
): Promise<{ nodes: Node[], edges: Edge[] }> {
    // Simplified layout - in real implementation, this would use ELK
    return {
        nodes: nodes.map((node, index) => ({
            ...node,
            position: { x: index * 300, y: 0 }
        })),
        edges
    }
}
