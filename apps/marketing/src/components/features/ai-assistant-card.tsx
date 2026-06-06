'use client'

import { useEffect, useRef, useState } from 'react'

import { useGate } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * AI Assistant — natural-language → SQL. An English question types into the
 * prompt row, the assistant "thinks" for a beat, then streams a syntax-tinted
 * SQL answer token-by-token with a blinking caret. Loops through a few pairs;
 * hovering a pair's dot jumps straight to it and pauses the cycle.
 * ------------------------------------------------------------------------- */
const PAIRS = [
    {
        ask: 'top 5 customers by revenue',
        sql: 'SELECT name, sum(total) AS revenue\nFROM orders\nGROUP BY name\nORDER BY revenue DESC\nLIMIT 5;'
    },
    {
        ask: 'users who signed up this week',
        sql: "SELECT id, email\nFROM users\nWHERE created_at > now() - interval '7 days';"
    },
    {
        ask: 'orders still pending',
        sql: "SELECT id, total\nFROM orders\nWHERE status = 'pending';"
    }
] as const

const KEYWORDS = new Set([
    'select',
    'from',
    'where',
    'group',
    'by',
    'order',
    'desc',
    'asc',
    'limit',
    'sum',
    'as',
    'and',
    'or',
    'interval',
    'now'
])

// Tints SQL token-by-token: keywords rose, strings warm, the rest muted.
function SqlTokens({ text }: { text: string }) {
    const parts = text.split(/(\s+|,|;|\(|\))/)
    return (
        <>
            {parts.map((part, i) => {
                if (/^'.*'?$/.test(part.trim()) && part.includes("'"))
                    return (
                        <span key={i} className="text-[#c9a3b5]">
                            {part}
                        </span>
                    )
                if (KEYWORDS.has(part.toLowerCase()))
                    return (
                        <span key={i} className="text-[#e3b2b3]">
                            {part}
                        </span>
                    )
                return (
                    <span key={i} className="text-[#9a9a9a]">
                        {part}
                    </span>
                )
            })}
        </>
    )
}

type TPhase = 'ask' | 'think' | 'gen' | 'hold'

