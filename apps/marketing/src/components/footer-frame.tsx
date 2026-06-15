'use client'

import type { CSSProperties } from 'react'

import { CornerTick } from '@/components/corner-tick'
import { useFrameDrawIn } from '@/shared/hooks/use-frame-draw-in'

/**
 * Footer frame: the top border, the two side accents (top-anchored gradients),
 * and the corner ticks are all rendered statically — present from first paint.
 */
export function FooterFrame() {
    const { ref, lineStyle, tickStyle } = useFrameDrawIn<HTMLSpanElement>()

    const sideStyle: CSSProperties = { transform: 'none' }

    return (
        <>
            <span
                ref={ref}
                aria-hidden
                className="pointer-events-none absolute inset-0"
            />
            <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 h-px w-full origin-center bg-[#3a3138]"
                style={lineStyle('x')}
            />
            <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-[#3a3138] to-transparent"
                style={sideStyle}
            />
            <span
                aria-hidden
                className="pointer-events-none absolute right-0 top-0 h-full w-px bg-gradient-to-b from-[#3a3138] to-transparent"
                style={sideStyle}
            />
            <CornerTick
                className="-left-px -top-px -translate-x-1/2 -translate-y-1/2"
                style={tickStyle(0)}
            />
            <CornerTick
                className="-right-px -top-px translate-x-1/2 -translate-y-1/2"
                style={tickStyle(1)}
            />
        </>
    )
}
