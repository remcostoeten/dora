'use client'

import { useRef, useEffect, useState } from 'react'

import type { Motion } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * Connection String Morph — database URIs cycle through with staggered
 * character animation and abstract visual elements.
 * ------------------------------------------------------------------------- */
const CONNECTION_STRINGS = [
    {
        db: 'PostgreSQL',
        conn: 'postgresql://user:pass@db.neon.tech/mydb',
        color: '#f5c0c0'
    },
    {
        db: 'MySQL',
        conn: 'mysql://user:pass@localhost:3306/mydb',
        color: '#e3b2b3'
    },
    { db: 'SQLite', conn: 'file:///path/to/database.db', color: '#c9a3b5' },
    {
        db: 'libSQL',
        conn: 'libsql://database.turso.io?authToken=token',
        color: '#ad8eb6'
    }
]

// Hub at the centre; the four providers orbit it on the diagonals.
const HUB = { x: 50, y: 46 }
const NODE_POS = [
    { x: 27, y: 22 },
    { x: 73, y: 22 },
    { x: 73, y: 70 },
    { x: 27, y: 70 }
]

// Character-by-character reveal of a string; restarts whenever `resetKey` flips.
function useTypewriter(text: string, resetKey: number, speed = 20) {
    const [count, setCount] = useState(0)
    useEffect(() => {
        setCount(0)
        const id = setInterval(() => {
            setCount((c) => {
                if (c >= text.length) {
                    clearInterval(id)
                    return c
                }
                return c + 1
            })
        }, speed)
        return () => clearInterval(id)
    }, [text, resetKey, speed])
    return count
}

/* ---------------------------------------------------------------------------
 * Multi-Database — an interactive "connection constellation". A rose core sits
 * at the centre with the four supported providers orbiting it; links flow with
 * animated dashes and a data packet streams along the active link. Hovering a
 * provider (or its dot) focuses it, pausing the auto-cycle, and types that
 * provider's connection string in below. The cluster drifts with the pointer.
 * ------------------------------------------------------------------------- */
