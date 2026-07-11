'use client'

import { useRef, useEffect, useState } from 'react'

import {
    BOOT_JITTER,
    BOOT_MIN_DURATION,
    CONTAINERS,
    EASE_OUT,
    RESTART_JITTER,
    RESTART_MIN_DELAY
} from './docker-containers-motion'
import { ActivitySparkline } from './docker-containers-sparkline'
import { useGate } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * Docker Containers — three live container blocks, each with an animated
 * activity equalizer. One reboots on a loop: its bars freeze and a spinner
 * takes over before it bursts back to "up". Hovering a block lifts it.
 * ------------------------------------------------------------------------- */

function getContainerTransform(
    revealed: boolean,
    lit: boolean,
    starting: boolean
) {
    if (!revealed) return 'translateY(10px)'
    if (lit) return 'translate3d(0,-2px,0)'
    if (starting) return 'translate3d(0,1px,0)'
    return 'translate3d(0,0,0)'
}

export function DockerContainersCard({ animate }: { animate: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const [restarting, setRestarting] = useState<number | null>(null)
    const [hover, setHover] = useState<number | null>(null)
    const [revealed, setRevealed] = useState(false)
    const lastRestartRef = useRef<number | null>(null)
    const gate = useGate(ref)
    const running = animate && gate.active

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
        if (!running) {
            setRestarting(null)
            return
        }

        let timer: ReturnType<typeof setTimeout>

        const pickNext = () => {
            let next = Math.floor(Math.random() * CONTAINERS.length)
            if (CONTAINERS.length > 1 && next === lastRestartRef.current)
                next =
                    (next + 1 + Math.floor(Math.random() * 2)) %
                    CONTAINERS.length
            lastRestartRef.current = next
            return next
        }

        const cycle = () => {
            setRestarting(pickNext())
            timer = setTimeout(
                () => {
                    setRestarting(null)
                    timer = setTimeout(
                        cycle,
                        RESTART_MIN_DELAY + Math.random() * RESTART_JITTER
                    )
                },
                BOOT_MIN_DURATION + Math.random() * BOOT_JITTER
            )
        }
        timer = setTimeout(cycle, 1200 + Math.random() * 900)
        return () => clearTimeout(timer)
    }, [running])

    return (
        <div ref={ref} className="h-full flex flex-col">
            <div className="flex-1 grid grid-cols-3 gap-2 px-4 pt-6 pb-3">
                {CONTAINERS.map((c, idx) => {
                    const starting = restarting === idx
                    const lit = hover === idx
                    const color = starting ? 'var(--color-brand-600)' : 'var(--color-brand-300)'
                    const entryDelay = idx * 70
                    return (
                        <div
                            key={c.name}
                            onMouseEnter={() => setHover(idx)}
                            onMouseLeave={() => setHover(null)}
                            className="relative flex flex-col items-center justify-between gap-2 rounded-md border px-2 py-2.5 cursor-pointer"
                            style={{
                                borderColor: lit ? 'var(--color-line-strong)' : 'var(--color-line)',
                                backgroundColor: lit
                                    ? 'var(--color-surface)'
                                    : 'transparent',
                                opacity: revealed ? 1 : 0,
                                transform: getContainerTransform(
                                    revealed,
                                    lit,
                                    starting
                                ),
                                transition: `opacity 420ms ${EASE_OUT} ${entryDelay}ms, transform 260ms ${EASE_OUT} ${entryDelay}ms, border-color 220ms ease, background-color 220ms ease`
                            }}
                        >
                            {/* image name */}
                            <div className="flex w-full min-w-0 items-baseline gap-px">
                                <span className="truncate font-mono text-[9px] text-ink-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                                    {c.name}
                                </span>
                                <span className="shrink-0 font-mono text-[8px] text-ink-700 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                                    :{c.tag}
                                </span>
                            </div>

                            {/* live activity / boot spinner */}
                            <div className="relative flex h-7 w-full items-center justify-center">
                                <ActivitySparkline
                                    active={!starting}
                                    animate={running}
                                    color={color}
                                    phase={c.phase}
                                />
                                {starting && running ? (
                                    <span
                                        className="absolute h-4 w-4 rounded-full border border-brand-600/60 border-t-[var(--color-brand-100)]"
                                        style={{
                                            animation:
                                                'dockerBootSpin 720ms linear infinite, dockerBootPulse 1180ms cubic-bezier(0.23, 1, 0.32, 1) infinite'
                                        }}
                                    />
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
                                        className="font-mono text-[7px] uppercase tracking-wider [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                                        style={{ color }}
                                    >
                                        {starting ? 'boot' : 'up'}
                                    </span>
                                </span>
                                <span className="font-mono text-[7px] text-ink-800 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                                    :{c.port}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="px-5 pb-5">
                <h3 className="mb-1 font-pixel text-sm font-[500] text-ink-200">
                    Docker Containers
                </h3>
                <p className="text-xs text-ink-500 leading-relaxed">
                    Start, stop, restart. Live process management.
                    Auto-reconnect on failure.
                </p>
            </div>
        </div>
    )
}