export function AIAssistantCard({ animate }: { animate: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const gate = useGate(ref)
    const running = animate && gate.active

    const [index, setIndex] = useState(0)
    const [phase, setPhase] = useState<TPhase>('ask')
    const [askLen, setAskLen] = useState(0)
    const [sqlLen, setSqlLen] = useState(0)
    const [paused, setPaused] = useState(false)

    const pair = PAIRS[index]
    const active = running && !paused

    // Drive the ask -> think -> gen -> hold state machine off a single timer per
    // phase so it can pause/resume cleanly when the card leaves the viewport.
    useEffect(() => {
        if (!active) return
        if (phase === 'ask') {
            if (askLen < pair.ask.length) {
                const id = setTimeout(() => setAskLen((n) => n + 1), 34)
                return () => clearTimeout(id)
            }
            const id = setTimeout(() => setPhase('think'), 360)
            return () => clearTimeout(id)
        }
        if (phase === 'think') {
            const id = setTimeout(() => setPhase('gen'), 620)
            return () => clearTimeout(id)
        }
        if (phase === 'gen') {
            if (sqlLen < pair.sql.length) {
                const id = setTimeout(() => setSqlLen((n) => n + 2), 18)
                return () => clearTimeout(id)
            }
            const id = setTimeout(() => setPhase('hold'), 1600)
            return () => clearTimeout(id)
        }
        // hold -> advance to the next pair
        const id = setTimeout(() => {
            setIndex((i) => (i + 1) % PAIRS.length)
            setAskLen(0)
            setSqlLen(0)
            setPhase('ask')
        }, 400)
        return () => clearTimeout(id)
    }, [active, phase, askLen, sqlLen, pair.ask.length, pair.sql.length])

    // When paused on hover, settle to the fully-rendered pair so it reads cleanly.
    function jumpTo(i: number) {
        setPaused(true)
        setIndex(i)
        setAskLen(PAIRS[i].ask.length)
        setSqlLen(PAIRS[i].sql.length)
        setPhase('hold')
    }

    const askTyping = phase === 'ask' && askLen < pair.ask.length
    const genTyping = phase === 'gen' && sqlLen < pair.sql.length
    const showSql = phase === 'gen' || phase === 'hold'

    function renderAnswer() {
        if (phase === 'think' && active)
            return (
                <div className="flex items-center gap-1 pt-1">
                    {[0, 1, 2].map((d) => (
                        <span
                            key={d}
                            className="h-1 w-1 rounded-full bg-[#e3b2b3]"
                            style={{
                                animation: `particleFloat 0.9s ease-in-out ${d * 140}ms infinite alternate`
                            }}
                        />
                    ))}
                </div>
            )
        if (!showSql) return null
        return (
            <pre className="whitespace-pre-wrap break-words font-mono text-[10.5px] leading-[1.5] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                <SqlTokens text={pair.sql.slice(0, sqlLen)} />
                {genTyping && active ? (
                    <span className="ml-px inline-block h-3 w-px animate-pulse bg-[#e3b2b3] align-middle" />
                ) : null}
            </pre>
        )
    }

    return (
        <div
            ref={ref}
            className="relative h-full flex flex-col overflow-hidden"
            onMouseLeave={() => setPaused(false)}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[34%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
                style={{
                    background:
                        'radial-gradient(circle, rgba(173,142,182,0.14) 0%, rgba(227,178,179,0.06) 40%, transparent 72%)'
                }}
            />

            <div className="relative flex-1 px-4 pt-5">
                {/* prompt row */}
                <div className="flex items-center gap-2 border border-[#2b252c] bg-[#100d12]/80 px-3 py-2">
                    <svg
                        viewBox="0 0 24 24"
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                        fill="none"
                    >
                        <path
                            d="M12 3l1.8 4.9L18.7 9.7 13.8 11.5 12 16.4 10.2 11.5 5.3 9.7 10.2 7.9z"
                            fill="#ad8eb6"
                        >
                            {active ? (
                                <animate
                                    attributeName="opacity"
                                    values="0.6;1;0.6"
                                    dur="2.2s"
                                    repeatCount="indefinite"
                                />
                            ) : null}
                        </path>
                    </svg>
                    <span className="min-w-0 truncate font-mono text-[11px] text-[#cfcfcf] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        {pair.ask.slice(0, askLen)}
                        {askTyping && active ? (
                            <span className="ml-px inline-block h-3 w-px animate-pulse bg-[#ad8eb6] align-middle" />
                        ) : null}
                    </span>
                </div>

                {/* generated SQL */}
                <div className="mt-2.5 min-h-[96px] border border-[#2b252c] bg-[#0d0a0f]/80 px-3 py-2.5">
                    {renderAnswer()}
                </div>
            </div>

            {/* pair selector dots */}
            <div className="flex items-center justify-center gap-1 px-5 pt-3">
                {PAIRS.map((p, idx) => (
                    <button
                        key={p.ask}
                        aria-label={`Show: ${p.ask}`}
                        onMouseEnter={() => jumpTo(idx)}
                        className="flex size-6 items-center justify-center"
                    >
                        <span
                            aria-hidden
                            className="h-1 transition-all duration-300"
                            style={{
                                width: idx === index ? 16 : 4,
                                backgroundColor:
                                    idx === index ? '#ad8eb6' : '#3a3138'
                            }}
                        />
                    </button>
                ))}
            </div>

            <div className="relative px-5 pb-5 pt-2">
                <h3 className="mb-1 font-pixel text-sm font-[500] text-[#e0e0e0]">
                    Ask in English
                </h3>
                <p className="text-xs text-[#8a8a8a] leading-relaxed">
                    Describe what you need. The AI writes the SQL, streams it
                    live, ready to run.
                </p>
            </div>
        </div>
    )
}
