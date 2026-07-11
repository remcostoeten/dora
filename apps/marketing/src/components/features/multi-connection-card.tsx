'use client'

import { useEffect, useRef, useState } from 'react'

import { useGate } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * Many connections, one window (issue #96). A connection tab bar sits above a
 * row of table tabs. Each connection keeps its OWN isolated tab group, so
 * switching the active connection swaps the table tabs beneath it while every
 * connection's open tabs are preserved.
 *
 * The demo auto-cycles the active connection to show per-connection state carry
 * across, but it is also interactive: hover (or focus) a connection to pin it,
 * which pauses the cycle and reveals a status tooltip, mirroring the studio
 * ConnectionTabBar and its `Ctrl+Shift+[` / `Ctrl+Shift+]` switching.
 * ------------------------------------------------------------------------- */

type TStatus = 'connected' | 'connecting' | 'error'

type TConnection = {
    name: string
    status: TStatus
    // Each connection's isolated tab group + which tab is active within it.
    tabs: string[]
    activeTab: number
}

// Dot colours + labels mirror the studio ConnectionTabBar: connected -> green,
// connecting/idle -> amber, error -> red.
const STATUS_COLOR: Record<TStatus, string> = {
    connected: 'var(--color-status-ok)',
    connecting: 'var(--color-status-pending)',
    error: 'var(--color-status-error)'
}

const STATUS_LABEL: Record<TStatus, string> = {
    connected: 'Connected',
    connecting: 'Connecting',
    error: 'Connection error'
}

const CONNECTIONS: TConnection[] = [
    {
        name: 'prod-api',
        status: 'connected',
        tabs: ['users', 'orders', 'sessions'],
        activeTab: 1
    },
    {
        name: 'analytics',
        status: 'connected',
        tabs: ['events', 'funnels'],
        activeTab: 0
    },
    {
        name: 'staging',
        status: 'connecting',
        tabs: ['migrations', 'jobs', 'users', 'audit'],
        activeTab: 2
    },
    {
        name: 'local.db',
        status: 'connected',
        tabs: ['todos'],
        activeTab: 0
    }
]

const STEP_MS = 2200

function CloseGlyph() {
    return (
        <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M6 6l12 12M18 6L6 18" />
        </svg>
    )
}

export function MultiConnectionCard({ animate }: { animate: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const [active, setActive] = useState(0)
    const [pinned, setPinned] = useState<number | null>(null)
    const gate = useGate(ref)
    // Auto-cycle only when on-screen and nothing is hovered/focused.
    const running = animate && gate.active && pinned === null

    useEffect(
        function cycleConnection() {
            if (!running) return
            const id = setInterval(function tick() {
                setActive((c) => (c + 1) % CONNECTIONS.length)
            }, STEP_MS)
            return () => clearInterval(id)
        },
        [running]
    )

    // A pinned (hovered/focused) connection wins over the auto-cycle.
    const activeIndex = pinned ?? active
    const current = CONNECTIONS[activeIndex]

    function pin(i: number) {
        setPinned(i)
        setActive(i)
    }

    return (
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
            <div
                ref={ref}
                className="flex flex-1 flex-col justify-center gap-2 px-5 pt-5"
            >
                {/* connection tab bar */}
                <div className="flex items-center gap-1 overflow-visible rounded-[3px] border border-line bg-surface-deep/80 p-1">
                    {CONNECTIONS.map((conn, i) => {
                        const isActive = i === activeIndex
                        const isPinned = i === pinned
                        const color = STATUS_COLOR[conn.status]
                        return (
                            <button
                                key={conn.name}
                                type="button"
                                aria-label={`${conn.name}: ${STATUS_LABEL[conn.status]}`}
                                onMouseEnter={() => pin(i)}
                                onMouseLeave={() => setPinned(null)}
                                onFocus={() => pin(i)}
                                onBlur={() => setPinned(null)}
                                className="group/conn relative flex min-w-0 items-center gap-1.5 rounded-[2px] px-2 py-1 outline-none transition-all duration-300"
                                style={{
                                    backgroundColor: isActive
                                        ? 'color-mix(in srgb, var(--color-brand-200) 10%, transparent)'
                                        : 'transparent',
                                    boxShadow: isActive
                                        ? 'inset 0 0 0 1px color-mix(in srgb, var(--color-brand-200) 35%, transparent)'
                                        : 'none'
                                }}
                            >
                                <span
                                    className="h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-300"
                                    style={{
                                        backgroundColor: color,
                                        boxShadow: isActive
                                            ? `0 0 6px ${color}cc`
                                            : 'none',
                                        opacity:
                                            conn.status === 'connecting' &&
                                            isActive
                                                ? 0.6
                                                : 1
                                    }}
                                />
                                <span
                                    className="truncate font-mono text-[10.5px] leading-none transition-colors duration-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                                    style={{
                                        color: isActive ? 'var(--color-brand-100)' : 'var(--color-ink-500)'
                                    }}
                                >
                                    {conn.name}
                                </span>
                                <span
                                    className="shrink-0 transition-colors duration-300 group-hover/conn:text-brand-400"
                                    style={{
                                        color: isActive ? 'var(--color-ink-400)' : 'var(--color-line-strong)'
                                    }}
                                >
                                    <CloseGlyph />
                                </span>

                                {/* status tooltip, revealed on hover/focus */}
                                <span
                                    role="tooltip"
                                    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 flex -translate-x-1/2 translate-y-1 items-center gap-1.5 whitespace-nowrap rounded-[3px] border border-line bg-surface px-2 py-1 opacity-0 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.6)] transition-all duration-200 group-hover/conn:translate-y-0 group-hover/conn:opacity-100 group-focus-visible/conn:translate-y-0 group-focus-visible/conn:opacity-100"
                                >
                                    <span
                                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-brand-300">
                                        {STATUS_LABEL[conn.status]}
                                    </span>
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* table tabs for the active connection's isolated group */}
                <div className="flex items-center gap-1 px-0.5">
                    {current.tabs.map((tab, i) => {
                        const isActive = i === current.activeTab
                        return (
                            <span
                                key={`${current.name}-${tab}`}
                                className="truncate rounded-[2px] border px-2 py-1 font-mono text-[10px] leading-none transition-all duration-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                                style={{
                                    borderColor: isActive
                                        ? 'color-mix(in srgb, var(--color-brand-600) 50%, transparent)'
                                        : 'var(--color-surface-raised)',
                                    backgroundColor: isActive
                                        ? 'color-mix(in srgb, var(--color-brand-600) 10%, transparent)'
                                        : 'transparent',
                                    color: isActive ? 'var(--color-brand-300)' : 'var(--color-ink-700)'
                                }}
                            >
                                {tab}
                            </span>
                        )
                    })}
                    <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-800">
                        {current.tabs.length} tab
                        {current.tabs.length === 1 ? '' : 's'}
                    </span>
                </div>

                {/* keyboard hint */}
                <div className="mt-1 flex items-center gap-1.5 text-ink-700">
                    <kbd className="rounded-[2px] border border-line bg-surface-deep px-1 py-px font-mono text-[9px] text-ink-400">
                        Ctrl+Shift+[
                    </kbd>
                    <kbd className="rounded-[2px] border border-line bg-surface-deep px-1 py-px font-mono text-[9px] text-ink-400">
                        ]
                    </kbd>
                    <span className="font-mono text-[9px] text-ink-800">
                        cycle connections
                    </span>
                </div>
            </div>

            <div className="px-5 pb-5 pt-3">
                <h3 className="mb-1 font-pixel text-sm font-[500] text-ink-200">
                    Many connections, one window
                </h3>
                <p className="text-xs leading-relaxed text-ink-500">
                    Keep several databases open at once, each with its own
                    isolated tabs, filters, and scroll position.
                </p>
            </div>
        </div>
    )
}
