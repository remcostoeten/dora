import React from 'react'
import type { VirtualItem } from '@tanstack/react-virtual'
import { Checkbox } from '@/shared/ui/checkbox'
import { cn } from '@/shared/utils/cn'
import { ColumnDefinition, FilterDescriptor } from '../../types'
import { CellContextMenu } from '../cell-context-menu'
import { RowAction, RowContextMenu } from '../row-context-menu'
import { formatCellValue } from './cell-value'
import { DraftRow } from './draft-row'
import { NoRowsState } from './empty-states'
import { EditingCell } from './types'

type GridBodyProps = {
	columns: ColumnDefinition[]
	draftInsertIndex?: number | null
	draftRow?: Record<string, unknown> | null
	editInputRef: React.RefObject<HTMLInputElement>
	editingCell: EditingCell | null
	editValue: string
	effectiveSelectedRows: Set<number>
	focusedCell: { row: number; col: number } | null
	getColumnWidth: (columnName: string) => number | undefined
	handleCellContextMenuChange: (open: boolean, row: number, col: number) => void
	handleCellDoubleClick: (rowIndex: number, columnName: string, currentValue: unknown) => void
	handleCellMouseDown: (e: React.MouseEvent, rowIndex: number, colIndex: number) => void
	handleCellMouseEnter: (rowIndex: number, colIndex: number) => void
	handleEditKeyDown: (e: React.KeyboardEvent) => void
	handleSaveEdit: () => void
	handleRowClick: (e: React.MouseEvent, rowIndex: number) => void
	handleRowContextMenuChange: (open: boolean, row: number) => void
	onBatchCellEdit?: (rowIndexes: number[], columnName: string, newValue: unknown) => void
	onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void
	onDraftCancel?: () => void
	onDraftChange?: (columnName: string, value: unknown) => void
	onDraftSave?: () => void
	onFilterAdd?: (filter: FilterDescriptor) => void
	onRowAction?: (
		action: RowAction,
		row: Record<string, unknown>,
		rowIndex: number,
		batchIndexes?: number[]
	) => void
	onRowSelect: (rowIndex: number, checked: boolean) => void
	pendingEdits?: Set<string>
	primaryKeyColumnName?: string
	rows: Record<string, unknown>[]
	selectedCellsByRow: Map<number, Set<number>>
	selectedRows: Set<number>
	tableName?: string
	ensureRowSelectionForContextMenu: (rowIndex: number) => void
	setEditValue: (value: string) => void
	/** Pass virtual rows from useRowVirtualizer. Null = render all (non-virtual). */
	virtualRows?: VirtualItem[] | null
	/** Total scroll height when virtualizing. */
	totalVirtualSize?: number | null
}

