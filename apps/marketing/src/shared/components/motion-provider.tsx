'use client'

import { LazyMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Lazily loads the framer-motion feature engine (`domMax`) in a separate async
 * chunk instead of bundling it into the initial route JS.
 *
 * Every animated component on the home view uses the lightweight `m` component
 * (not `motion`) — `m` ships ~6 kB of core, while the heavier animation/layout
 * features are fetched right after hydration. None of the home-view animations
 * are first-paint (they're scroll/interaction-driven), so the feature chunk
 * lands well before any user could trigger them.
 *
 * `domMax` (not `domAnimation`) because the home view uses layout animations:
 * the OS-tab `layoutId` pill and the demo grid's `layout` + `popLayout` rows.
 *
 * `strict` forbids the full `motion` component anywhere in this subtree, which
 * guarantees the heavy engine can never sneak back into the initial bundle.
 */
const loadFeatures = () => import('framer-motion').then((mod) => mod.domMax)

export function MotionProvider({ children }: { children: ReactNode }) {
    return (
        <LazyMotion features={loadFeatures} strict>
            {children}
        </LazyMotion>
    )
}
