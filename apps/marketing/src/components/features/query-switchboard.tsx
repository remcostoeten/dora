'use client'

import { useEffect, useRef, useState } from 'react'

import { CardAura } from './card-aura'
import { useGate } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * Query switchboard — three input dialects (English, Drizzle, Prisma) wired
 * into one shared engine pane. The active rail row auto-cycles and types its
 * query (ORM rows get the LSP completion popup), then a signal dot travels the
 * patch cable into the engine, the compiled SQL streams in, and rows land.
 * The cable itself slides to whichever row is speaking.
 * ------------------------------------------------------------------------- */

const C = {
    punct: 'var(--color-ink-600)',
    method: 'var(--color-syntax-key)',
    fn: 'var(--color-syntax-key)',
    table: 'var(--color-syntax-keyword)',
    prop: 'var(--color-syntax-value)',
    id: 'var(--color-ink-200)',
    string: 'var(--color-syntax-string)'
}

type TItem = { name: string; detail: string; kind: 'M' | 'F' }
type TPopup = { items: TItem[]; target: number }
type TSeg = { text: string; color: string; accept?: TPopup }

const METHODS: TItem[] = [
    { name: 'delete', detail: 'table => ...', kind: 'M' },
    { name: 'insert', detail: 'into(table)', kind: 'M' },
    { name: 'query', detail: 'RelationalQuery', kind: 'M' },
    { name: 'select', detail: 'fields? => ...', kind: 'M' },
    { name: 'update', detail: 'set(values)', kind: 'M' }
]

const MODELS: TItem[] = [
    { name: 'order', detail: 'OrderDelegate', kind: 'M' },
    { name: 'post', detail: 'PostDelegate', kind: 'M' },
    { name: 'user', detail: 'UserDelegate', kind: 'M' },
    { name: 'session', detail: 'SessionDelegate', kind: 'M' }
]

const DRIZZLE_LINE: TSeg[] = [
    { text: 'db', color: C.id },
    { text: '.', color: C.punct },
    { text: 'select', color: C.method, accept: { items: METHODS, target: 3 } },
    { text: '().', color: C.punct },
    { text: 'from', color: C.method },
    { text: '(', color: C.punct },
    { text: 'users', color: C.table },
    { text: ').', color: C.punct },
    { text: 'where', color: C.method },
    { text: '(', color: C.punct },
    { text: 'eq', color: C.fn },
    { text: '(', color: C.punct },
    { text: 'users.', color: C.table },
    { text: 'plan', color: C.prop },
    { text: ', ', color: C.punct },
    { text: "'pro'", color: C.string },
    { text: '))', color: C.punct }
]

const PRISMA_LINE: TSeg[] = [
    { text: 'prisma', color: C.id },
    { text: '.', color: C.punct },
    { text: 'user', color: C.table, accept: { items: MODELS, target: 2 } },
    { text: '.', color: C.punct },
    { text: 'findMany', color: C.method },
    { text: '({ ', color: C.punct },
    { text: 'where', color: C.prop },
    { text: ': { ', color: C.punct },
    { text: 'plan', color: C.prop },
    { text: ': ', color: C.punct },
    { text: "'pro'", color: C.string },
    { text: ' } })', color: C.punct }
]

type TColumn = {
    label: string
    tone: 'dim' | 'main' | 'accent'
    align?: 'right'
}

type TMode = {
    id: string
    label: string
    ask?: string
    script?: TSeg[]
    sql: string
    streamLabel: string
    grid: string
    columns: TColumn[]
    rows: string[][]
}