export function GridBody({
	columns,
	draftInsertIndex,
	draftRow,
	editInputRef,
	editingCell,
	editValue,
	effectiveSelectedRows,
	focusedCell,
	getColumnWidth,
	handleCellContextMenuChange,
	handleCellDoubleClick,
	handleCellMouseDown,
	handleCellMouseEnter,
	handleEditKeyDown,
	handleSaveEdit,
	handleRowClick,
	handleRowContextMenuChange,
	onBatchCellEdit,
	onCellEdit,
	onDraftCancel,
	onDraftChange,
	onDraftSave,
	onFilterAdd,
	onRowAction,
	onRowSelect,
	pendingEdits,
	primaryKeyColumnName,
	rows,
	selectedCellsByRow,
	selectedRows,
	tableName,
	ensureRowSelectionForContextMenu,
	setEditValue,
	virtualRows,
	totalVirtualSize,
}: GridBodyProps) {
	// Determine which rows to actually render
	const rowsToRender: Array<{ rowIndex: number; start?: number }> = virtualRows
		? virtualRows.map(function (vr) { return { rowIndex: vr.index, start: vr.start } })
		: rows.map(function (_, i) { return { rowIndex: i } })

	const topPad = virtualRows && virtualRows.length > 0 ? virtualRows[0].start : 0
	const bottomPad = virtualRows && virtualRows.length > 0 && totalVirtualSize
		? totalVirtualSize - (virtualRows[virtualRows.length - 1].start + virtualRows[virtualRows.length - 1].size)
		: 0
	return (
		<tbody role='rowgroup'>
			{draftRow &&
				(draftInsertIndex === undefined ||
					draftInsertIndex === null ||
					draftInsertIndex === -1) && (
					<DraftRow
						columns={columns}
						draftRow={draftRow}
						getColumnWidth={getColumnWidth}
						onDraftChange={onDraftChange}
						onDraftSave={onDraftSave}
						onDraftCancel={onDraftCancel}
						variant='top'
					/>
				)}

			{/* Virtual top spacer */}
			{topPad > 0 && (
				<tr style={{ height: topPad }}>
					<td colSpan={columns.length + 1} />
				</tr>
			)}

			{rowsToRender.map(function ({ rowIndex }) {
				const row = rows[rowIndex]
				const rowBackgroundClasses = selectedRows.has(rowIndex)
					? 'bg-primary/10'
					: rowIndex % 2 === 1
						? 'bg-muted/35 hover:bg-sidebar-accent/30'
						: 'hover:bg-sidebar-accent/30'
				const rowClasses = cn(
					'group transition-colors cursor-pointer',
					rowBackgroundClasses
				)

				return (
					<React.Fragment key={rowIndex}>
						<RowContextMenu
							row={row}
							rowIndex={rowIndex}
							columns={columns}
							tableName={tableName}
							onAction={function (action, row, index, batchIndexes) {
								onRowAction?.(action, row, index, batchIndexes)
							}}
							onOpenChange={function (open, row) {
								if (open) {
									ensureRowSelectionForContextMenu(row)
								}
								handleRowContextMenuChange(open, row)
							}}
							selectedRows={effectiveSelectedRows}
						>
							<tr
								className={rowClasses}
								onClick={function (e) {
									handleRowClick(e, rowIndex)
								}}
								role='row'
								aria-rowindex={rowIndex + 2}
								aria-selected={selectedRows.has(rowIndex)}
							>
								<td
									className={cn(
										'px-4 py-1.5 text-center border-b border-r border-sidebar-border sticky left-0 z-20 transition-colors',
										rowBackgroundClasses,
										selectedRows.has(rowIndex) && 'bg-sidebar-accent'
									)}
									role='gridcell'
								>
									<Checkbox
										checked={selectedRows.has(rowIndex)}
										onCheckedChange={function (checked) {
											onRowSelect(rowIndex, !!checked)
										}}
										className='h-4 w-4'
										aria-label={`Select row ${rowIndex + 1}`}
									/>
								</td>
								{columns.map(function (col, colIndex) {
									const isEditing =
										editingCell?.rowIndex === rowIndex &&
										editingCell?.columnName === col.name
									const isFocused =
										focusedCell?.row === rowIndex &&
										focusedCell?.col === colIndex
									const rowSelectedCols = selectedCellsByRow.get(rowIndex)
									const isSelected = rowSelectedCols?.has(colIndex) || false
									const width = getColumnWidth(col.name)
									const isDirty = primaryKeyColumnName
										? pendingEdits?.has(
												`${row[primaryKeyColumnName]}:${col.name}`
											)
										: false

									return (
										<CellContextMenu
											key={col.name}
											value={row[col.name]}
											column={col}
											rowIndex={rowIndex}
											colIndex={colIndex}
											selectedRows={effectiveSelectedRows}
											onAction={function (
												action,
												value,
												column,
												batchAction
											) {
												if (action === 'filter-by-value' && onFilterAdd) {
													onFilterAdd({
														column: column.name,
														operator: 'eq',
														value
													})
												} else if (action === 'edit') {
													handleCellDoubleClick(
														rowIndex,
														column.name,
														value
													)
												} else if (action === 'set-null' && onCellEdit) {
													onCellEdit(rowIndex, column.name, null)
												} else if (
													action === 'set-null-batch' &&
													batchAction &&
													onBatchCellEdit
												) {
													onBatchCellEdit(
														batchAction.rowIndexes,
														column.name,
														null
													)
												} else {
													console.log(
														'Cell action:',
														action,
														value,
														column.name
													)
												}
											}}
											onOpenChange={function (open, row, col) {
												handleCellContextMenuChange(open, row, col)
											}}
										>
											<td
												className={cn(
													'border-b border-r border-sidebar-border last:border-r-0 font-mono text-sm overflow-hidden cursor-cell px-3 py-1.5 relative whitespace-nowrap text-ellipsis max-w-[300px]',
													isSelected &&
														!isEditing &&
														'bg-muted-foreground/10',
													isFocused &&
														!isEditing &&
														'bg-primary/5 ring-2 ring-inset ring-primary/60 z-10',
													isDirty && 'bg-amber-500/10'
												)}
												style={width ? { maxWidth: width } : undefined}
												data-cell-key={`${rowIndex}:${colIndex}`}
												onMouseDown={function (e) {
													handleCellMouseDown(e, rowIndex, colIndex)
												}}
												onMouseEnter={function () {
													handleCellMouseEnter(rowIndex, colIndex)
												}}
												onDoubleClick={function () {
													handleCellDoubleClick(
														rowIndex,
														col.name,
														row[col.name]
													)
												}}
											>
												{isEditing ? (
													<input
														ref={editInputRef}
														type='text'
														value={editValue}
														onChange={function (e) {
															setEditValue(e.target.value)
														}}
														onBlur={handleSaveEdit}
														onKeyDown={handleEditKeyDown}
														data-no-shortcuts='true'
														className='w-full h-full bg-primary/10 outline outline-1 outline-offset-[-1px] outline-primary font-mono text-sm -mx-3 -my-1.5 px-3 py-1.5 box-content'
													/>
												) : (
													<div className='truncate relative'>
														{formatCellValue(row[col.name], col)}
														{isDirty && (
															<div className='absolute top-0 right-0 -mr-3 -mt-1.5 w-0 h-0 border-t-[6px] border-r-[6px] border-t-transparent border-r-amber-500' />
														)}
													</div>
												)}
											</td>
										</CellContextMenu>
									)
								})}
							</tr>
						</RowContextMenu>
						{draftRow && draftInsertIndex === rowIndex + 1 && (
							<DraftRow
								columns={columns}
								draftRow={draftRow}
								getColumnWidth={getColumnWidth}
								onDraftChange={onDraftChange}
								onDraftSave={onDraftSave}
								onDraftCancel={onDraftCancel}
								variant='inline'
							/>
						)}
					</React.Fragment>
				)
			})}
			{/* Virtual bottom spacer */}
			{bottomPad > 0 && (
				<tr style={{ height: bottomPad }}>
					<td colSpan={columns.length + 1} />
				</tr>
			)}

			{rows.length === 0 && <NoRowsState colSpan={columns.length + 1} />}
		</tbody>
	)
}
