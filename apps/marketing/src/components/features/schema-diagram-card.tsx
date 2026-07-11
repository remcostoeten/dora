'use client'

import { useEffect, useRef, useState } from 'react'

import { useGate } from './use-scroll-motion'

const HEADER_H = 14
const ROW_H = 9

type TCol = { name: string; type: string; pk?: boolean; fk?: string }
type TTable = { id: string; x: number; y: number; w: number; cols: TCol[] }
type TEdge = { a: string; aCol: number; b: string; bCol: number }

// Deliberately uneven — different widths, column counts, and vertical offsets
// so the diagram reads like a real schema rather than a 2x2 grid.
const TABLES: TTable[] = [
    {
        id: 'users',
        x: 4,
        y: 4,
        w: 72,
        cols: [
            { name: 'id', type: 'int', pk: true },
            { name: 'email', type: 'text' },
            { name: 'name', type: 'text' },
            { name: 'created_at', type: 'date' },
        ],
    },
    {
        id: 'orders',
        x: 104,
        y: 4,
        w: 58,
        cols: [
            { name: 'id', type: 'int', pk: true },
            { name: 'user_id', type: 'int', fk: 'users' },
            { name: 'total', type: 'numeric' },
        ],
    },
    {
        id: 'products',
        x: 4,
        y: 65,
        w: 62,
        cols: [
            { name: 'id', type: 'int', pk: true },
            { name: 'name', type: 'text' },
            { name: 'price', type: 'numeric' },
        ],
    },
    {
        id: 'reviews',
        x: 104,
        y: 56,
        w: 66,
        cols: [
            { name: 'id', type: 'int', pk: true },
            { name: 'user_id', type: 'int', fk: 'users' },
            { name: 'product_id', type: 'int', fk: 'products' },
            { name: 'rating', type: 'int' },
        ],
    },
]

const EDGES: TEdge[] = [
    { a: 'users', aCol: 0, b: 'orders', bCol: 1 },
    { a: 'users', aCol: 0, b: 'reviews', bCol: 1 },
    { a: 'products', aCol: 0, b: 'reviews', bCol: 2 },
]

const CYCLE = ['users', 'orders', 'products', 'reviews']

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

function tableById(id: string): TTable {
    return TABLES.find((t) => t.id === id)!
}

function edgePath(edge: TEdge): string {
    const src = tableById(edge.a)
    const dst = tableById(edge.b)
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
    if (col.pk) return { label: 'PK', bg: 'color-mix(in srgb, var(--color-brand-600) 22%, transparent)', fg: 'var(--color-brand-600)' }
    if (col.fk) return { label: 'FK', bg: 'color-mix(in srgb, var(--color-brand-300) 18%, transparent)', fg: 'var(--color-brand-300)' }
    return null
}

function fkColColor(col: TCol, tableId: string, active: string | null): string {
    const linked = active === null || active === tableId || active === col.fk
    return linked ? 'var(--color-brand-300)' : 'var(--color-ink-700)'
}

function colColor(col: TCol, tableId: string, active: string | null): string {
    if (!isNodeLit(tableId, active)) return 'var(--color-line-bright)'
    if (col.pk) return 'var(--color-brand-600)'
    if (col.fk) return fkColColor(col, tableId, active)
    return 'var(--color-ink-400)'
}

