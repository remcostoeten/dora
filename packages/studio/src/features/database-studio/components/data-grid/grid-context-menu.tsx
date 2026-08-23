import React, { useCallback, useRef, useState } from 'react'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@studio/shared/ui/context-menu'
import { ColumnDefinition, FilterDescriptor } from '../../types'
import { BlobAction, CellContextMenuItems } from '../cell-context-menu'
import { RowAction, RowContextMenuItems } from '../row-context-menu'

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

type Reporting = {
	onCellOpenChange: (open: boolean, row: number, col: number) => void
	onRowOpenChange: (open: boolean, row: number) => void
	ensureRowSelection: (rowIndex: number) => void
}

/**
 * Tracks which cell or row the next context menu is for. Cells call `armCell`
 * / `armRow` from their `onContextMenu`; the event then bubbles to the shared
 * trigger, whose handler promotes the armed target to state (or, when nothing
 * armed it — header, spacer rows — suppresses the menu).
 */
export function useGridContextMenu({
	onCellOpenChange,
	onRowOpenChange,
	ensureRowSelection
}: Reporting) {
	const [target, setTarget] = useState<GridMenuTarget | null>(null)
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

	const handleOpenChange = useCallback(
		function handleOpenChange(open: boolean) {
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

	return { target, armCell, armRow, handleTriggerContextMenu, handleOpenChange }
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
	onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void
	onBatchCellEdit?: (rowIndexes: number[], columnName: string, newValue: unknown) => void
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
	children: React.ReactNode
}

function preventCloseAutoFocus(event: Event) {
	event.preventDefault()
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
	onCellEdit,
	onBatchCellEdit,
	startCellEdit,
	onBlobAction,
	onRowAction,
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
				className='w-[180px]'
				// "Edit cell" opens an inline <input>; letting Radix refocus the
				// trigger would blur that input the instant it mounts and close
				// the editor. Row actions keep the default so keyboard focus
				// returns to the grid.
				onCloseAutoFocus={target?.kind === 'cell' ? preventCloseAutoFocus : undefined}
			>
				{target?.kind === 'cell' && targetRow && targetColumn ? (
					<CellContextMenuItems
						value={targetRow[targetColumn.name]}
						column={targetColumn}
						rowIndex={target.rowIndex}
						row={targetRow}
						selectedRows={menuSelectedRows}
						hasFilter={!!onFilterAdd}
						onBlobAction={onBlobAction}
						onAction={function (action, value, column, batchAction) {
							if (action === 'filter-by-value' && onFilterAdd) {
								onFilterAdd({ column: column.name, operator: 'eq', value })
							} else if (action === 'edit') {
								startCellEdit(target.rowIndex, column.name, value)
							} else if (action === 'set-null' && onCellEdit) {
								onCellEdit(target.rowIndex, column.name, null)
							} else if (
								action === 'set-null-batch' &&
								batchAction &&
								onBatchCellEdit
							) {
								onBatchCellEdit(batchAction.rowIndexes, column.name, null)
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
