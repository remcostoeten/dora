'use client'

import { useRef, useEffect, type RefObject } from 'react'

/* ---------------------------------------------------------------------------
 * Shared scroll-motion hook
 * Tracks the section's position in the viewport (progress 0 -> 1) and the
 * current scroll velocity. Both are exposed as refs so canvas/RAF loops can
 * read the freshest value every frame without re-subscribing, and progress is
 * also returned as state for DOM-driven transforms.
 * ------------------------------------------------------------------------- */
export function useScrollMotion(ref: RefObject<HTMLElement | null>) {
    const progressRef = useRef(0)
    const velocityRef = useRef(0)

    useEffect(() => {
        let lastY = window.scrollY
        let lastT = performance.now()
        let raf = 0
        let decayRaf = 0

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
            velocityRef.current *= 0.9
            if (Math.abs(velocityRef.current) < 0.002) {
                velocityRef.current = 0
                decayRaf = 0
                return
            }
            decayRaf = requestAnimationFrame(decay)
        }

        const onScroll = () => {
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
    }, [ref])

    return { progressRef, velocityRef }
}

export type Motion = {
    progressRef: RefObject<number>
    velocityRef: RefObject<number>
}
