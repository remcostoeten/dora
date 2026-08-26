import { useCallback, useEffect, useRef } from 'react'
import type React from 'react'
import { ColumnDefinition } from '../../types'
import { getColumnDefault } from '../../utils/studio-data'
import { getCellKey, getCellsInRectangle } from './selection'
import { CellPosition, EditingCell } from './types'

type UseGridKeyboardArgs = {
	anchorCell: CellPosition | null
	allSelected: boolean
	columns: ColumnDefinition[]
	editingCell: EditingCell | null
	focusedCell: CellPosition | null
	lastClickedRowRef: React.MutableRefObject<number | null>
	/** Privacy mode: block editing, copy, paste, and deletion (read-only). */
	masked?: boolean
	onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void
	onDeleteSelectedRows?: () => void
	onOpenCellMenu?: (rowIndex: number, colIndex: number) => void
	onSortColumn?: (columnName: string) => void
	onRowsSelect?: (rowIndices: number[], checked: boolean) => void
	onRowSelect: (rowIndex: number, checked: boolean) => void
	onSelectAll: (checked: boolean) => void
	rows: Record<string, unknown>[]
	selectedCellsSet: Set<string>
	selectedRows: Set<number>
	setAnchorCell: (cell: CellPosition | null) => void
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
	masked,
	onCellEdit,
	onDeleteSelectedRows,
	onOpenCellMenu,
	onSortColumn,
	onRowsSelect,
	onRowSelect,
	onSelectAll,
	rows,
	selectedCellsSet,
	selectedRows,
	setAnchorCell,
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
					// First key inside the (single-tab-stop) grid lands on the
					// top-left cell. From there arrows / Tab walk individual cells;
					// Tab still escapes the grid once you reach the last cell.
					e.preventDefault()
					const firstPos = { row: 0, col: 0 }
					setFocusedCell(firstPos)
					setAnchorCell(firstPos)
					lastClickedRowRef.current = firstPos.row
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
						lastClickedRowRef.current = newRow
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
					if (e.shiftKey) {
						if (col > 0) {
							e.preventDefault()
							moveAndMaybeSelect(row, col - 1)
						} else if (row > 0) {
							e.preventDefault()
							moveAndMaybeSelect(row - 1, maxCol)
						}
					} else if (col < maxCol) {
						e.preventDefault()
						moveAndMaybeSelect(row, col + 1)
					} else if (row < maxRow) {
						e.preventDefault()
						moveAndMaybeSelect(row + 1, 0)
					}
					break
				case 'Enter':
				case 'F2':
					e.preventDefault()
					if (!masked) {
						startCellEdit(row, columns[col].name, rows[row][columns[col].name])
					}
					break
				case 'F10':
				case 'ContextMenu':
					if (e.key === 'ContextMenu' || e.shiftKey) {
						onOpenCellMenu?.(row, col)
					}
					break
				// Delete removes the active row(s). onDeleteSelectedRows resolves
				// the target via rowsForActions, which falls back to the focused
				// row when nothing is explicitly selected — matching the "Del"
				// hint shown in the selection bar whenever a row is active.
				case 'Delete':
					if (e.ctrlKey || e.metaKey) break
					// preventDefault so the document-level `deleteRows` shortcut
					// does not also fire — the grid handler is authoritative here.
					e.preventDefault()
					if (masked) break
					onDeleteSelectedRows?.()
					break
				// Backspace clears the focused cell back to its column default,
				// distinct from Delete's whole-row removal. shift+Backspace is
				// handled as a delete by the document-level shortcut. Primary
				// keys are left untouched — clearing them would orphan the row.
				case 'Backspace':
					if (e.ctrlKey || e.metaKey || e.shiftKey) break
					e.preventDefault()
					if (masked) break
					if (onCellEdit) {
						for (const cell of getCellsToClear(selectedCellsSet, focusedCell)) {
							const column = columns[cell.col]
							if (!column || column.primaryKey || !rows[cell.row]) continue
							onCellEdit(cell.row, column.name, getColumnDefault(column))
						}
					}
					break
				case 'Escape':
					e.preventDefault()
					if (pendingNavFrameRef.current !== null) {
						cancelAnimationFrame(pendingNavFrameRef.current)
						pendingNavFrameRef.current = null
					}
					// Progressive escape: collapse a multi-cell selection → drop
					// the row selection (keep the focused cell) → clear focus.
					if (selectedCellsSet.size > 1) {
						updateCellSelection(new Set([getCellKey(row, col)]))
					} else if (selectedRows.size > 0) {
						onSelectAll(false)
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
						const range: number[] = []
						for (let i = start; i <= end; i++) {
							range.push(i)
						}
						onRowsSelect(range, true)
					} else {
						onRowSelect(row, !selectedRows.has(row))
						lastClickedRowRef.current = row
					}
					break
				// Single-key command: edit the focused cell (like F2/Enter).
				// With a modifier it is not a command — let it bubble (e.g. mod+e
				// = export) instead of opening the editor.
				case 'e':
					if (!e.ctrlKey && !e.metaKey && !e.altKey) {
						e.preventDefault()
						if (!masked) {
							startCellEdit(row, columns[col].name, rows[row][columns[col].name])
						}
					}
					break
				// Single-key command: delete the selected rows (or the focused
				// row when nothing is explicitly selected). mod+d stays "deselect".
				case 'd':
					if (!e.ctrlKey && !e.metaKey && !e.altKey) {
						e.preventDefault()
						if (!masked) {
							onDeleteSelectedRows?.()
						}
					}
					break
				case 's':
					if (!e.ctrlKey && !e.metaKey && !e.altKey) {
						e.preventDefault()
						onSortColumn?.(columns[col].name)
					}
					break
				case 'a':
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault()
						onSelectAll(!allSelected)
					}
					break
				// Single-key command: copy the focused cell / selection. mod+c
				// works too. A focused cell is a command surface — there is
				// nothing to type until you enter edit mode — so a bare letter
				// runs the command instead of starting an edit.
				case 'c':
					if (!e.altKey) {
						e.preventDefault()
						if (!masked) {
							copySelectionToClipboard(selectedCellsSet, focusedCell, rows, columns)
						}
					}
					break
				// Single-key command: paste into the focused cell. mod+v works too.
				case 'v':
					if (!e.altKey && focusedCell && onCellEdit) {
						e.preventDefault()
						if (!masked) {
							pasteClipboardIntoGrid(focusedCell, rows.length, columns, onCellEdit)
						}
					}
					break
				default:
					// A focused cell never types-to-edit: editing is entered
					// explicitly via Enter / e / F2 / double-click. Swallow lone
					// printable keys so they neither edit nor trigger stray
					// document-level shortcuts while navigating the grid.
					if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
						e.preventDefault()
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
			masked,
			onCellEdit,
			onDeleteSelectedRows,
			onOpenCellMenu,
			onSortColumn,
			onRowsSelect,
			onRowSelect,
			onSelectAll,
			rows,
			selectedCellsSet,
			selectedRows,
			setAnchorCell,
			setFocusedCell,
			startCellEdit,
			updateCellSelection
		]
	)
}

