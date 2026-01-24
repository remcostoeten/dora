import { GripHorizontal } from 'lucide-react'
import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/shared/utils/cn'

type Props = {
	topPanel: React.ReactNode
	bottomPanel: React.ReactNode
	defaultSplit?: number // percentage for top panel
	minSize?: number // minimum size in pixels
}

export function ResizablePanels({
	topPanel,
	bottomPanel,
	defaultSplit = 50,
	minSize = 100
}: Props) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [splitPercent, setSplitPercent] = useState(defaultSplit)
	const [isDragging, setIsDragging] = useState(false)

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		setIsDragging(true)
	}, [])

	useEffect(() => {
		if (!isDragging) return

		function handleMouseMove(e: MouseEvent) {
			if (!containerRef.current) return

			const rect = containerRef.current.getBoundingClientRect()
			const containerHeight = rect.height
			const mouseY = e.clientY - rect.top

			// Calculate percentage
			let percent = (mouseY / containerHeight) * 100

			// Apply minimum sizes
			const minPercent = (minSize / containerHeight) * 100
			const maxPercent = 100 - minPercent

			percent = Math.max(minPercent, Math.min(maxPercent, percent))
			setSplitPercent(percent)
		}

		function handleMouseUp() {
			setIsDragging(false)
		}

		document.addEventListener('mousemove', handleMouseMove)
		document.addEventListener('mouseup', handleMouseUp)

		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
		}
	}, [isDragging, minSize])

	return (
		<div
			ref={containerRef}
			className={cn('flex flex-col h-full', isDragging && 'select-none cursor-row-resize')}
		>
			{/* Top panel */}
			<div className='relative overflow-hidden' style={{ height: `${splitPercent}%` }}>
				{topPanel}
			</div>

			{/* Resizable divider */}
			<div
				className={cn(
					'flex items-center justify-center h-2 border-y border-sidebar-border bg-sidebar-accent/50 cursor-row-resize group hover:bg-sidebar-accent transition-colors',
					isDragging && 'bg-sidebar-primary/20'
				)}
				onMouseDown={handleMouseDown}
			>
				<GripHorizontal
					className={cn(
						'h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors',
						isDragging && 'text-sidebar-primary'
					)}
				/>
			</div>

			{/* Bottom panel */}
			<div className='relative overflow-hidden' style={{ height: `${100 - splitPercent}%` }}>
				{bottomPanel}
			</div>
		</div>
	)
}
