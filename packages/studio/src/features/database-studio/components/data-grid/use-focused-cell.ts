import { useCallback, useEffect, useState } from 'react'
import { CellPosition } from './types'

export function useFocusedCell(
	initialFocusedCell: CellPosition | null | undefined,
	onFocusedCellChange?: (cell: CellPosition | null) => void
) {
	const [focusedCell, setFocusedCellInternal] = useState<CellPosition | null>(
		initialFocusedCell ?? null
	)

	useEffect(() => {
		if (
			initialFocusedCell &&
			(!focusedCell ||
				focusedCell.row !== initialFocusedCell.row ||
				focusedCell.col !== initialFocusedCell.col)
		) {
			setFocusedCellInternal(initialFocusedCell)
			return
		}

		if (!initialFocusedCell && focusedCell) {
			setFocusedCellInternal(null)
		}
	}, [initialFocusedCell, focusedCell])

	const setFocusedCell = useCallback(
		function (cell: CellPosition | null) {
			setFocusedCellInternal(cell)
			onFocusedCellChange?.(cell)
		},
		[onFocusedCellChange]
	)

	return { focusedCell, setFocusedCell }
}