export function getCellsToClear(
	selectedCellsSet: Set<string>,
	focusedCell: CellPosition
): CellPosition[] {
	const keys =
		selectedCellsSet.size > 0
			? selectedCellsSet
			: new Set([getCellKey(focusedCell.row, focusedCell.col)])
	return Array.from(keys, function (key) {
		const [row, col] = key.split(':').map(Number)
		return { row, col }
	})
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

/**
 * Splits clipboard text into a grid of cell values. Normalises CRLF/CR line
 * endings (Excel, Sheets, Windows apps) so no `\r` ends up in cell values,
 * and drops the single trailing newline most copy sources append so it does
 * not become a phantom row that overwrites the row below the paste target.
 */
export function parseClipboardGrid(clipboardText: string): string[][] {
	return clipboardText
		.replace(/\r\n?/g, '\n')
		.replace(/\n$/, '')
		.split('\n')
		.map(function (line) {
			return line.split('\t')
		})
}

function isEmptyPasteRow(pasteRow: string[]): boolean {
	return pasteRow.length === 1 && pasteRow[0] === ''
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
			const pasteRows = parseClipboardGrid(clipboardText)
			pasteRows.forEach(function (pasteRow, pasteRowIndex) {
				if (isEmptyPasteRow(pasteRow)) return
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
