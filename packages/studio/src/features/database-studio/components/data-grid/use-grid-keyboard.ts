import { useCallback, useEffect, useMemo, useRef } from 'react'
import type React from 'react'
import type { ShortcutDefinition, ShortcutName } from '@studio/core/shortcuts'
import { ColumnDefinition } from '../../types'
import type { RowAction } from '../row-context-menu'
import {
	buildGridKeymap,
	getSequencePrefixes,
	isBareKey,
	isSequenceContinuation,
	resolveGridCommand,
	type GridCommandContext
} from './grid-commands'
import type { CellEdit, GridNotice, StagedAction } from './grid-edits'
import { isTextEntryEvent } from './grid-events'
import { clampToBounds } from './grid-navigation'
import { getCellKey, getCellsInRectangle } from './selection'
import { CellPosition, EditingCell } from './types'

type UseGridKeyboardArgs = {
	anchorCell: CellPosition | null
	allSelected: boolean
	applyCellEdits?: (edits: CellEdit[]) => void
	columns: ColumnDefinition[]
	editingCell: EditingCell | null
	focusedCell: CellPosition | null
	isHeaderFocused: boolean
	setHeaderFocused: (focused: boolean) => void
	autoFitColumn: (columnName: string, columnType?: string) => void
	resizeColumnBy: (columnName: string, delta: number) => void
	onFilterColumn?: (columnName: string) => void
	onHideColumn?: (columnName: string) => void
	onSortDirection?: (columnName: string, direction: 'asc' | 'desc') => void
	getPageSize: () => number
	lastClickedRowRef: React.MutableRefObject<number | null>
	masked?: boolean
	notify: (notice: GridNotice) => void
	onDeleteSelectedRows?: () => void
	onInsertRow?: (rowIndex: number, position: 'above' | 'below') => void
	onOpenCellMenu?: (rowIndex: number, colIndex: number) => void
	onOpenRowMenu?: (rowIndex: number) => void
	onRowAction?: (
		action: RowAction,
		row: Record<string, unknown>,
		rowIndex: number,
		batchIndexes?: number[]
	) => void
	onPageChange?: (direction: 'next' | 'prev') => void
	onRevertStaged?: (rowIndex: number, columnName: string | null) => void
	onStagedAction?: (action: StagedAction) => void
	onSortColumn?: (columnName: string) => void
	onRowsSelect?: (rowIndices: number[], checked: boolean) => void
	onRowSelect: (rowIndex: number, checked: boolean) => void
	onSelectAll: (checked: boolean) => void
	openGoToPrompt: () => void
	openHelp: () => void
	commitFillSelection: () => void
	rows: Record<string, unknown>[]
	selectedCellsSet: Set<string>
	selectedRows: Set<number>
	setAnchorCell: (cell: CellPosition | null) => void
	setFocusedCell: (cell: CellPosition | null) => void
	shortcuts: Record<ShortcutName, ShortcutDefinition>
	startCellEdit: (rowIndex: number, columnName: string, currentValue: unknown) => void
	updateCellSelection: (cells: Set<string>) => void
}

const INITIAL_FOCUS_KEYS = new Set([
	'ArrowDown',
	'ArrowUp',
	'ArrowLeft',
	'ArrowRight',
	'Tab',
	'Enter'
])