const MODES: TMode[] = [
    {
        id: 'english',
        label: 'English',
        ask: 'top 5 customers by revenue',
        sql: 'SELECT name, sum(total) AS revenue\nFROM orders\nGROUP BY name\nORDER BY revenue DESC\nLIMIT 5;',
        streamLabel: 'writing sql',
        grid: 'minmax(0,1fr) 5.5rem',
        columns: [
            { label: 'name', tone: 'main' },
            { label: 'revenue', tone: 'accent', align: 'right' }
        ],
        rows: [
            ['Acme Co', '48,120'],
            ['Globex', '31,480'],
            ['Initech', '27,904']
        ]
    },
    {
        id: 'drizzle',
        label: 'Drizzle',
        script: DRIZZLE_LINE,
        sql: 'select "id", "email", "plan"\nfrom "users"\nwhere "users"."plan" = \'pro\';',
        streamLabel: 'sql preview',
        grid: '2.5rem minmax(0,1fr) 3rem',
        columns: [
            { label: 'id', tone: 'dim' },
            { label: 'email', tone: 'main' },
            { label: 'plan', tone: 'accent', align: 'right' }
        ],
        rows: [
            ['42', 'maya@dora.dev', 'pro'],
            ['57', 'ravi@dora.dev', 'pro'],
            ['83', 'lina@dora.dev', 'pro']
        ]
    },
    {
        id: 'prisma',
        label: 'Prisma',
        script: PRISMA_LINE,
        sql: 'SELECT "id", "email", "plan"\nFROM "users"\nWHERE "plan" = \'pro\';',
        streamLabel: 'sql preview',
        grid: '2.5rem minmax(0,1fr) 3rem',
        columns: [
            { label: 'id', tone: 'dim' },
            { label: 'email', tone: 'main' },
            { label: 'plan', tone: 'accent', align: 'right' }
        ],
        rows: [
            ['42', 'maya@dora.dev', 'pro'],
            ['57', 'ravi@dora.dev', 'pro'],
            ['83', 'lina@dora.dev', 'pro']
        ]
    }
]

const KEYWORDS = new Set([
    'select',
    'from',
    'where',
    'group',
    'by',
    'order',
    'desc',
    'limit',
    'sum',
    'as'
])

const ROW_H = 76
const ROW_GAP = 8
const POPUP_WIDTH = 196
const MONO = '[font-family:var(--font-geist-mono),ui-monospace,monospace]'

function SqlTokens({ text }: { text: string }) {
    const parts = text.split(/(\s+|,|;|\(|\))/)
    return (
        <>
            {parts.map((part, i) => {
                if (part.includes("'"))
                    return (
                        <span key={i} className="text-syntax-string">
                            {part}
                        </span>
                    )
                if (part.startsWith('"'))
                    return (
                        <span key={i} className="text-syntax-key">
                            {part}
                        </span>
                    )
                if (/^\d+$/.test(part))
                    return (
                        <span key={i} className="text-syntax-number">
                            {part}
                        </span>
                    )
                if (KEYWORDS.has(part.toLowerCase()))
                    return (
                        <span key={i} className="text-syntax-keyword">
                            {part}
                        </span>
                    )
                return (
                    <span key={i} className="text-ink-400">
                        {part}
                    </span>
                )
            })}
        </>
    )
}

function charsFor(script: TSeg[]) {
    return script.flatMap((seg) =>
        [...seg.text].map((ch) => ({ ch, color: seg.color }))
    )
}

function toSpans(slice: { ch: string; color: string }[]) {
    const spans: { text: string; color: string }[] = []
    for (const c of slice) {
        const last = spans[spans.length - 1]
        if (last && last.color === c.color) last.text += c.ch
        else spans.push({ text: c.ch, color: c.color })
    }
    return spans
}

const MODE_CHARS = MODES.map((mode) =>
    mode.script ? charsFor(mode.script) : []
)

type TPhase = 'input' | 'think' | 'handoff' | 'sql' | 'rows' | 'hold'

type TPopupState = {
    items: TItem[]
    selected: number
    top: number
    left: number
}

