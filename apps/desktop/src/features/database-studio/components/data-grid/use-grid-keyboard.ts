import { useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import { ColumnDefinition } from '../../types'
import { getCellKey, getCellsInRectangle } from './selection'
import { CellPosition, EditingCell } from './types'

type UseGridKeyboardArgs = {
	anchorCell: CellPosition | null
	allSelected: boolean
	columns: ColumnDefinition[]
	editingCell: EditingCell | null
	focusedCell: CellPosition | null
	lastClickedRowRef: React.MutableRefObject<number | null>
	onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void
	onRowsSelect?: (rowIndices: number[], checked: boolean) => void
	onRowSelect: (rowIndex: number, checked: boolean) => void
	onSelectAll: (checked: boolean) => void
	rows: Record<string, unknown>[]
	selectedCellsSet: Set<string>
	selectedRows: Set<number>
	setAnchorCell: (cell: CellPosition | null) => void
	setEditingCell: (cell: EditingCell | null) => void
	setEditValue: (value: string) => void
	setFocusedCell: (cell: CellPosition | null) => void
	startCellEdit: (rowIndex: number, columnName: string, currentValue: unknown) => void
	updateCellSelection: (cells: Set<string>) => void
}

export function useGridKeyboard({
	anchorCell,
	allSelected,
	columns,
	editingCell,
	focusedCell,
	lastClickedRowRef,
	onCellEdit,
	onRowsSelect,
	onRowSelect,
	onSelectAll,
	rows,
	selectedCellsSet,
	selectedRows,
	setAnchorCell,
	setEditingCell,
	setEditValue,
	setFocusedCell,
	startCellEdit,
	updateCellSelection
}: UseGridKeyboardArgs) {
	const pendingNavFrameRef = useRef<number | null>(null)

	useEffect(function cleanupPendingFrame() {
		return function () {
			if (pendingNavFrameRef.current !== null) {
				cancelAnimationFrame(pendingNavFrameRef.current)
			}
		}
	}, [])

	return useCallback(
		function handleGridKeyDown(e: React.KeyboardEvent) {
			if (!focusedCell) {
				if (
					rows.length > 0 &&
					columns.length > 0 &&
					(e.key === 'ArrowDown' ||
						e.key === 'ArrowUp' ||
						e.key === 'ArrowLeft' ||
						e.key === 'ArrowRight' ||
						e.key === 'Tab' ||
						e.key === 'Enter')
				) {
					e.preventDefault()
					const firstPos = { row: 0, col: 0 }
					setFocusedCell(firstPos)
					setAnchorCell(firstPos)
					updateCellSelection(new Set([getCellKey(0, 0)]))
				}
				return
			}
			if (editingCell) return

			const { row, col } = focusedCell
			const maxRow = rows.length - 1
			const maxCol = columns.length - 1

			function moveAndMaybeSelect(newRow: number, newCol: number) {
				const newPos: CellPosition = { row: newRow, col: newCol }
				if (pendingNavFrameRef.current !== null) {
					cancelAnimationFrame(pendingNavFrameRef.current)
				}
				pendingNavFrameRef.current = requestAnimationFrame(function () {
					setFocusedCell(newPos)
					if (e.shiftKey && anchorCell) {
						updateCellSelection(getCellsInRectangle(anchorCell, newPos))
					} else if (!e.shiftKey) {
						setAnchorCell(newPos)
						updateCellSelection(new Set([getCellKey(newRow, newCol)]))
					}
					pendingNavFrameRef.current = null
				})
			}

			switch (e.key) {
				case 'ArrowUp':
					e.preventDefault()
					if (e.ctrlKey || e.metaKey) {
						moveAndMaybeSelect(0, col)
					} else if (row > 0) {
						moveAndMaybeSelect(row - 1, col)
					}
					break
				case 'ArrowDown':
					e.preventDefault()
					if (e.ctrlKey || e.metaKey) {
						moveAndMaybeSelect(maxRow, col)
					} else if (row < maxRow) {
						moveAndMaybeSelect(row + 1, col)
					}
					break
				case 'ArrowLeft':
					e.preventDefault()
					if (e.ctrlKey || e.metaKey) {
						moveAndMaybeSelect(row, 0)
					} else if (col > 0) {
						moveAndMaybeSelect(row, col - 1)
					}
					break
				case 'ArrowRight':
					e.preventDefault()
					if (e.ctrlKey || e.metaKey) {
						moveAndMaybeSelect(row, maxCol)
					} else if (col < maxCol) {
						moveAndMaybeSelect(row, col + 1)
					}
					break
				case 'Tab':
					e.preventDefault()
					if (e.shiftKey) {
						if (col > 0) {
							moveAndMaybeSelect(row, col - 1)
						} else if (row > 0) {
							moveAndMaybeSelect(row - 1, maxCol)
						}
					} else if (col < maxCol) {
						moveAndMaybeSelect(row, col + 1)
					} else if (row < maxRow) {
						moveAndMaybeSelect(row + 1, 0)
					}
					break
				case 'Enter':
				case 'F2':
					e.preventDefault()
					startCellEdit(row, columns[col].name, rows[row][columns[col].name])
					break
				case 'Delete':
				case 'Backspace':
					if (!e.ctrlKey && !e.metaKey && onCellEdit) {
						e.preventDefault()
						onCellEdit(row, columns[col].name, null)
					}
					break
				case 'Escape':
					e.preventDefault()
					if (pendingNavFrameRef.current !== null) {
						cancelAnimationFrame(pendingNavFrameRef.current)
						pendingNavFrameRef.current = null
					}
					if (selectedCellsSet.size > 1) {
						updateCellSelection(new Set([getCellKey(row, col)]))
					} else {
						setFocusedCell(null)
						updateCellSelection(new Set())
					}
					break
				case ' ':
					e.preventDefault()
					if (e.shiftKey && lastClickedRowRef.current !== null && onRowsSelect) {
						const start = Math.min(lastClickedRowRef.current, row)
						const end = Math.max(lastClickedRowRef.current, row)
						const range = []
						for (let i = start; i <= end; i++) {
							range.push(i)
						}
						onRowsSelect(range, true)
					} else {
						onRowSelect(row, !selectedRows.has(row))
						lastClickedRowRef.current = row
					}
					break
				case 'a':
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault()
						onSelectAll(!allSelected)
					}
					break
				case 'c':
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault()
						copySelectionToClipboard(selectedCellsSet, focusedCell, rows, columns)
					}
					break
				case 'v':
					if ((e.ctrlKey || e.metaKey) && focusedCell && onCellEdit) {
						e.preventDefault()
						pasteClipboardIntoGrid(focusedCell, rows.length, columns, onCellEdit)
					}
					break
				default:
					if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
						e.preventDefault()
						setEditingCell({ rowIndex: row, columnName: columns[col].name })
						setEditValue(e.key)
					}
					break
			}
		},
		[
			anchorCell,
			allSelected,
			columns,
			editingCell,
			focusedCell,
			lastClickedRowRef,
			onCellEdit,
			onRowsSelect,
			onRowSelect,
			onSelectAll,
			rows,
			selectedCellsSet,
			selectedRows,
			setAnchorCell,
			setEditingCell,
			setEditValue,
			setFocusedCell,
			startCellEdit,
			updateCellSelection
		]
	)
}

