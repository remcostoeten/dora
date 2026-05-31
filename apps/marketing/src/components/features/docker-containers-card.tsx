'use client'

import { useRef, useEffect, useState } from 'react'

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

export function DockerContainersCard() {
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
