'use client'

import { useEffect, useRef, useState } from 'react'

import { useGate } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * Drizzle Runner — a type-safe Drizzle query sits at the top; a rose "run"
 * pulse sweeps the editor, then the result rows materialize one-by-one into a
 * compact table below. Loops: rows clear and the run replays. Hovering the
 * editor triggers an immediate re-run.
 * ------------------------------------------------------------------------- */
const QUERY_LINES: { indent: number; tokens: [string, string][] }[] = [
    {
        indent: 0,
        tokens: [
            ['db', '#cfcfcf'],
            ['.', '#6a6a6a'],
            ['select', '#e3b2b3'],
            ['()', '#6a6a6a']
        ]
    },
    {
        indent: 1,
        tokens: [
            ['.', '#6a6a6a'],
            ['from', '#e3b2b3'],
            ['(', '#6a6a6a'],
            ['users', '#ad8eb6'],
            [')', '#6a6a6a']
        ]
    },
    {
        indent: 1,
        tokens: [
            ['.', '#6a6a6a'],
            ['where', '#e3b2b3'],
            ['(', '#6a6a6a'],
            ['eq', '#9a9a9a'],
            ['(', '#6a6a6a'],
            ['users.plan', '#ad8eb6'],
            [', ', '#6a6a6a'],
            ["'pro'", '#c9a3b5'],
            ['))', '#6a6a6a']
        ]
    }
]

const ROWS = [
    { id: '42', email: 'maya@dora.dev', plan: 'pro' },
    { id: '57', email: 'ravi@dora.dev', plan: 'pro' },
    { id: '83', email: 'lina@dora.dev', plan: 'pro' }
]

export function DrizzleRunnerCard({ animate }: { animate: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const gate = useGate(ref)
    const running = animate && gate.active

    // -1 idle, 0 running pulse, >=1 number of rows revealed
    const [step, setStep] = useState(-1)
    const cycle = useRef(0)

    useEffect(() => {
        if (!running) return
        const timers: ReturnType<typeof setTimeout>[] = []
        const run = () => {
            const mine = ++cycle.current
            setStep(0)
            // reveal rows one at a time after the run pulse
            ROWS.forEach((_, i) => {
                timers.push(
                    setTimeout(
                        () => {
                            if (cycle.current === mine) setStep(i + 1)
                        },
                        520 + i * 240
                    )
                )
            })
            // hold the full result, then clear and replay
            timers.push(
                setTimeout(
                    () => {
                        if (cycle.current !== mine) return
                        setStep(-1)
                        timers.push(setTimeout(run, 700))
                    },
                    520 + ROWS.length * 240 + 2200
                )
            )
        }
        run()
        return () => {
            cycle.current++
            timers.forEach(clearTimeout)
        }
    }, [running])

    function rerun() {
        if (!running) return
        cycle.current++
        const mine = cycle.current
        setStep(0)
        ROWS.forEach((_, i) =>
            setTimeout(
                () => {
                    if (cycle.current === mine) setStep(i + 1)
                },
                520 + i * 240
            )
        )
    }

    const isRunning = step === 0

    return (
        <div
            ref={ref}
            className="relative h-full flex flex-col overflow-hidden"
        >
            <div className="relative flex-1 px-4 pt-5">
                {/* editor */}
                <div
                    className="relative overflow-hidden border border-[#2b252c] bg-[#0d0a0f]/80 px-3 py-2.5"
                    onMouseEnter={rerun}
                >
                    {/* run-pulse sweep */}
                    {isRunning && running ? (
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-y-0 left-0 w-12"
                            style={{
                                background:
                                    'linear-gradient(90deg, transparent, rgba(227,178,179,0.16), transparent)',
                                animation: 'drizzleSweep 0.62s ease-out'
                            }}
                        />
                    ) : null}
                    <pre className="font-mono text-[10.5px] leading-[1.55] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        {QUERY_LINES.map((line, li) => (
                            <div
                                key={li}
                                style={{ paddingLeft: line.indent * 12 }}
                            >
                                {line.tokens.map(([t, c], ti) => (
                                    <span key={ti} style={{ color: c }}>
                                        {t}
                                    </span>
                                ))}
                            </div>
                        ))}
                    </pre>
                </div>

                {/* run status + results */}
                <div className="mt-2 flex items-center gap-2 px-0.5">
                    <span
                        className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
                        style={{
                            backgroundColor: isRunning ? '#e3b2b3' : '#4a7a55',
                            boxShadow: isRunning
                                ? '0 0 8px rgba(227,178,179,0.6)'
                                : '0 0 8px rgba(74,122,85,0.5)'
                        }}
                    />
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#7a7a7a] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        {isRunning
                            ? 'running…'
                            : `${Math.max(step, 0)} rows · 3 ms`}
                    </span>
                </div>

                <div className="mt-1.5 overflow-hidden border border-[#2b252c] bg-[#100d12]/70">
                    {/* header */}
                    <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.6rem] gap-1 border-b border-[#2b252c] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#6a6a6a] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        <span>id</span>
                        <span>email</span>
                        <span className="text-right">plan</span>
                    </div>
                    {ROWS.map((row, i) => {
                        const shown = step > i
                        return (
                            <div
                                key={row.id}
                                className="grid grid-cols-[2rem_minmax(0,1fr)_2.6rem] items-center gap-1 px-2.5 py-1 font-mono text-[10px] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                                style={{
                                    opacity: shown ? 1 : 0,
                                    transform: shown
                                        ? 'translateY(0)'
                                        : 'translateY(4px)',
                                    transition:
                                        'opacity 320ms ease, transform 360ms cubic-bezier(0.34,1.56,0.64,1)'
                                }}
                            >
                                <span className="text-[#7a7a7a] tabular-nums">
                                    {row.id}
                                </span>
                                <span className="truncate text-[#cfcfcf]">
                                    {row.email}
                                </span>
                                <span className="text-right text-[#e3b2b3]">
                                    {row.plan}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="relative px-5 pb-5 pt-3">
                <h3 className="mb-1 font-pixel text-sm font-[500] text-[#e0e0e0]">
                    Drizzle, natively
                </h3>
                <p className="text-xs text-[#8a8a8a] leading-relaxed">
                    Write type-safe Drizzle queries against a live database. Run
                    them, see the rows.
                </p>
            </div>
        </div>
    )
}
