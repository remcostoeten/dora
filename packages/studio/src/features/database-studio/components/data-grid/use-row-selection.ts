import { useCallback } from 'react'
import type React from 'react'

type UseRowSelectionArgs = {
	lastClickedRowRef: React.MutableRefObject<number | null>
	onRowSelect: (rowIndex: number, checked: boolean) => void
	onRowsSelect?: (rowIndices: number[], checked: boolean) => void
	onSelectAll: (checked: boolean) => void
	selectedRows: Set<number>
}

export function useRowSelection({
	lastClickedRowRef,
	onRowSelect,
	onRowsSelect,
	onSelectAll,
	selectedRows
}: UseRowSelectionArgs) {
	const handleRowClick = useCallback(
		function (e: React.MouseEvent, rowIndex: number) {
			if (e.button !== 0) return

			if (e.shiftKey) {
				e.preventDefault()
			}

			if (e.shiftKey && lastClickedRowRef.current !== null && onRowsSelect) {
				const start = Math.min(lastClickedRowRef.current, rowIndex)
				const end = Math.max(lastClickedRowRef.current, rowIndex)
				const range: number[] = []
				for (let i = start; i <= end; i++) {
					range.push(i)
				}
				onSelectAll(false)
				onRowsSelect(range, true)
			} else if (e.ctrlKey || e.metaKey) {
				onRowSelect(rowIndex, !selectedRows.has(rowIndex))
				lastClickedRowRef.current = rowIndex
			} else {
				lastClickedRowRef.current = rowIndex
			}
		},
		[lastClickedRowRef, onRowSelect, onRowsSelect, selectedRows]
	)

	const ensureRowSelectionForContextMenu = useCallback(
		function (rowIndex: number) {
			if (selectedRows.has(rowIndex)) return
			onSelectAll(false)
			onRowSelect(rowIndex, true)
			lastClickedRowRef.current = rowIndex
		},
		[lastClickedRowRef, onRowSelect, onSelectAll, selectedRows]
	)

	return { handleRowClick, ensureRowSelectionForContextMenu }
}
