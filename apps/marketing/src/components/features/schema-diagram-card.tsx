'use client'

import { useEffect, useRef, useState } from 'react'

import { useGate } from './use-scroll-motion'

const HEADER_H = 14
const ROW_H = 9

type TCol = { name: string; type: string; pk?: boolean; fk?: string }
type TTable = { id: string; x: number; y: number; w: number; cols: TCol[] }
type TEdge = { a: string; aCol: number; b: string; bCol: number }

const TABLES: TTable[] = [
    {
        id: 'users',
        x: 4,
        y: 5,
        w: 66,
        cols: [
            { name: 'id', type: 'int', pk: true },
            { name: 'email', type: 'text' },
            { name: 'name', type: 'text' },
        ],
    },
    {
        id: 'orders',
        x: 104,
        y: 34,
        w: 64,
        cols: [
            { name: 'id', type: 'int', pk: true },
            { name: 'user_id', type: 'int', fk: 'users' },
            { name: 'product_id', type: 'int', fk: 'products' },
        ],
    },
    {
        id: 'products',
        x: 4,
        y: 64,
        w: 66,
        cols: [
            { name: 'id', type: 'int', pk: true },
            { name: 'name', type: 'text' },
            { name: 'price', type: 'numeric' },
        ],
    },
]

const EDGES: TEdge[] = [
    { a: 'users', aCol: 0, b: 'orders', bCol: 1 },
    { a: 'products', aCol: 0, b: 'orders', bCol: 2 },
]

const CYCLE = ['users', 'orders', 'products']

const PARTICLES = [
    { left: '22%', top: '30%', size: 1.5, opacity: 0.36 },
    { left: '43%', top: '21%', size: 2, opacity: 0.42 },
    { left: '70%', top: '32%', size: 1, opacity: 0.32 },
    { left: '76%', top: '58%', size: 1.5, opacity: 0.38 },
    { left: '31%', top: '67%', size: 1, opacity: 0.3 },
] as const

function tableH(table: TTable): number {
    return HEADER_H + table.cols.length * ROW_H + 2
}

function rowCenterY(table: TTable, colIndex: number): number {
    return table.y + HEADER_H + colIndex * ROW_H + ROW_H / 2
}

