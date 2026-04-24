import { useRef, useState } from 'react'
import type React from 'react'

export function useRightDragScroll(scrollContainerRef: React.RefObject<HTMLDivElement>) {
	const [isRightDragging, setIsRightDragging] = useState(false)
	const rightDragStartRef = useRef<{ x: number; pointerId: number; scrollLeft: number } | null>(
		null
	)
	const hasRightDraggedRef = useRef(false)

	function handleRightDragValues(e: React.PointerEvent<HTMLDivElement>) {
		if (!rightDragStartRef.current || !scrollContainerRef.current) return

		const delta = rightDragStartRef.current.x - e.clientX
		if (Math.abs(delta) > 5) {
			hasRightDraggedRef.current = true
		}

		if (hasRightDraggedRef.current) {
			scrollContainerRef.current.scrollLeft = rightDragStartRef.current.scrollLeft + delta
		}
	}

	function handleRightDragStart(e: React.PointerEvent<HTMLDivElement>) {
		if (e.button !== 2 || !scrollContainerRef.current) return
		e.currentTarget.setPointerCapture(e.pointerId)
		setIsRightDragging(true)
		rightDragStartRef.current = {
			x: e.clientX,
			pointerId: e.pointerId,
			scrollLeft: scrollContainerRef.current.scrollLeft
		}
		hasRightDraggedRef.current = false
	}

	function handleRightDragMove(e: React.PointerEvent<HTMLDivElement>) {
		if (!isRightDragging) return
		handleRightDragValues(e)
	}

	function handleRightDragEnd(e: React.PointerEvent<HTMLDivElement>) {
		if (!isRightDragging) return
		const pointerId = rightDragStartRef.current?.pointerId
		if (pointerId !== undefined && e.currentTarget.hasPointerCapture(pointerId)) {
			e.currentTarget.releasePointerCapture(pointerId)
		}
		setIsRightDragging(false)
		rightDragStartRef.current = null
		setTimeout(() => {
			hasRightDraggedRef.current = false
		}, 50)
	}

	return {
		hasRightDraggedRef,
		isRightDragging,
		handleRightDragEnd,
		handleRightDragMove,
		handleRightDragStart
	}
}
