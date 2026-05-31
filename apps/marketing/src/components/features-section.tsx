'use client'

import { useRef, useEffect, useState, type RefObject } from 'react'

import { CornerTick } from '@/components/corner-tick'

/* ---------------------------------------------------------------------------
 * Shared scroll-motion hook
 * Tracks the section's position in the viewport (progress 0 -> 1) and the
 * current scroll velocity. Both are exposed as refs so canvas/RAF loops can
 * read the freshest value every frame without re-subscribing, and progress is
 * also returned as state for DOM-driven transforms.
 * ------------------------------------------------------------------------- */
function useScrollMotion(ref: RefObject<HTMLElement | null>) {
    const progressRef = useRef(0)
    const velocityRef = useRef(0)

    useEffect(() => {
        let lastY = window.scrollY
        let lastT = performance.now()
        let raf = 0
        let decayRaf = 0

        const measure = () => {
            const el = ref.current
            if (el) {
                const rect = el.getBoundingClientRect()
                const vh = window.innerHeight
                const total = rect.height + vh
                const seen = vh - rect.top
                // refs only — no setState, so scrolling never re-renders the section
                progressRef.current = Math.max(0, Math.min(1, seen / total))
            }
        }

        // Decay velocity toward 0 so motion settles. Self-stopping: only runs
        // while there is residual velocity, instead of looping forever.
        const decay = () => {
            velocityRef.current *= 0.9
            if (Math.abs(velocityRef.current) < 0.002) {
                velocityRef.current = 0
                decayRaf = 0
                return
            }
            decayRaf = requestAnimationFrame(decay)
        }

        const onScroll = () => {
            const now = performance.now()
            const dy = window.scrollY - lastY
            const dt = Math.max(16, now - lastT)
            // normalized velocity (px per ms), clamped
            velocityRef.current = Math.max(-3, Math.min(3, dy / dt))
            lastY = window.scrollY
            lastT = now
            if (!raf) {
                raf = requestAnimationFrame(() => {
                    measure()
                    raf = 0
                })
            }
            if (!decayRaf) decayRaf = requestAnimationFrame(decay)
        }

        measure()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', measure)
        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', measure)
            if (raf) cancelAnimationFrame(raf)
            if (decayRaf) cancelAnimationFrame(decayRaf)
        }
    }, [ref])

    return { progressRef, velocityRef }
}

