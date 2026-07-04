'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CornerTick } from '@/components/corner-tick'
import { SectionFrame } from '@/components/section-frame'
import { HubSphere, ProviderRowGraph } from '@/components/provider-row-graph'
import {
    ProviderLogoMark,
    type ProviderLogoId
} from '@/components/provider-logo'
import { ProviderInfoPopover } from '@/components/provider-info-popover'

import { usePrefersReducedMotion } from '@/shared/hooks/use-prefers-reduced-motion'

/* -------------------------------------------------------------------------- */

type TProvider = {
    id: ProviderLogoId
    name: string
    connectionString: string
    tag: string
    blurb: string
}

const PROVIDERS: TProvider[] = [
    {
        id: 'postgres',
        name: 'PostgreSQL',
        connectionString: 'postgresql://user:pass@db.neon.tech/mydb',
        tag: 'Relational',
        blurb: 'The advanced open-source standard. Browse schemas, edit rows, and query JSONB with full read and write support.'
    },
    {
        id: 'sqlite',
        name: 'SQLite',
        connectionString: 'file:///path/to/database.db',
        tag: 'Embedded file',
        blurb: 'Serverless and file-based. Point Dora at a .db file and start querying instantly, no server required.'
    },
    {
        id: 'duckdb',
        name: 'DuckDB',
        connectionString: 'duckdb:///analytics.duckdb · or any .csv/.parquet',
        tag: 'Analytical',
        blurb: 'In-process analytics that flies. Query Parquet, CSV, and JSON as fast columnar tables, then save as .duckdb.'
    },
    {
        id: 'libsql',
        name: 'libSQL',
        connectionString: 'libsql://database.turso.io?authToken=…',
        tag: 'Edge SQLite',
        blurb: 'SQLite reimagined for the edge. Connect to a distributed Turso database over HTTP with an auth token.'
    },
    {
        id: 'mysql',
        name: 'MySQL',
        connectionString: 'mysql://user:pass@localhost:3306/mydb',
        tag: 'Relational',
        blurb: 'The most widely deployed open-source database for the web. Full schema browsing and write support.'
    },
    {
        id: 'mariadb',
        name: 'MariaDB',
        connectionString: 'mysql://user:pass@mariadb.internal/mydb',
        tag: 'Relational',
        blurb: 'A community-driven MySQL fork. Same wire protocol, so your MySQL connection string just works.'
    },
    {
        id: 'cockroach',
        name: 'CockroachDB',
        connectionString:
            'postgresql://user:pass@cockroach.internal:26257/defaultdb',
        tag: 'Distributed SQL',
        blurb: 'Horizontally scalable SQL that speaks Postgres. Strongly consistent, survives failures, no rewrites.'
    }
]

/**
 * Hosted services Dora reaches over the standard Postgres / libSQL paths.
 * These are not separate engines — they're connection-string compatibility,
 * surfaced here to match how people search ("Supabase GUI", "Neon client").
 */
const HOSTED_PROVIDERS = [
    { name: 'Supabase', src: '/providers/supabase.svg' },
    { name: 'Neon', src: '/providers/neon.svg' },
    { name: 'Turso', src: '/providers/libsql.svg' },
    { name: 'PlanetScale', src: '/providers/planetscale.svg' },
    { name: 'Vercel', src: '/providers/vercel.svg' },
    { name: 'Xata', src: '/providers/xata.svg' }
] as const

const HOSTED_EXTRA =
    'Railway, Render, Fly.io, Aiven, DigitalOcean, Crunchy Bridge, Timescale, AWS RDS, Azure, Google Cloud SQL, CockroachDB Cloud, TiDB Cloud'

const ACCENT = '#f5c0c0'
const REVEAL_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'
const STAGGER_MS = 52

const PANEL_GRID =
    'grid grid-cols-[4rem_repeat(7,minmax(0,1fr))] sm:grid-cols-[5.5rem_repeat(7,minmax(0,1fr))]'

