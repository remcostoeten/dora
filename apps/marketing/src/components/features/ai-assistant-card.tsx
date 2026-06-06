'use client'

import { useEffect, useRef, useState } from 'react'

import { CardAura } from './card-aura'
import { useGate } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * AI Assistant — natural-language → SQL. An English question types into the
 * prompt row, the assistant "thinks" for a beat, then streams a syntax-tinted
 * SQL answer token-by-token with a blinking caret. Auto-cycles through the
 * pairs on a loop — no manual controls, the animation advances itself.
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

// Gradient AI sparkle — the visual signature that the answer is generated.
function Sparkle({ className, spin }: { className?: string; spin?: boolean }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            aria-hidden="true"
            fill="none"
        >
            <defs>
                <linearGradient id="ai-spark" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#ad8eb6" />
                    <stop offset="1" stopColor="#f5c0c0" />
                </linearGradient>
            </defs>
            <path
                d="M12 2.2l1.9 5.6 5.6 1.9-5.6 1.9L12 17.2l-1.9-5.6L4.5 9.7l5.6-1.9z"
                fill="url(#ai-spark)"
            >
                {spin ? (
                    <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 12 9.7"
                        to="360 12 9.7"
                        dur="4s"
                        repeatCount="indefinite"
                    />
                ) : null}
            </path>
            <path
                d="M18.8 13.4l.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8z"
                fill="url(#ai-spark)"
                opacity="0.85"
            />
        </svg>
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

    const pair = PAIRS[index]
    const active = running

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

    const askTyping = phase === 'ask' && askLen < pair.ask.length
    const genTyping = phase === 'gen' && sqlLen < pair.sql.length
    const showSql = phase === 'gen' || phase === 'hold'

    const thinking = phase === 'think'
    const answering = thinking || showSql

    function aiStatus(): { label: string; color: string } {
        if (thinking) return { label: 'generating…', color: '#9a8aa0' }
        if (genTyping) return { label: 'writing SQL', color: '#9a8aa0' }
        return { label: 'ready ✓', color: '#6f9e78' }
    }

    function renderBody() {
        if (thinking && active)
            return (
                <div className="flex items-center gap-1 pl-0.5">
                    {[0, 1, 2].map((d) => (
                        <span
                            key={d}
                            className="h-1 w-1 rounded-full bg-[#c9a3b5]"
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

    function renderAnswer() {
        if (!answering) return null
        const status = aiStatus()
        return (
            <>
                {/* AI assistant label */}
                <div className="mb-2 flex items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-full border border-[#ad8eb6]/30 bg-[#ad8eb6]/10 py-[1px] pl-1 pr-1.5">
                        <Sparkle
                            className="h-2.5 w-2.5"
                            spin={active && thinking}
                        />
                        <span className="font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-[#c9a3b5] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                            Dora AI
                        </span>
                    </span>
                    <span
                        className="font-mono text-[8.5px] tracking-[0.04em] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                        style={{ color: status.color }}
                    >
                        {status.label}
                    </span>
                </div>
                {renderBody()}
            </>
        )
    }

    return (
        <div
            ref={ref}
            className="relative h-full flex flex-col overflow-hidden"
        >
            <CardAura active={active} />

            <div className="relative flex-1 px-4 pt-5">
                {/* prompt row — the user's question */}
                <div className="flex items-center gap-2 border border-[#2b252c] bg-[#100d12]/80 px-3 py-2">
                    <span className="shrink-0 font-mono text-[12px] leading-none text-[#ad8eb6]/70 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        ›
                    </span>
                    <span className="min-w-0 truncate font-mono text-[11px] text-[#cfcfcf] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        {askLen === 0 && active ? (
                            <span className="text-[#5a5560]">
                                ask your database…
                            </span>
                        ) : (
                            pair.ask.slice(0, askLen)
                        )}
                        {askTyping && active ? (
                            <span className="ml-px inline-block h-3 w-px animate-pulse bg-[#ad8eb6] align-middle" />
                        ) : null}
                    </span>
                </div>

                {/* AI-generated answer */}
                <div className="mt-2.5 min-h-[112px] border border-[#ad8eb6]/15 bg-[#0d0a0f]/80 px-3 py-2.5">
                    {renderAnswer()}
                </div>
            </div>

            <div className="relative px-5 pb-5 pt-4">
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
