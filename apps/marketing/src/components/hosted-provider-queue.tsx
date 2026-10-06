'use client'

import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties
} from 'react'
import {
    AnimatePresence,
    m,
    useInView,
    useReducedMotion,
    type Transition
} from 'framer-motion'

type THostedProvider = {
    name: string
    src: string
    brand: string
    method: string
    detail: string
    nativeEngine?: boolean
}

const POSTGRES_STRING = 'Paste a Postgres connection string.'
const POSTGRES_OR_MYSQL_STRING = 'Paste a Postgres or MySQL connection string.'

const HOSTED_PROVIDERS: THostedProvider[] = [
    {
        name: 'Supabase',
        brand: '#3ECF8E',
        src: '/providers/supabase.svg',
        method: 'OAuth',
        detail: 'Authorize in one click or paste an access token, then pick a project.'
    },
    {
        name: 'Neon',
        brand: '#00E599',
        src: '/providers/neon.svg',
        method: 'API key',
        detail: 'Pick a project branch and Dora builds the pooled connection string.'
    },
    {
        name: 'Turso',
        brand: '#4FF8D2',
        src: '/providers/libsql.svg',
        method: 'API token',
        detail: 'Pick a database across your organizations; Dora mints its auth token.'
    },
    {
        name: 'PlanetScale',
        brand: '#F2F2F2',
        src: '/providers/planetscale.svg',
        method: 'Service token',
        detail: 'Pick a database and branch to connect.'
    },
    {
        name: 'Vercel',
        brand: '#FFFFFF',
        src: '/providers/vercel.svg',
        method: 'Access token',
        detail: 'Pick a project and Dora reads its Postgres store URL.'
    },
    {
        name: 'Xata',
        brand: '#9F7AEA',
        src: '/providers/xata.svg',
        method: 'API key',
        detail: 'Connects through the Postgres endpoint of a database branch.'
    },
    {
        name: 'Cloudflare D1',
        brand: '#F38020',
        src: '/providers/cloudflare-d1.svg',
        method: 'API token',
        detail: 'Pick an account and a D1 database. Queries run over the D1 HTTP API.',
        nativeEngine: true
    },
    {
        name: 'PostHog',
        brand: '#F54E00',
        src: '/providers/posthog.svg',
        method: 'API key',
        detail: 'Query events with HogQL and build a built-in analytics dashboard.',
        nativeEngine: true
    },
    {
        name: 'Railway',
        brand: '#A66BF0',
        src: '/providers/railway.svg',
        method: 'Connection string',
        detail: POSTGRES_OR_MYSQL_STRING
    },
    {
        name: 'Render',
        brand: '#8A63FF',
        src: '/providers/render.svg',
        method: 'Connection string',
        detail: POSTGRES_STRING
    },
    {
        name: 'Fly.io',
        brand: '#8B5CF6',
        src: '/providers/fly.svg',
        method: 'Connection string',
        detail: POSTGRES_STRING
    },
    {
        name: 'Aiven',
        brand: '#FF3554',
        src: '/providers/aiven.svg',
        method: 'Connection string',
        detail: POSTGRES_OR_MYSQL_STRING
    },
    {
        name: 'DigitalOcean',
        brand: '#0080FF',
        src: '/providers/digitalocean.svg',
        method: 'Connection string',
        detail: POSTGRES_OR_MYSQL_STRING
    },
    {
        name: 'Crunchy Bridge',
        brand: '#2D9CDB',
        src: '/providers/crunchy-bridge.svg',
        method: 'Connection string',
        detail: POSTGRES_STRING
    },
    {
        name: 'Timescale',
        brand: '#FDB515',
        src: '/providers/timescale.svg',
        method: 'Connection string',
        detail: POSTGRES_STRING
    },
    {
        name: 'AWS RDS',
        brand: '#527FFF',
        src: '/providers/aws-rds.svg',
        method: 'Connection string',
        detail: POSTGRES_OR_MYSQL_STRING
    },
    {
        name: 'Azure',
        brand: '#0089D6',
        src: '/providers/azure.svg',
        method: 'Connection string',
        detail: POSTGRES_OR_MYSQL_STRING
    },
    {
        name: 'Google Cloud SQL',
        brand: '#4285F4',
        src: '/providers/google-cloud-sql.svg',
        method: 'Connection string',
        detail: POSTGRES_OR_MYSQL_STRING
    },
    {
        name: 'CockroachDB Cloud',
        brand: '#8A63FF',
        src: '/providers/cockroach.svg',
        method: 'Connection string',
        detail: 'Paste the Postgres-compatible connection string.'
    },
    {
        name: 'TiDB Cloud',
        brand: '#E30C34',
        src: '/providers/tidb.svg',
        method: 'Connection string',
        detail: 'Paste the MySQL-compatible connection string.'
    }
]

