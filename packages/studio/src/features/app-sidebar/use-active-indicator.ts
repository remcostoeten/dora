import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const POINTER_WINDOW_MS = 500

/**
 * @name useActiveIndicator
 * @description Positions a single fill element behind the active rail item. The
 * fill slides between items only when the change follows a pointer press; first
 * placement, layout shifts and keyboard-driven changes move it instantly.
 *
 * @example
 * const indicatorRef = useActiveIndicator(navRef, activeNavId, analyticsAvailable)
 * <div ref={indicatorRef} className='rail-indicator' />
 */
export function useActiveIndicator(
	navRef: RefObject<HTMLElement | null>,
	activeNavId: string | undefined,
	layoutKey: unknown
) {
	const indicatorRef = useRef<HTMLDivElement>(null)
	const lastPointerAt = useRef(0)
	const hasPlaced = useRef(false)

	const place = useCallback(
		(animate: boolean) => {
			const nav = navRef.current
			const indicator = indicatorRef.current
			if (!nav || !indicator) return

			const target = activeNavId
				? nav.querySelector<HTMLElement>(`[data-nav-id="${activeNavId}"]`)
				: null
			if (!target) {
				indicator.dataset.visible = 'false'
				return
			}

			const wasVisible = indicator.dataset.visible === 'true'
			const navBox = nav.getBoundingClientRect()
			const targetBox = target.getBoundingClientRect()
			indicator.dataset.animate = String(animate && wasVisible)
			indicator.dataset.visible = 'true'
			indicator.dataset.activeId = activeNavId ?? ''
			indicator.style.transform = `translate(${targetBox.left - navBox.left}px, ${targetBox.top - navBox.top}px)`
		},
		[navRef, activeNavId]
	)

	useLayoutEffect(() => {
		const followsPointer = performance.now() - lastPointerAt.current < POINTER_WINDOW_MS
		place(followsPointer && hasPlaced.current)
		hasPlaced.current = true
	}, [place, layoutKey])

	useEffect(() => {
		const nav = navRef.current
		if (!nav) return

		function markPointer() {
			lastPointerAt.current = performance.now()
		}

		const observer = new ResizeObserver(() => place(false))
		observer.observe(nav)
		nav.addEventListener('pointerdown', markPointer, true)

		return () => {
			observer.disconnect()
			nav.removeEventListener('pointerdown', markPointer, true)
		}
	}, [navRef, place])

	return indicatorRef
}
