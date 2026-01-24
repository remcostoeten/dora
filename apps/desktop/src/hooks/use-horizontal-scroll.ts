import { useEffect, useRef, useCallback } from 'react'

type HorizontalScrollConfig = {
	sensitivity?: number
	invertDirection?: boolean
	cursorStyle?: string
}

type HorizontalScrollState = {
	isActive: boolean
	startX: number
	scrollableContainer: HTMLElement | null
}

const DEFAULT_CONFIG: Required<HorizontalScrollConfig> = {
	sensitivity: 1,
	invertDirection: false,
	cursorStyle: 'ew-resize'
}

function findScrollableParent(element: HTMLElement | null): HTMLElement | null {
	if (!element) return null

	let current: HTMLElement | null = element

	while (current) {
		const { overflowX } = window.getComputedStyle(current)
		const isScrollable = current.scrollWidth > current.clientWidth
		const hasOverflow = overflowX === 'auto' || overflowX === 'scroll'

		if (isScrollable && hasOverflow) {
			return current
		}

		current = current.parentElement
	}

	return null
}

export function useHorizontalScroll(config: HorizontalScrollConfig = {}) {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config }
	const stateRef = useRef<HorizontalScrollState>({
		isActive: false,
		startX: 0,
		scrollableContainer: null
	})
	const originalCursorRef = useRef<string>('')

	const handleMouseDown = useCallback(
		function onMouseDown(event: MouseEvent) {
			if (event.button !== 1) return

			event.preventDefault()
			event.stopPropagation()

			const target = event.target as HTMLElement
			const scrollableContainer = findScrollableParent(target)

			if (!scrollableContainer) return

			stateRef.current = {
				isActive: true,
				startX: event.clientX,
				scrollableContainer
			}

			originalCursorRef.current = document.body.style.cursor
			document.body.style.cursor = mergedConfig.cursorStyle
		},
		[mergedConfig.cursorStyle]
	)

	const handleMouseMove = useCallback(
		function onMouseMove(event: MouseEvent) {
			const state = stateRef.current

			if (!state.isActive || !state.scrollableContainer) return

			event.preventDefault()

			const deltaX = event.clientX - state.startX
			const scrollAmount = mergedConfig.invertDirection ? deltaX : -deltaX

			state.scrollableContainer.scrollBy({
				left: scrollAmount * mergedConfig.sensitivity,
				behavior: 'auto'
			})

			stateRef.current.startX = event.clientX
		},
		[mergedConfig.sensitivity, mergedConfig.invertDirection]
	)

	const handleMouseUp = useCallback(function onMouseUp(event: MouseEvent) {
		if (event.button !== 1) return

		stateRef.current = {
			isActive: false,
			startX: 0,
			scrollableContainer: null
		}

		document.body.style.cursor = originalCursorRef.current
	}, [])

	const handleContextMenu = useCallback(function onContextMenu(event: MouseEvent) {
		if (stateRef.current.isActive) {
			event.preventDefault()
		}
	}, [])

	const handleAuxClick = useCallback(function onAuxClick(event: MouseEvent) {
		if (event.button === 1) {
			event.preventDefault()
		}
	}, [])

	useEffect(
		function setupEventListeners() {
			document.addEventListener('mousedown', handleMouseDown)
			document.addEventListener('mousemove', handleMouseMove)
			document.addEventListener('mouseup', handleMouseUp)
			document.addEventListener('contextmenu', handleContextMenu)
			document.addEventListener('auxclick', handleAuxClick)

			return function cleanup() {
				document.removeEventListener('mousedown', handleMouseDown)
				document.removeEventListener('mousemove', handleMouseMove)
				document.removeEventListener('mouseup', handleMouseUp)
				document.removeEventListener('contextmenu', handleContextMenu)
				document.removeEventListener('auxclick', handleAuxClick)

				document.body.style.cursor = originalCursorRef.current
			}
		},
		[handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu, handleAuxClick]
	)
}

export type { HorizontalScrollConfig }