export function DatabaseConnectionCard({ motion }: { motion: Motion }) {
    const [active, setActive] = useState(0)
    const [paused, setPaused] = useState(false)
    const groupRef = useRef<HTMLDivElement>(null)
    const packetRef = useRef<SVGCircleElement>(null)

    const current = CONNECTION_STRINGS[active]
    const revealed = useTypewriter(current.conn, active)

    // Split the URI so the scheme can be tinted and the rest stays muted.
    const scheme = current.conn.split('://')[0]
    const rest = current.conn.slice(scheme.length + 3)
    const schemeShown = scheme.slice(0, Math.min(revealed, scheme.length))
    const sepShown =
        revealed > scheme.length ? '://'.slice(0, revealed - scheme.length) : ''
    const restShown =
        revealed > scheme.length + 3
            ? rest.slice(0, revealed - scheme.length - 3)
            : ''
    const isTyping = revealed < current.conn.length

    // Auto-cycle providers until the user hovers one.
    useEffect(() => {
        if (paused) return
        const id = setInterval(
            () => setActive((a) => (a + 1) % CONNECTION_STRINGS.length),
            3200
        )
        return () => clearInterval(id)
    }, [paused])

    // A data packet streams hub -> active node on a loop; scrolling nudges its
    // speed. Driven by direct attribute writes so it never re-renders React.
    useEffect(() => {
        const node = NODE_POS[active]
        let raf = 0
        let t = 0
        const loop = () => {
            const vel = Math.abs(motion.velocityRef.current ?? 0)
            t = (t + 0.014 + vel * 0.04) % 1
            // ease-in-out so the packet accelerates out of the hub and settles
            const e =
                t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
            const c = packetRef.current
            if (c) {
                c.setAttribute('cx', String(HUB.x + (node.x - HUB.x) * e))
                c.setAttribute('cy', String(HUB.y + (node.y - HUB.y) * e))
                c.setAttribute('opacity', String(Math.sin(t * Math.PI)))
            }
            raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
    }, [active, motion])

    // Pointer parallax — the whole cluster leans a few px toward the cursor.
    function onMove(event: React.MouseEvent) {
        const g = groupRef.current
        if (!g) return
        const r = event.currentTarget.getBoundingClientRect()
        const dx = (event.clientX - r.left) / r.width - 0.5
        const dy = (event.clientY - r.top) / r.height - 0.5
        g.style.transform = `translate(${dx * 12}px, ${dy * 12}px)`
    }
    function onLeave() {
        if (groupRef.current) groupRef.current.style.transform = 'translate(0,0)'
        setPaused(false)
    }

    return (
        <div className="h-full flex flex-col">
            <div
                className="relative flex-1 overflow-hidden"
                onMouseMove={onMove}
                onMouseLeave={onLeave}
            >
                {/* soft glow centred on the hub */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(circle at 50% 46%, rgba(245,192,192,0.12), transparent 62%)'
                    }}
                />
                <div
                    ref={groupRef}
                    className="absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out"
                >
                    <svg
                        viewBox="0 0 100 100"
                        className="h-full max-h-[150px] aspect-square"
                        aria-hidden="true"
                    >
                        {/* links from hub to each provider */}
                        {NODE_POS.map((n, i) => {
                            const on = i === active
                            return (
                                <line
                                    key={i}
                                    x1={HUB.x}
                                    y1={HUB.y}
                                    x2={n.x}
                                    y2={n.y}
                                    stroke={on ? current.color : '#3a3138'}
                                    strokeWidth={on ? 0.7 : 0.4}
                                    strokeDasharray="2 2"
                                    className="transition-[stroke,stroke-width] duration-300"
                                >
                                    {on ? (
                                        <animate
                                            attributeName="stroke-dashoffset"
                                            from="0"
                                            to="-8"
                                            dur="0.7s"
                                            repeatCount="indefinite"
                                        />
                                    ) : null}
                                </line>
                            )
                        })}

                        {/* slow rotating ring around the hub */}
                        <circle
                            cx={HUB.x}
                            cy={HUB.y}
                            r="9"
                            fill="none"
                            stroke="rgba(245,192,192,0.22)"
                            strokeWidth="0.4"
                            strokeDasharray="1.5 3"
                        >
                            <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from={`0 ${HUB.x} ${HUB.y}`}
                                to={`360 ${HUB.x} ${HUB.y}`}
                                dur="14s"
                                repeatCount="indefinite"
                            />
                        </circle>

                        {/* hub core */}
                        <circle
                            cx={HUB.x}
                            cy={HUB.y}
                            r="4"
                            fill="#161218"
                            stroke="rgba(245,192,192,0.5)"
                            strokeWidth="0.6"
                        />
                        <circle cx={HUB.x} cy={HUB.y} r="1.6" fill="#f5c0c0">
                            <animate
                                attributeName="r"
                                values="1.4;2;1.4"
                                dur="2.4s"
                                repeatCount="indefinite"
                            />
                        </circle>

                        {/* streaming data packet */}
                        <circle
                            ref={packetRef}
                            cx={HUB.x}
                            cy={HUB.y}
                            r="1.3"
                            fill={current.color}
                        />

                        {/* provider nodes — interactive */}
                        {NODE_POS.map((n, i) => {
                            const on = i === active
                            const c = CONNECTION_STRINGS[i].color
                            return (
                                <g
                                    key={i}
                                    onMouseEnter={() => {
                                        setActive(i)
                                        setPaused(true)
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {/* generous invisible hit area */}
                                    <circle
                                        cx={n.x}
                                        cy={n.y}
                                        r="9"
                                        fill="transparent"
                                    />
                                    {on ? (
                                        <circle
                                            cx={n.x}
                                            cy={n.y}
                                            r="5"
                                            fill="none"
                                            stroke={c}
                                            strokeWidth="0.5"
                                            opacity="0.5"
                                        >
                                            <animate
                                                attributeName="r"
                                                values="4;6;4"
                                                dur="1.8s"
                                                repeatCount="indefinite"
                                            />
                                            <animate
                                                attributeName="opacity"
                                                values="0.5;0;0.5"
                                                dur="1.8s"
                                                repeatCount="indefinite"
                                            />
                                        </circle>
                                    ) : null}
                                    <circle
                                        cx={n.x}
                                        cy={n.y}
                                        r={on ? 3 : 2.2}
                                        fill={on ? c : '#161218'}
                                        stroke={c}
                                        strokeWidth="0.6"
                                        className="transition-all duration-300"
                                        style={{ opacity: on ? 1 : 0.55 }}
                                    />
                                </g>
                            )
                        })}
                    </svg>
                </div>
            </div>

            {/* typing connection string */}
            <div className="px-5 pb-1">
                <div className="relative flex items-center gap-2 overflow-hidden border border-[#2b252c] bg-[#100d12]/80 px-3 py-2 font-mono text-[11px]">
                    <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300"
                        style={{
                            backgroundColor: current.color,
                            boxShadow: `0 0 8px ${current.color}80`
                        }}
                    />
                    <span className="truncate">
                        <span style={{ color: current.color }}>
                            {schemeShown}
                        </span>
                        <span className="text-[#6a6a6a]">{sepShown}</span>
                        <span className="text-[#9a9a9a]">{restShown}</span>
                        {isTyping ? (
                            <span
                                className="ml-px inline-block h-3 w-px animate-pulse align-middle"
                                style={{ backgroundColor: current.color }}
                            />
                        ) : null}
                    </span>
                </div>
            </div>

            {/* provider selector dots */}
            <div className="px-5 pb-4 flex items-center justify-center gap-1.5">
                {CONNECTION_STRINGS.map((db, idx) => (
                    <button
                        key={db.db}
                        aria-label={`Show ${db.db}`}
                        onMouseEnter={() => {
                            setActive(idx)
                            setPaused(true)
                        }}
                        onMouseLeave={() => setPaused(false)}
                        onClick={() => setActive(idx)}
                        className={`h-1 transition-all duration-300 ${
                            idx === active ? 'w-4' : 'w-1'
                        }`}
                        style={{
                            backgroundColor:
                                idx === active ? db.color : '#3a3138'
                        }}
                    />
                ))}
            </div>

            <div className="px-5 pb-5">
                <h3 className="text-sm text-[#e0e0e0] font-medium mb-1">
                    Multi-Database
                </h3>
                <p className="text-xs text-[#5a5a5a] leading-relaxed">
                    PostgreSQL, SQLite, libSQL, MySQL. Connect anywhere — local,
                    hosted, tunneled, SSH.
                </p>
            </div>
        </div>
    )
}