type Motion = {
    progressRef: RefObject<number>
    velocityRef: RefObject<number>
}

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
function DatabaseConnectionCard({ motion }: { motion: Motion }) {
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

/* ---------------------------------------------------------------------------
 * Connect Anywhere — wireframe globe; rotation speed reacts to scroll.
 * ------------------------------------------------------------------------- */
function RegionGlobeCard({ motion }: { motion: Motion }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
    const rotationRef = useRef(0)
    const animationRef = useRef<number>(0)

    const regions = [
        { name: 'Local', angle: 0, radius: 0.35 },
        { name: 'Neon', angle: Math.PI * 0.5, radius: 0.45 },
        { name: 'Turso', angle: Math.PI, radius: 0.4 },
        { name: 'SSH', angle: Math.PI * 1.5, radius: 0.5 }
    ]

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)

        const cx = rect.width / 2
        const cy = rect.height / 2 - 10
        const baseRadius = Math.min(rect.width, rect.height) * 0.35

        const animate = () => {
            const vel = motion.velocityRef.current ?? 0
            // gently drifts at rest; scrolling just nudges the rotation speed
            rotationRef.current += 0.0025 + vel * 0.05
            // autonomous phase that always advances, independent of scroll, so the
            // colour highlight travels around the globe on its own
            const t = performance.now() / 1000
            ctx.clearRect(0, 0, rect.width, rect.height)

            for (let i = 0; i < 3; i++) {
                ctx.beginPath()
                ctx.ellipse(
                    cx,
                    cy,
                    baseRadius,
                    (baseRadius * 0.3 * (i + 1)) / 3,
                    0,
                    0,
                    Math.PI * 2
                )
                ctx.strokeStyle = '#2b252c'
                ctx.lineWidth = 1
                ctx.stroke()
            }

            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI + rotationRef.current
                // a rose glow sweeps smoothly from one meridian to the next over time
                const glow = (Math.sin(t * 1.4 - i * 0.8) + 1) / 2 // 0..1
                const g2 = glow * glow
                // interpolate from the warm-dark base (#2b252c) to rose (#e3b2b3)
                const gr = Math.round(43 + g2 * (227 - 43))
                const gg = Math.round(37 + g2 * (178 - 37))
                const gb = Math.round(44 + g2 * (179 - 44))
                ctx.beginPath()
                ctx.ellipse(
                    cx,
                    cy,
                    baseRadius * Math.abs(Math.cos(angle)),
                    baseRadius,
                    Math.PI / 2,
                    0,
                    Math.PI * 2
                )
                ctx.strokeStyle = `rgb(${gr}, ${gg}, ${gb})`
                ctx.lineWidth = 1 + glow * glow * 0.6
                ctx.stroke()
            }

            ctx.beginPath()
            ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2)
            ctx.strokeStyle = '#3a3138'
            ctx.lineWidth = 1
            ctx.stroke()

            animationRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animationRef.current)
    }, [motion])

    return (
        <div className="h-full flex flex-col relative">
            <div className="flex-1 relative">
                <canvas ref={canvasRef} className="w-full h-full" />
                {regions.map((region) => {
                    const x = 50 + Math.cos(region.angle) * region.radius * 80
                    const y = 45 + Math.sin(region.angle) * region.radius * 50
                    return (
                        <div
                            key={region.name}
                            onMouseEnter={() => setHoveredRegion(region.name)}
                            onMouseLeave={() => setHoveredRegion(null)}
                            className="absolute cursor-pointer transition-all duration-200"
                            style={{
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: 'translate(-50%, -50%)'
                            }}
                        >
                            <div
                                className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all ${
                                    hoveredRegion === region.name
                                        ? 'border-[#e3b2b3]/50 bg-[#161218]'
                                        : 'border-[#2b252c] bg-[#161218]/80'
                                }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                        hoveredRegion === region.name
                                            ? 'bg-[#e3b2b3]'
                                            : 'bg-[#3a3a3a]'
                                    }`}
                                />
                                <span className="text-[9px] text-[#5a5a5a] font-mono">
                                    {region.name}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="px-5 pb-5">
                <h3 className="text-sm text-[#e0e0e0] font-medium mb-1">
                    Query History
                </h3>
                <p className="text-xs text-[#5a5a5a] leading-relaxed">
                    Every query logged and queryable. Full audit trail.
                    Time-series playback.
                </p>
            </div>
        </div>
    )
}

/* ---------------------------------------------------------------------------
 * Rust-Native — orbit animation; orbit speed reacts to scroll + hover.
 * ------------------------------------------------------------------------- */
function NativePerformanceCard({ motion }: { motion: Motion }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number>(0)
    const [isHovered, setIsHovered] = useState(false)
    const hoverRef = useRef(false)

    useEffect(() => {
        hoverRef.current = isHovered
    }, [isHovered])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)

        const cx = rect.width / 2
        const cy = rect.height / 2
        let time = 0

        const animate = () => {
            const vel = Math.abs(motion.velocityRef.current ?? 0)
            // scroll only nudges the spin speed; colour responds to hover only, so
            // it never blinks or flashes while scrolling
            time += (hoverRef.current ? 0.024 : 0.008) + vel * 0.05
            const active = hoverRef.current
            ctx.clearRect(0, 0, rect.width, rect.height)

            // autonomous phase so the nodes pulse green on their own, scroll-independent
            const t = performance.now() / 1000

            const orbits = [30, 45, 60]
            orbits.forEach((radius, idx) => {
                // each node pulses green on its own staggered cycle
                const pulse = (Math.sin(t * 1.6 - idx * 1.1) + 1) / 2 // 0..1
                const lit = active ? 1 : pulse * pulse
                // interpolate from neutral grey (#3a3a3a) to rose (#e3b2b3)
                const r = Math.round(58 + lit * (227 - 58))
                const g = Math.round(58 + lit * (178 - 58))
                const b = Math.round(58 + lit * (179 - 58))
                const node = `rgb(${r}, ${g}, ${b})`

                ctx.beginPath()
                ctx.arc(cx, cy, radius, 0, Math.PI * 2)
                ctx.strokeStyle = `rgba(227,178,179,${0.05 + lit * 0.15})`
                ctx.setLineDash([4, 4])
                ctx.lineWidth = 1
                ctx.stroke()
                ctx.setLineDash([])

                const angle = time * (1 - idx * 0.2) + idx * Math.PI * 0.7
                const px = cx + Math.cos(angle) * radius
                const py = cy + Math.sin(angle) * radius
                ctx.beginPath()
                ctx.arc(px, py, 3 + lit * 1.2, 0, Math.PI * 2)
                ctx.fillStyle = node
                ctx.fill()
            })

            const corePulse = (Math.sin(t * 1.6) + 1) / 2
            const coreLit = active ? 1 : corePulse * corePulse
            ctx.beginPath()
            ctx.arc(cx, cy, 6, 0, Math.PI * 2)
            ctx.fillStyle = `rgb(${Math.round(42 + coreLit * (227 - 42))}, ${Math.round(42 + coreLit * (178 - 42))}, ${Math.round(42 + coreLit * (179 - 42))})`
            ctx.fill()

            animationRef.current = requestAnimationFrame(animate)
        }

        animate()
        return () => cancelAnimationFrame(animationRef.current)
    }, [motion])

    return (
        <div className="h-full flex flex-col">
            <div
                className="flex-1 flex items-center justify-center cursor-pointer"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <canvas ref={canvasRef} className="w-32 h-32" />
            </div>
            <div className="px-5 pb-5">
                <h3 className="text-sm text-[#e0e0e0] font-medium mb-1">
                    Rust-Native
                </h3>
                <p className="text-xs text-[#5a5a5a] leading-relaxed">
                    Edge-optimized engine. Instant queries. Orchestrated
                    container management.
                </p>
            </div>
        </div>
    )
}

/* ---------------------------------------------------------------------------
 * Query History — an abstract replay timeline. Each past query is a latency
 * bar along a time axis (taller = slower); a rose "replay head" sweeps across
 * on a loop and the newest query keeps pulsing. Hovering any bar scrubs it into
 * the readout line beneath the chart.
 * ------------------------------------------------------------------------- */
const HISTORY: { sql: string; ms: number; ago: string }[] = [
    { sql: "SELECT * FROM orders WHERE status = 'paid'", ms: 6, ago: 'now' },
    { sql: "UPDATE users SET plan = 'pro' WHERE id = 42", ms: 11, ago: '2m' },
    { sql: 'SELECT count(*) FROM events GROUP BY day', ms: 24, ago: '5m' },
    { sql: 'INSERT INTO audit_log (action) VALUES ($1)', ms: 8, ago: '8m' },
    { sql: 'DELETE FROM sessions WHERE expires < now()', ms: 9, ago: '12m' },
    { sql: 'SELECT id, email FROM users LIMIT 100', ms: 14, ago: '18m' },
    { sql: 'VACUUM ANALYZE products', ms: 21, ago: '24m' }
]

function QueryHistoryCard() {
    const ref = useRef<HTMLDivElement>(null)
    const [revealed, setRevealed] = useState(false)
    const [hover, setHover] = useState<number | null>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.4)
                    setRevealed(true)
            },
            { threshold: [0, 0.4, 1] }
        )
        io.observe(el)
        return () => io.disconnect()
    }, [])

    const count = HISTORY.length
    const X0 = 14
    const X1 = 150
    const BASE = 66
    const step = (X1 - X0) / (count - 1)
    const maxMs = Math.max(...HISTORY.map((h) => h.ms))
    const barH = (ms: number) => 7 + (ms / maxMs) * 40

    // readout scrubs to the hovered bar, falling back to the latest query
    const q = HISTORY[hover ?? 0]

    return (
        <div ref={ref} className="h-full flex flex-col">
            <div className="flex-1 px-2 pt-4">
                <svg
                    viewBox="0 0 160 76"
                    className="w-full h-full"
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient
                            id="qh-sweep"
                            x1="0"
                            x2="1"
                            y1="0"
                            y2="0"
                        >
                            <stop
                                offset="0"
                                stopColor="#e3b2b3"
                                stopOpacity="0"
                            />
                            <stop
                                offset="0.5"
                                stopColor="#e3b2b3"
                                stopOpacity="0.5"
                            />
                            <stop
                                offset="1"
                                stopColor="#e3b2b3"
                                stopOpacity="0"
                            />
                        </linearGradient>
                    </defs>

                    {/* baseline axis */}
                    <line
                        x1={X0 - 4}
                        y1={BASE}
                        x2={X1 + 4}
                        y2={BASE}
                        stroke="#2b252c"
                        strokeWidth="0.6"
                    />

                    {/* sweeping replay head */}
                    <rect
                        x={X0 - 8}
                        y={12}
                        width="16"
                        height={BASE - 12}
                        fill="url(#qh-sweep)"
                    >
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            from="0 0"
                            to={`${X1 - X0 + 8} 0`}
                            dur="3.4s"
                            repeatCount="indefinite"
                        />
                    </rect>

                    {/* latency bars — newest on the right */}
                    {HISTORY.map((h, idx) => {
                        const p = count - 1 - idx
                        const x = X0 + p * step
                        const hgt = barH(h.ms)
                        const lit =
                            hover === idx || (hover === null && idx === 0)
                        return (
                            <g
                                key={h.sql}
                                onMouseEnter={() => setHover(idx)}
                                onMouseLeave={() => setHover(null)}
                                style={{
                                    cursor: 'pointer',
                                    opacity: revealed ? 1 : 0,
                                    transform: revealed
                                        ? 'none'
                                        : 'translateY(8px)',
                                    transition: `opacity 500ms ease ${p * 80}ms, transform 600ms cubic-bezier(0.34,1.56,0.64,1) ${p * 80}ms`
                                }}
                            >
                                <rect
                                    x={x - step / 2}
                                    y={8}
                                    width={step}
                                    height={BASE - 8}
                                    fill="transparent"
                                />
                                <rect
                                    x={x - 2.4}
                                    y={BASE - hgt}
                                    width="4.8"
                                    height={hgt}
                                    rx="1.4"
                                    fill={lit ? '#e3b2b3' : '#4a3f46'}
                                    className="transition-[fill] duration-200"
                                />
                                <circle
                                    cx={x}
                                    cy={BASE - hgt}
                                    r={lit ? 1.8 : 1.2}
                                    fill={lit ? '#f5c0c0' : '#5a4f56'}
                                    className="transition-all duration-200"
                                >
                                    {idx === 0 ? (
                                        <animate
                                            attributeName="r"
                                            values="1.8;3;1.8"
                                            dur="1.8s"
                                            repeatCount="indefinite"
                                        />
                                    ) : null}
                                </circle>
                            </g>
                        )
                    })}
                </svg>
            </div>

            {/* readout */}
            <div className="px-5">
                <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#e3b2b3]" />
                    <span className="flex-1 truncate text-[#cfcfcf]">
                        {q.sql}
                    </span>
                    <span className="shrink-0 text-[#e3b2b3]/80 tabular-nums">
                        {q.ms}ms
                    </span>
                    <span className="shrink-0 w-7 text-right text-[#6a6a6a]">
                        {q.ago}
                    </span>
                </div>
            </div>

            <div className="px-5 pb-5 pt-3">
                <h3 className="text-sm text-[#e0e0e0] font-medium mb-1">
                    Query History
                </h3>
                <p className="text-xs text-[#5a5a5a] leading-relaxed">
                    Every query saved. Search, replay, analyze.
                </p>
            </div>
        </div>
    )
}

/* ---------------------------------------------------------------------------
 * Docker Containers — three live container blocks, each with an animated
 * activity equalizer. One reboots on a loop: its bars freeze and a spinner
 * takes over before it bursts back to "up". Hovering a block lifts it.
 * ------------------------------------------------------------------------- */
const CONTAINERS = [
    { name: 'postgres', tag: '16', port: '5432' },
    { name: 'mysql', tag: '8.4', port: '3306' },
    { name: 'redis', tag: '7', port: '6379' }
]

const EQ_BARS = [
    { x: 4, values: '5;16;8;14;5', dur: '0.9s', begin: '0s' },
    { x: 11, values: '7;18;6;15;7', dur: '1.1s', begin: '-0.3s' },
    { x: 18, values: '6;12;18;9;6', dur: '0.8s', begin: '-0.6s' },
    { x: 25, values: '5;15;7;17;5', dur: '1s', begin: '-0.15s' },
    { x: 32, values: '8;11;16;10;8', dur: '1.2s', begin: '-0.45s' }
]

function EqualizerBars({ active, color }: { active: boolean; color: string }) {
    return (
        <svg viewBox="0 0 39 22" className="w-full h-7" aria-hidden="true">
            {EQ_BARS.map((b) => {
                // keep each bar bottom-anchored at y = 21 as it grows
                const yValues = b.values
                    .split(';')
                    .map((v) => 21 - Number(v))
                    .join(';')
                return (
                    <rect
                        key={b.x}
                        x={b.x}
                        width="3"
                        rx="1"
                        fill={color}
                        opacity={active ? 0.9 : 0.3}
                        y={active ? 11 : 17}
                        height={active ? 10 : 4}
                    >
                        {active ? (
                            <>
                                <animate
                                    attributeName="height"
                                    values={b.values}
                                    dur={b.dur}
                                    begin={b.begin}
                                    repeatCount="indefinite"
                                />
                                <animate
                                    attributeName="y"
                                    values={yValues}
                                    dur={b.dur}
                                    begin={b.begin}
                                    repeatCount="indefinite"
                                />
                            </>
                        ) : null}
                    </rect>
                )
            })}
        </svg>
    )
}

function DockerContainersCard() {
    const ref = useRef<HTMLDivElement>(null)
    const [restarting, setRestarting] = useState<number | null>(null)
    const [hover, setHover] = useState<number | null>(null)
    const [revealed, setRevealed] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.4)
                    setRevealed(true)
            },
            { threshold: [0, 0.4, 1] }
        )
        io.observe(el)
        return () => io.disconnect()
    }, [])

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>
        let i = 0
        const cycle = () => {
            setRestarting(i % CONTAINERS.length)
            timer = setTimeout(() => {
                setRestarting(null)
                i += 1
                timer = setTimeout(cycle, 2400)
            }, 1400)
        }
        timer = setTimeout(cycle, 1600)
        return () => clearTimeout(timer)
    }, [])

    return (
        <div ref={ref} className="h-full flex flex-col">
            <div className="flex-1 grid grid-cols-3 gap-2 px-4 pt-6 pb-3">
                {CONTAINERS.map((c, idx) => {
                    const starting = restarting === idx
                    const lit = hover === idx
                    const color = starting ? '#ad8eb6' : '#e3b2b3'
                    return (
                        <div
                            key={c.name}
                            onMouseEnter={() => setHover(idx)}
                            onMouseLeave={() => setHover(null)}
                            className="relative flex flex-col items-center justify-between gap-2 rounded-md border px-2 py-2.5 cursor-pointer"
                            style={{
                                borderColor: lit ? '#3a3138' : '#2b252c',
                                backgroundColor: lit ? '#161218' : 'transparent',
                                opacity: revealed ? 1 : 0,
                                transform: revealed
                                    ? lit
                                        ? 'translateY(-2px)'
                                        : 'translateY(0)'
                                    : 'translateY(10px)',
                                transition: `opacity 500ms ease ${idx * 100}ms, transform 500ms cubic-bezier(0.34,1.56,0.64,1) ${idx * 100}ms, border-color 300ms ease, background-color 300ms ease`
                            }}
                        >
                            {/* image name */}
                            <div className="flex w-full min-w-0 items-baseline gap-px">
                                <span className="truncate text-[9px] font-mono text-[#cfcfcf]">
                                    {c.name}
                                </span>
                                <span className="shrink-0 text-[8px] font-mono text-[#6a6a6a]">
                                    :{c.tag}
                                </span>
                            </div>

                            {/* live activity / boot spinner */}
                            <div className="relative flex h-7 w-full items-center justify-center">
                                <EqualizerBars active={!starting} color={color} />
                                {starting ? (
                                    <span className="absolute h-3.5 w-3.5 rounded-full border border-[#ad8eb6] border-t-transparent animate-spin" />
                                ) : null}
                            </div>

                            {/* status */}
                            <div className="flex w-full items-center justify-between">
                                <span className="flex items-center gap-1">
                                    <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{
                                            backgroundColor: color,
                                            boxShadow: `0 0 6px ${color}80`
                                        }}
                                    />
                                    <span
                                        className="text-[7px] font-mono uppercase tracking-wider"
                                        style={{ color }}
                                    >
                                        {starting ? 'boot' : 'up'}
                                    </span>
                                </span>
                                <span className="text-[7px] font-mono text-[#5a4f56]">
                                    :{c.port}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="px-5 pb-5">
                <h3 className="text-sm text-[#e0e0e0] font-medium mb-1">
                    Docker Containers
                </h3>
                <p className="text-xs text-[#5a5a5a] leading-relaxed">
                    Start, stop, restart. Live process management.
                    Auto-reconnect on failure.
                </p>
            </div>
        </div>
    )
}

/* ---------------------------------------------------------------------------
 * Schema Visualization — live ER diagram; a pulse travels the foreign-key
 * links and hovering a table highlights its relationships.
 * ------------------------------------------------------------------------- */
function SchemaDiagramCard() {
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

export function FeaturesSection() {
    const sectionRef = useRef<HTMLElement>(null)
    const [isVisible, setIsVisible] = useState(false)
    const motion = useScrollMotion(sectionRef)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setIsVisible(true)
            },
            { threshold: 0.1 }
        )
        if (sectionRef.current) observer.observe(sectionRef.current)
        return () => observer.disconnect()
    }, [])

    return (
        <section
            ref={sectionRef}
            className="relative w-full border-l border-t border-[#3a3138]"
        >
            <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
            <CornerTick className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2" />
            <CornerTick className="-bottom-px -right-px translate-x-1/2 translate-y-1/2" />
            {/* Heading */}
            <div
                className={`px-6 sm:px-8 py-12 border-b border-[#2b252c] transition-all duration-700 delay-150 ${
                    isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                }`}
            >
                <h2 className="text-2xl text-[#5a5a5a] font-light italic mb-1 font-[family-name:var(--font-pixel)]">
                    More Than a GUI.
                </h2>
                <h3 className="text-3xl text-[#f0f0f0] font-semibold font-[family-name:var(--font-pixel)]">
                    The Interface Databases Deserve.
                </h3>
            </div>

            {/* Feature cards — collapsed bordered grid */}
            <div
                className={`relative grid grid-cols-2 md:grid-cols-3 md:grid-rows-2 transition-all duration-700 delay-300 ${
                    isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                }`}
            >
                {/* squares along the divider between the top and bottom three */}
                <CornerTick className="hidden md:block left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-2/3 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <CornerTick className="hidden md:block left-full top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <DatabaseConnectionCard motion={motion} />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <RegionGlobeCard motion={motion} />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <DockerContainersCard />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <SchemaDiagramCard />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <NativePerformanceCard motion={motion} />
                </div>
                <div className="border-r border-b border-[#2b252c] overflow-hidden transition-colors hover:bg-[rgba(245,192,192,0.06)]">
                    <QueryHistoryCard />
                </div>
            </div>
        </section>
    )
}
