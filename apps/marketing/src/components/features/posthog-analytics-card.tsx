'use client'

import { useRef } from 'react'

import { useGate } from './use-scroll-motion'

/* ---------------------------------------------------------------------------
 * PostHog analytics, built in. Dora connects to a PostHog project over the
 * HogQL Query API (no wire protocol) and turns raw events into a dashboard:
 * KPI tiles, an activity chart, and the list of sites actually sending data —
 * with a one-click "exclude localhost" toggle. This card mirrors that surface
 * in miniature and animates its bars in when scrolled into view.
 * ------------------------------------------------------------------------- */

const ACCENT = 'var(--color-brand-200)'
const MAUVE = 'var(--color-brand-600)'

// Two weeks of event volume — the shape the real Activity chart draws.
const BARS = [34, 41, 38, 52, 61, 47, 55, 68, 72, 63, 81, 77, 92, 86]

type TKpi = { label: string; value: string }

const KPIS: TKpi[] = [
    { label: 'Events', value: '128.4K' },
    { label: 'Users', value: '9,312' },
    { label: 'Pageviews', value: '74.1K' }
]

const SITES = ['app.acme.io', 'docs.acme.io', 'acme.io']

export function PosthogAnalyticsCard({ animate }: { animate: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const gate = useGate(ref)
    const grown = animate ? gate.active : true

    return (
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
            <div
                ref={ref}
                className="flex flex-1 flex-col justify-center gap-2.5 px-5 pt-5"
            >
                {/* mock analytics header + exclude-localhost toggle */}
                <div className="flex items-center gap-2">
                    <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                            backgroundColor: ACCENT,
                            boxShadow: `0 0 6px ${ACCENT}cc`
                        }}
                    />
                    <span className="font-mono text-[10.5px] leading-none text-ink-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                        analytics · HogQL
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                        <span
                            className="flex h-3 w-5 items-center rounded-full px-px transition-colors duration-300"
                            style={{
                                backgroundColor: grown
                                    ? 'color-mix(in srgb, var(--color-brand-200) 35%, transparent)'
                                    : 'var(--color-surface-raised)'
                            }}
                        >
                            <span
                                className="h-2.5 w-2.5 rounded-full bg-ink-200 transition-transform duration-300"
                                style={{
                                    transform: grown
                                        ? 'translateX(8px)'
                                        : 'translateX(0)'
                                }}
                            />
                        </span>
                        <span className="font-mono text-[9px] text-ink-800">
                            exclude localhost
                        </span>
                    </span>
                </div>

                {/* KPI tiles */}
                <div className="grid grid-cols-3 gap-1.5">
                    {KPIS.map((kpi) => (
                        <div
                            key={kpi.label}
                            className="rounded-[3px] border border-line bg-surface-deep/80 px-2 py-1.5"
                        >
                            <div className="font-mono text-[8px] uppercase tracking-[0.08em] text-ink-800">
                                {kpi.label}
                            </div>
                            <div className="mt-0.5 font-mono text-[12px] leading-none text-ink-200 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                                {kpi.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* activity chart */}
                <div className="flex h-14 items-end gap-[3px] rounded-[3px] border border-line bg-surface-deep/50 px-2 py-1.5">
                    {BARS.map((height, i) => (
                        <span
                            key={i}
                            className="flex-1 rounded-[1px] transition-[height,opacity] ease-out"
                            style={{
                                height: grown ? `${height}%` : '4%',
                                opacity: grown ? 1 : 0.2,
                                transitionDuration: '620ms',
                                transitionDelay: `${i * 34}ms`,
                                background: `linear-gradient(to top, ${MAUVE}, ${ACCENT})`
                            }}
                        />
                    ))}
                </div>

                {/* monitored sites */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-800">
                        sites
                    </span>
                    {SITES.map((site) => (
                        <span
                            key={site}
                            className="flex shrink-0 items-center gap-1 rounded-[2px] border border-line px-1.5 py-0.5"
                        >
                            <span
                                className="h-1 w-1 rounded-full"
                                style={{ backgroundColor: ACCENT }}
                            />
                            <span className="font-mono text-[9px] text-ink-500 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                                {site}
                            </span>
                        </span>
                    ))}
                </div>
            </div>

            <div className="px-5 pb-5 pt-3">
                <h3 className="mb-1 flex items-center gap-2 font-pixel text-sm font-[500] text-ink-200">
                    PostHog analytics, built in
                    <span className="rounded-[2px] border border-brand-300/40 bg-brand-300/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-brand-300">
                        native engine
                    </span>
                </h3>
                <p className="text-xs leading-relaxed text-ink-500">
                    Point Dora at a PostHog project and explore events, top
                    pages, and live traffic in HogQL — KPI tiles, activity
                    charts, and the sites actually sending data, no SQL
                    required.
                </p>
            </div>
        </div>
    )
}
