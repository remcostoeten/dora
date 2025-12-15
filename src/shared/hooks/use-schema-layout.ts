'use client'

import { useMemo } from 'react'
import type { Node, Edge, MarkerType } from 'reactflow'
import type { DatabaseSchema } from '@/types/database'
import type { SchemaTableNodeData } from '@/components/schema/schema-table-node'
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled'

const elk = new ELK()

// ELK layout options for hierarchical layout
const elkOptions = {
    'elk.algorithm': 'layered',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    'elk.spacing.nodeNode': '80',
    'elk.direction': 'RIGHT',
}

export function useSchemaLayout(schema: DatabaseSchema | null) {
    return useMemo(() => {
        if (!schema || !schema.tables) {
            return { nodes: [], edges: [] }
        }

        // Step 1: Create nodes from tables
        const nodes: Node<SchemaTableNodeData>[] = schema.tables.map((table) => {
            // Parse columns to extract constraints
            const columns = table.columns.map((col) => {
                const constraints: string[] = []

                // Simple heuristic: columns named 'id' are usually primary keys
                // Or check if NOT NULL + column name suggests it
                const isProbablyPK =
                    col.name.toLowerCase() === 'id' ||
                    col.name.toLowerCase().endsWith('_id') &&
                    col.name.toLowerCase() === table.name.toLowerCase() + '_id'

                if (isProbablyPK) {
                    constraints.push('PK')
                }

                // Check for NOT NULL
                if (!col.is_nullable) {
                    constraints.push('NOT NULL')
                }

                // Check for foreign key by column name heuristic
                // Columns ending in _id (but not the table's own id) might be FKs
                if (col.name.toLowerCase().endsWith('_id') && !isProbablyPK) {
                    // Try to guess the referenced table
                    const referencedTable = col.name.toLowerCase().replace('_id', '')
                    const matchingTable = schema.tables.find(
                        t => t.name.toLowerCase() === referencedTable ||
                            t.name.toLowerCase() === referencedTable + 's' ||
                            t.name.toLowerCase() === referencedTable.slice(0, -1) // singular
                    )
                    if (matchingTable) {
                        constraints.push(`FK → ${matchingTable.name}.id`)
                    }
                }

                return {
                    name: col.name,
                    type: col.data_type,
                    constraints,
                }
            })

            return {
                id: `table-${table.schema || 'public'}-${table.name}`,
                type: 'schemaTable',
                position: { x: 0, y: 0 }, // Will be set by ELK layout
                data: {
                    tableName: table.name,
                    schema: table.schema || 'public',
                    columns,
                },
            }
        })

        // Step 2: Create edges from foreign key heuristics
        const edges: Edge[] = []
        schema.tables.forEach((table) => {
            table.columns.forEach((col) => {
                // Detect FK by naming convention (column_name_id)
                if (col.name.toLowerCase().endsWith('_id') &&
                    col.name.toLowerCase() !== 'id' &&
                    col.name.toLowerCase() !== table.name.toLowerCase() + '_id') {

                    const referencedTable = col.name.toLowerCase().replace('_id', '')
                    const targetTable = schema.tables.find(
                        t => t.name.toLowerCase() === referencedTable ||
                            t.name.toLowerCase() === referencedTable + 's' ||
                            t.name.toLowerCase() === referencedTable.slice(0, -1)
                    )

                    if (targetTable) {
                        const sourceId = `table-${table.schema || 'public'}-${table.name}`
                        const targetId = `table-${targetTable.schema || 'public'}-${targetTable.name}`

                        edges.push({
                            id: `fk-${table.name}-${col.name}-${targetTable.name}`,
                            source: sourceId,
                            target: targetId,
                            type: 'smoothstep',
                            animated: false,
                            style: { stroke: 'var(--muted-foreground)', strokeWidth: 2 },
                            markerEnd: {
                                type: ('arrowclosed' as any) as MarkerType, // Type assertion for compatibility
                                color: 'var(--muted-foreground)',
                            },
                        })
                    }
                }
            })
        })

        // Return nodes and edges without layout for now
        // Layout will be applied in the component
        return { nodes, edges }
    }, [schema])
}

export async function applyElkLayout(
    nodes: Node[],
    edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
    // Create ELK graph structure
    const graph: ElkNode = {
        id: 'root',
        layoutOptions: elkOptions,
        children: nodes.map((node) => ({
            id: node.id,
            width: 250, // Default width for table nodes
            height: Math.max(100, 40 + (node.data.columns?.length || 0) * 28), // Dynamic height based on columns
        })),
        edges: edges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
        })),
    }

    try {
        const layoutedGraph = await elk.layout(graph)

        // Apply calculated positions to nodes
        const layoutedNodes = nodes.map((node) => {
            const layoutedNode = layoutedGraph.children?.find((n) => n.id === node.id)
            return {
                ...node,
                position: {
                    x: layoutedNode?.x || 0,
                    y: layoutedNode?.y || 0,
                },
            }
        })

        return { nodes: layoutedNodes, edges }
    } catch (error) {
        console.error('ELK layout failed:', error)
        // Return original nodes with default positions
        return { nodes, edges }
    }
}
