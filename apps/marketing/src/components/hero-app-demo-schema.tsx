'use client'

import {
    Hash,
    Key,
    LayoutGrid,
    Link as LinkIcon,
    Maximize2,
    RefreshCw,
    Search,
    Type
} from 'lucide-react'
import { useRef, useState } from 'react'
import { findTable } from '@/components/hero-app-demo-tables'

/**
 * Mock replica of the real schema visualizer: table-card nodes with typed
 * column rows, FK edges drawn column-to-column as SVG beziers, search
 * highlighting and genuinely draggable nodes (edges follow live).
 */

const NODE_W = 176
const HEADER_H = 40
const ROW_H = 20

type TNode = {
    table: string
    count: string
    columns: number
    x: number
    y: number
}

type TEdge = {
    from: { table: string; column: number }
    to: { table: string; column: number }
}

const DEFAULT_NODES: TNode[] = [
    { table: 'customers', count: '1.2K', columns: 4, x: 30, y: 46 },
    { table: 'orders', count: '4.8K', columns: 5, x: 274, y: 26 },
    { table: 'order_items', count: '12.6K', columns: 4, x: 528, y: 56 },
    { table: 'products', count: '340', columns: 4, x: 528, y: 248 },
    { table: 'transactions', count: '21.4K', columns: 5, x: 274, y: 236 },
    { table: 'subscriptions', count: '620', columns: 4, x: 30, y: 232 }
]

const EDGES: TEdge[] = [
    {
        from: { table: 'orders', column: 1 },
        to: { table: 'customers', column: 0 }
    },
    {
        from: { table: 'order_items', column: 1 },
        to: { table: 'orders', column: 0 }
    },
    {
        from: { table: 'order_items', column: 2 },
        to: { table: 'products', column: 0 }
    },
    {
        from: { table: 'transactions', column: 1 },
        to: { table: 'orders', column: 0 }
    },
    {
        from: { table: 'subscriptions', column: 1 },
        to: { table: 'customers', column: 0 }
    }
]

function columnAnchorY(node: TNode, column: number): number {
    return node.y + HEADER_H + column * ROW_H + ROW_H / 2 + 4
}

function edgePath(source: TNode, target: TNode, edge: TEdge): string {
    const sourceY = columnAnchorY(source, edge.from.column)
    const targetY = columnAnchorY(target, edge.to.column)
    const sourceRight = target.x + NODE_W / 2 > source.x + NODE_W / 2
    const x1 = sourceRight ? source.x + NODE_W : source.x
    const x2 = sourceRight ? target.x : target.x + NODE_W
    const bend = sourceRight ? 44 : -44
    return `M ${x1} ${sourceY} C ${x1 + bend} ${sourceY}, ${x2 - bend} ${targetY}, ${x2} ${targetY}`
}

function nodeMatches(node: TNode, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true
    if (node.table.toLowerCase().includes(q)) return true
    return findTable(node.table)
        .columns.slice(0, node.columns)
        .some((column) => column.name.toLowerCase().includes(q))
}

function columnIcon(kind: string) {
    if (kind === 'pk')
        return <Key className="h-2.5 w-2.5 shrink-0 text-amber-500" />
    if (kind === 'fk') {
        return <LinkIcon className="h-2.5 w-2.5 shrink-0 text-blue-500" />
    }
    if (kind === 'number' || kind === 'money') {
        return <Hash className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
    }
    return <Type className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
}

