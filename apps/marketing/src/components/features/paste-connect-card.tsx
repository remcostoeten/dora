'use client'

import { useRef, useEffect, useState } from 'react'

import { useGate } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * Paste to Connect — a parse-on-paste demo. A connection string sits in a
 * paste bar; a left-to-right "parse sweep" lights each segment of the URL and
 * fills the matching form field beneath it in the SAME colour, so the
 * segment -> field mapping reads at a glance. Cycles across providers.
 * ------------------------------------------------------------------------- */

// One colour per field, reused across every sample so the URL token and its
// parsed field always share a hue.
const COLORS: Record<string, string> = {
    type: 'var(--color-syntax-value)',
    host: 'var(--color-brand-200)',
    port: 'var(--color-brand-300)',
    user: 'var(--color-brand-300)',
    password: 'var(--color-brand-400)',
    database: 'var(--color-brand-600)',
    ssl: 'var(--color-syntax-value)'
}

type TField = { key: string; label: string; value: string; color: string }
type TToken = { str: string; key?: string } // no key === punctuation
type TSample = { provider: string; tokens: TToken[]; fields: TField[] }

type TSpec = {
    provider: string
    scheme: string
    user: string
    password: string
    host: string
    port: string
    database: string
    sslParam: string
    sslValue: string
}

// Fields are listed in the order the sweep reads them — which is also the
// order they appear in the grid below.
function makeSample(spec: TSpec): TSample {
    const masked = '•'.repeat(6)
    const tokens: TToken[] = [
        { str: spec.scheme, key: 'type' },
        { str: '://' },
        { str: spec.user, key: 'user' },
        { str: ':' },
        { str: spec.password, key: 'password' },
        { str: '@' },
        { str: spec.host, key: 'host' },
        { str: ':' },
        { str: spec.port, key: 'port' },
        { str: '/' },
        { str: spec.database, key: 'database' },
        { str: '?' },
        { str: spec.sslParam, key: 'ssl' }
    ]
    const fields: TField[] = [
        { key: 'host', label: 'Host', value: spec.host, color: COLORS.host },
        { key: 'port', label: 'Port', value: spec.port, color: COLORS.port },
        { key: 'user', label: 'User', value: spec.user, color: COLORS.user },
        {
            key: 'password',
            label: 'Password',
            value: masked,
            color: COLORS.password
        },
        {
            key: 'database',
            label: 'Database',
            value: spec.database,
            color: COLORS.database
        },
        { key: 'ssl', label: 'SSL', value: spec.sslValue, color: COLORS.ssl }
    ]
    return { provider: spec.provider, tokens, fields }
}

const SAMPLES: TSample[] = [
    makeSample({
        provider: 'PostgreSQL',
        scheme: 'postgresql',
        user: 'app',
        password: 's3cr3t',
        host: 'db.neon.tech',
        port: '5432',
        database: 'store',
        sslParam: 'sslmode=require',
        sslValue: 'require'
    }),
    makeSample({
        provider: 'MySQL',
        scheme: 'mysql',
        user: 'root',
        password: 'pscale',
        host: 'aws.psdb.cloud',
        port: '3306',
        database: 'shop',
        sslParam: 'ssl=true',
        sslValue: 'true'
    }),
    makeSample({
        provider: 'CockroachDB',
        scheme: 'postgresql',
        user: 'dev',
        password: 'roach',
        host: 'free.cockroachlabs.cloud',
        port: '26257',
        database: 'defaultdb',
        sslParam: 'sslmode=verify-full',
        sslValue: 'verify-full'
    })
]

const STEP_MS = 560

function ClipboardIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect x="8" y="2" width="8" height="4" rx="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </svg>
    )
}

function CheckIcon({ color }: { color: string }) {
    return (
        <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M20 6 9 17l-5-5" />
        </svg>
    )
}

