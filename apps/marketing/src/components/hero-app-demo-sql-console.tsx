'use client'

import { AnimatePresence, m } from 'framer-motion'
import {
    Bookmark,
    Braces,
    Clock,
    Database,
    Download,
    Gauge,
    Play,
    Plus,
    Sparkles,
    Square,
    Table as TableIcon,
    X
} from 'lucide-react'
import { useState } from 'react'
import { downloadText } from '@/components/hero-app-demo-export'
import type { TConnection } from '@/components/hero-app-demo-connections'

/**
 * Mock replica of the real SQL console: mode tabs (SQL / Drizzle / Prisma),
 * query tabs, a highlighted read-only editor, an action bar with a working
 * Run button, and a results pane whose rows animate in per run.
 */

type TToken = [cls: string | null, text: string]

type TQuery = {
    name: string
    ms: number
    columns: { name: string; track: string }[]
    rows: string[][]
    code: Record<TMode, TToken[][]>
}

type TMode = 'sql' | 'drizzle' | 'prisma'

const KW = 'text-syntax-keyword'
const STR = 'text-syntax-string'
const NUM = 'text-syntax-number'
const IDENT = 'text-syntax-ident'
const KEY = 'text-syntax-key'
const PUNCT = 'text-muted-foreground/70'

const QUERIES: TQuery[] = [
    {
        name: 'shipped orders',
        ms: 12,
        columns: [
            { name: 'id', track: '52px' },
            { name: 'name', track: 'minmax(90px, 1.2fr)' },
            { name: 'total', track: 'minmax(70px, 0.8fr)' },
            { name: 'status', track: 'minmax(70px, 0.8fr)' }
        ],
        rows: [
            ['6', 'Ava Davis', '749.50', 'shipped'],
            ['1', 'Sophia Brown', '538.99', 'shipped'],
            ['3', 'Mia Thompson', '1299.00', 'shipped'],
            ['11', 'Oliver Anderson', '529.00', 'shipped']
        ],
        code: {
            sql: [
                [
                    [KW, 'SELECT '],
                    [null, 'o.id, c.name, o.total, o.status']
                ],
                [
                    [KW, 'FROM '],
                    [IDENT, 'orders'],
                    [null, ' o']
                ],
                [
                    [KW, 'JOIN '],
                    [IDENT, 'customers'],
                    [null, ' c '],
                    [KW, 'ON '],
                    [null, 'c.id = o.customer_id']
                ],
                [
                    [KW, 'WHERE '],
                    [null, 'o.status = '],
                    [STR, "'shipped'"]
                ],
                [
                    [KW, 'ORDER BY '],
                    [null, 'o.placed_at '],
                    [KW, 'DESC']
                ],
                [
                    [KW, 'LIMIT '],
                    [NUM, '5'],
                    [PUNCT, ';']
                ]
            ],
            drizzle: [
                [
                    [KW, 'const '],
                    [null, 'rows '],
                    [PUNCT, '= '],
                    [KW, 'await '],
                    [IDENT, 'db']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'select'],
                    [PUNCT, '({ '],
                    [KEY, 'name'],
                    [PUNCT, ': '],
                    [null, 'customers.name'],
                    [PUNCT, ', '],
                    [KEY, 'total'],
                    [PUNCT, ': '],
                    [null, 'orders.total'],
                    [PUNCT, ' })']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'from'],
                    [PUNCT, '('],
                    [IDENT, 'orders'],
                    [PUNCT, ')']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'innerJoin'],
                    [PUNCT, '('],
                    [IDENT, 'customers'],
                    [PUNCT, ', '],
                    [IDENT, 'eq'],
                    [PUNCT, '('],
                    [null, 'customers.id, orders.customerId'],
                    [PUNCT, '))']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'where'],
                    [PUNCT, '('],
                    [IDENT, 'eq'],
                    [PUNCT, '('],
                    [null, 'orders.status, '],
                    [STR, "'shipped'"],
                    [PUNCT, '))']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'orderBy'],
                    [PUNCT, '('],
                    [IDENT, 'desc'],
                    [PUNCT, '('],
                    [null, 'orders.placedAt'],
                    [PUNCT, '))']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'limit'],
                    [PUNCT, '('],
                    [NUM, '5'],
                    [PUNCT, ')']
                ]
            ],
            prisma: [
                [
                    [KW, 'const '],
                    [null, 'rows '],
                    [PUNCT, '= '],
                    [KW, 'await '],
                    [IDENT, 'prisma'],
                    [PUNCT, '.'],
                    [null, 'order'],
                    [PUNCT, '.'],
                    [KEY, 'findMany'],
                    [PUNCT, '({']
                ],
                [
                    [PUNCT, '    '],
                    [KEY, 'where'],
                    [PUNCT, ': { '],
                    [KEY, 'status'],
                    [PUNCT, ': '],
                    [STR, "'shipped'"],
                    [PUNCT, ' },']
                ],
                [
                    [PUNCT, '    '],
                    [KEY, 'include'],
                    [PUNCT, ': { '],
                    [KEY, 'customer'],
                    [PUNCT, ': '],
                    [KW, 'true'],
                    [PUNCT, ' },']
                ],
                [
                    [PUNCT, '    '],
                    [KEY, 'orderBy'],
                    [PUNCT, ': { '],
                    [KEY, 'placedAt'],
                    [PUNCT, ': '],
                    [STR, "'desc'"],
                    [PUNCT, ' },']
                ],
                [
                    [PUNCT, '    '],
                    [KEY, 'take'],
                    [PUNCT, ': '],
                    [NUM, '5']
                ],
                [[PUNCT, '})']]
            ]
        }
    },
    {
        name: 'revenue by plan',
        ms: 8,
        columns: [
            { name: 'plan', track: 'minmax(90px, 1fr)' },
            { name: 'subs', track: 'minmax(60px, 0.6fr)' },
            { name: 'mrr', track: 'minmax(80px, 0.8fr)' }
        ],
        rows: [
            ['enterprise', '3', '16050.00'],
            ['team', '4', '380.00'],
            ['pro', '4', '76.00'],
            ['free', '1', '0.00']
        ],
        code: {
            sql: [
                [
                    [KW, 'SELECT '],
                    [null, 'plan, '],
                    [IDENT, 'COUNT'],
                    [PUNCT, '(*) '],
                    [KW, 'AS '],
                    [null, 'subs, '],
                    [IDENT, 'SUM'],
                    [PUNCT, '('],
                    [null, 'mrr'],
                    [PUNCT, ') '],
                    [KW, 'AS '],
                    [null, 'mrr']
                ],
                [
                    [KW, 'FROM '],
                    [IDENT, 'subscriptions']
                ],
                [
                    [KW, 'GROUP BY '],
                    [null, 'plan']
                ],
                [
                    [KW, 'ORDER BY '],
                    [null, 'mrr '],
                    [KW, 'DESC'],
                    [PUNCT, ';']
                ]
            ],
            drizzle: [
                [
                    [KW, 'const '],
                    [null, 'rows '],
                    [PUNCT, '= '],
                    [KW, 'await '],
                    [IDENT, 'db']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'select'],
                    [PUNCT, '({ '],
                    [KEY, 'plan'],
                    [PUNCT, ': '],
                    [null, 'subscriptions.plan'],
                    [PUNCT, ', '],
                    [KEY, 'mrr'],
                    [PUNCT, ': '],
                    [IDENT, 'sum'],
                    [PUNCT, '('],
                    [null, 'subscriptions.mrr'],
                    [PUNCT, ') })']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'from'],
                    [PUNCT, '('],
                    [IDENT, 'subscriptions'],
                    [PUNCT, ')']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'groupBy'],
                    [PUNCT, '('],
                    [null, 'subscriptions.plan'],
                    [PUNCT, ')']
                ],
                [
                    [PUNCT, '    .'],
                    [KEY, 'orderBy'],
                    [PUNCT, '('],
                    [IDENT, 'desc'],
                    [PUNCT, '('],
                    [IDENT, 'sum'],
                    [PUNCT, '('],
                    [null, 'subscriptions.mrr'],
                    [PUNCT, ')))']
                ]
            ],
            prisma: [
                [
                    [KW, 'const '],
                    [null, 'rows '],
                    [PUNCT, '= '],
                    [KW, 'await '],
                    [IDENT, 'prisma'],
                    [PUNCT, '.'],
                    [null, 'subscription'],
                    [PUNCT, '.'],
                    [KEY, 'groupBy'],
                    [PUNCT, '({']
                ],
                [
                    [PUNCT, '    '],
                    [KEY, 'by'],
                    [PUNCT, ': ['],
                    [STR, "'plan'"],
                    [PUNCT, '],']
                ],
                [
                    [PUNCT, '    '],
                    [KEY, '_count'],
                    [PUNCT, ': '],
                    [KW, 'true'],
                    [PUNCT, ',']
                ],
                [
                    [PUNCT, '    '],
                    [KEY, '_sum'],
                    [PUNCT, ': { '],
                    [KEY, 'mrr'],
                    [PUNCT, ': '],
                    [KW, 'true'],
                    [PUNCT, ' },']
                ],
                [
                    [PUNCT, '    '],
                    [KEY, 'orderBy'],
                    [PUNCT, ': { '],
                    [KEY, '_sum'],
                    [PUNCT, ': { '],
                    [KEY, 'mrr'],
                    [PUNCT, ': '],
                    [STR, "'desc'"],
                    [PUNCT, ' } }']
                ],
                [[PUNCT, '})']]
            ]
        }
    }
]