const VISIBLE_COUNT = 8
const SHIFT_INTERVAL_MS = 2400
const EASE_OUT = [0.23, 1, 0.32, 1] as const

const TOOLTIP_DELAY_MS = 150
const TOOLTIP_HALF_WIDTH = 128
const DRAG_FREE_PX = 120
const DRAG_RESISTANCE = 0.3
const FLICK_PROJECTION_MS = 120
const MAX_DRAG_STEPS = 3

type TDrag = {
    pointerId: number
    startX: number
    lastX: number
    lastTime: number
    velocity: number
    offset: number
}

function dampDrag(delta: number) {
    const distance = Math.abs(delta)
    if (distance <= DRAG_FREE_PX) return delta
    return (
        Math.sign(delta) *
        (DRAG_FREE_PX + (distance - DRAG_FREE_PX) * DRAG_RESISTANCE)
    )
}

type TTooltip = {
    provider: THostedProvider
    x: number
}

const ITEM_TRANSITION: Transition = {
    duration: 0.45,
    ease: EASE_OUT,
    layout: { duration: 0.5, ease: EASE_OUT }
}

export function HostedProviderQueue() {
    const rowRef = useRef<HTMLDivElement>(null)
    const inView = useInView(rowRef, { amount: 0.5 })
    const reduceMotion = useReducedMotion()
    const [head, setHead] = useState(0)
    const [paused, setPaused] = useState(false)
    const [tooltip, setTooltip] = useState<TTooltip | null>(null)
    const [tooltipVisible, setTooltipVisible] = useState(false)
    const [sliding, setSliding] = useState(false)
    const [dragging, setDragging] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const trackRef = useRef<HTMLDivElement>(null)
    const drag = useRef<TDrag | null>(null)
    const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    function clearOpenTimer() {
        if (openTimer.current) {
            clearTimeout(openTimer.current)
            openTimer.current = null
        }
    }

    function showTooltip(provider: THostedProvider, target: HTMLElement) {
        const wrapper = wrapperRef.current
        if (!wrapper) return
        const wrapperBox = wrapper.getBoundingClientRect()
        const targetBox = target.getBoundingClientRect()
        const center = targetBox.left - wrapperBox.left + targetBox.width / 2
        const next = {
            provider,
            x: Math.max(
                TOOLTIP_HALF_WIDTH,
                Math.min(wrapperBox.width - TOOLTIP_HALF_WIDTH, center)
            )
        }
        clearOpenTimer()
        setSliding(tooltipVisible)
        setTooltip(next)
        if (tooltipVisible) return
        openTimer.current = setTimeout(
            () => setTooltipVisible(true),
            TOOLTIP_DELAY_MS
        )
    }

    function hideTooltip() {
        clearOpenTimer()
        setTooltipVisible(false)
    }

    useEffect(() => clearOpenTimer, [])

    function averageItemWidth() {
        const items = Array.from(trackRef.current?.children ?? []).filter(
            (item) => item instanceof HTMLElement
        )
        const first = items[0]
        const last = items[items.length - 1]
        if (!first || !last || items.length < 2) return 120
        return (last.offsetLeft - first.offsetLeft) / (items.length - 1)
    }

    function setTrackOffset(offset: number, animate: boolean) {
        const track = trackRef.current
        if (!track) return
        track.style.transition = animate
            ? 'transform 320ms cubic-bezier(0.23, 1, 0.32, 1)'
            : 'none'
        track.style.transform = offset ? `translateX(${offset}px)` : ''
    }

    function startDrag(event: React.PointerEvent<HTMLDivElement>) {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        hideTooltip()
        setDragging(true)
        drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            lastX: event.clientX,
            lastTime: event.timeStamp,
            velocity: 0,
            offset: 0
        }
        setTrackOffset(0, false)
    }

    function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        const elapsed = event.timeStamp - current.lastTime
        if (elapsed > 0) {
            current.velocity = (event.clientX - current.lastX) / elapsed
        }
        current.lastX = event.clientX
        current.lastTime = event.timeStamp
        current.offset = dampDrag(event.clientX - current.startX)
        setTrackOffset(current.offset, false)
    }

    function endDrag(event: React.PointerEvent<HTMLDivElement>) {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        drag.current = null
        setDragging(false)
        const projected =
            current.offset + current.velocity * FLICK_PROJECTION_MS
        const steps = Math.max(
            -MAX_DRAG_STEPS,
            Math.min(
                MAX_DRAG_STEPS,
                -Math.round(projected / averageItemWidth())
            )
        )
        if (steps === 0) {
            setTrackOffset(0, true)
            return
        }
        setHead(
            (prev) =>
                (prev + steps + HOSTED_PROVIDERS.length) %
                HOSTED_PROVIDERS.length
        )
    }

    useLayoutEffect(() => {
        if (!drag.current) setTrackOffset(0, false)
    }, [head])

    useEffect(() => {
        if (!inView || paused || dragging) return
        const id = setInterval(() => {
            if (document.hidden) return
            setHead((prev) => (prev + 1) % HOSTED_PROVIDERS.length)
        }, SHIFT_INTERVAL_MS)
        return () => clearInterval(id)
    }, [inView, paused, dragging])

    const visible = Array.from(
        { length: VISIBLE_COUNT },
        (_, offset) =>
            HOSTED_PROVIDERS[(head + offset) % HOSTED_PROVIDERS.length]
    )
    const shift = reduceMotion ? 0 : 16
    const transition: Transition = reduceMotion
        ? { duration: 0.2, ease: 'easeOut', layout: { duration: 0 } }
        : ITEM_TRANSITION

    return (
        <div ref={wrapperRef} className="relative">
            <ul className="sr-only">
                {HOSTED_PROVIDERS.map((provider) => (
                    <li key={provider.name}>
                        {provider.name}, {provider.method}: {provider.detail}
                    </li>
                ))}
            </ul>
            <div
                ref={rowRef}
                aria-hidden
                className={`relative h-7 touch-pan-y select-none overflow-hidden [mask-image:linear-gradient(to_right,black_85%,transparent)] ${
                    dragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                onLostPointerCapture={endDrag}
                onPointerCancel={endDrag}
                onPointerDown={startDrag}
                onPointerEnter={() => setPaused(true)}
                onPointerLeave={() => {
                    setPaused(false)
                    hideTooltip()
                }}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
            >
                <div
                    ref={trackRef}
                    className="flex h-full flex-nowrap items-center gap-x-7"
                >
                    <AnimatePresence mode="popLayout" initial={false}>
                        {visible.map((provider) => (
                            <m.span
                                key={provider.name}
                                layout="position"
                                className="hosted-provider flex shrink-0 items-center gap-2"
                                initial={{ opacity: 0, x: shift }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -shift }}
                                transition={transition}
                                onPointerEnter={(event) => {
                                    if (!drag.current)
                                        showTooltip(
                                            provider,
                                            event.currentTarget
                                        )
                                }}
                            >
                                <span
                                    className="hosted-provider-logo size-5"
                                    // CSS custom properties are not part of CSSProperties
                                    style={
                                        {
                                            '--logo': `url(${provider.src})`,
                                            '--brand': provider.brand
                                        } as CSSProperties
                                    }
                                />
                                <span className="hosted-provider-name whitespace-nowrap text-[13px] font-medium text-ink-350">
                                    {provider.name}
                                </span>
                                {provider.nativeEngine ? (
                                    <span className="whitespace-nowrap rounded-[2px] border border-brand-300/40 bg-brand-300/10 px-1.5 py-0.5 font-[family-name:var(--font-pixel)] text-[9px] uppercase tracking-[0.1em] text-brand-300">
                                        native engine
                                    </span>
                                ) : null}
                            </m.span>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
            {tooltip ? (
                <div
                    aria-hidden
                    className="pointer-events-none absolute bottom-full left-0 z-20 pb-2.5"
                    style={{
                        transform: `translateX(calc(${tooltip.x}px - 50%))`,
                        transition: !sliding
                            ? 'none'
                            : 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)'
                    }}
                >
                    <div
                        className="hosted-provider-tooltip w-64 border border-line-strong bg-surface-deep px-3 py-2.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.9)]"
                        data-instant={sliding}
                        data-visible={tooltipVisible}
                    >
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                            <span className="text-[12px] font-medium text-ink-100">
                                {tooltip.provider.name}
                            </span>
                            <span
                                className="font-[family-name:var(--font-pixel)] text-[9px] uppercase tracking-[0.1em]"
                                style={{ color: tooltip.provider.brand }}
                            >
                                {tooltip.provider.method}
                            </span>
                        </div>
                        <p className="text-[11px] leading-snug text-ink-400">
                            {tooltip.provider.detail}
                        </p>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