function copySelectionToClipboard(
	selectedCellsSet: Set<string>,
	focusedCell: CellPosition | null,
	rows: Record<string, unknown>[],
	columns: ColumnDefinition[]
) {
	if (selectedCellsSet.size > 0) {
		const cellsArray = Array.from(selectedCellsSet).map(function (key) {
			const [row, col] = key.split(':').map(Number)
			return { row, col }
		})
		cellsArray.sort(function (a, b) {
			return a.row === b.row ? a.col - b.col : a.row - b.row
		})
		const minRow = Math.min(
			...cellsArray.map(function (cell) {
				return cell.row
			})
		)
		const maxRow = Math.max(
			...cellsArray.map(function (cell) {
				return cell.row
			})
		)
		const rowData: string[][] = []
		for (let row = minRow; row <= maxRow; row++) {
			const rowCells = cellsArray.filter(function (cell) {
				return cell.row === row
			})
			const values = rowCells.map(function (cell) {
				const value = rows[cell.row][columns[cell.col].name]
				return value === null || value === undefined ? '' : String(value)
			})
			rowData.push(values)
		}
		navigator.clipboard.writeText(
			rowData
				.map(function (row) {
					return row.join('\t')
				})
				.join('\n')
		)
		return
	}

	if (focusedCell) {
		const value = rows[focusedCell.row][columns[focusedCell.col].name]
		navigator.clipboard.writeText(value === null || value === undefined ? '' : String(value))
	}
}

function pasteClipboardIntoGrid(
	focusedCell: CellPosition,
	rowCount: number,
	columns: ColumnDefinition[],
	onCellEdit: (rowIndex: number, columnName: string, newValue: unknown) => void
) {
	navigator.clipboard
		.readText()
		.then(function (clipboardText) {
			if (!clipboardText) return
			const pasteRows = clipboardText.split('\n').map(function (line) {
				return line.split('\t')
			})
			pasteRows.forEach(function (pasteRow, pasteRowIndex) {
				const targetRow = focusedCell.row + pasteRowIndex
				if (targetRow >= rowCount) return
				pasteRow.forEach(function (pasteValue, pasteColIndex) {
					const targetCol = focusedCell.col + pasteColIndex
					if (targetCol >= columns.length) return
					onCellEdit(targetRow, columns[targetCol].name, pasteValue)
				})
			})
		})
		.catch(function () {
			// Clipboard read unavailable; keep grid interaction silent.
		})
}
