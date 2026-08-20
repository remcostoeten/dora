'use client'

import { AnimatePresence, m } from 'framer-motion'
import {
    Copy,
    Send,
    Sparkles,
    SquareTerminal,
    Table2,
    Trash2,
    X
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { copyText } from '@/components/hero-app-demo-export'

/**
 * Mock replica of the real right-docked AI assistant: suggestion chips, a
 * chat transcript with a typewriter-streamed reply and a SQL block whose
 * "Run in console" genuinely switches the demo to the SQL console view.
 */

type TAnswer = { text: string; sql: string[] }

type TChatMessage = {
    id: number
    role: 'user' | 'assistant'
    question: string
    text: string
    sql: string[]
    done: boolean
}

const ANSWERS: Record<string, TAnswer> = {
    'Which customers spend the most?': {
        text: 'Joining orders onto customers and summing totals per customer gives you a spend ranking. Refunded and cancelled orders are excluded:',
        sql: [
            'SELECT c.name, SUM(o.total) AS spend',
            'FROM customers c',
            'JOIN orders o ON o.customer_id = c.id',
            "WHERE o.status NOT IN ('refunded', 'cancelled')",
            'GROUP BY c.id ORDER BY spend DESC LIMIT 10;'
        ]
    },
    'Find orders missing payment': {
        text: 'An anti-join surfaces orders that never got a successful transaction — usually stuck checkouts or webhook drops:',
        sql: [
            'SELECT o.id, o.total, o.placed_at',
            'FROM orders o',
            'LEFT JOIN transactions t ON t.order_id = o.id',
            "  AND t.status = 'succeeded'",
            'WHERE t.id IS NULL;'
        ]
    },
    'Draft a churn query': {
        text: 'Cancelled and past-due subscriptions against the active base give you a simple monthly churn read:',
        sql: [
            'SELECT status, COUNT(*) AS subs,',
            '  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS pct',
            'FROM subscriptions',
            'GROUP BY status ORDER BY subs DESC;'
        ]
    }
}

const FALLBACK: TAnswer = {
    text: 'Based on the connected schema, this query answers that against the live data:',
    sql: [
        'SELECT status, COUNT(*) AS orders, SUM(total) AS revenue',
        'FROM orders',
        'GROUP BY status ORDER BY revenue DESC;'
    ]
}

const SUGGESTIONS = Object.keys(ANSWERS)

const TYPE_INTERVAL_MS = 14
const TYPE_CHUNK = 3

type Props = {
    open: boolean
    tableName: string
    onClose: () => void
    onOpenConsole: () => void
}

export function AiAssistantPanel({
    open,
    tableName,
    onClose,
    onOpenConsole
}: Props) {
    const [messages, setMessages] = useState<TChatMessage[]>([])
    const [draft, setDraft] = useState('')
    const nextIdRef = useRef(1)
    const scrollRef = useRef<HTMLDivElement>(null)

    const streaming = messages.some((message) => !message.done)

    useEffect(() => {
        const pending = messages.find((message) => !message.done)
        if (!pending) return
        const answer = ANSWERS[pending.question] ?? FALLBACK
        const target = answer.text
        const timer = window.setInterval(() => {
            setMessages((current) =>
                current.map((message) => {
                    if (message.id !== pending.id) return message
                    const shown = target.slice(
                        0,
                        message.text.length + TYPE_CHUNK
                    )
                    if (shown.length >= target.length) {
                        return {
                            ...message,
                            text: target,
                            sql: answer.sql,
                            done: true
                        }
                    }
                    return { ...message, text: shown }
                })
            )
        }, TYPE_INTERVAL_MS)
        return () => window.clearInterval(timer)
    }, [messages])

    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight
        })
    }, [messages])

    function ask(question: string) {
        if (streaming) return
        const userId = nextIdRef.current
        nextIdRef.current += 2
        setMessages((current) =>
            current.concat(
                {
                    id: userId,
                    role: 'user',
                    question,
                    text: question,
                    sql: [],
                    done: true
                },
                {
                    id: userId + 1,
                    role: 'assistant',
                    question,
                    text: '',
                    sql: [],
                    done: false
                }
            )
        )
    }

    function send() {
        const question = draft.trim()
        if (!question || streaming) return
        setDraft('')
        ask(question)
    }

    return (
        <AnimatePresence>
            {open && (
                <m.aside
                    initial={{ x: 320, opacity: 0.6 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 320, opacity: 0 }}
                    transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 34
                    }}
                    className="absolute bottom-0 right-0 top-0 z-30 flex w-[300px] flex-col border-l border-sidebar-border bg-sidebar shadow-2xl"
                    aria-label="AI Assistant"
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 border-b border-sidebar-border px-3 py-2.5 shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-foreground" />
                        <span className="text-xs font-medium text-foreground">
                            AI Assistant
                        </span>
                        <span className="inline-flex h-4 items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 text-[9px] font-medium text-emerald-400">
                            <span className="h-1 w-1 rounded-full bg-emerald-400" />
                            Ready
                        </span>
                        <div className="ml-auto flex items-center gap-0.5">
                            <button
                                type="button"
                                aria-label="Clear chat"
                                onClick={() => setMessages([])}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                            <button
                                type="button"
                                aria-label="Close assistant"
                                onClick={onClose}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Context chip */}
                    <div className="flex items-center gap-1.5 border-b border-sidebar-border px-3 py-1.5 shrink-0">
                        <Table2 className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-[10px] text-muted-foreground">
                            {tableName}
                        </span>
                    </div>

                    {/* Transcript */}
                    <div
                        ref={scrollRef}
                        className="hero-connection-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3"
                    >
                        {messages.length === 0 ? (
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    Suggestions
                                </span>
                                {SUGGESTIONS.map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        onClick={() => ask(suggestion)}
                                        className="rounded-md border border-sidebar-border bg-background/40 px-2.5 py-2 text-left text-[11px] text-sidebar-foreground transition-colors hover:border-sidebar-border hover:bg-sidebar-accent"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5">
                                {messages.map((message) =>
                                    message.role === 'user' ? (
                                        <div
                                            key={message.id}
                                            className="ml-6 rounded-lg rounded-br-sm bg-sidebar-accent px-2.5 py-1.5 text-[11px] text-sidebar-foreground"
                                        >
                                            {message.text}
                                        </div>
                                    ) : (
                                        <div
                                            key={message.id}
                                            className="mr-2 text-[11px] leading-relaxed text-foreground/85"
                                        >
                                            {message.text}
                                            {!message.done && (
                                                <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-foreground/60 align-middle" />
                                            )}
                                            {message.sql.length > 0 && (
                                                <div className="mt-2 overflow-hidden rounded-md border border-sidebar-border bg-background">
                                                    <pre className="m-0 overflow-x-auto px-2.5 py-2 font-mono text-[10px] leading-relaxed text-syntax-ident">
                                                        {message.sql.join('\n')}
                                                    </pre>
                                                    <div className="flex items-center gap-0.5 border-t border-sidebar-border px-1 py-1">
                                                        <button
                                                            type="button"
                                                            onClick={
                                                                onOpenConsole
                                                            }
                                                            className="inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[9px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                                                        >
                                                            <SquareTerminal className="h-2.5 w-2.5" />
                                                            Run in console
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                copyText(
                                                                    message.sql.join(
                                                                        '\n'
                                                                    )
                                                                )
                                                            }
                                                            className="inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-[9px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                                                        >
                                                            <Copy className="h-2.5 w-2.5" />
                                                            Copy
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* Composer */}
                    <div className="border-t border-sidebar-border p-2 shrink-0">
                        <div className="flex items-end gap-1.5">
                            <textarea
                                value={draft}
                                rows={1}
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' &&
                                        !event.shiftKey
                                    ) {
                                        event.preventDefault()
                                        send()
                                    }
                                }}
                                placeholder="Ask anything about your database..."
                                className="max-h-16 min-h-8 flex-1 resize-none rounded-md border border-sidebar-border/60 bg-background/30 px-2.5 py-1.5 text-[11px] text-sidebar-foreground outline-hidden transition-colors placeholder:text-muted-foreground/60 focus:border-sidebar-border"
                            />
                            <button
                                type="button"
                                aria-label="Send"
                                onClick={send}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
                                disabled={!draft.trim() || streaming}
                            >
                                <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        <div className="mt-1.5 px-0.5 text-[9px] text-muted-foreground/60">
                            claude-sonnet · keys configured in Settings
                        </div>
                    </div>
                </m.aside>
            )}
        </AnimatePresence>
    )
}
