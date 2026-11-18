import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@studio/shared/ui/context-menu'
import { ColumnDefinition, FilterDescriptor } from '../../types'
import { BlobAction, CellContextMenuItems } from '../cell-context-menu'
import { RowAction, RowContextMenuItems } from '../row-context-menu'
import { CellPosition } from './types'

/**
 * One Radix context menu for the whole grid.
 *
 * Wrapping every cell and row in its own `ContextMenu` meant a 50×5 page
 * mounted 300 menu roots (each a provider chain plus a portal/presence pair)
 * and re-rendered all of them on every table switch; that was the long frame
 * behind the navigation budgets. Here the cells only report which one was
 * right-clicked, and a single root anchored on the table body renders the
 * items for that target.
 */

export type GridMenuTarget =
	| { kind: 'cell'; rowIndex: number; colIndex: number }
	| { kind: 'row'; rowIndex: number }

const EMPTY_ROW_SET: ReadonlySet<number> = new Set<number>()

export type MenuShortcutHints = {
	editCell?: string
	copyCells?: string
	setNull?: string
	viewRow?: string
	editRow?: string
	duplicateRow?: string
	deleteRows?: string
}

type Reporting = {
	gridRef: React.RefObject<HTMLTableElement>
	onCellOpenChange: (open: boolean, row: number, col: number) => void
	onRowOpenChange: (open: boolean, row: number) => void
	ensureRowSelection: (rowIndex: number) => void
}

const FIRST_MENU_ITEM = '[data-slot="context-menu-content"] [role="menuitem"]:not([data-disabled])'

function dispatchContextMenu(element: Element) {
	const rect = element.getBoundingClientRect()
	element.dispatchEvent(
		new MouseEvent('contextmenu', {
			bubbles: true,
			cancelable: true,
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2
		})
	)
}

/**
 * Tracks which cell or row the next context menu is for. Cells call `armCell`
 * / `armRow` from their `onContextMenu`; the event then bubbles to the shared
 * trigger, whose handler promotes the armed target to state (or, when nothing
 * armed it — header, spacer rows — suppresses the menu).
 */
export function useGridContextMenu({
	gridRef,
	onCellOpenChange,
	onRowOpenChange,
	ensureRowSelection
}: Reporting) {
	const [target, setTarget] = useState<GridMenuTarget | null>(null)
	const [isOpen, setIsOpen] = useState(false)
	const openedFromKeyboardRef = useRef(false)
	const armedRef = useRef<GridMenuTarget | null>(null)
	const currentRef = useRef<GridMenuTarget | null>(null)

	const armCell = useCallback(function armCell(rowIndex: number, colIndex: number) {
		armedRef.current = { kind: 'cell', rowIndex, colIndex }
	}, [])

	const armRow = useCallback(function armRow(rowIndex: number) {
		armedRef.current = { kind: 'row', rowIndex }
	}, [])

	const handleTriggerContextMenu = useCallback(function handleTriggerContextMenu(
		event: React.MouseEvent
	) {
		const armed = armedRef.current
		armedRef.current = null
		if (!armed) {
			event.preventDefault()
			return
		}
		currentRef.current = armed
		setTarget(armed)
	}, [])

	const openCellMenuFromKeyboard = useCallback(
		function openCellMenuFromKeyboard(rowIndex: number, colIndex: number) {
			const grid = gridRef.current
			if (!grid) return
			openedFromKeyboardRef.current = true
			const cell = grid.querySelector(`[data-cell-key="${rowIndex}:${colIndex}"]`)
			if (!cell) armCell(rowIndex, colIndex)
			dispatchContextMenu(cell ?? grid)
		},
		[armCell, gridRef]
	)

	const openRowMenuFromKeyboard = useCallback(
		function openRowMenuFromKeyboard(rowIndex: number) {
			const grid = gridRef.current
			if (!grid) return
			openedFromKeyboardRef.current = true
			const rowHandle = grid.querySelector(`tr[data-index="${rowIndex}"] > td`)
			if (!rowHandle) armRow(rowIndex)
			dispatchContextMenu(rowHandle ?? grid)
		},
		[armRow, gridRef]
	)

	useEffect(
		function focusFirstItemWhenOpenedFromKeyboard() {
			if (!isOpen || !openedFromKeyboardRef.current) return
			openedFromKeyboardRef.current = false
			document.querySelector<HTMLElement>(FIRST_MENU_ITEM)?.focus()
		},
		[isOpen, target]
	)

	const handleOpenChange = useCallback(
		function handleOpenChange(open: boolean) {
			setIsOpen(open)
			if (!open) openedFromKeyboardRef.current = false
			const current = currentRef.current
			if (!current) return
			if (current.kind === 'cell') {
				onCellOpenChange(open, current.rowIndex, current.colIndex)
				return
			}
			if (open) ensureRowSelection(current.rowIndex)
			onRowOpenChange(open, current.rowIndex)
		},
		[onCellOpenChange, onRowOpenChange, ensureRowSelection]
	)

	return {
		target,
		armCell,
		armRow,
		openCellMenuFromKeyboard,
		openRowMenuFromKeyboard,
		handleTriggerContextMenu,
		handleOpenChange
	}
}