// The relationship surfaced in the readout: prefer an edge where the active
// table is the referenced (PK) side, else one where it is the FK side.
function readoutEdge(active: string | null): TEdge {
    if (active) {
        const asPk = EDGES.find((e) => e.a === active)
        if (asPk) return asPk
        const asFk = EDGES.find((e) => e.b === active)
        if (asFk) return asFk
    }
    return EDGES[0]
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

    const relEdge = readoutEdge(active)
    const relSrc = tableById(relEdge.a)
    const relDst = tableById(relEdge.b)
    const relSrcCol = relSrc.cols[relEdge.aCol]
    const relDstCol = relDst.cols[relEdge.bCol]

    return (
        <div ref={ref} className="relative h-full flex flex-col overflow-hidden">
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[42%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
                style={{
                    background:
                        'radial-gradient(circle, color-mix(in srgb, var(--color-brand-300) 12%, transparent) 0%, color-mix(in srgb, var(--color-brand-600) 5%, transparent) 38%, transparent 70%)',
                }}
            />
            {PARTICLES.map((particle, index) => (
                <span
                    aria-hidden
                    key={`${particle.left}-${particle.top}`}
                    className="pointer-events-none absolute rounded-full bg-brand-200"
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

            <div className="relative flex-1 min-h-0 flex items-center justify-center px-3 pt-3">
                <svg
                    viewBox="0 0 172 114"
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full h-full max-h-[210px]"
                    aria-hidden="true"
                >
                    <defs>
                        {/* crow's-foot "many" end */}
                        <marker
                            id="card-many"
                            markerWidth="8"
                            markerHeight="8"
                            refX="6.5"
                            refY="4"
                            orient="auto"
                        >
                            <path
                                d="M0 4 L6.5 1 M0 4 L6.5 4 M0 4 L6.5 7"
                                stroke="color-mix(in srgb, var(--color-brand-300) 75%, transparent)"
                                strokeWidth="0.8"
                                fill="none"
                            />
                        </marker>
                        {/* "one" tick at the PK end */}
                        <marker
                            id="card-one"
                            markerWidth="6"
                            markerHeight="8"
                            refX="2"
                            refY="4"
                            orient="auto"
                        >
                            <line
                                x1="2"
                                y1="1.5"
                                x2="2"
                                y2="6.5"
                                stroke="color-mix(in srgb, var(--color-brand-300) 75%, transparent)"
                                strokeWidth="0.8"
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
                            <polygon points="0 0, 5 2, 0 4" fill="var(--color-line)" />
                        </marker>
                    </defs>

                    {/* FK relationship lines */}
                    {EDGES.map((edge, edgeIndex) => {
                        const lit = isEdgeLit(edge, active)
                        return (
                            <path
                                key={edgeIndex}
                                id={`schema-edge-${edgeIndex}`}
                                d={edgePath(edge)}
                                fill="none"
                                stroke={
                                    lit ? 'color-mix(in srgb, var(--color-brand-300) 48%, transparent)' : 'var(--color-line)'
                                }
                                strokeWidth="1.2"
                                strokeDasharray={lit ? '3 3' : undefined}
                                markerStart={
                                    lit ? 'url(#card-one)' : undefined
                                }
                                markerEnd={
                                    lit
                                        ? 'url(#card-many)'
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

                    {/* data packets streaming PK -> FK along lit edges */}
                    {EDGES.map((edge, edgeIndex) => {
                        const lit = isEdgeLit(edge, active)
                        if (!lit || !running) return null
                        const dur = `${1.5 + edgeIndex * 0.25}s`
                        return (
                            <circle key={`p-${edgeIndex}`} r="1.5" fill="var(--color-brand-200)">
                                <animateMotion
                                    dur={dur}
                                    repeatCount="indefinite"
                                    calcMode="linear"
                                >
                                    <mpath href={`#schema-edge-${edgeIndex}`} />
                                </animateMotion>
                                <animate
                                    attributeName="opacity"
                                    values="0;1;1;0"
                                    keyTimes="0;0.12;0.82;1"
                                    dur={dur}
                                    repeatCount="indefinite"
                                />
                            </circle>
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
                                    fill="var(--color-surface)"
                                    stroke={
                                        lit
                                            ? 'color-mix(in srgb, var(--color-brand-300) 38%, transparent)'
                                            : 'var(--color-line)'
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
                                            ? 'color-mix(in srgb, var(--color-brand-300) 11%, transparent)'
                                            : 'var(--color-surface-elevated)'
                                    }
                                />
                                {/* table name */}
                                <text
                                    x={table.x + 6}
                                    y={table.y + 9}
                                    fontSize="6"
                                    fill={lit ? 'var(--color-brand-300)' : 'var(--color-ink-700)'}
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
                                    stroke="var(--color-line)"
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
                                                            ? 'color-mix(in srgb, var(--color-brand-600) 7%, transparent)'
                                                            : 'color-mix(in srgb, var(--color-brand-300) 5%, transparent)'
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
                                                    lit ? 'var(--color-ink-800)' : 'var(--color-line-strong)'
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

            {/* active relationship readout */}
            <div className="relative px-5">
                <div className="flex h-4 items-center gap-2 overflow-hidden font-mono text-[10px] leading-none [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
                    <span className="truncate whitespace-nowrap">
                        <span style={{ color: 'var(--color-brand-600)' }}>
                            {relSrc.id}.{relSrcCol.name}
                        </span>
                        <span className="px-1.5 text-ink-700">─&lt;</span>
                        <span style={{ color: 'var(--color-brand-300)' }}>
                            {relDst.id}.{relDstCol.name}
                        </span>
                    </span>
                </div>
            </div>

            <div className="relative px-5 pb-5 pt-3">
                <h3 className="mb-1 font-pixel text-sm font-[500] text-ink-200">
                    Schema Visualization
                </h3>
                <p className="text-xs text-ink-500 leading-relaxed">
                    ERD diagram. Live relationships. Query-driven discovery.
                    Instant insight.
                </p>
            </div>
        </div>
    )
}
