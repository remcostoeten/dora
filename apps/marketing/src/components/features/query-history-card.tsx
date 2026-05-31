'use client'

import { useRef, useEffect, useState } from 'react'

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

export function QueryHistoryCard() {
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