function ConnectionStringMarquee({
    activeId,
    reducedMotion
}: {
    activeId: string
    reducedMotion: boolean
}) {
    const active = PROVIDERS.find((p) => p.id === activeId) ?? PROVIDERS[0]
    const [displayed, setDisplayed] = useState(PROVIDERS[0].connectionString)
    const [typedLen, setTypedLen] = useState(
        PROVIDERS[0].connectionString.length
    )
    const prevIdRef = useRef<string | null>(null)

    useEffect(() => {
        if (active.id === prevIdRef.current) return
        prevIdRef.current = active.id
        const str = active.connectionString
        setDisplayed(str)
        if (reducedMotion) {
            setTypedLen(str.length)
            return
        }
        setTypedLen(0)
        let i = 0
        const id = setInterval(() => {
            i += 2
            setTypedLen(Math.min(i, str.length))
            if (i >= str.length) clearInterval(id)
        }, 18)
        return () => clearInterval(id)
    }, [active, reducedMotion])

    const scheme = displayed.split('://')[0]
    const rest = displayed.slice(scheme.length + 3)
    const schemeShown = scheme.slice(0, Math.min(typedLen, scheme.length))
    const sepShown =
        typedLen > scheme.length ? '://'.slice(0, typedLen - scheme.length) : ''
    const restShown =
        typedLen > scheme.length + 3
            ? rest.slice(0, typedLen - scheme.length - 3)
            : ''
    const isTyping = typedLen < displayed.length

    return (
        <div className="flex h-9 items-center gap-2 overflow-hidden border-r border-t border-line bg-surface-deep/80 px-3 font-mono text-[11px] transition-colors duration-300 [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: ACCENT }}
            />
            <span className="truncate">
                <span style={{ color: ACCENT }}>{schemeShown}</span>
                <span className="text-ink-700">{sepShown}</span>
                <span className="text-ink-400">{restShown}</span>
                {isTyping && !reducedMotion ? (
                    <span
                        className="ml-px inline-block h-3 w-px animate-pulse align-middle"
                        style={{ backgroundColor: ACCENT }}
                    />
                ) : null}
            </span>
        </div>
    )
}