type Props = {
	target: GridMenuTarget | null
	/** Privacy mode: no menu at all (no copy/edit/export). */
	disabled?: boolean
	rows: Record<string, unknown>[]
	columns: ColumnDefinition[]
	tableName?: string
	selectedRows: Set<number>
	focusedCell: { row: number; col: number } | null
	onTriggerContextMenu: (event: React.MouseEvent) => void
	onOpenChange: (open: boolean) => void
	onFilterAdd?: (filter: FilterDescriptor) => void
	onSetCellsNull?: (cells: CellPosition[]) => void
	isEditing: () => boolean
	onRestoreGridFocus: () => void
	shortcutHints?: MenuShortcutHints
	startCellEdit: (rowIndex: number, columnName: string, currentValue: unknown) => void
	onBlobAction?: (
		action: BlobAction,
		column: ColumnDefinition,
		row: Record<string, unknown>
	) => void
	onRowAction?: (
		action: RowAction,
		row: Record<string, unknown>,
		rowIndex: number,
		batchIndexes?: number[]
	) => void
	canEditRows?: boolean
	children: React.ReactNode
}

export function GridContextMenu({
	target,
	disabled = false,
	rows,
	columns,
	tableName,
	selectedRows,
	focusedCell,
	onTriggerContextMenu,
	onOpenChange,
	onFilterAdd,
	onSetCellsNull,
	isEditing,
	onRestoreGridFocus,
	shortcutHints,
	startCellEdit,
	onBlobAction,
	onRowAction,
	canEditRows = true,
	children
}: Props) {
	const targetRow = target ? rows[target.rowIndex] : undefined
	const targetColumn = target?.kind === 'cell' ? columns[target.colIndex] : undefined

	const menuSelectedRows = resolveMenuSelection(selectedRows, focusedCell, target)

	return (
		<ContextMenu onOpenChange={onOpenChange}>
			<ContextMenuTrigger asChild disabled={disabled} onContextMenu={onTriggerContextMenu}>
				{children}
			</ContextMenuTrigger>
			<ContextMenuContent
				className='w-[220px]'
				// Radix refocusing the trigger would blur an editor that "Edit cell" just mounted.
				onCloseAutoFocus={(event) => {
					event.preventDefault()
					if (!isEditing()) onRestoreGridFocus()
				}}
			>
				{target?.kind === 'cell' && targetRow && targetColumn ? (
					<CellContextMenuItems
						value={targetRow[targetColumn.name]}
						column={targetColumn}
						rowIndex={target.rowIndex}
						row={targetRow}
						selectedRows={menuSelectedRows}
						hasFilter={!!onFilterAdd}
						canEdit={canEditRows}
						shortcutHints={shortcutHints}
						onBlobAction={onBlobAction}
						onAction={function (action, value, column, batchAction) {
							if (action === 'filter-by-value' && onFilterAdd) {
								onFilterAdd({ column: column.name, operator: 'eq', value })
							} else if (action === 'edit') {
								startCellEdit(target.rowIndex, column.name, value)
							} else if (action === 'set-null') {
								onSetCellsNull?.([{ row: target.rowIndex, col: target.colIndex }])
							} else if (action === 'set-null-batch' && batchAction) {
								onSetCellsNull?.(
									batchAction.rowIndexes.map((row) => ({
										row,
										col: target.colIndex
									}))
								)
							}
						}}
					/>
				) : null}
				{target?.kind === 'row' && targetRow ? (
					<RowContextMenuItems
						row={targetRow}
						rowIndex={target.rowIndex}
						columns={columns}
						tableName={tableName}
						allRows={rows}
						selectedRows={menuSelectedRows}
						canEdit={canEditRows}
						shortcutHints={shortcutHints}
						onAction={onRowAction}
					/>
				) : null}
			</ContextMenuContent>
		</ContextMenu>
	)
}

/**
 * The selection the menu acts on. Falls back to the target row when nothing is
 * selected but a cell in that row is focused — batch actions (size > 1) only
 * ever come from the real selection.
 */
function resolveMenuSelection(
	selectedRows: Set<number>,
	focusedCell: { row: number; col: number } | null,
	target: GridMenuTarget | null
): Set<number> {
	if (selectedRows.size > 0) return selectedRows
	if (target && focusedCell && focusedCell.row === target.rowIndex)
		return new Set([target.rowIndex])
	return EMPTY_ROW_SET as Set<number>
}
