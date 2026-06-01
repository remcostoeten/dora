import { useRef } from 'react'
import type React from 'react'
import { ContextMenuState } from './types'

export function useContextMenuReporting(onContextMenuChange?: (ctx: ContextMenuState) => void) {
	const lastContextMenuCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

	function handleCellContextMenuChange(open: boolean, row: number, col: number) {
		if (!onContextMenuChange) return
		if (open) {
			onContextMenuChange({
				kind: 'cell',
				cell: { row, col },
				x: lastContextMenuCoordsRef.current.x,
				y: lastContextMenuCoordsRef.current.y
			})
		} else {
			onContextMenuChange(null)
		}
	}

	function handleRowContextMenuChange(open: boolean, row: number) {
		if (!onContextMenuChange) return
		if (open) {
			onContextMenuChange({
				kind: 'row',
				cell: { row, col: 0 },
				x: lastContextMenuCoordsRef.current.x,
				y: lastContextMenuCoordsRef.current.y
			})
		} else {
			onContextMenuChange(null)
		}
	}

	function handleContextMenuCapture(e: React.MouseEvent) {
		lastContextMenuCoordsRef.current = { x: e.clientX, y: e.clientY }
	}

	return {
		handleCellContextMenuChange,
		handleRowContextMenuChange,
		handleContextMenuCapture
	}
}
