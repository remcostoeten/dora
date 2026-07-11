'use client'

import { useRef, useEffect, useState } from 'react'

import { useGate, type Motion } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * Connection String Morph — database URIs cycle through with staggered
 * character animation and abstract visual elements.
 * ------------------------------------------------------------------------- */
const CONNECTION_STRINGS = [
    {
        db: 'PostgreSQL',
        conn: 'postgresql://user:pass@db.neon.tech/mydb',
        color: 'var(--color-brand-200)'
    },
    {
        db: 'MySQL',
        conn: 'mysql://user:pass@localhost:3306/mydb',
        color: 'var(--color-brand-300)'
    },
    {
        db: 'MariaDB',
        conn: 'mysql://user:pass@mariadb.internal:3306/mydb',
        color: 'var(--color-brand-300)'
    },
    { db: 'SQLite', conn: 'file:///path/to/database.db', color: 'var(--color-brand-400)' },
    {
        db: 'libSQL',
        conn: 'libsql://database.turso.io?authToken=token',
        color: 'var(--color-brand-600)'
    },
    {
        db: 'CockroachDB',
        conn: 'postgresql://user:pass@cockroach.internal:26257/defaultdb',
        color: 'var(--color-syntax-value)'
    }
]

// Hub at the centre; the compatibility targets orbit it in a loose hexagon.
const HUB = { x: 50, y: 46 }
const NODE_POS = [
    { x: 50, y: 18 },
    { x: 74, y: 32 },
    { x: 74, y: 60 },
    { x: 50, y: 74 },
    { x: 26, y: 60 },
    { x: 26, y: 32 }
]

// Character-by-character reveal of a string; restarts whenever `resetKey` flips.
function useTypewriter(
    text: string,
    resetKey: number,
    enabled: boolean,
    speed = 20
) {
    const [count, setCount] = useState(0)
    useEffect(() => {
        if (!enabled) {
            setCount(text.length)
            return
        }
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
    }, [enabled, text, resetKey, speed])
    return count
}

/* ---------------------------------------------------------------------------
 * Multi-Database — an interactive "connection constellation". A rose core sits
 * at the centre with the six supported providers orbiting it; links flow with
 * animated dashes and a data packet streams along the active link. Hovering a
 * provider (or its dot) focuses it, pausing the auto-cycle, and types that
 * provider's connection string in below. The cluster drifts with the pointer.
 * ------------------------------------------------------------------------- */
export function DatabaseConnectionCard({
    animate,
    motion
}: {
    animate: boolean
    motion: Motion
}) {
    const rootRef = useRef<HTMLDivElement>(null)
    const [active, setActive] = useState(0)
    const [paused, setPaused] = useState(false)
    const groupRef = useRef<HTMLDivElement>(null)
    const packetRef = useRef<SVGCircleElement>(null)
    const gate = useGate(rootRef)
    const running = animate && gate.active && motion.activeRef.current

    const current = CONNECTION_STRINGS[active]
    const revealed = useTypewriter(current.conn, active, running)

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
        if (paused || !running) return
        const id = setInterval(
            () => setActive((a) => (a + 1) % CONNECTION_STRINGS.length),
            3200
        )
        return () => clearInterval(id)
    }, [running, paused])

    // A data packet streams hub -> active node on a loop; scrolling nudges its
    // speed. Driven by direct attribute writes so it never re-renders React.
    useEffect(() => {
        const node = NODE_POS[active]
        let raf = 0
        let t = 0
        const draw = (running: boolean) => {
            const vel = running ? Math.abs(motion.velocityRef.current ?? 0) : 0
            t = (t + (running ? 0.014 + vel * 0.003 : 0)) % 1
            // ease-in-out so the packet accelerates out of the hub and settles
            const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
            const c = packetRef.current
            if (c) {
                c.setAttribute('cx', String(HUB.x + (node.x - HUB.x) * e))
                c.setAttribute('cy', String(HUB.y + (node.y - HUB.y) * e))
                c.setAttribute('opacity', String(Math.sin(t * Math.PI)))
            }
            if (running) raf = requestAnimationFrame(loop)
        }
        const loop = () => {
            draw(animate && gate.activeRef.current && motion.activeRef.current)
        }
        draw(running)
        if (running) raf = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(raf)
    }, [active, animate, running, motion, gate.activeRef])

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
        if (groupRef.current)
            groupRef.current.style.transform = 'translate(0,0)'
        setPaused(false)
    }

    return (
        <div ref={rootRef} className="h-full flex flex-col">
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
                            'radial-gradient(circle at 50% 46%, color-mix(in srgb, var(--color-brand-200) 12%, transparent), transparent 62%)'
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
                                    stroke={on ? current.color : 'var(--color-line-strong)'}
                                    strokeWidth={on ? 0.7 : 0.4}
                                    strokeDasharray="2 2"
                                    className="transition-[stroke,stroke-width] duration-300"
                                >
                                    {on && running ? (
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
                            stroke="color-mix(in srgb, var(--color-brand-200) 22%, transparent)"
                            strokeWidth="0.4"
                            strokeDasharray="1.5 3"
                        >
                            {running ? (
                                <animateTransform
                                    attributeName="transform"
                                    type="rotate"
                                    from={`0 ${HUB.x} ${HUB.y}`}
                                    to={`360 ${HUB.x} ${HUB.y}`}
                                    dur="14s"
                                    repeatCount="indefinite"
                                />
                            ) : null}
                        </circle>

                        {/* hub core */}
                        <circle
                            cx={HUB.x}
                            cy={HUB.y}
                            r="4"
                            fill="var(--color-surface)"
                            stroke="color-mix(in srgb, var(--color-brand-200) 50%, transparent)"
                            strokeWidth="0.6"
                        />
                        <circle cx={HUB.x} cy={HUB.y} r="1.6" fill="var(--color-brand-200)">
                            {running ? (
                                <animate
                                    attributeName="r"
                                    values="1.4;2;1.4"
                                    dur="2.4s"
                                    repeatCount="indefinite"
                                />
                            ) : null}
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
                                    {on && running ? (
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
                                        fill={on ? c : 'var(--color-surface)'}
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
                <div className="relative flex w-full items-center gap-2 overflow-hidden border border-line bg-surface-deep/80 px-3 py-2 font-mono text-[11px] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
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
                        <span className="text-ink-700">{sepShown}</span>
                        <span className="text-ink-400">{restShown}</span>
                        {isTyping && running ? (
                            <span
                                className="ml-px inline-block h-3 w-px animate-pulse align-middle"
                                style={{ backgroundColor: current.color }}
                            />
                        ) : null}
                    </span>
                </div>
            </div>

            {/* provider selector dots */}
            <div className="px-5 pb-4 flex items-center justify-center gap-1">
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
                        className="flex size-6 items-center justify-center"
                    >
                        <span
                            aria-hidden
                            className={`h-1 transition-all duration-300 ${
                                idx === active ? 'w-4' : 'w-1'
                            }`}
                            style={{
                                backgroundColor:
                                    idx === active ? db.color : 'var(--color-line-strong)'
                            }}
                        />
                    </button>
                ))}
            </div>

            <div className="px-5 pb-5">
                <h3 className="mb-1 font-pixel text-sm font-[500] text-ink-200">
                    Multi-Database
                </h3>
                <p className="text-xs text-ink-500 leading-relaxed">
                    PostgreSQL, SQLite, libSQL, MySQL. Connect anywhere — local,
                    hosted, tunneled, SSH.
                </p>
            </div>
        </div>
    )
}
