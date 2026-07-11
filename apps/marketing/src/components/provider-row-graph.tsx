'use client'

import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject
} from 'react'

type Point = { x: number; y: number }

type RowProvider = {
    id: string
}

export function HubSphere({ running }: { running: boolean }) {
    return (
        <svg viewBox="0 0 64 64" className="size-11 shrink-0 sm:size-12" aria-hidden>
            <g transform="translate(32 32)">
                <g>
                    {running ? (
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 0 0"
                            to="360 0 0"
                            dur="18s"
                            repeatCount="indefinite"
                        />
                    ) : null}
                    <ellipse cx="0" cy="0" rx="18" ry="7" fill="none" stroke="color-mix(in srgb, var(--color-brand-200) 40%, transparent)" strokeWidth="1" />
                    <ellipse cx="0" cy="0" rx="18" ry="18" fill="none" stroke="color-mix(in srgb, var(--color-brand-200) 25%, transparent)" strokeWidth="0.9" />
                </g>
                <g>
                    {running ? (
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="360 0 0"
                            to="0 0 0"
                            dur="24s"
                            repeatCount="indefinite"
                        />
                    ) : null}
                    <ellipse cx="0" cy="0" rx="7" ry="18" fill="none" stroke="color-mix(in srgb, var(--color-brand-300) 30%, transparent)" strokeWidth="0.9" />
                </g>
                <circle cx="0" cy="0" r="5" fill="var(--color-surface)" stroke="color-mix(in srgb, var(--color-brand-200) 55%, transparent)" strokeWidth="1" />
                <circle cx="0" cy="0" r="2.2" fill="var(--color-brand-200)" />
            </g>
        </svg>
    )
}

function measureLayout(
    container: HTMLDivElement,
    hubRef: RefObject<HTMLDivElement | null>,
    nodeRefs: RefObject<(HTMLDivElement | null)[]>,
    providers: RowProvider[],
) {
    const hubEl = hubRef.current
    const cr = container.getBoundingClientRect()
    if (!hubEl || cr.width === 0) return null

    const hr = hubEl.getBoundingClientRect()
    const hub: Point = {
        x: hr.left + hr.width / 2 - cr.left,
        y: hr.top + hr.height / 2 - cr.top,
    }

    const nodes = providers.map((_, i) => {
        const el = nodeRefs.current[i]
        if (!el) return null
        const r = el.getBoundingClientRect()
        return {
            x: r.left + r.width / 2 - cr.left,
            y: r.top + r.height / 2 - cr.top,
        }
    })

    if (nodes.some((n) => n === null)) return null

    const last = nodes[nodes.length - 1] as Point
    const trackY = (nodes[0] as Point).y

    return {
        w: cr.width,
        h: cr.height,
        hub,
        nodes: nodes as Point[],
        track: { x1: hub.x, y1: trackY, x2: last.x, y2: trackY },
    }
}

const STEM_LENGTH = 14
const REVEAL_EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'

function stemRevealStyle(
    revealed: boolean,
    delay: number,
    reducedMotion: boolean
) {
    return {
        strokeDasharray: STEM_LENGTH,
        strokeDashoffset: revealed ? 0 : STEM_LENGTH,
        transition: reducedMotion
            ? 'stroke-dashoffset 180ms ease'
            : `stroke-dashoffset 420ms ${REVEAL_EASE} ${delay}ms`,
    }
}

