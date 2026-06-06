'use client'

import { useRef, useEffect, useState, type RefObject } from 'react'

type TGate = {
    active: boolean
    activeRef: RefObject<boolean>
}

function canAnimate(prefersReducedMotion: boolean) {
    return (
        !prefersReducedMotion &&
        document.visibilityState === 'visible'
    )
}

export function useGate(ref: RefObject<HTMLElement | null>): TGate {
    const activeRef = useRef(false)
    const [active, setActive] = useState(false)

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)')
        let isIntersecting = false

        const update = () => {
            const reduced = media.matches
            const next = isIntersecting && canAnimate(reduced)
            activeRef.current = next
            setActive(next)
        }

        const io = new IntersectionObserver(
            ([entry]) => {
                isIntersecting = entry.isIntersecting
                update()
            },
            { threshold: [0, 0.01] }
        )

        const el = ref.current
        if (el) io.observe(el)

        update()
        document.addEventListener('visibilitychange', update)
        window.addEventListener('focus', update)
        window.addEventListener('blur', update)
        media.addEventListener('change', update)

        return () => {
            io.disconnect()
            document.removeEventListener('visibilitychange', update)
            window.removeEventListener('focus', update)
            window.removeEventListener('blur', update)
            media.removeEventListener('change', update)
        }
    }, [ref])

    return { active, activeRef }
}

/* ---------------------------------------------------------------------------
 * Shared scroll-motion hook
 * Tracks the section's position in the viewport (progress 0 -> 1) and the
 * current scroll velocity. Both are exposed as refs so canvas/RAF loops can
 * read the freshest value every frame without re-subscribing, and progress is
 * also returned as state for DOM-driven transforms.
 * ------------------------------------------------------------------------- */
export function useScrollMotion(
    ref: RefObject<HTMLElement | null>,
    { active = true }: { active?: boolean } = {}
) {
    const progressRef = useRef(0)
    const velocityRef = useRef(0)
    const gate = useGate(ref)
    const shouldTrack = active && gate.active

    useEffect(() => {
        if (!shouldTrack) {
            progressRef.current = 0
            velocityRef.current = 0
            return
        }

        let lastY = window.scrollY
        let lastT = performance.now()
        let raf = 0
        let decayRaf = 0

        const stopDecay = () => {
            if (decayRaf) cancelAnimationFrame(decayRaf)
            decayRaf = 0
            velocityRef.current = 0
        }

        const measure = () => {
            const el = ref.current
            if (el) {
                const rect = el.getBoundingClientRect()
                const vh = window.innerHeight
                const total = rect.height + vh
                const seen = vh - rect.top
                // refs only — no setState, so scrolling never re-renders the section
                progressRef.current = Math.max(0, Math.min(1, seen / total))
            }
        }

        // Decay velocity toward 0 so motion settles. Self-stopping: only runs
        // while there is residual velocity, instead of looping forever.
        const decay = () => {
            if (!gate.activeRef.current) {
                stopDecay()
                return
            }
            velocityRef.current *= 0.9
            if (Math.abs(velocityRef.current) < 0.002) {
                velocityRef.current = 0
                decayRaf = 0
                return
            }
            decayRaf = requestAnimationFrame(decay)
        }

        const onScroll = () => {
            if (!gate.activeRef.current) {
                stopDecay()
                return
            }
            const now = performance.now()
            const dy = window.scrollY - lastY
            const dt = Math.max(16, now - lastT)
            // normalized velocity (px per ms), clamped
            velocityRef.current = Math.max(-3, Math.min(3, dy / dt))
            lastY = window.scrollY
            lastT = now
            if (!raf) {
                raf = requestAnimationFrame(() => {
                    measure()
                    raf = 0
                })
            }
            if (!decayRaf) decayRaf = requestAnimationFrame(decay)
        }

        measure()
        window.addEventListener('scroll', onScroll, { passive: true })
        window.addEventListener('resize', measure)
        return () => {
            window.removeEventListener('scroll', onScroll)
            window.removeEventListener('resize', measure)
            if (raf) cancelAnimationFrame(raf)
            if (decayRaf) cancelAnimationFrame(decayRaf)
        }
    }, [ref, shouldTrack, gate.activeRef])

    return { progressRef, velocityRef, activeRef: gate.activeRef }
}

export type Motion = {
    progressRef: RefObject<number>
    velocityRef: RefObject<number>
    activeRef: RefObject<boolean>
}