export function QuerySwitchboard({ animate }: { animate: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const railRef = useRef<HTMLDivElement>(null)
    const caretRef = useRef<HTMLSpanElement>(null)
    const gate = useGate(ref)
    const running = animate && gate.active

    const [modeIndex, setModeIndex] = useState(0)
    const [phase, setPhase] = useState<TPhase>('input')
    const [inputLen, setInputLen] = useState(0)
    const [sqlLen, setSqlLen] = useState(0)
    const [rowsShown, setRowsShown] = useState(0)
    const [popup, setPopup] = useState<TPopupState | null>(null)

    useEffect(() => {
        if (!running) return
        let cancelled = false
        const sleep = (ms: number) =>
            new Promise<void>((resolve) => setTimeout(resolve, ms))
        const frame = () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve())
            )

        function anchor(itemCount: number): { top: number; left: number } {
            const caret = caretRef.current
            const rail = railRef.current
            if (!caret || !rail) return { top: 30, left: 12 }
            const max = rail.clientWidth - POPUP_WIDTH - 8
            const estHeight = itemCount * 19 + 10
            let top = caret.offsetTop + caret.offsetHeight + 5
            if (top + estHeight > rail.clientHeight)
                top = caret.offsetTop - estHeight - 6
            return {
                top,
                left: Math.max(8, Math.min(caret.offsetLeft, max))
            }
        }

        async function play() {
            let m = 0
            while (!cancelled) {
                setModeIndex(m)
                setPhase('input')
                setInputLen(0)
                setSqlLen(0)
                setRowsShown(0)
                setPopup(null)
                await sleep(340)

                const mode = MODES[m]
                if (mode.ask) {
                    for (let i = 1; i <= mode.ask.length; i++) {
                        if (cancelled) return
                        setInputLen(i)
                        await sleep(34)
                    }
                    if (cancelled) return
                    setPhase('think')
                    await sleep(680)
                } else if (mode.script) {
                    let pos = 0
                    for (const seg of mode.script) {
                        if (cancelled) return
                        if (seg.accept) {
                            await frame()
                            const at = anchor(seg.accept.items.length)
                            for (let s = 0; s <= seg.accept.target; s++) {
                                if (cancelled) return
                                setPopup({
                                    items: seg.accept.items,
                                    selected: s,
                                    top: at.top,
                                    left: at.left
                                })
                                await sleep(s === 0 ? 160 : 80)
                            }
                            await sleep(220)
                            if (cancelled) return
                            setPopup(null)
                            pos += seg.text.length
                            setInputLen(pos)
                            await sleep(90)
                        } else {
                            for (let i = 0; i < seg.text.length; i++) {
                                if (cancelled) return
                                pos += 1
                                setInputLen(pos)
                                await sleep(16)
                            }
                        }
                    }
                }

                if (cancelled) return
                setPhase('handoff')
                await sleep(600)
                if (cancelled) return
                setPhase('sql')
                for (let n = 2; ; n += 2) {
                    if (cancelled) return
                    const next = Math.min(n, mode.sql.length)
                    setSqlLen(next)
                    if (next >= mode.sql.length) break
                    await sleep(18)
                }
                await sleep(200)
                setPhase('rows')
                for (let r = 1; r <= mode.rows.length; r++) {
                    if (cancelled) return
                    setRowsShown(r)
                    await sleep(130)
                }
                setPhase('hold')
                await sleep(1700)
                m = (m + 1) % MODES.length
            }
        }

        play()
        return () => {
            cancelled = true
        }
    }, [running])

    // At rest (before the loop starts) the board shows the
    // English run finished: prompt written, SQL compiled, rows landed.
    const activeIndex = running ? modeIndex : 0
    const mode = MODES[activeIndex]
    const shownInput = running
        ? inputLen
        : mode.ask
          ? mode.ask.length
          : MODE_CHARS[activeIndex].length
    const shownSql = running ? sqlLen : mode.sql.length
    const shownRows = running ? rowsShown : mode.rows.length
    const livePhase: TPhase = running ? phase : 'hold'

    const cableTop = activeIndex * (ROW_H + ROW_GAP) + ROW_H / 2

    function status(): { color: string; label: string } {
        if (livePhase === 'input')
            return {
                color: 'var(--color-ink-600)',
                label: mode.ask ? 'listening' : 'autocomplete'
            }
        if (livePhase === 'think')
            return { color: 'var(--color-ink-400)', label: 'generating…' }
        if (livePhase === 'handoff')
            return { color: 'var(--color-brand-300)', label: 'compiling…' }
        if (livePhase === 'sql')
            return { color: 'var(--color-brand-300)', label: mode.streamLabel }
        if (livePhase === 'rows')
            return { color: 'var(--color-brand-300)', label: 'running…' }
        return {
            color: 'var(--color-status-ok-dim)',
            label: `${mode.rows.length} rows · 3 ms`
        }
    }
    const { color: statusColor, label: statusLabel } = status()

    const showSql =
        livePhase === 'sql' || livePhase === 'rows' || livePhase === 'hold'
    const sqlTyping = livePhase === 'sql' && shownSql < mode.sql.length

    return (
        <div ref={ref} className="relative overflow-hidden px-5 py-8 sm:px-8">
            <CardAura active={running} />

            <div className="relative grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,5fr)_56px_minmax(0,7fr)] md:gap-0">
                {/* input rail — the three dialects */}
                <div
                    ref={railRef}
                    className="relative flex flex-col"
                    style={{ gap: ROW_GAP }}
                >
                    {MODES.map((row, i) => {
                        const active = i === activeIndex
                        const typing =
                            active && running && livePhase === 'input'
                        return (
                            <div
                                key={row.id}
                                className="flex flex-col justify-center border px-3.5 transition-colors duration-300"
                                style={{
                                    height: ROW_H,
                                    borderColor: active
                                        ? 'color-mix(in srgb, var(--color-brand-300) 28%, var(--color-line))'
                                        : 'var(--color-line)',
                                    backgroundColor: active
                                        ? 'var(--color-surface-elevated)'
                                        : 'color-mix(in srgb, var(--color-surface-deep) 55%, transparent)'
                                }}
                            >
                                <div className="mb-1.5 flex items-center gap-1.5">
                                    <span
                                        className="h-1 w-1 rounded-full transition-colors duration-300"
                                        style={{
                                            backgroundColor: active
                                                ? 'var(--color-brand-300)'
                                                : 'var(--color-ink-800)',
                                            boxShadow: active
                                                ? '0 0 6px color-mix(in srgb, var(--color-brand-300) 60%, transparent)'
                                                : 'none'
                                        }}
                                    />
                                    <span
                                        className={`font-mono text-[8px] font-medium uppercase tracking-[0.16em] transition-colors duration-300 ${MONO}`}
                                        style={{
                                            color: active
                                                ? 'var(--color-brand-300)'
                                                : 'var(--color-ink-700)'
                                        }}
                                    >
                                        {row.label}
                                    </span>
                                </div>
                                <div
                                    className={`overflow-hidden whitespace-nowrap font-mono text-[10.5px] leading-none transition-opacity duration-300 [mask-image:linear-gradient(90deg,black_88%,transparent)] ${MONO}`}
                                    style={{ opacity: active ? 1 : 0.38 }}
                                >
                                    {row.ask ? (
                                        <span className="text-ink-300">
                                            <span className="mr-1.5 text-brand-600/70">
                                                ›
                                            </span>
                                            {active
                                                ? row.ask.slice(0, shownInput)
                                                : row.ask}
                                        </span>
                                    ) : (
                                        toSpans(
                                            MODE_CHARS[i].slice(
                                                0,
                                                active
                                                    ? shownInput
                                                    : MODE_CHARS[i].length
                                            )
                                        ).map((s, j) => (
                                            <span
                                                key={j}
                                                style={{ color: s.color }}
                                            >
                                                {s.text}
                                            </span>
                                        ))
                                    )}
                                    {typing ? (
                                        <span
                                            ref={caretRef}
                                            className="ml-px inline-block h-[11px] w-px animate-pulse bg-brand-300 align-middle"
                                        />
                                    ) : null}
                                </div>
                            </div>
                        )
                    })}

                    {/* LSP completion popup */}
                    {running && popup ? (
                        <div
                            className="absolute z-20 overflow-hidden border border-line-strong bg-surface py-1 shadow-[0_10px_28px_rgba(0,0,0,0.55)]"
                            style={{
                                top: popup.top,
                                left: popup.left,
                                width: POPUP_WIDTH,
                                animation: 'lspPop 150ms ease-out'
                            }}
                        >
                            {popup.items.map((item, i) => {
                                const on = i === popup.selected
                                return (
                                    <div
                                        key={item.name}
                                        className={`flex items-center gap-2 px-2 py-[3px] font-mono text-[10px] ${MONO}`}
                                        style={{
                                            backgroundColor: on
                                                ? 'color-mix(in srgb, var(--color-brand-300) 12%, transparent)'
                                                : 'transparent'
                                        }}
                                    >
                                        <span
                                            className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[2px] text-[7px] font-bold"
                                            style={{
                                                backgroundColor:
                                                    'color-mix(in srgb, var(--color-brand-300) 16%, transparent)',
                                                color: 'var(--color-brand-300)'
                                            }}
                                        >
                                            {item.kind}
                                        </span>
                                        <span
                                            style={{
                                                color: on
                                                    ? 'var(--color-brand-50)'
                                                    : 'var(--color-ink-300)'
                                            }}
                                        >
                                            {item.name}
                                        </span>
                                        <span className="ml-auto truncate text-ink-700">
                                            {item.detail}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    ) : null}
                </div>

                {/* patch cable — slides to the speaking row, carries the signal dot */}
                <div aria-hidden className="relative hidden md:block">
                    <div
                        className="absolute left-0 right-0 h-px bg-line-strong transition-[top] duration-500 ease-out"
                        style={{ top: cableTop }}
                    />
                    <div
                        className="absolute h-[5px] w-[5px] rounded-full bg-brand-300"
                        style={{
                            top: cableTop - 2,
                            left:
                                livePhase === 'handoff'
                                    ? 'calc(100% - 5px)'
                                    : '-2px',
                            opacity: livePhase === 'handoff' ? 1 : 0,
                            boxShadow:
                                '0 0 8px color-mix(in srgb, var(--color-brand-300) 80%, transparent)',
                            transition:
                                livePhase === 'handoff'
                                    ? 'left 560ms cubic-bezier(0.5, 0, 0.7, 1), opacity 120ms ease'
                                    : 'opacity 120ms ease'
                        }}
                    />
                </div>

                {/* engine — the one destination every dialect compiles into */}
                <div className="relative flex flex-col border border-line bg-surface-deeper/80">
                    {livePhase === 'sql' ? (
                        <span
                            key={mode.id}
                            aria-hidden
                            className="pointer-events-none absolute inset-0 z-10"
                            style={{
                                background:
                                    'linear-gradient(90deg, color-mix(in srgb, var(--color-brand-300) 10%, transparent), transparent 60%)',
                                animation: 'lspFlash 0.7s ease-out forwards'
                            }}
                        />
                    ) : null}

                    <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
                        <span
                            className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
                            style={{
                                backgroundColor: statusColor,
                                boxShadow: `0 0 8px ${statusColor}99`
                            }}
                        />
                        <span
                            className={`font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500 ${MONO}`}
                        >
                            Dora engine
                        </span>
                        <span
                            className={`ml-auto font-mono text-[9px] tracking-[0.06em] transition-colors duration-300 ${MONO}`}
                            style={{ color: statusColor }}
                        >
                            {statusLabel}
                        </span>
                    </div>

                    <div className="min-h-[104px] px-3.5 py-3">
                        {livePhase === 'think' ? (
                            <div className="flex items-center gap-1 pl-0.5 pt-1">
                                {[0, 1, 2].map((d) => (
                                    <span
                                        key={d}
                                        className="h-1 w-1 rounded-full bg-brand-400"
                                        style={{
                                            animation: `particleFloat 0.9s ease-in-out ${d * 140}ms infinite alternate`
                                        }}
                                    />
                                ))}
                            </div>
                        ) : showSql ? (
                            <pre
                                className={`whitespace-pre-wrap break-words font-mono text-[10.5px] leading-[1.55] ${MONO}`}
                            >
                                <SqlTokens text={mode.sql.slice(0, shownSql)} />
                                {sqlTyping ? (
                                    <span className="ml-px inline-block h-3 w-px animate-pulse bg-brand-300 align-middle" />
                                ) : null}
                            </pre>
                        ) : null}
                    </div>

                    <div className="mt-auto border-t border-line">
                        <div
                            className={`grid gap-1 border-b border-line px-3.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-700 ${MONO}`}
                            style={{ gridTemplateColumns: mode.grid }}
                        >
                            {mode.columns.map((col) => (
                                <span
                                    key={col.label}
                                    className={
                                        col.align === 'right'
                                            ? 'text-right'
                                            : undefined
                                    }
                                >
                                    {col.label}
                                </span>
                            ))}
                        </div>
                        {mode.rows.map((row, i) => {
                            const shown = shownRows > i
                            return (
                                <div
                                    key={i}
                                    className={`grid items-center gap-1 px-3.5 py-1 font-mono text-[10px] ${MONO}`}
                                    style={{
                                        gridTemplateColumns: mode.grid,
                                        opacity: shown ? 1 : 0,
                                        transform: shown
                                            ? 'translateY(0)'
                                            : 'translateY(4px)',
                                        transition:
                                            'opacity 320ms ease, transform 360ms cubic-bezier(0.34,1.56,0.64,1)'
                                    }}
                                >
                                    {row.map((cell, j) => {
                                        const col = mode.columns[j]
                                        const tone =
                                            col.tone === 'accent'
                                                ? 'text-brand-300'
                                                : col.tone === 'dim'
                                                  ? 'text-ink-600 tabular-nums'
                                                  : 'text-ink-300'
                                        return (
                                            <span
                                                key={j}
                                                className={`truncate ${tone} ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}
                                            >
                                                {cell}
                                            </span>
                                        )
                                    })}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