export function ProvidersSection() {
    const sectionRef = useRef<HTMLElement>(null)
    const rowRef = useRef<HTMLDivElement>(null)
    const hubRef = useRef<HTMLDivElement>(null)
    const nodeRefs = useRef<(HTMLDivElement | null)[]>([])
    const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

    const [hoveredId, setHoveredId] = useState<ProviderLogoId | null>(null)
    const [canHover, setCanHover] = useState(false)
    const [scrollProgress, setScrollProgress] = useState(0)
    const scrollProgressRef = useRef(0)
    const reducedMotion = usePrefersReducedMotion()
    const running = !reducedMotion

    useEffect(() => {
        if (reducedMotion) {
            scrollProgressRef.current = 1
            setScrollProgress(1)
            return
        }

        let raf = 0

        // Map the fill to the scroll range that's actually reachable. Filling
        // starts as the row enters from the bottom of the viewport, and the
        // "full" point (line at CockroachDB, the last node) is capped at the
        // document's max scroll — so it always lands full at the end of the
        // page even when the section can't scroll any higher.
        const compute = () => {
            raf = 0
            const el = rowRef.current
            if (!el) return
            const rect = el.getBoundingClientRect()
            const vh = window.innerHeight || 1
            const scrollY = window.scrollY
            const doc = document.documentElement
            const maxScroll = Math.max(0, doc.scrollHeight - vh)

            const rowCenterDoc = rect.top + scrollY + rect.height / 2
            // begin when the row's top reaches the bottom of the viewport
            const startScroll = rowCenterDoc - rect.height / 2 - vh
            // natural completion: the row's center reaches the top — but never
            // ask for more scroll than the page actually has
            const endScroll = Math.min(rowCenterDoc, maxScroll)
            const span = Math.max(1, endScroll - startScroll)

            const progress = Math.max(
                0,
                Math.min(1, (scrollY - startScroll) / span)
            )
            scrollProgressRef.current = progress
            setScrollProgress((prev) =>
                Math.abs(prev - progress) > 0.001 ? progress : prev
            )
        }

        const onScroll = () => {
            if (!raf) raf = requestAnimationFrame(compute)
        }

        compute()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', onScroll)
        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', onScroll)
            if (raf) cancelAnimationFrame(raf)
        }
    }, [reducedMotion])

    const scrollIndex = Math.min(
        PROVIDERS.length - 1,
        Math.round(scrollProgress * (PROVIDERS.length - 1))
    )
    const activeId = hoveredId ?? PROVIDERS[scrollIndex].id
    const activeIndex = Math.max(
        0,
        PROVIDERS.findIndex((p) => p.id === activeId)
    )
    const fillOverride = hoveredId ? activeIndex / (PROVIDERS.length - 1) : null

    useEffect(() => {
        const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
        const update = () => setCanHover(mq.matches)
        update()
        mq.addEventListener('change', update)
        return () => mq.removeEventListener('change', update)
    }, [])

    const hoveredIndex = hoveredId
        ? PROVIDERS.findIndex((p) => p.id === hoveredId)
        : -1
    const hoveredProvider = hoveredIndex >= 0 ? PROVIDERS[hoveredIndex] : null
    const popoverInfo = hoveredProvider
        ? {
              name: hoveredProvider.name,
              tag: hoveredProvider.tag,
              blurb: hoveredProvider.blurb
          }
        : null

    function focusProvider(id: ProviderLogoId) {
        setHoveredId(id)
    }

    const revealed = true

    function revealStyle(delay: number): CSSProperties {
        return {
            opacity: revealed ? 1 : 0,
            transform: reducedMotion
                ? 'none'
                : revealed
                  ? 'translate3d(0, 0, 0)'
                  : 'translate3d(0, 12px, 0)',
            transitionDelay: reducedMotion ? '0ms' : `${delay}ms`,
            transitionDuration: reducedMotion ? '180ms' : '420ms',
            transitionProperty: 'opacity, transform',
            transitionTimingFunction: REVEAL_EASE
        }
    }

    const rowDelay = 90
    const hubDelay = rowDelay + 36
    const providerStart = hubDelay + STAGGER_MS
    const marqueeDelay = providerStart + PROVIDERS.length * STAGGER_MS + 36
    const footerDelay = marqueeDelay + 72

    return (
        <section ref={sectionRef} className="relative w-full">
            <SectionFrame />

            <div className="border-b border-r border-line px-6 py-12 sm:px-8">
                <h2
                    className="mb-1 font-[family-name:var(--font-pixel)] text-2xl font-light italic text-ink-600"
                    style={revealStyle(0)}
                >
                    Every database you reach for.
                </h2>
                <h3
                    className="font-[family-name:var(--font-pixel)] text-3xl font-semibold text-ink-100"
                    style={revealStyle(STAGGER_MS)}
                >
                    One workbench for all of them.
                </h3>
            </div>

            <div className="overflow-hidden border-b border-r border-line">
                <div ref={rowRef} className="relative overflow-hidden">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-[0.22]"
                        style={{
                            backgroundImage:
                                'linear-gradient(to right, rgba(227,178,179,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(227,178,179,0.08) 1px, transparent 1px)',
                            backgroundSize: '24px 24px'
                        }}
                    />

                    <ProviderRowGraph
                        containerRef={rowRef}
                        hubRef={hubRef}
                        nodeRefs={nodeRefs}
                        providers={PROVIDERS}
                        fillProgressRef={scrollProgressRef}
                        fillOverride={fillOverride}
                        running={running}
                        revealed={revealed}
                        hubDelay={hubDelay}
                        providerStart={providerStart}
                        staggerMs={STAGGER_MS}
                        reducedMotion={reducedMotion}
                    />

                    <div className={PANEL_GRID}>
                        <div
                            className="relative flex flex-col items-center justify-center gap-2 border-r border-line px-2 py-6 sm:gap-3 sm:px-3 sm:py-10"
                            style={revealStyle(hubDelay)}
                        >
                            <CornerTick className="-left-px -top-px -translate-x-1/2 -translate-y-1/2" />
                            <CornerTick className="-left-px -bottom-px -translate-x-1/2 translate-y-1/2" />
                            <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
                            <CornerTick className="-right-px -bottom-px translate-x-1/2 translate-y-1/2" />
                            <HubSphere running={running} />
                            <div
                                ref={hubRef}
                                aria-hidden
                                className="h-px w-px shrink-0"
                            />
                            <span className="font-[family-name:var(--font-pixel)] text-[10px] font-medium uppercase tracking-[0.08em] text-[#9a8aa2]">
                                Dora
                            </span>
                        </div>

                        {PROVIDERS.map((provider, i) => {
                            const isActive = activeId === provider.id

                            return (
                                <button
                                    key={provider.id}
                                    type="button"
                                    ref={(el) => {
                                        buttonRefs.current[i] = el
                                    }}
                                    className={[
                                        'relative flex flex-col items-center justify-center gap-2 border-r border-line px-1 py-6 transition-colors duration-300 last:border-r-0 sm:gap-3 sm:px-2 sm:py-10',
                                        isActive
                                            ? 'bg-[rgba(245,192,192,0.04)]'
                                            : 'hover:bg-[rgba(245,192,192,0.02)]'
                                    ].join(' ')}
                                    style={revealStyle(
                                        providerStart + i * STAGGER_MS
                                    )}
                                    onMouseEnter={() =>
                                        focusProvider(provider.id)
                                    }
                                    onMouseLeave={() => setHoveredId(null)}
                                    onFocus={() => focusProvider(provider.id)}
                                    onBlur={() => setHoveredId(null)}
                                >
                                    <CornerTick className="-right-px -top-px translate-x-1/2 -translate-y-1/2" />
                                    <CornerTick className="-right-px -bottom-px translate-x-1/2 translate-y-1/2" />
                                    <ProviderLogoMark
                                        id={provider.id}
                                        active={isActive}
                                    />
                                    <div
                                        ref={(el) => {
                                            nodeRefs.current[i] = el
                                        }}
                                        aria-hidden
                                        className="h-px w-px shrink-0"
                                    />
                                    <span
                                        className="max-w-[4.75rem] truncate text-center font-[family-name:var(--font-pixel)] text-[10px] font-medium leading-tight transition-colors duration-300 sm:max-w-none sm:text-[11px]"
                                        style={{
                                            color: isActive
                                                ? '#f0e8f0'
                                                : '#9a8aa2'
                                        }}
                                    >
                                        {provider.name}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            <ProviderInfoPopover
                info={popoverInfo}
                anchor={
                    hoveredIndex >= 0 ? buttonRefs.current[hoveredIndex] : null
                }
                open={canHover && hoveredId !== null}
            />

            <div style={revealStyle(marqueeDelay)}>
                <ConnectionStringMarquee
                    activeId={activeId}
                    reducedMotion={reducedMotion}
                />
            </div>

            <div className="border-t border-r border-line px-6 py-8 sm:px-8">
                <p
                    className="mb-5 font-[family-name:var(--font-pixel)] text-[11px] font-medium uppercase tracking-[0.12em] text-[#7a6a72]"
                    style={revealStyle(footerDelay)}
                >
                    First-class native connectors
                </p>
                <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
                    {HOSTED_PROVIDERS.map((provider, i) => (
                        <span
                            key={provider.name}
                            className="flex items-center gap-2"
                            style={revealStyle(
                                footerDelay + STAGGER_MS + i * STAGGER_MS
                            )}
                        >
                            <img
                                src={provider.src}
                                alt={`${provider.name} logo`}
                                width={20}
                                height={20}
                                className="size-5 opacity-75"
                                style={{
                                    filter: 'grayscale(1) brightness(1.7)'
                                }}
                                draggable={false}
                            />
                            <span className="text-[13px] font-medium text-[#c4bcc4]">
                                {provider.name}
                            </span>
                        </span>
                    ))}
                    {/* Cloudflare D1 — a genuinely new query engine, not a Postgres
                        shim, so it gets a callout rather than a grayscaled logo. */}
                    <span
                        className="flex items-center gap-2"
                        style={revealStyle(
                            footerDelay +
                                STAGGER_MS +
                                HOSTED_PROVIDERS.length * STAGGER_MS
                        )}
                    >
                        <span className="text-[13px] font-medium text-[#c4bcc4]">
                            Cloudflare D1
                        </span>
                        <span className="rounded-[2px] border border-accent-rose/40 bg-accent-rose/10 px-1.5 py-0.5 font-[family-name:var(--font-pixel)] text-[9px] uppercase tracking-[0.1em] text-accent-rose">
                            native engine
                        </span>
                    </span>
                    {/* PostHog — reached over the HogQL Query API, another new
                        engine (not a Postgres shim), so it earns the same badge. */}
                    <span
                        className="flex items-center gap-2"
                        style={revealStyle(
                            footerDelay +
                                STAGGER_MS +
                                (HOSTED_PROVIDERS.length + 1) * STAGGER_MS
                        )}
                    >
                        <span className="text-[13px] font-medium text-[#c4bcc4]">
                            PostHog
                        </span>
                        <span className="rounded-[2px] border border-accent-rose/40 bg-accent-rose/10 px-1.5 py-0.5 font-[family-name:var(--font-pixel)] text-[9px] uppercase tracking-[0.1em] text-accent-rose">
                            native engine
                        </span>
                    </span>
                </div>
                <p
                    className="mt-5 max-w-2xl text-[13px] leading-relaxed text-ink-700"
                    style={revealStyle(
                        footerDelay +
                            STAGGER_MS +
                            (HOSTED_PROVIDERS.length + 2) * STAGGER_MS
                    )}
                >
                    Connect with OAuth, an API token, or a branch picker — not
                    just a pasted string. Supabase authorizes in one click; Neon
                    and PlanetScale connect branch-aware; Cloudflare D1 speaks
                    its own HTTP engine, and PostHog turns HogQL events into a
                    built-in analytics dashboard. Plus {HOSTED_EXTRA}, and any
                    Postgres, MySQL, or libSQL connection string.
                </p>
            </div>
        </section>
    )
}
