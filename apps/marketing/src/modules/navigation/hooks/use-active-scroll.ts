'use client'

import { useEffect, useRef } from 'react'

/**
 * @name useActiveScroll
 * @description Scrolls the active sidebar link into view when it sits outside
 * the sidebar viewport.
 *
 * @example
 * const linkRef = useActiveScroll(active)
 */
export function useActiveScroll(active: boolean) {
    const ref = useRef<HTMLAnchorElement>(null)

    useEffect(() => {
        if (!active) return
        const element = ref.current
        const viewport = element?.closest<HTMLElement>(
            '[data-docs-sidebar-viewport]'
        )
        if (!element || !viewport || viewport.getClientRects().length === 0)
            return

        const elementRect = element.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        if (
            elementRect.top >= viewportRect.top &&
            elementRect.bottom <= viewportRect.bottom
        )
            return

        element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }, [active])

    return ref
}
