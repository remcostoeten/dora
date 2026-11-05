import { useCallback, useEffect, useRef, useState } from 'react'
import { noop } from '@studio/shared/utils/noop'

const STORAGE_KEY = 'dora-sidebar-width'

export const SIDEBAR_MIN_WIDTH = 200
export const SIDEBAR_MAX_WIDTH = 560
export const SIDEBAR_DEFAULT_WIDTH = 244

function clampWidth(width: number): number {
	return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width))
}

function readStoredWidth(): number {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY)
		if (!stored) return SIDEBAR_DEFAULT_WIDTH
		const parsed = Number.parseInt(stored, 10)
		return Number.isFinite(parsed) ? clampWidth(parsed) : SIDEBAR_DEFAULT_WIDTH
	} catch {
		return SIDEBAR_DEFAULT_WIDTH
	}
}

function persistWidth(width: number) {
	try {
		window.localStorage.setItem(STORAGE_KEY, String(width))
	} catch {
		noop()
	}
}

export function useSidebarWidth() {
	const [width, setWidth] = useState(readStoredWidth)
	const [isResizing, setIsResizing] = useState(false)
	const widthRef = useRef(width)

	useEffect(
		function syncWidthRef() {
			widthRef.current = width
		},
		[width]
	)

	const startResize = useCallback(function (event: React.MouseEvent) {
		event.preventDefault()
		const startX = event.clientX
		const startWidth = widthRef.current
		const previousCursor = document.body.style.cursor
		const previousUserSelect = document.body.style.userSelect

		document.body.style.cursor = 'col-resize'
		document.body.style.userSelect = 'none'
		setIsResizing(true)

		let latestWidth = startWidth
		let frame = 0

		function onMove(moveEvent: MouseEvent) {
			latestWidth = clampWidth(startWidth + (moveEvent.clientX - startX))
			if (frame) return
			frame = requestAnimationFrame(function () {
				frame = 0
				setWidth(latestWidth)
			})
		}

		function onUp() {
			cancelAnimationFrame(frame)
			document.body.style.cursor = previousCursor
			document.body.style.userSelect = previousUserSelect
			setWidth(latestWidth)
			setIsResizing(false)
			persistWidth(latestWidth)
			window.removeEventListener('mousemove', onMove)
			window.removeEventListener('mouseup', onUp)
		}

		window.addEventListener('mousemove', onMove)
		window.addEventListener('mouseup', onUp)
	}, [])

	const resetWidth = useCallback(function () {
		setWidth(SIDEBAR_DEFAULT_WIDTH)
		persistWidth(SIDEBAR_DEFAULT_WIDTH)
	}, [])

	const nudgeWidth = useCallback(function (delta: number) {
		setWidth(function (current) {
			const next = clampWidth(current + delta)
			persistWidth(next)
			return next
		})
	}, [])

	return { width, isResizing, startResize, resetWidth, nudgeWidth }
}