export function ProviderRowGraph({
    containerRef,
    hubRef,
    nodeRefs,
    providers,
    fillProgressRef,
    fillOverride = null,
    running,
    revealed = true,
    hubDelay = 0,
    providerStart = 0,
    staggerMs = 52,
    reducedMotion = false,
}: {
    containerRef: RefObject<HTMLDivElement | null>
    hubRef: RefObject<HTMLDivElement | null>
    nodeRefs: RefObject<(HTMLDivElement | null)[]>
    providers: RowProvider[]
    fillProgressRef: RefObject<number>
    fillOverride?: number | null
    running: boolean
    revealed?: boolean
    hubDelay?: number
    providerStart?: number
    staggerMs?: number
    reducedMotion?: boolean
}) {
    const packetRef = useRef<SVGCircleElement>(null)
    const [layout, setLayout] = useState<ReturnType<typeof measureLayout>>(null)
    const [fillProgress, setFillProgress] = useState(0)
    const displayFillRef = useRef(0)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const update = () => {
            const next = measureLayout(container, hubRef, nodeRefs, providers)
            if (next) setLayout(next)
        }

        update()
        const ro = new ResizeObserver(update)
        ro.observe(container)
        window.addEventListener('resize', update)
        return () => {
            ro.disconnect()
            window.removeEventListener('resize', update)
        }
    }, [containerRef, hubRef, nodeRefs, providers])

    useLayoutEffect(() => {
        const container = containerRef.current
        if (!container) return

        let frame = 0
        let raf = 0

        const update = () => {
            const next = measureLayout(container, hubRef, nodeRefs, providers)
            if (next) {
                setLayout(next)
            } else if (frame < 8) {
                frame += 1
                raf = requestAnimationFrame(update)
            }
        }

        raf = requestAnimationFrame(update)
        return () => cancelAnimationFrame(raf)
    }, [containerRef, hubRef, nodeRefs, providers, fillOverride])

    useEffect(() => {
        let raf = 0
        let pulse = 0

        const tick = () => {
            const target = fillOverride ?? fillProgressRef.current ?? 0
            // Ease the displayed fill toward its target so a hover glides the
            // line in (and back out on release) instead of snapping to the tile.
            const cur = displayFillRef.current
            const eased = reducedMotion ? target : cur + (target - cur) * 0.12
            const next = Math.abs(target - eased) < 0.0005 ? target : eased
            displayFillRef.current = next
            setFillProgress(next)

            if (layout && running) {
                pulse += 0.04
                const last = layout.nodes[layout.nodes.length - 1]
                const fillX =
                    layout.hub.x +
                    (last.x - layout.hub.x) * Math.max(0, Math.min(1, next))
                const packet = packetRef.current
                if (packet) {
                    packet.setAttribute('cx', String(fillX))
                    packet.setAttribute('cy', String(layout.track.y1))
                    packet.setAttribute(
                        'opacity',
                        String(Math.sin(pulse) * 0.2 + 0.8)
                    )
                }
            }

            raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [fillOverride, fillProgressRef, layout, running, reducedMotion])

    if (!layout || layout.w === 0) return null

    const lastNode = layout.nodes[layout.nodes.length - 1]
    const clampedFill = Math.max(0, Math.min(1, fillProgress))
    const fillX =
        layout.hub.x + (lastNode.x - layout.hub.x) * clampedFill
    const fillPoint = { x: fillX, y: layout.track.y1 }
    const reachedIndex = Math.min(
        providers.length - 1,
        Math.round(clampedFill * (providers.length - 1))
    )
    const activeColor = 'var(--color-brand-200)'

    return (
        <svg
            aria-hidden
            className="pointer-events-none absolute inset-0"
            width={layout.w}
            height={layout.h}
        >
            <line
                x1={layout.track.x1}
                y1={layout.track.y1}
                x2={layout.track.x2}
                y2={layout.track.y1}
                stroke="var(--color-line)"
                strokeWidth="1"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={revealed ? 0 : 1}
                style={{
                    transition: reducedMotion
                        ? 'stroke-dashoffset 180ms ease'
                        : `stroke-dashoffset 520ms ${REVEAL_EASE} ${hubDelay}ms`,
                }}
            />
            <line
                x1={layout.track.x1}
                y1={layout.track.y1 + 3}
                x2={layout.track.x2}
                y2={layout.track.y1 + 3}
                stroke="var(--color-surface-elevated)"
                strokeWidth="1"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={revealed ? 0 : 1}
                style={{
                    transition: reducedMotion
                        ? 'stroke-dashoffset 180ms ease'
                        : `stroke-dashoffset 520ms ${REVEAL_EASE} ${hubDelay + 40}ms`,
                }}
            />

            {layout.nodes.map((node, i) => {
                const lit = i <= reachedIndex
                const leading = i === reachedIndex
                const stemDelay = providerStart + i * staggerMs

                return (
                    <g key={providers[i]?.id ?? i}>
                        <line
                            x1={node.x}
                            y1={node.y - STEM_LENGTH}
                            x2={node.x}
                            y2={node.y}
                            stroke={
                                leading
                                    ? 'color-mix(in srgb, var(--color-brand-200) 35%, transparent)'
                                    : lit
                                      ? 'color-mix(in srgb, var(--color-brand-200) 18%, transparent)'
                                      : 'var(--color-line-strong)'
                            }
                            strokeWidth="1"
                            style={stemRevealStyle(revealed, stemDelay, reducedMotion)}
                        />
                        <rect
                            x={node.x - 2}
                            y={node.y - 2}
                            width="4"
                            height="4"
                            fill={leading ? activeColor : lit ? 'var(--color-line)' : 'var(--color-surface)'}
                            stroke={leading ? activeColor : lit ? 'color-mix(in srgb, var(--color-brand-200) 45%, transparent)' : 'var(--color-line-strong)'}
                            strokeWidth="0.75"
                            style={{
                                opacity: revealed ? 1 : 0,
                                transition: reducedMotion
                                    ? 'opacity 180ms ease'
                                    : `opacity 280ms ${REVEAL_EASE} ${stemDelay + 120}ms`,
                            }}
                        />
                    </g>
                )
            })}

            {clampedFill > 0 ? (
                <line
                    x1={layout.hub.x}
                    y1={layout.track.y1}
                    x2={fillPoint.x}
                    y2={layout.track.y1}
                    stroke="var(--color-brand-200)"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    strokeLinecap="round"
                    opacity="0.75"
                >
                    {running ? (
                        <animate
                            attributeName="stroke-dashoffset"
                            from="0"
                            to="-6"
                            dur="0.8s"
                            repeatCount="indefinite"
                        />
                    ) : null}
                </line>
            ) : null}

            <circle
                ref={packetRef}
                cx={layout.hub.x}
                cy={layout.track.y1}
                r="2.5"
                fill="var(--color-brand-200)"
                opacity={clampedFill > 0 ? 1 : 0}
            />

            <line
                x1={layout.hub.x}
                y1={layout.hub.y - STEM_LENGTH}
                x2={layout.hub.x}
                y2={layout.hub.y}
                stroke="color-mix(in srgb, var(--color-brand-200) 35%, transparent)"
                strokeWidth="1"
                style={stemRevealStyle(revealed, hubDelay, reducedMotion)}
            />
        </svg>
    )
}
