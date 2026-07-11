'use client'

import { CornerTick } from '@/components/corner-tick'
import { useFrameDrawIn } from '@/shared/hooks/use-frame-draw-in'

const LINE = 'pointer-events-none absolute z-[2] bg-line-strong'

/**
 * Frame for the two-tone marketing section grids. Draws the rose outer edges
 * (top + left, the ones the section owns) outward from center on first view,
 * then pops the four corner ticks. The grey inner-cell grid (var(--color-line)) that
 * forms the right/bottom edges stays static.
 *
 * Drop inside a `relative` section in place of the old
 * `border-l border-t border-line-strong` + four corner ticks.
 */
export function SectionFrame() {
    const { ref, lineStyle, tickStyle } = useFrameDrawIn<HTMLSpanElement>()

    return (
        <>
            {/* sentinel observed for first view */}
            <span
                ref={ref}
                aria-hidden
                className="pointer-events-none absolute inset-0"
            />
            <span
                aria-hidden
                className={`${LINE} left-0 top-0 h-px w-full origin-center`}
                style={lineStyle('x')}
            />
            <span
                aria-hidden
                className={`${LINE} left-0 top-0 h-full w-px origin-center`}
                style={lineStyle('y')}
            />
            <CornerTick
                className="-left-px -top-px -translate-x-1/2 -translate-y-1/2"
                style={tickStyle(0)}
            />
            <CornerTick
                className="-right-px -top-px translate-x-1/2 -translate-y-1/2"
                style={tickStyle(1)}
            />
            <CornerTick
                className="-bottom-px -left-px -translate-x-1/2 translate-y-1/2"
                style={tickStyle(2)}
            />
            <CornerTick
                className="-bottom-px -right-px translate-x-1/2 translate-y-1/2"
                style={tickStyle(3)}
            />
        </>
    )
}
