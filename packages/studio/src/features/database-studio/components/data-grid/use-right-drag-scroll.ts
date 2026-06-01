import { useEffect, useRef, useState } from 'react'
import type React from 'react'

export function useRightDragScroll(scrollContainerRef: React.RefObject<HTMLDivElement>) {
	const [isRightDragging, setIsRightDragging] = useState(false)
	const rightDragStartRef = useRef<{ x: number; scrollLeft: number } | null>(null)
	const hasRightDraggedRef = useRef(false)

	function handleRightDragValues(e: React.MouseEvent | MouseEvent) {
		if (!rightDragStartRef.current || !scrollContainerRef.current) return

		const delta = rightDragStartRef.current.x - e.clientX
		if (Math.abs(delta) > 5) {
			hasRightDraggedRef.current = true
		}

		if (hasRightDraggedRef.current) {
			scrollContainerRef.current.scrollLeft = rightDragStartRef.current.scrollLeft + delta
		}
	}

	useEffect(() => {
		if (!isRightDragging) return

		function handleGlobalMouseMove(e: MouseEvent) {
			handleRightDragValues(e)
		}

		function handleGlobalMouseUp() {
			if (isRightDragging) {
				setIsRightDragging(false)
				rightDragStartRef.current = null
				setTimeout(() => {
					hasRightDraggedRef.current = false
				}, 50)
			}
		}

		document.addEventListener('mousemove', handleGlobalMouseMove)
		document.addEventListener('mouseup', handleGlobalMouseUp)

		return () => {
			document.removeEventListener('mousemove', handleGlobalMouseMove)
			document.removeEventListener('mouseup', handleGlobalMouseUp)
		}
	}, [isRightDragging])

	function handleRightDragStart(e: React.MouseEvent) {
		if (e.button !== 2 || !scrollContainerRef.current) return
		setIsRightDragging(true)
		rightDragStartRef.current = {
			x: e.clientX,
			scrollLeft: scrollContainerRef.current.scrollLeft
		}
		hasRightDraggedRef.current = false
	}

	return {
		hasRightDraggedRef,
		isRightDragging,
		handleRightDragStart
	}
}