export function useGridKeyboard({
	anchorCell,
	allSelected,
	applyCellEdits,
	columns,
	editingCell,
	focusedCell,
	getPageSize,
	isHeaderFocused,
	setHeaderFocused,
	autoFitColumn,
	resizeColumnBy,
	onFilterColumn,
	onHideColumn,
	onSortDirection,
	lastClickedRowRef,
	masked,
	notify,
	onDeleteSelectedRows,
	onInsertRow,
	onOpenCellMenu,
	onOpenRowMenu,
	onPageChange,
	onRevertStaged,
	onStagedAction,
	onRowAction,
	onSortColumn,
	onRowsSelect,
	onRowSelect,
	onSelectAll,
	openGoToPrompt,
	openHelp,
	commitFillSelection,
	rows,
	selectedCellsSet,
	selectedRows,
	setAnchorCell,
	setFocusedCell,
	shortcuts,
	startCellEdit,
	updateCellSelection
}: UseGridKeyboardArgs) {
	const pendingNavFrameRef = useRef<number | null>(null)
	const prefixPressedAtRef = useRef<number | null>(null)

	const keymap = useMemo(() => buildGridKeymap(shortcuts), [shortcuts])
	const sequencePrefixes = useMemo(() => getSequencePrefixes(shortcuts), [shortcuts])

	useEffect(function cleanupPendingFrame() {
		return function () {
			if (pendingNavFrameRef.current !== null) {
				cancelAnimationFrame(pendingNavFrameRef.current)
			}
		}
	}, [])

	return useCallback(
		function handleGridKeyDown(e: React.KeyboardEvent) {
			const event = e.nativeEvent
			if (editingCell) {
				const editingCommand = resolveGridCommand(event, keymap, true, 'editing')
				if (!editingCommand || (editingCommand.blockedByMask && masked)) return
				e.preventDefault()
				commitFillSelection()
				return
			}
			if (isTextEntryEvent(event)) return

			function cancelPendingNavigation() {
				if (pendingNavFrameRef.current === null) return
				cancelAnimationFrame(pendingNavFrameRef.current)
				pendingNavFrameRef.current = null
			}

			function moveTo(target: CellPosition, extend: boolean) {
				cancelPendingNavigation()
				pendingNavFrameRef.current = requestAnimationFrame(() => {
					setFocusedCell(target)
					if (extend && anchorCell) {
						updateCellSelection(getCellsInRectangle(anchorCell, target))
					} else if (!extend) {
						setAnchorCell(target)
						lastClickedRowRef.current = target.row
						updateCellSelection(new Set([getCellKey(target.row, target.col)]))
					}
					pendingNavFrameRef.current = null
				})
			}

			if (isBareKey(event)) {
				const continuesSequence = isSequenceContinuation(
					prefixPressedAtRef.current,
					event.timeStamp
				)
				prefixPressedAtRef.current = null
				if (continuesSequence) return
			}

			const bounds = { rowCount: rows.length, colCount: columns.length }

			if (!focusedCell && INITIAL_FOCUS_KEYS.has(event.key)) {
				if (bounds.rowCount === 0 || bounds.colCount === 0) return
				e.preventDefault()
				const firstCell = { row: 0, col: 0 }
				setFocusedCell(firstCell)
				setAnchorCell(firstCell)
				lastClickedRowRef.current = firstCell.row
				updateCellSelection(new Set([getCellKey(0, 0)]))
				return
			}

			if (
				focusedCell &&
				(focusedCell.row >= bounds.rowCount || focusedCell.col >= bounds.colCount)
			) {
				const clamped = clampToBounds(focusedCell, bounds)
				if (!clamped) return
				e.preventDefault()
				setFocusedCell(clamped)
				setAnchorCell(clamped)
				return
			}

			const region = isHeaderFocused && focusedCell ? 'header' : 'cell'

			function leaveHeader(rowIndex: number) {
				setHeaderFocused(false)
				if (!focusedCell) return
				moveTo({ row: Math.max(0, rowIndex), col: focusedCell.col }, false)
			}

			function moveHeaderTo(colIndex: number) {
				if (!focusedCell) return
				setFocusedCell({ row: focusedCell.row, col: colIndex })
			}

			const command = resolveGridCommand(event, keymap, focusedCell !== null, region)

			if (!command) {
				if (!isBareKey(event)) return
				if (sequencePrefixes.has(event.key.toLowerCase())) {
					prefixPressedAtRef.current = event.timeStamp
				}
				if (focusedCell) e.preventDefault()
				return
			}

			if (command.blockedByMask && masked) {
				e.preventDefault()
				return
			}

			const context: GridCommandContext = {
				allSelected,
				anchorCell,
				columns,
				focusedCell,
				rows,
				selectedCellsSet,
				selectedRows,
				applyCellEdits,
				cancelPendingNavigation,
				getPageSize,
				region,
				autoFitColumn,
				resizeColumnBy,
				onFilterColumn,
				onHideColumn,
				onSortDirection,
				enterHeader: () => setHeaderFocused(true),
				leaveHeader,
				moveHeaderTo,
				moveTo,
				notify,
				onDeleteSelectedRows,
				onInsertRow,
				onOpenCellMenu,
				onOpenRowMenu,
				onPageChange,
				onRevertStaged,
				onStagedAction,
				onRowAction,
				onRowSelect,
				onRowsSelect,
				onSelectAll,
				onSortColumn,
				openGoToPrompt,
				openHelp,
				commitFillSelection,
				setFocusedCell,
				setLastClickedRow: (rowIndex) => {
					lastClickedRowRef.current = rowIndex
				},
				startCellEdit,
				updateCellSelection
			}

			if (command.run(context) === 'handled') e.preventDefault()
		},
		[
			anchorCell,
			allSelected,
			applyCellEdits,
			columns,
			editingCell,
			focusedCell,
			getPageSize,
			isHeaderFocused,
			setHeaderFocused,
			autoFitColumn,
			resizeColumnBy,
			onFilterColumn,
			onHideColumn,
			onSortDirection,
			keymap,
			lastClickedRowRef,
			masked,
			notify,
			onDeleteSelectedRows,
			onInsertRow,
			onOpenCellMenu,
			onOpenRowMenu,
			onPageChange,
			onRevertStaged,
			onStagedAction,
			onRowAction,
			onSortColumn,
			onRowsSelect,
			onRowSelect,
			onSelectAll,
			openGoToPrompt,
			openHelp,
			commitFillSelection,
			rows,
			selectedCellsSet,
			selectedRows,
			sequencePrefixes,
			setAnchorCell,
			setFocusedCell,
			startCellEdit,
			updateCellSelection
		]
	)
}