export function SchemaView() {
    const [nodes, setNodes] = useState(DEFAULT_NODES)
    const [selected, setSelected] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const dragRef = useRef<{
        table: string
        startX: number
        startY: number
        originX: number
        originY: number
    } | null>(null)

    function startDrag(event: React.PointerEvent, node: TNode) {
        event.preventDefault()
        ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
        dragRef.current = {
            table: node.table,
            startX: event.clientX,
            startY: event.clientY,
            originX: node.x,
            originY: node.y
        }
        setSelected(node.table)
    }

    function moveDrag(event: React.PointerEvent) {
        const drag = dragRef.current
        if (!drag) return
        setNodes((current) =>
            current.map((node) =>
                node.table === drag.table
                    ? {
                          ...node,
                          x: Math.max(
                              0,
                              drag.originX + event.clientX - drag.startX
                          ),
                          y: Math.max(
                              0,
                              drag.originY + event.clientY - drag.startY
                          )
                      }
                    : node
            )
        )
    }

    function endDrag() {
        dragRef.current = null
    }

    function edgeStroke(edge: TEdge): string {
        if (
            selected &&
            (edge.from.table === selected || edge.to.table === selected)
        ) {
            return 'color-mix(in srgb, var(--primary) 65%, transparent)'
        }
        return 'var(--sidebar-border)'
    }

    return (
        <div className="flex flex-1 min-h-0 flex-col">
            {/* Schema toolbar */}
            <div className="flex items-center h-10 px-2 gap-1.5 bg-sidebar border-b border-sidebar-border shrink-0">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search tables or columns..."
                        className="h-7 w-[200px] rounded-md border border-sidebar-border/60 bg-background/30 pl-6 pr-2 text-[11px] text-sidebar-foreground outline-hidden transition-colors placeholder:text-muted-foreground/60 focus:border-sidebar-border"
                    />
                </div>
                <button
                    type="button"
                    title="Fit schema to viewport"
                    onClick={() => {
                        setNodes(DEFAULT_NODES)
                        setSelected(null)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                    <Maximize2 className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    title="Refresh schema"
                    onClick={() => {
                        setNodes(DEFAULT_NODES)
                        setQuery('')
                        setSelected(null)
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <div className="flex-1" />
                <span className="pr-2 text-[10px] text-muted-foreground/60">
                    {nodes.length} tables · {EDGES.length} relations · drag to
                    rearrange
                </span>
            </div>

            {/* Canvas */}
            <div
                className="relative min-h-0 flex-1 overflow-hidden bg-background"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
                    backgroundSize: '24px 24px'
                }}
                onClick={() => setSelected(null)}
            >
                <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    aria-hidden="true"
                >
                    {EDGES.map((edge, index) => {
                        const source = nodes.find(
                            (node) => node.table === edge.from.table
                        )
                        const target = nodes.find(
                            (node) => node.table === edge.to.table
                        )
                        if (!source || !target) return null
                        return (
                            <path
                                key={index}
                                d={edgePath(source, target, edge)}
                                fill="none"
                                strokeWidth={1.25}
                                style={{
                                    stroke: edgeStroke(edge),
                                    transition: 'stroke 150ms'
                                }}
                            />
                        )
                    })}
                </svg>

                {nodes.map((node) => {
                    const table = findTable(node.table)
                    const matches = nodeMatches(node, query)
                    const isSelected = selected === node.table
                    return (
                        <div
                            key={node.table}
                            onPointerDown={(event) => startDrag(event, node)}
                            onPointerMove={moveDrag}
                            onPointerUp={endDrag}
                            onClick={(event) => event.stopPropagation()}
                            style={{ left: node.x, top: node.y }}
                            className={
                                'absolute w-[176px] cursor-grab select-none rounded-md border bg-card shadow-md transition-[opacity,border-color] duration-150 active:cursor-grabbing ' +
                                (isSelected
                                    ? 'border-primary/60 ring-1 ring-primary/25 '
                                    : 'border-sidebar-border ') +
                                (matches ? 'opacity-100' : 'opacity-30')
                            }
                        >
                            <div className="flex items-center gap-1.5 border-b border-sidebar-border px-2.5 py-2">
                                <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                    <div className="truncate text-[12px] font-semibold leading-none text-foreground">
                                        {node.table}
                                    </div>
                                    <div className="mt-0.5 text-[9px] text-muted-foreground">
                                        public · {node.count} rows
                                    </div>
                                </div>
                            </div>
                            <div className="py-1">
                                {table.columns
                                    .slice(0, node.columns)
                                    .map((column) => (
                                        <div
                                            key={column.name}
                                            className="flex h-5 items-center gap-1.5 px-2.5 text-[10px]"
                                        >
                                            {columnIcon(column.kind)}
                                            <span className="truncate text-sidebar-foreground">
                                                {column.name}
                                            </span>
                                            <span className="ml-auto shrink-0 font-mono text-[8px] lowercase text-muted-foreground/60">
                                                {column.type}
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
