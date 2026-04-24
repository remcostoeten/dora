import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import { ColumnDefinition } from '../../types'
import { getCellKey } from './selection'
import { CellPosition, EditingCell } from './types'

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
	const editingCellRef = useRef(editingCell)
	editingCellRef.current = editingCell
	const skipNextBlurSaveRef = useRef(false)

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
		setEditingCell({ rowIndex, columnName })
		setEditValue(
			currentValue === null || currentValue === undefined ? '' : String(currentValue)
		)
	}, [])

	const handleSaveEdit = useCallback(
		function () {
			if (skipNextBlurSaveRef.current) {
				skipNextBlurSaveRef.current = false
				return
			}
			const cell = editingCellRef.current
			const value = editValueRef.current
			if (cell && onCellEdit) {
				onCellEdit(cell.rowIndex, cell.columnName, value)
			}
			editingCellRef.current = null
			setEditingCell(null)
			setEditValue('')
			refocusGrid()
		},
		[onCellEdit, refocusGrid]
	)

	const handleCancelEdit = useCallback(
		function () {
			setEditingCell(null)
			setEditValue('')
			refocusGrid()
		},
		[refocusGrid]
	)

	const handleSaveEditAndMove = useCallback(
		function (direction: 'next' | 'prev') {
			const cell = editingCellRef.current
			if (!cell) return

			if (onCellEdit) {
				onCellEdit(cell.rowIndex, cell.columnName, editValueRef.current)
			}

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
			setFocusedCell(newPos)
			setAnchorCell(newPos)
			updateCellSelection(new Set([getCellKey(nextRow, nextCol)]))
			setEditingCell({ rowIndex: nextRow, columnName: columns[nextCol].name })
			setEditValue(
				rows[nextRow][columns[nextCol].name] === null ||
					rows[nextRow][columns[nextCol].name] === undefined
					? ''
					: String(rows[nextRow][columns[nextCol].name])
			)
		},
		[columns, onCellEdit, rows, setAnchorCell, setFocusedCell, updateCellSelection]
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

	useEffect(() => {
		if (editingCell && editInputRef.current) {
			const timer = setTimeout(function () {
				if (editInputRef.current) {
					editInputRef.current.focus()
					editInputRef.current.select()
				}
			}, 10)
			return function () {
				clearTimeout(timer)
			}
		}
	}, [editingCell])

	return {
		editingCell,
		setEditingCell,
		editValue,
		setEditValue,
		editInputRef,
		handleCellDoubleClick,
		handleSaveEdit,
		handleEditKeyDown
	}
}
