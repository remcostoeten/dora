'use client'

import { useRef, type CSSProperties } from 'react'

/**
 * Marketing frames render statically: the four border lines and the rose corner
 * ticks are present from first paint (server HTML), with no scroll/draw-in
 * animation. Only content eases in — that lives in `ScrollReveal`. Keeping these
 * helpers (rather than inlining the styles) lets every frame component stay
 * unchanged at the call site while the borders are just solid markup.
 */

/** A border line at full extent — no transform, so it's drawn immediately. */
export function frameLineStyle(): CSSProperties {
    return { transform: 'none' }
}

/** A corner tick, always visible. */
export function frameTickStyle(): CSSProperties {
    return { opacity: 1 }
}

/**
 * Provides a ref (so frames can still anchor a DOM node) and the static line/tick
 * style helpers. `visible`/`reduced` are retained for call sites that read them,
 * but frames no longer animate, so both are constant.
 */
export function useFrameDrawIn<T extends HTMLElement = HTMLDivElement>(
    _delay = 0
) {
    const ref = useRef<T>(null)

    return {
        ref,
        visible: true,
        reduced: false,
        lineStyle: (_axis?: 'x' | 'y') => frameLineStyle(),
        tickStyle: (_index?: number) => frameTickStyle()
    }
}