export function PasteConnectCard({ animate }: { animate: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const [sample, setSample] = useState(0)
    const [frame, setFrame] = useState(0)
    const gate = useGate(ref)
    const running = animate && gate.active

    const current = SAMPLES[sample]
    const len = current.fields.length

    // frame 0          -> just pasted, nothing parsed yet
    // frame 1..len     -> field (frame-1) is being scanned, earlier ones done
    // frame len+1..+3  -> all parsed, hold before cycling
    useEffect(
        function runParseLoop() {
            if (!running) return
            const id = setInterval(function tick() {
                setFrame(function (f) {
                    if (f >= len + 3) {
                        setSample((s) => (s + 1) % SAMPLES.length)
                        return 0
                    }
                    return f + 1
                })
            }, STEP_MS)
            return () => clearInterval(id)
        },
        [running, len]
    )

    const settled = !running
    const showFinished = settled || frame > len
    const activeIdx = settled
        ? -1
        : frame >= 1 && frame <= len
          ? frame - 1
          : -1
    const doneCount = settled
        ? len
        : frame === 0
          ? 0
          : frame <= len
            ? frame - 1
            : len

    function stateOf(i: number): 'done' | 'active' | 'empty' {
        if (showFinished) return 'done'
        if (i === activeIdx) return 'active'
        if (i < doneCount) return 'done'
        return 'empty'
    }

    const fieldIndex: Record<string, number> = {}
    current.fields.forEach((f, i) => {
        fieldIndex[f.key] = i
    })

    const detected = settled || frame >= 1

    return (
        <div ref={ref} className="h-full flex flex-col">
            <div className="flex-1 flex flex-col justify-center gap-3 px-5 pt-5">
                {/* paste bar */}
                <div className="flex items-start gap-2 rounded-[3px] border border-line bg-surface-deep/80 px-2.5 py-2">
                    <span className="mt-px shrink-0 text-ink-700">
                        <ClipboardIcon />
                    </span>
                    <code className="min-w-0 flex-1 font-mono text-[10.5px] leading-[1.5] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        {current.tokens.map((token, i) => {
                            if (!token.key) {
                                return (
                                    <span
                                        key={i}
                                        className="whitespace-nowrap text-ink-800"
                                    >
                                        {token.str}
                                    </span>
                                )
                            }
                            const color = COLORS[token.key]
                            const st =
                                token.key === 'type'
                                    ? detected
                                        ? 'done'
                                        : 'empty'
                                    : stateOf(fieldIndex[token.key])
                            const isActive = st === 'active'
                            const isLit = st !== 'empty'
                            return (
                                <span
                                    key={i}
                                    className="whitespace-nowrap rounded-[2px] px-px transition-all duration-300"
                                    style={{
                                        color: isLit ? color : 'var(--color-ink-700)',
                                        opacity: isLit ? (isActive ? 1 : 0.82) : 1,
                                        backgroundColor: isActive
                                            ? `${color}24`
                                            : 'transparent'
                                    }}
                                >
                                    {token.str}
                                </span>
                            )
                        })}
                    </code>
                    {/* detected provider badge */}
                    <span
                        className="mt-px flex shrink-0 items-center gap-1 transition-opacity duration-300"
                        style={{ opacity: detected ? 1 : 0 }}
                    >
                        {showFinished ? (
                            <CheckIcon color={COLORS.type} />
                        ) : (
                            <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                    backgroundColor: COLORS.type,
                                    boxShadow: `0 0 6px ${COLORS.type}99`
                                }}
                            />
                        )}
                        <span className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.08em] text-ink-400">
                            {current.provider}
                        </span>
                    </span>
                </div>

                {/* parsed fields */}
                <div className="grid grid-cols-2 gap-1.5">
                    {current.fields.map((field, i) => {
                        const st = stateOf(i)
                        const filled = st !== 'empty'
                        const isActive = st === 'active'
                        return (
                            <div
                                key={field.key}
                                className="rounded-[3px] border px-2 py-1 transition-all duration-300"
                                style={{
                                    borderColor: isActive
                                        ? `${field.color}b3`
                                        : filled
                                          ? `${field.color}40`
                                          : 'var(--color-surface-raised)',
                                    backgroundColor: isActive
                                        ? `${field.color}12`
                                        : 'transparent',
                                    boxShadow: isActive
                                        ? `0 0 0 1px ${field.color}40, 0 0 12px -2px ${field.color}80`
                                        : 'none'
                                }}
                            >
                                <div className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-ink-700">
                                    {field.label}
                                </div>
                                <div className="relative mt-0.5 h-3.5">
                                    {/* skeleton placeholder */}
                                    <span
                                        className="absolute left-0 top-1/2 block h-[3px] w-2/3 -translate-y-1/2 rounded-full bg-surface-raised transition-opacity duration-300"
                                        style={{ opacity: filled ? 0 : 1 }}
                                    />
                                    {/* parsed value */}
                                    <span
                                        className="block truncate font-mono text-[10.5px] leading-[14px] transition-all duration-300"
                                        style={{
                                            color: field.color,
                                            opacity: filled ? 1 : 0,
                                            transform: filled
                                                ? 'none'
                                                : 'translateY(3px)'
                                        }}
                                    >
                                        {field.value}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="px-5 pb-5 pt-3">
                <h3 className="mb-1 font-pixel text-sm font-[500] text-ink-200">
                    Paste to Connect
                </h3>
                <p className="text-xs text-ink-500 leading-relaxed">
                    Drop in any connection string — Dora parses every field
                    automatically.
                </p>
            </div>
        </div>
    )
}
