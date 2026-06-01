import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type React from 'react'
import { ColumnDefinition } from '../../types'
import { getCellKey } from './selection'
import { CellPosition, EditingCell } from './types'
import { areValuesEqual } from '@studio/shared/utils/value-equality'

function valueToEditString(value: unknown): string {
	if (value === null || value === undefined) return ''
	if (typeof value === 'object') return JSON.stringify(value, null, 2)
	return String(value)
}

type UseCellEditingArgs = {
	columns: ColumnDefinition[]
	gridRef: React.RefObject<HTMLTableElement>
	onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void
	rows: Record<string, unknown>[]
	setAnchorCell: (cell: CellPosition | null) => void
	setFocusedCell: (cell: CellPosition | null) => void
	updateCellSelection: (cells: Set<string>) => void
}

export function useCellEditing({
	columns,
	gridRef,
	onCellEdit,
	rows,
	setAnchorCell,
	setFocusedCell,
	updateCellSelection
}: UseCellEditingArgs) {
	const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
	const [editValue, setEditValue] = useState<string>('')
	const editInputRef = useRef<HTMLInputElement>(null)
	const editValueRef = useRef(editValue)
	editValueRef.current = editValue
	const originalEditValueRef = useRef<string>('')
	const editingCellRef = useRef(editingCell)
	editingCellRef.current = editingCell
	const skipNextBlurSaveRef = useRef(false)
	// How the editor should treat the seeded text once it focuses:
	// 'all' selects everything (Enter/F2/double-click/Tab — overwrite-on-type),
	// 'end' leaves the caret at the end (type-to-edit — the first keystroke is
	// kept and subsequent keystrokes append).
	const editSelectModeRef = useRef<'all' | 'end'>('all')

	const refocusGrid = useCallback(
		function () {
			requestAnimationFrame(function () {
				gridRef.current?.focus()
			})
		},
		[gridRef]
	)

	const handleCellDoubleClick = useCallback(function (
		rowIndex: number,
		columnName: string,
		currentValue: unknown
	) {
		const nextEditingCell = { rowIndex, columnName }
		editingCellRef.current = nextEditingCell
		editSelectModeRef.current = 'all'
		setEditingCell(nextEditingCell)
		const originalValue = valueToEditString(currentValue)
		originalEditValueRef.current = originalValue
		setEditValue(originalValue)
	}, [])

	// Start editing by typing a character into a focused cell. The typed char
	// seeds the editor and the caret sits after it, so nothing is dropped and
	// further typing appends (vs. select-all which would overwrite the seed).
	const startTypeEdit = useCallback(function (
		rowIndex: number,
		columnName: string,
		currentValue: unknown,
		char: string
	) {
		const nextEditingCell = { rowIndex, columnName }
		editingCellRef.current = nextEditingCell
		editSelectModeRef.current = 'end'
		originalEditValueRef.current = valueToEditString(currentValue)
		setEditingCell(nextEditingCell)
		setEditValue(char)
	}, [])

	const commitEdit = useCallback(
		function ({ clear, refocus }: { clear: boolean; refocus: boolean }) {
			const cell = editingCellRef.current
			const value = editValueRef.current
			if (!cell || areValuesEqual(value, originalEditValueRef.current)) {
				if (clear) {
					editingCellRef.current = null
					setEditingCell(null)
					setEditValue('')
					originalEditValueRef.current = ''
					if (refocus) {
						refocusGrid()
					}
				}
				return
			}
			if (cell && onCellEdit) {
				onCellEdit(cell.rowIndex, cell.columnName, value)
			}

			if (!clear) return

			editingCellRef.current = null
			setEditingCell(null)
			setEditValue('')
			originalEditValueRef.current = ''
			if (refocus) {
				refocusGrid()
			}
		},
		[onCellEdit, refocusGrid]
	)

	const handleSaveEdit = useCallback(
		function () {
			if (skipNextBlurSaveRef.current) {
				skipNextBlurSaveRef.current = false
				return
			}
			commitEdit({ clear: true, refocus: true })
		},
		[commitEdit]
	)

	const handleCancelEdit = useCallback(
		function () {
			editingCellRef.current = null
			setEditingCell(null)
			setEditValue('')
			originalEditValueRef.current = ''
			refocusGrid()
		},
		[refocusGrid]
	)

	const handleSaveEditAndMove = useCallback(
		function (direction: 'next' | 'prev') {
			const cell = editingCellRef.current
			if (!cell) return

			commitEdit({ clear: false, refocus: false })

			skipNextBlurSaveRef.current = true

			const colIndex = columns.findIndex(function (c) {
				return c.name === cell.columnName
			})
			const maxCol = columns.length - 1
			const maxRow = rows.length - 1
			let nextRow = cell.rowIndex
			let nextCol = colIndex

			if (direction === 'next') {
				if (colIndex < maxCol) {
					nextCol = colIndex + 1
				} else if (cell.rowIndex < maxRow) {
					nextRow = cell.rowIndex + 1
					nextCol = 0
				}
			} else if (colIndex > 0) {
				nextCol = colIndex - 1
			} else if (cell.rowIndex > 0) {
				nextRow = cell.rowIndex - 1
				nextCol = maxCol
			}

			const newPos = { row: nextRow, col: nextCol }
			const nextEditingCell = { rowIndex: nextRow, columnName: columns[nextCol].name }
			setFocusedCell(newPos)
			setAnchorCell(newPos)
			updateCellSelection(new Set([getCellKey(nextRow, nextCol)]))
			editingCellRef.current = nextEditingCell
			editSelectModeRef.current = 'all'
			setEditingCell(nextEditingCell)
			setEditValue(valueToEditString(rows[nextRow][columns[nextCol].name]))
		},
		[columns, commitEdit, rows, setAnchorCell, setFocusedCell, updateCellSelection]
	)

	const handleEditKeyDown = useCallback(
		function (e: React.KeyboardEvent) {
			if (e.key === 'Enter') {
				e.preventDefault()
				handleSaveEdit()
			} else if (e.key === 'Escape') {
				e.preventDefault()
				handleCancelEdit()
			} else if (e.key === 'Tab') {
				e.preventDefault()
				handleSaveEditAndMove(e.shiftKey ? 'prev' : 'next')
			}
		},
		[handleCancelEdit, handleSaveEdit, handleSaveEditAndMove]
	)

	// Focus synchronously after the editor mounts (useLayoutEffect, not a
	// setTimeout) so the keystrokes immediately following a type-to-edit are
	// never dropped into the void.
	useLayoutEffect(
		function focusEditInput() {
			if (!editingCell) return
			const input = editInputRef.current
			if (!input) return
			input.focus()
			if (editSelectModeRef.current === 'end') {
				const end = input.value.length
				input.setSelectionRange(end, end)
			} else {
				input.select()
			}
		},
		[editingCell]
	)

	return {
		editingCell,
		setEditingCell,
		editValue,
		setEditValue,
		editInputRef,
		handleCellDoubleClick,
		startTypeEdit,
		handleSaveEdit,
		handleEditKeyDown
	}
}
