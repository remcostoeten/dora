'use client'

import { useEffect, useRef, useState } from 'react'
import { FolderGit2 } from 'lucide-react'

import { CardAura } from './card-aura'
import { useGate } from './use-scroll-motion'
import { usePrefersReducedMotion } from '@/shared/hooks/use-prefers-reduced-motion'

/* ---------------------------------------------------------------------------
 * ORM Cockpit — a four-beat loop that mirrors the real cockpit flow: link a
 * Drizzle / Prisma project, watch the live DB get diffed against the code
 * schema, then generate the migration. Drift rows land one by one, each tagged
 * safe / review / destructive; "Generate migration" presses itself and the SQL
 * types out into the preview — destructive operations commented out, gated.
 * Source flips between Drizzle and Prisma on each loop. Honors reduced motion
 * by snapping to the finished state.
 * ------------------------------------------------------------------------- */

type TConf = 'safe' | 'review' | 'destructive'

const CONF: Record<
    TConf,
    { label: string; fg: string; bg: string; bd: string }
> = {
    safe: {
        label: 'safe',
        fg: 'var(--color-syntax-string)',
        bg: 'color-mix(in srgb, var(--color-syntax-string) 12%, transparent)',
        bd: 'color-mix(in srgb, var(--color-syntax-string) 32%, transparent)'
    },
    review: {
        label: 'review',
        fg: 'var(--color-syntax-keyword)',
        bg: 'color-mix(in srgb, var(--color-syntax-keyword) 12%, transparent)',
        bd: 'color-mix(in srgb, var(--color-syntax-keyword) 32%, transparent)'
    },
    destructive: {
        label: 'destructive',
        fg: 'var(--color-brand-500)',
        bg: 'color-mix(in srgb, var(--color-brand-500) 12%, transparent)',
        bd: 'color-mix(in srgb, var(--color-brand-500) 32%, transparent)'
    }
}

type TDrift = {
    sign: '+' | '~' | '−'
    table: string
    col: string
    detail: string
    conf: TConf
}

// DB (live) is the `from` side, code schema the `to` side — so "added in code"
// reads as "needs creating in the database". Same diff for either ORM; only the
// linked folder + badge flip.
const DRIFT: TDrift[] = [
    {
        sign: '+',
        table: 'users',
        col: 'last_login',
        detail: 'add nullable · timestamptz',
        conf: 'safe'
    },
    {
        sign: '+',
        table: 'orders',
        col: 'idx_status',
        detail: 'add index',
        conf: 'safe'
    },
    {
        sign: '~',
        table: 'posts',
        col: 'status',
        detail: 'varchar(20) → text',
        conf: 'review'
    },
    {
        sign: '−',
        table: 'sessions',
        col: 'legacy_token',
        detail: 'drop column',
        conf: 'destructive'
    }
]

const C = {
    kw: 'var(--color-brand-300)',
    punct: 'var(--color-ink-700)',
    ident: 'var(--color-brand-400)',
    type: 'var(--color-ink-400)',
    comment: 'var(--color-ink-700)'
}

type TSeg = { text: string; color: string }

// Generated migration, postgres dialect — the safe + review ops run, the
// destructive drop stays commented behind the review gate.
const SQL_SCRIPT: TSeg[] = [
    { text: 'ALTER TABLE ', color: C.kw },
    { text: '"users"', color: C.ident },
    { text: ' ADD COLUMN ', color: C.kw },
    { text: '"last_login"', color: C.ident },
    { text: ' timestamptz', color: C.type },
    { text: ';\n', color: C.punct },
    { text: 'CREATE INDEX ', color: C.kw },
    { text: '"idx_status"', color: C.ident },
    { text: ' ON ', color: C.kw },
    { text: '"orders"', color: C.ident },
    { text: ' (', color: C.punct },
    { text: '"status"', color: C.ident },
    { text: ');\n', color: C.punct },
    { text: 'ALTER TABLE ', color: C.kw },
    { text: '"posts"', color: C.ident },
    { text: ' ALTER COLUMN ', color: C.kw },
    { text: '"status"', color: C.ident },
    { text: ' TYPE ', color: C.kw },
    { text: 'text', color: C.type },
    { text: ';\n\n', color: C.punct },
    { text: '-- destructive · gated behind review\n', color: C.comment },
    {
        text: '-- ALTER TABLE "sessions" DROP COLUMN "legacy_token";',
        color: C.comment
    }
]

function charsFor(script: TSeg[]) {
    return script.flatMap((seg) =>
        [...seg.text].map((ch) => ({ ch, color: seg.color }))
    )
}

