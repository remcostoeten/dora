'use client'

import { useState } from 'react'

/* ---------------------------------------------------------------------------
 * Schema Visualization — live ER diagram; a pulse travels the foreign-key
 * links and hovering a table highlights its relationships.
 * ------------------------------------------------------------------------- */
export function SchemaDiagramCard() {
    const [hover, setHover] = useState<string | null>(null)
    const nodes = [
        { id: 'users', x: 12, y: 10, w: 54, h: 30 },
        { id: 'products', x: 8, y: 78, w: 60, h: 30 },
        { id: 'orders', x: 98, y: 44, w: 52, h: 30 }
    ]
    const edges = [
        { a: 'users', b: 'orders', d: 'M66 22 C 86 22, 84 56, 98 56' },
        { a: 'products', b: 'orders', d: 'M68 90 C 88 90, 84 62, 98 62' }
    ]
    const nodeLit = (id: string) =>
        hover === null ||
        hover === id ||
        edges.some(
            (e) =>
                (e.a === hover && e.b === id) || (e.b === hover && e.a === id)
        )
    const edgeLit = (e: { a: string; b: string }) =>
        hover === null || e.a === hover || e.b === hover

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center px-4 pt-5">
                <svg
                    viewBox="0 0 160 118"
                    className="w-full h-[118px]"
                    aria-hidden="true"
                >
                    {edges.map((e, i) => (
                        <path
                            key={i}
                            d={e.d}
                            fill="none"
                            stroke={edgeLit(e) ? '#e3b2b3' : '#3a3138'}
                            strokeWidth="1.2"
                            strokeDasharray={edgeLit(e) ? '4 4' : undefined}
                        >
                            {edgeLit(e) ? (
                                <animate
                                    attributeName="stroke-dashoffset"
                                    dur="0.9s"
                                    from="0"
                                    repeatCount="indefinite"
                                    to="-16"
                                />
                            ) : null}
                        </path>
                    ))}
                    {nodes.map((n) => {
                        const lit = nodeLit(n.id)
                        return (
                            <g
                                key={n.id}
                                onMouseEnter={() => setHover(n.id)}
                                onMouseLeave={() => setHover(null)}
                                style={{ cursor: 'pointer' }}
                            >
                                <rect
                                    x={n.x}
                                    y={n.y}
                                    width={n.w}
                                    height={n.h}
                                    rx="3"
                                    fill="#161218"
                                    stroke={
                                        lit ? 'rgba(227,178,179,0.4)' : '#2b252c'
                                    }
                                    strokeWidth="1"
                                    className="transition-colors duration-200"
                                />
                                <path
                                    d={`M${n.x} ${n.y + 3} a3 3 0 0 1 3 -3 h${n.w - 6} a3 3 0 0 1 3 3 v7 h-${n.w} Z`}
                                    fill={
                                        lit ? 'rgba(227,178,179,0.16)' : '#1c1820'
                                    }
                                    className="transition-colors duration-200"
                                />
                                <text
                                    x={n.x + 5}
                                    y={n.y + 7.6}
                                    fontSize="6.5"
                                    className="font-mono transition-colors duration-200"
                                    fill={lit ? '#e3b2b3' : '#6a6a6a'}
                                >
                                    {n.id}
                                </text>
                                <line
                                    x1={n.x + 5}
                                    y1={n.y + 17}
                                    x2={n.x + n.w - 6}
                                    y2={n.y + 17}
                                    stroke="#3a3138"
                                    strokeWidth="1.4"
                                />
                                <line
                                    x1={n.x + 5}
                                    y1={n.y + 23}
                                    x2={n.x + n.w - 12}
                                    y2={n.y + 23}
                                    stroke="#2b252c"
                                    strokeWidth="1.4"
                                />
                            </g>
                        )
                    })}
                </svg>
            </div>
            <div className="px-5 pb-5">
                <h3 className="text-sm text-[#e0e0e0] font-medium mb-1">
                    Schema Visualization
                </h3>
                <p className="text-xs text-[#5a5a5a] leading-relaxed">
                    ERD diagram. Live relationships. Query-driven discovery.
                    Instant insight.
                </p>
            </div>
        </div>
    )
}