function edgePath(edge: TEdge): string {
    const src = TABLES.find((t) => t.id === edge.a)!
    const dst = TABLES.find((t) => t.id === edge.b)!
    const x1 = src.x + src.w
    const y1 = rowCenterY(src, edge.aCol)
    const x2 = dst.x
    const y2 = rowCenterY(dst, edge.bCol)
    const midX = (x1 + x2) / 2
    return `M${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
}

function isEdgeLit(edge: TEdge, active: string | null): boolean {
    if (active === null) return true
    return edge.a === active || edge.b === active
}

function isNodeLit(id: string, active: string | null): boolean {
    if (active === null) return true
    if (active === id) return true
    return EDGES.some(
        (e) => (e.a === active && e.b === id) || (e.b === active && e.a === id),
    )
}

function colBadge(col: TCol): { label: string; bg: string; fg: string } | null {
    if (col.pk) return { label: 'PK', bg: 'rgba(173,142,182,0.22)', fg: '#ad8eb6' }
    if (col.fk) return { label: 'FK', bg: 'rgba(227,178,179,0.18)', fg: '#e3b2b3' }
    return null
}

function fkColColor(col: TCol, tableId: string, active: string | null): string {
    const linked = active === null || active === tableId || active === col.fk
    return linked ? '#e3b2b3' : '#6a6a6a'
}

function colColor(col: TCol, tableId: string, active: string | null): string {
    if (!isNodeLit(tableId, active)) return '#4a4548'
    if (col.pk) return '#ad8eb6'
    if (col.fk) return fkColColor(col, tableId, active)
    return '#9a9a9a'
}

export function SchemaDiagramCard({ animate }: { animate: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const gate = useGate(ref)
    const running = animate && gate.active

    const [hover, setHover] = useState<string | null>(null)
    const [focusIdx, setFocusIdx] = useState(0)

    useEffect(() => {
        if (!running) return
        const id = setInterval(
            () => setFocusIdx((prev) => (prev + 1) % CYCLE.length),
            2200,
        )
        return () => clearInterval(id)
    }, [running])

    const active = hover ?? (running ? CYCLE[focusIdx] : null)

    return (
        <div ref={ref} className="relative h-full flex flex-col overflow-hidden">
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[42%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
                style={{
                    background:
                        'radial-gradient(circle, rgba(227,178,179,0.12) 0%, rgba(173,142,182,0.05) 38%, transparent 70%)',
                }}
            />
            {PARTICLES.map((particle, index) => (
                <span
                    aria-hidden
                    key={`${particle.left}-${particle.top}`}
                    className="pointer-events-none absolute rounded-full bg-[#f5c0c0]"
                    style={{
                        left: particle.left,
                        top: particle.top,
                        width: particle.size,
                        height: particle.size,
                        opacity: particle.opacity,
                        animation: `particleFloat ${4.1 + index * 0.5}s cubic-bezier(0.23,1,0.32,1) ${index * 140}ms infinite alternate`,
                        animationPlayState: running ? 'running' : 'paused',
                    }}
                />
            ))}

            <div className="relative flex-1 flex items-center justify-center px-4 pt-4">
                <svg
                    viewBox="0 0 172 114"
                    className="w-full h-[114px]"
                    aria-hidden="true"
                >
                    <defs>
                        <marker
                            id="fk-arrow-lit"
                            markerWidth="5"
                            markerHeight="4"
                            refX="4"
                            refY="2"
                            orient="auto"
                        >
                            <polygon
                                points="0 0, 5 2, 0 4"
                                fill="rgba(227,178,179,0.65)"
                            />
                        </marker>
                        <marker
                            id="fk-arrow-dim"
                            markerWidth="5"
                            markerHeight="4"
                            refX="4"
                            refY="2"
                            orient="auto"
                        >
                            <polygon points="0 0, 5 2, 0 4" fill="#2b252c" />
                        </marker>
                    </defs>

                    {/* FK relationship lines */}
                    {EDGES.map((edge, edgeIndex) => {
                        const lit = isEdgeLit(edge, active)
                        return (
                            <path
                                key={edgeIndex}
                                d={edgePath(edge)}
                                fill="none"
                                stroke={
                                    lit ? 'rgba(227,178,179,0.48)' : '#2b252c'
                                }
                                strokeWidth="1.2"
                                strokeDasharray={lit ? '3 3' : undefined}
                                markerEnd={
                                    lit
                                        ? 'url(#fk-arrow-lit)'
                                        : 'url(#fk-arrow-dim)'
                                }
                            >
                                {lit && running ? (
                                    <animate
                                        attributeName="stroke-dashoffset"
                                        dur="1s"
                                        from="0"
                                        to="-12"
                                        repeatCount="indefinite"
                                    />
                                ) : null}
                            </path>
                        )
                    })}

                    {/* Table nodes */}
                    {TABLES.map((table) => {
                        const lit = isNodeLit(table.id, active)
                        const height = tableH(table)
                        return (
                            <g
                                key={table.id}
                                onMouseEnter={() => setHover(table.id)}
                                onMouseLeave={() => setHover(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* card outline */}
                                <rect
                                    x={table.x}
                                    y={table.y}
                                    width={table.w}
                                    height={height}
                                    rx="3"
                                    fill="#161218"
                                    stroke={
                                        lit
                                            ? 'rgba(227,178,179,0.38)'
                                            : '#2b252c'
                                    }
                                    strokeWidth="1"
                                />
                                {/* header fill */}
                                <rect
                                    x={table.x + 0.5}
                                    y={table.y + 0.5}
                                    width={table.w - 1}
                                    height={HEADER_H - 1}
                                    rx="2.5"
                                    fill={
                                        lit
                                            ? 'rgba(227,178,179,0.11)'
                                            : '#1c1820'
                                    }
                                />
                                {/* table name */}
                                <text
                                    x={table.x + 6}
                                    y={table.y + 9}
                                    fontSize="6"
                                    fill={lit ? '#e3b2b3' : '#6a6a6a'}
                                    style={{
                                        fontFamily: 'var(--font-geist-mono)',
                                        fontWeight: 600,
                                    }}
                                >
                                    {table.id}
                                </text>
                                {/* header / body divider */}
                                <line
                                    x1={table.x + 1}
                                    y1={table.y + HEADER_H}
                                    x2={table.x + table.w - 1}
                                    y2={table.y + HEADER_H}
                                    stroke="#2b252c"
                                    strokeWidth="1"
                                />
                                {/* column rows */}
                                {table.cols.map((col, colIndex) => {
                                    const rowBaseY =
                                        table.y + HEADER_H + colIndex * ROW_H
                                    const badge = colBadge(col)
                                    const fill = colColor(
                                        col,
                                        table.id,
                                        active,
                                    )
                                    return (
                                        <g key={col.name}>
                                            {badge && lit ? (
                                                <rect
                                                    x={table.x + 1}
                                                    y={rowBaseY + 0.5}
                                                    width={table.w - 2}
                                                    height={ROW_H - 1}
                                                    fill={
                                                        col.pk
                                                            ? 'rgba(173,142,182,0.07)'
                                                            : 'rgba(227,178,179,0.05)'
                                                    }
                                                />
                                            ) : null}
                                            {badge ? (
                                                <>
                                                    <rect
                                                        x={table.x + 4}
                                                        y={rowBaseY + 2}
                                                        width="10"
                                                        height="5"
                                                        rx="1"
                                                        fill={badge.bg}
                                                    />
                                                    <text
                                                        x={table.x + 9}
                                                        y={rowBaseY + 6.2}
                                                        fontSize="3.8"
                                                        fill={badge.fg}
                                                        textAnchor="middle"
                                                        style={{
                                                            fontFamily:
                                                                'var(--font-geist-mono)',
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {badge.label}
                                                    </text>
                                                </>
                                            ) : null}
                                            <text
                                                x={
                                                    badge
                                                        ? table.x + 17
                                                        : table.x + 6
                                                }
                                                y={rowBaseY + 6.5}
                                                fontSize="5.5"
                                                fill={fill}
                                                style={{
                                                    fontFamily:
                                                        'var(--font-geist-mono)',
                                                }}
                                            >
                                                {col.name}
                                            </text>
                                            <text
                                                x={table.x + table.w - 4}
                                                y={rowBaseY + 6.5}
                                                fontSize="4.5"
                                                fill={
                                                    lit ? '#5a5560' : '#333038'
                                                }
                                                textAnchor="end"
                                                style={{
                                                    fontFamily:
                                                        'var(--font-geist-mono)',
                                                }}
                                            >
                                                {col.type}
                                            </text>
                                        </g>
                                    )
                                })}
                            </g>
                        )
                    })}
                </svg>
            </div>

            <div className="relative px-5 pb-5">
                <h3 className="mb-1 font-pixel text-sm font-[500] text-[#e0e0e0]">
                    Schema Visualization
                </h3>
                <p className="text-xs text-[#8a8a8a] leading-relaxed">
                    ERD diagram. Live relationships. Query-driven discovery.
                    Instant insight.
                </p>
            </div>
        </div>
    )
}