const SQL_CHARS = charsFor(SQL_SCRIPT)

function toSpans(slice: { ch: string; color: string }[]) {
    const spans: { text: string; color: string }[] = []
    for (const c of slice) {
        const last = spans[spans.length - 1]
        if (last && last.color === c.color) last.text += c.ch
        else spans.push({ text: c.ch, color: c.color })
    }
    return spans
}

type TLang = 'drizzle' | 'prisma'
type TStage = 'link' | 'drift' | 'generate' | 'sql'

const SOURCE: Record<TLang, { folder: string; accent: string }> = {
    drizzle: { folder: 'apps/web/db', accent: 'var(--color-brand-300)' },
    prisma: { folder: 'server/prisma', accent: 'var(--color-vendor-prisma)' }
}

export function OrmCockpitCard({ animate }: { animate: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const caretRef = useRef<HTMLSpanElement>(null)
    const gate = useGate(ref)
    const reduced = usePrefersReducedMotion()
    const running = animate && gate.active

    const [stage, setStage] = useState<TStage>('link')
    const [driftShown, setDriftShown] = useState(0)
    const [sqlChars, setSqlChars] = useState(0)
    const [lang, setLang] = useState<TLang>('drizzle')
    const [pressed, setPressed] = useState(false)

    useEffect(() => {
        if (!running) return
        let cancelled = false
        const sleep = (ms: number) =>
            new Promise<void>((resolve) => setTimeout(resolve, ms))

        async function play() {
            let mode: TLang = 'drizzle'
            while (!cancelled) {
                setLang(mode)
                setStage('link')
                setDriftShown(0)
                setSqlChars(0)
                setPressed(false)
                await sleep(720)
                if (cancelled) return

                // Drift rows land one by one.
                setStage('drift')
                for (let i = 1; i <= DRIFT.length; i++) {
                    if (cancelled) return
                    setDriftShown(i)
                    await sleep(230)
                }
                await sleep(820)
                if (cancelled) return

                // Press "Generate migration".
                setStage('generate')
                setPressed(true)
                await sleep(180)
                setPressed(false)
                await sleep(260)
                if (cancelled) return

                // Type the SQL out.
                setStage('sql')
                for (let i = 1; i <= SQL_CHARS.length; i++) {
                    if (cancelled) return
                    setSqlChars(i)
                    const ch = SQL_CHARS[i - 1].ch
                    await sleep(ch === '\n' ? 34 : 9)
                }
                await sleep(2000)
                mode = mode === 'drizzle' ? 'prisma' : 'drizzle'
            }
        }

        play()
        return () => {
            cancelled = true
        }
    }, [running])

    const activeLang: TLang = running ? lang : 'drizzle'
    const src = SOURCE[activeLang]
    // Reduced-motion / pre-view: show the finished state, no self-wiping replay.
    const shownDrift = running ? driftShown : reduced ? DRIFT.length : 0
    const shownSql = running ? sqlChars : reduced ? SQL_CHARS.length : 0
    const isLinking = running && stage === 'link'
    const isTyping = running && stage === 'sql' && sqlChars < SQL_CHARS.length
    const spans = toSpans(SQL_CHARS.slice(0, shownSql))
    const hasSql = shownSql > 0

    const safeCount = DRIFT.filter((d) => d.conf === 'safe').length
    const reviewCount = DRIFT.filter((d) => d.conf === 'review').length
    const destructiveCount = DRIFT.filter(
        (d) => d.conf === 'destructive'
    ).length

    function status(): { color: string; label: string } {
        if (isLinking) return { color: 'var(--color-ink-600)', label: 'detecting project…' }
        if (running && stage === 'drift')
            return {
                color: 'var(--color-syntax-keyword)',
                label: `${shownDrift} changes · diffing`
            }
        if (running && stage === 'generate')
            return { color: 'var(--color-brand-300)', label: 'generating migration…' }
        return {
            color: 'var(--color-syntax-string)',
            label: `${safeCount} safe · ${reviewCount} review · ${destructiveCount} destructive`
        }
    }
    const { color: statusColor, label: statusLabel } = status()

    return (
        <div
            ref={ref}
            className="relative flex h-full flex-col overflow-hidden"
        >
            <CardAura active={running} />

            <div className="relative px-4 pt-5 pb-4">
                {/* Linked-project header */}
                <div className="relative flex items-center gap-2 overflow-hidden border border-line bg-surface-deeper/80 px-2.5 py-1.5">
                    {isLinking ? (
                        <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background:
                                    'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-brand-300) 10%, transparent), transparent)',
                                animation:
                                    'providerScanSweep 1.1s ease-in-out infinite'
                            }}
                        />
                    ) : null}
                    <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    <span className="truncate font-mono text-[10.5px] text-ink-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        {src.folder}
                    </span>
                    <span
                        className="ml-auto shrink-0 rounded-[2px] border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] transition-colors duration-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                        style={{
                            color: src.accent,
                            borderColor: `${src.accent}55`,
                            backgroundColor: `${src.accent}14`
                        }}
                    >
                        {activeLang}
                    </span>
                </div>

                {/* Schema drift */}
                <div className="mt-2 overflow-hidden border border-line bg-surface-deep/70">
                    <div className="flex items-center justify-between border-b border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-700 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        <span>schema drift</span>
                        <span>
                            {shownDrift > 0 ? `${shownDrift} changes` : '—'}
                        </span>
                    </div>
                    <div className="divide-y divide-[var(--color-surface-raised)]">
                        {DRIFT.map((row, i) => {
                            const shown = shownDrift > i
                            const conf = CONF[row.conf]
                            return (
                                <div
                                    key={`${row.table}.${row.col}`}
                                    className="flex items-center gap-2 px-2.5 py-[5px] font-mono text-[10px] [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                                    style={{
                                        opacity: shown ? 1 : 0,
                                        transform: shown
                                            ? 'translateX(0)'
                                            : 'translateX(-6px)',
                                        transition:
                                            'opacity 300ms ease, transform 360ms cubic-bezier(0.34,1.56,0.64,1)'
                                    }}
                                >
                                    <span
                                        className="w-2 shrink-0 text-center font-bold"
                                        style={{ color: conf.fg }}
                                    >
                                        {row.sign}
                                    </span>
                                    <span className="shrink-0 text-ink-300">
                                        {row.table}
                                        <span className="text-ink-700">
                                            .
                                        </span>
                                        <span className="text-brand-400">
                                            {row.col}
                                        </span>
                                    </span>
                                    <span className="truncate text-[9.5px] text-ink-600">
                                        {row.detail}
                                    </span>
                                    <span
                                        className="ml-auto shrink-0 rounded-[2px] border px-1.5 py-px text-[8px] uppercase tracking-[0.08em]"
                                        style={{
                                            color: conf.fg,
                                            backgroundColor: conf.bg,
                                            borderColor: conf.bd
                                        }}
                                    >
                                        {conf.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Generate migration */}
                <div className="mt-2 flex items-center gap-2">
                    <span
                        className="inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] transition-all duration-150 [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                        style={{
                            color: 'var(--color-syntax-ident)',
                            borderColor: 'color-mix(in srgb, var(--color-status-ok-dim) 40%, transparent)',
                            backgroundColor: pressed
                                ? 'color-mix(in srgb, var(--color-status-ok-dim) 22%, transparent)'
                                : 'color-mix(in srgb, var(--color-status-ok-dim) 10%, transparent)',
                            transform: pressed ? 'scale(0.96)' : 'scale(1)'
                        }}
                    >
                        <span aria-hidden>✦</span> Generate migration
                    </span>
                    <span
                        className="ml-auto h-1.5 w-1.5 rounded-full transition-colors duration-300"
                        style={{
                            backgroundColor: statusColor,
                            boxShadow: `0 0 8px ${statusColor}99`
                        }}
                    />
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-600 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        {statusLabel}
                    </span>
                </div>

                {/* Migration preview */}
                <div className="mt-2 overflow-hidden border border-line bg-surface-deeper/80">
                    <div className="border-b border-line px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-700 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        migration preview · postgres
                    </div>
                    <pre className="relative min-h-[112px] whitespace-pre px-2.5 py-2 font-mono text-[10px] leading-[1.6] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        {hasSql ? (
                            spans.map((s, i) => (
                                <span key={i} style={{ color: s.color }}>
                                    {s.text}
                                </span>
                            ))
                        ) : (
                            <span className="text-ink-800">
                                Generate a migration from the drift above.
                            </span>
                        )}
                        {isTyping ? (
                            <span
                                ref={caretRef}
                                aria-hidden
                                className="ml-px inline-block h-[1.05em] w-[1.5px] -mb-[0.18em] bg-brand-300"
                                style={{
                                    animation: 'lspCaret 1s steps(1) infinite'
                                }}
                            />
                        ) : null}
                    </pre>
                </div>
            </div>
        </div>
    )
}