const MODES: { id: TMode; label: string; kbd: string }[] = [
    { id: 'sql', label: 'SQL', kbd: '⌥S' },
    { id: 'drizzle', label: 'Drizzle', kbd: '⌥D' },
    { id: 'prisma', label: 'Prisma', kbd: '⌥P' }
]

function CodeLine({ tokens, number }: { tokens: TToken[]; number: number }) {
    return (
        <div className="flex">
            <span className="w-8 shrink-0 select-none pr-3 text-right text-muted-foreground/40">
                {number}
            </span>
            <span className="whitespace-pre">
                {tokens.map(([cls, text], index) => (
                    <span key={index} className={cls ?? 'text-foreground/90'}>
                        {text}
                    </span>
                ))}
            </span>
        </div>
    )
}

function ActionIcon({
    icon: Icon,
    label
}: {
    icon: typeof Bookmark
    label: string
}) {
    return (
        <button
            type="button"
            title={label}
            className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
        >
            <Icon className="h-3.5 w-3.5" />
        </button>
    )
}

export function SqlConsole({ connection }: { connection: TConnection }) {
    const [mode, setMode] = useState<TMode>('sql')
    const [openTabs, setOpenTabs] = useState([0, 1])
    const [activeTab, setActiveTab] = useState(0)
    const [running, setRunning] = useState(false)
    const [ranTabs, setRanTabs] = useState<number[]>([])
    const [jsonResults, setJsonResults] = useState(false)

    const query = QUERIES[activeTab]
    const ran = ranTabs.includes(activeTab)

    function run() {
        if (running) return
        setRunning(true)
        setRanTabs((current) => current.filter((index) => index !== activeTab))
        window.setTimeout(() => {
            setRunning(false)
            setRanTabs((current) => current.concat(activeTab))
        }, 550)
    }

    function closeTab(index: number) {
        if (openTabs.length === 1) return
        const next = openTabs.filter((tab) => tab !== index)
        setOpenTabs(next)
        if (activeTab === index) setActiveTab(next[0])
    }

    function addTab() {
        const missing = QUERIES.findIndex(
            (_, index) => !openTabs.includes(index)
        )
        if (missing < 0) return
        setOpenTabs(openTabs.concat(missing))
        setActiveTab(missing)
    }

    function exportResults() {
        const records = query.rows.map((row) =>
            Object.fromEntries(
                query.columns.map((column, index) => [column.name, row[index]])
            )
        )
        downloadText(
            query.name.replaceAll(' ', '-') + '.json',
            JSON.stringify(records, null, 2),
            'application/json'
        )
    }

    const template = query.columns.map((column) => column.track).join(' ')

    return (
        <div
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    run()
                }
            }}
            className="flex flex-1 min-h-0 flex-col outline-none"
        >
            {/* Console header */}
            <div className="flex items-center h-10 px-2 gap-2 bg-sidebar border-b border-sidebar-border shrink-0 select-none">
                <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-sidebar-foreground">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="max-w-[160px] truncate">
                        {connection.name}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </div>
                <button
                    type="button"
                    title="Query history"
                    className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                >
                    <Clock className="h-3.5 w-3.5" />
                </button>
                <div className="flex-1" />
                <div className="flex items-center bg-sidebar-accent/50 rounded-md p-0.5">
                    {MODES.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            onClick={() => setMode(entry.id)}
                            className={
                                'flex h-6 items-center gap-1.5 rounded-sm px-2 text-[11px] font-medium transition-colors ' +
                                (mode === entry.id
                                    ? 'bg-sidebar-accent text-sidebar-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-sidebar-foreground')
                            }
                        >
                            {entry.label}
                            <span className="hidden lg:inline-flex h-4 items-center rounded border border-border/60 bg-muted/40 px-1 font-sans text-[9px] text-muted-foreground/80">
                                {entry.kbd}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Query tab bar */}
            <div className="flex items-center h-9 border-b border-sidebar-border bg-sidebar shrink-0 select-none">
                {openTabs.map((index) => {
                    const isActive = index === activeTab
                    return (
                        <div
                            key={index}
                            className={
                                'relative flex items-center h-full shrink-0 border-r border-sidebar-border transition-colors ' +
                                (isActive
                                    ? 'bg-background text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50')
                            }
                        >
                            <button
                                type="button"
                                onClick={() => setActiveTab(index)}
                                className="flex items-center h-full px-2 pl-3 text-xs font-medium"
                            >
                                <span className="max-w-[140px] truncate">
                                    {QUERIES[index].name}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => closeTab(index)}
                                aria-label={'Close ' + QUERIES[index].name}
                                className="h-full flex items-center px-1 pr-2 text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )
                })}
                <button
                    type="button"
                    onClick={addTab}
                    aria-label="New query tab"
                    className="flex items-center justify-center h-full px-2 text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Editor */}
            <div className="flex min-h-0 flex-[1.15] flex-col bg-background">
                <div className="flex-1 overflow-hidden px-3 py-3 font-mono text-xs leading-[1.7]">
                    {query.code[mode].map((tokens, index) => (
                        <CodeLine
                            key={mode + activeTab + index}
                            tokens={tokens}
                            number={index + 1}
                        />
                    ))}
                </div>
                <div className="flex items-center h-9 px-2 gap-0.5 border-t border-sidebar-border bg-sidebar shrink-0">
                    <ActionIcon icon={Bookmark} label="Save query" />
                    <ActionIcon icon={Sparkles} label="Format code" />
                    <ActionIcon icon={Braces} label="Toggle JSON view" />
                    <ActionIcon icon={Gauge} label="EXPLAIN ANALYZE" />
                    <ActionIcon icon={Download} label="Export results" />
                    <div className="flex-1" />
                    {running ? (
                        <button
                            type="button"
                            onClick={() => setRunning(false)}
                            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[2px] text-[11px] font-medium bg-red-500/15 text-red-400 transition-colors hover:bg-red-500/25"
                        >
                            <Square className="h-3 w-3 fill-current" />
                            Stop
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={run}
                            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[2px] text-[11px] font-medium bg-primary text-primary-foreground transition-opacity hover:opacity-85"
                        >
                            <Play className="h-3 w-3 fill-current" />
                            Run
                            <span className="hidden lg:inline-flex h-4 items-center rounded border border-primary-foreground/25 px-1 font-sans text-[9px] opacity-80">
                                ⌘↵
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Results */}
            <div className="flex min-h-0 flex-1 flex-col border-t border-sidebar-border">
                <div className="flex items-center h-8 px-2 gap-1 bg-sidebar border-b border-sidebar-border shrink-0">
                    <button
                        type="button"
                        aria-label="Table results"
                        onClick={() => setJsonResults(false)}
                        className={
                            'flex h-5.5 w-6 items-center justify-center rounded-sm transition-colors ' +
                            (!jsonResults
                                ? 'bg-sidebar-accent text-sidebar-foreground'
                                : 'text-muted-foreground hover:text-sidebar-foreground')
                        }
                    >
                        <TableIcon className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        aria-label="JSON results"
                        onClick={() => setJsonResults(true)}
                        className={
                            'flex h-5.5 w-6 items-center justify-center rounded-sm transition-colors ' +
                            (jsonResults
                                ? 'bg-sidebar-accent text-sidebar-foreground'
                                : 'text-muted-foreground hover:text-sidebar-foreground')
                        }
                    >
                        <Braces className="h-3 w-3" />
                    </button>
                    {ran && (
                        <span className="ml-2 inline-flex h-5 items-center gap-1 rounded-full bg-emerald-500/10 px-2 text-[10px] font-medium text-emerald-400 animate-in fade-in-0 duration-200">
                            ✓ Success
                        </span>
                    )}
                    {ran && (
                        <span className="text-[10px] text-muted-foreground">
                            {query.rows.length} rows · {query.ms}ms
                        </span>
                    )}
                    <div className="flex-1" />
                    <button
                        type="button"
                        title="Export results"
                        onClick={exportResults}
                        className="flex h-6 w-6 items-center justify-center rounded-[2px] text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                    >
                        <Download className="h-3 w-3" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden bg-background">
                    {!ran && !running ? (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground/60">
                            Run the query to see results
                        </div>
                    ) : running ? (
                        <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground/60">
                            <span className="h-3 w-3 animate-spin rounded-full border border-muted-foreground/40 border-t-transparent" />
                            Executing...
                        </div>
                    ) : jsonResults ? (
                        <pre className="m-0 overflow-hidden px-4 py-2 font-mono text-[11px] leading-relaxed text-foreground/90">
                            {JSON.stringify(
                                query.rows.map((row) =>
                                    Object.fromEntries(
                                        query.columns.map((column, index) => [
                                            column.name,
                                            row[index]
                                        ])
                                    )
                                ),
                                null,
                                2
                            )}
                        </pre>
                    ) : (
                        <div className="font-mono text-xs">
                            <div
                                style={{ gridTemplateColumns: template }}
                                className="grid bg-sidebar"
                            >
                                {query.columns.map((column) => (
                                    <div
                                        key={column.name}
                                        className="flex h-8 items-center border-b border-r border-sidebar-border bg-sidebar-accent/50 px-3 text-[11px] font-medium font-sans text-foreground"
                                    >
                                        {column.name}
                                    </div>
                                ))}
                            </div>
                            <AnimatePresence>
                                {query.rows.map((row, rowIndex) => (
                                    <m.div
                                        key={activeTab + ':' + row.join()}
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.22,
                                            delay: rowIndex * 0.05
                                        }}
                                        style={{
                                            gridTemplateColumns: template
                                        }}
                                        className={
                                            'grid ' +
                                            (rowIndex % 2 === 1
                                                ? 'bg-muted/35'
                                                : '')
                                        }
                                    >
                                        {row.map((cell, cellIndex) => (
                                            <div
                                                key={cellIndex}
                                                className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-sidebar-border px-3 py-1.5 text-foreground/90"
                                            >
                                                {cell}
                                            </div>
                                        ))}
                                    </m.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
