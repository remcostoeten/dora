import React, { memo, useMemo } from 'react'
import type { VirtualItem } from '@tanstack/react-virtual'
import { Checkbox } from '@studio/shared/ui/checkbox'
import { cn } from '@studio/shared/utils/cn'
import { ColumnDefinition, FilterDescriptor } from '../../types'
import { BlobAction, CellContextMenu } from '../cell-context-menu'
import { RowAction, RowContextMenu } from '../row-context-menu'
import { formatCellValue } from './cell-value'
import { DraftRow } from './draft-row'
import { NoRowsState } from './empty-states'
import { FKNavigateIcon } from './fk-icon'
import { EditingCell } from './types'

const EMPTY_ROW_SET: ReadonlySet<number> = new Set<number>()

type GridRowProps = {
	row: Record<string, unknown>
	rowIndex: number
	columns: ColumnDefinition[]
	allRows: Record<string, unknown>[]
	tableName?: string
	masked?: boolean
	selectedRows: Set<number>
	isRowSelected: boolean
	rowSelectedCols: Set<number> | undefined
	focusedCol: number | null
	/** Column being edited in THIS row, null when this row has no active editor. */
	editingColumnName: string | null
	/** Only meaningful while `editingColumnName` is set. */
	editValue: string
	pendingEdits?: Set<string>
	primaryKeyColumnName?: string
	getColumnWidth: (columnName: string) => number | undefined
	editInputRef: React.RefObject<HTMLInputElement | HTMLSelectElement>
	handleCellContextMenuChange: (open: boolean, row: number, col: number) => void
	handleCellDoubleClick: (rowIndex: number, columnName: string, currentValue: unknown) => void
	handleCellMouseDown: (e: React.MouseEvent, rowIndex: number, colIndex: number) => void
	handleCellMouseEnter: (rowIndex: number, colIndex: number) => void
	handleEditKeyDown: (e: React.KeyboardEvent) => void
	handleEditBlur: () => void
	handleSelectCommit: (value: string) => void
	handleRowClick: (e: React.MouseEvent, rowIndex: number) => void
	handleRowContextMenuChange: (open: boolean, row: number) => void
	onBatchCellEdit?: (rowIndexes: number[], columnName: string, newValue: unknown) => void
	onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void
	onFilterAdd?: (filter: FilterDescriptor) => void
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
	onRowSelect: (rowIndex: number, checked: boolean) => void
	ensureRowSelectionForContextMenu: (rowIndex: number) => void
	setEditValue: (value: string) => void
	onFKNavigate?: (referencedTable: string, referencedColumn: string, value: unknown) => void
}

/**
 * One data row, memoized so grid-level state churn (editing keystrokes, focus
 * moves, drag selection) only re-renders the rows it touches instead of every
 * visible cell.
 */
const GridRow = memo(function GridRow({
	row,
	rowIndex,
	columns,
	allRows,
	tableName,
	masked,
	selectedRows,
	isRowSelected,
	rowSelectedCols,
	focusedCol,
	editingColumnName,
	editValue,
	pendingEdits,
	primaryKeyColumnName,
	getColumnWidth,
	editInputRef,
	handleCellContextMenuChange,
	handleCellDoubleClick,
	handleCellMouseDown,
	handleCellMouseEnter,
	handleEditKeyDown,
	handleEditBlur,
	handleSelectCommit,
	handleRowClick,
	handleRowContextMenuChange,
	onBatchCellEdit,
	onCellEdit,
	onFilterAdd,
	onBlobAction,
	onRowAction,
	onRowSelect,
	ensureRowSelectionForContextMenu,
	setEditValue,
	onFKNavigate
}: GridRowProps) {
	// Selection the context menus act on. Falls back to this row when nothing is
	// selected but a cell here is focused — batch actions (which need size > 1)
	// only ever come from the real selection, so the fallback never has to know
	// about focus on OTHER rows.
	const menuSelectedRows = useMemo(() => {
		if (selectedRows.size > 0) return selectedRows
		if (focusedCol !== null) return new Set([rowIndex])
		return EMPTY_ROW_SET as Set<number>
	}, [selectedRows, focusedCol, rowIndex])

	const rowBackgroundClasses = isRowSelected
		? 'bg-primary/10'
		: rowIndex % 2 === 1
			? 'bg-muted/35 hover:bg-sidebar-accent/30'
			: 'hover:bg-sidebar-accent/30'
	const rowClasses = cn('group transition-colors cursor-pointer', rowBackgroundClasses)
	// The checkbox column is sticky, so it floats over other cells during
	// horizontal scroll — it needs an OPAQUE background (the translucent row
	// tints would let scrolled content bleed through). Use the solid, theme-aware
	// table tokens so striping/hover/selection still read correctly.
	const stickyCellBackgroundClasses = isRowSelected
		? 'bg-table-row-selected'
		: rowIndex % 2 === 1
			? 'bg-table-header group-hover:bg-table-row-hover'
			: 'bg-background group-hover:bg-table-row-hover'

	return (
		<RowContextMenu
			disabled={masked}
			row={row}
			rowIndex={rowIndex}
			columns={columns}
			tableName={tableName}
			allRows={allRows}
			onAction={function (action, row, index, batchIndexes) {
				onRowAction?.(action, row, index, batchIndexes)
			}}
			onOpenChange={function (open, row) {
				if (open) {
					ensureRowSelectionForContextMenu(row)
				}
				handleRowContextMenuChange(open, row)
			}}
			selectedRows={menuSelectedRows}
		>
			<tr
				className={rowClasses}
				onClick={function (e) {
					handleRowClick(e, rowIndex)
				}}
				role='row'
				aria-rowindex={rowIndex + 2}
				aria-selected={isRowSelected}
			>
				<td
					className={cn(
						'w-[30px] min-w-[30px] p-0 text-center align-middle border-b border-l border-r border-sidebar-border sticky left-0 z-20 transition-colors',
						stickyCellBackgroundClasses
					)}
					role='gridcell'
				>
					<Checkbox
						checked={isRowSelected}
						onCheckedChange={function (checked) {
							onRowSelect(rowIndex, !!checked)
						}}
						className='h-4 w-4'
						aria-label={`Select row ${rowIndex + 1}`}
						// Keep the grid a single tab stop: the table owns roving
						// keyboard focus (arrows navigate cells, Space toggles the
						// row). A tabbable checkbox per row would make Tab hop
						// checkboxes and skip the data cells.
						tabIndex={-1}
					/>
				</td>
				{columns.map(function (col, colIndex) {
					const isEditing = editingColumnName === col.name
					const isFocused = focusedCol === colIndex
					const isSelected = rowSelectedCols?.has(colIndex) || false
					const width = getColumnWidth(col.name)
					const isDirty = primaryKeyColumnName
						? pendingEdits?.has(`${row[primaryKeyColumnName]}:${col.name}`)
						: false

					return (
						<CellContextMenu
							key={col.name}
							disabled={masked}
							value={row[col.name]}
							column={col}
							rowIndex={rowIndex}
							colIndex={colIndex}
							row={row}
							selectedRows={menuSelectedRows}
							hasFilter={!!onFilterAdd}
							onBlobAction={onBlobAction}
							onAction={function (action, value, column, batchAction) {
								if (action === 'filter-by-value' && onFilterAdd) {
									onFilterAdd({
										column: column.name,
										operator: 'eq',
										value
									})
								} else if (action === 'edit') {
									handleCellDoubleClick(rowIndex, column.name, value)
								} else if (action === 'set-null' && onCellEdit) {
									onCellEdit(rowIndex, column.name, null)
								} else if (
									action === 'set-null-batch' &&
									batchAction &&
									onBatchCellEdit
								) {
									onBatchCellEdit(batchAction.rowIndexes, column.name, null)
								}
							}}
							onOpenChange={function (open, row, col) {
								handleCellContextMenuChange(open, row, col)
							}}
						>
							<td
								className={cn(
									'border-b border-r border-sidebar-border last:border-r-0 font-mono text-sm overflow-hidden cursor-cell px-3 py-1.5 relative whitespace-nowrap text-ellipsis max-w-[300px] group/cell',
									isSelected && !isEditing && 'bg-muted-foreground/10',
									isFocused &&
										!isEditing &&
										'bg-sidebar-accent/35 shadow-[inset_0_0_0_1px_hsl(var(--sidebar-foreground)/0.22)] z-10',
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
									if (masked) return
									handleCellDoubleClick(rowIndex, col.name, row[col.name])
								}}
							>
								{isEditing && col.allowedValues ? (
									<select
										ref={editInputRef as React.RefObject<HTMLSelectElement>}
										value={editValue}
										onChange={function (e) {
											handleSelectCommit(e.target.value)
										}}
										onBlur={handleEditBlur}
										onKeyDown={handleEditKeyDown}
										data-no-shortcuts='true'
										className='w-full h-full bg-sidebar-accent/35 outline outline-1 outline-offset-[-1px] outline-sidebar-foreground/25 font-mono text-sm -mx-3 -my-1.5 px-3 py-1.5 box-content'
									>
										{!col.allowedValues.includes(editValue) && (
											<option value={editValue}>
												{editValue === '' ? '(empty)' : editValue}
											</option>
										)}
										{col.allowedValues.map(function (value) {
											return (
												<option key={value} value={value}>
													{value}
												</option>
											)
										})}
									</select>
								) : isEditing ? (
									<input
										ref={editInputRef as React.RefObject<HTMLInputElement>}
										type='text'
										value={editValue}
										onChange={function (e) {
											setEditValue(e.target.value)
										}}
										onBlur={handleEditBlur}
										onKeyDown={handleEditKeyDown}
										data-no-shortcuts='true'
										className='w-full h-full bg-sidebar-accent/35 outline outline-1 outline-offset-[-1px] outline-sidebar-foreground/25 font-mono text-sm -mx-3 -my-1.5 px-3 py-1.5 box-content'
									/>
								) : (
									<div className='flex items-center min-w-0 relative'>
										<span className='truncate flex-1'>
											{formatCellValue(row[col.name], col, masked)}
										</span>
										{col.foreignKey && onFKNavigate && !masked && (
											<FKNavigateIcon
												foreignKey={col.foreignKey}
												cellValue={row[col.name]}
												onNavigate={onFKNavigate}
											/>
										)}
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
	)
})

type GridBodyProps = {
	columns: ColumnDefinition[]
	draftInsertIndex?: number | null
	draftRow?: Record<string, unknown> | null
	editInputRef: React.RefObject<HTMLInputElement | HTMLSelectElement>
	editingCell: EditingCell | null
	editValue: string
	focusedCell: { row: number; col: number } | null
	getColumnWidth: (columnName: string) => number | undefined
	handleCellContextMenuChange: (open: boolean, row: number, col: number) => void
	handleCellDoubleClick: (rowIndex: number, columnName: string, currentValue: unknown) => void
	handleCellMouseDown: (e: React.MouseEvent, rowIndex: number, colIndex: number) => void
	handleCellMouseEnter: (rowIndex: number, colIndex: number) => void
	handleEditKeyDown: (e: React.KeyboardEvent) => void
	handleEditBlur: () => void
	handleSelectCommit: (value: string) => void
	handleRowClick: (e: React.MouseEvent, rowIndex: number) => void
	handleRowContextMenuChange: (open: boolean, row: number) => void
	onBatchCellEdit?: (rowIndexes: number[], columnName: string, newValue: unknown) => void
	onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void
	onDraftCancel?: () => void
	onDraftChange?: (columnName: string, value: unknown) => void
	onDraftSave?: () => void
	onFilterAdd?: (filter: FilterDescriptor) => void
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
	onRowSelect: (rowIndex: number, checked: boolean) => void
	pendingEdits?: Set<string>
	primaryKeyColumnName?: string
	rows: Record<string, unknown>[]
	selectedCellsByRow: Map<number, Set<number>>
	selectedRows: Set<number>
	tableName?: string
	/** Privacy mode: mask every cell value and disable editing/copy/context menus. */
	masked?: boolean
	ensureRowSelectionForContextMenu: (rowIndex: number) => void
	setEditValue: (value: string) => void
	onFKNavigate?: (referencedTable: string, referencedColumn: string, value: unknown) => void
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
	focusedCell,
	getColumnWidth,
	handleCellContextMenuChange,
	handleCellDoubleClick,
	handleCellMouseDown,
	handleCellMouseEnter,
	handleEditKeyDown,
	handleEditBlur,
	handleSelectCommit,
	handleRowClick,
	handleRowContextMenuChange,
	onBatchCellEdit,
	onCellEdit,
	onDraftCancel,
	onDraftChange,
	onDraftSave,
	onFilterAdd,
	onBlobAction,
	onRowAction,
	onRowSelect,
	pendingEdits,
	primaryKeyColumnName,
	rows,
	selectedCellsByRow,
	selectedRows,
	tableName,
	masked,
	ensureRowSelectionForContextMenu,
	setEditValue,
	onFKNavigate,
	virtualRows,
	totalVirtualSize
}: GridBodyProps) {
	// Determine which rows to actually render
	const rowIndexesToRender: number[] = virtualRows
		? virtualRows.map(function (vr) {
				return vr.index
			})
		: rows.map(function (_, i) {
				return i
			})

	const topPad = virtualRows && virtualRows.length > 0 ? virtualRows[0].start : 0
	const bottomPad =
		virtualRows && virtualRows.length > 0 && totalVirtualSize
			? totalVirtualSize -
				(virtualRows[virtualRows.length - 1].start + virtualRows[virtualRows.length - 1].size)
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

			{rowIndexesToRender.map(function (rowIndex) {
				const isEditingRow = editingCell?.rowIndex === rowIndex

				return (
					<React.Fragment key={rowIndex}>
						<GridRow
							row={rows[rowIndex]}
							rowIndex={rowIndex}
							columns={columns}
							allRows={rows}
							tableName={tableName}
							masked={masked}
							selectedRows={selectedRows}
							isRowSelected={selectedRows.has(rowIndex)}
							rowSelectedCols={selectedCellsByRow.get(rowIndex)}
							focusedCol={focusedCell?.row === rowIndex ? focusedCell.col : null}
							editingColumnName={isEditingRow ? editingCell.columnName : null}
							editValue={isEditingRow ? editValue : ''}
							pendingEdits={pendingEdits}
							primaryKeyColumnName={primaryKeyColumnName}
							getColumnWidth={getColumnWidth}
							editInputRef={editInputRef}
							handleCellContextMenuChange={handleCellContextMenuChange}
							handleCellDoubleClick={handleCellDoubleClick}
							handleCellMouseDown={handleCellMouseDown}
							handleCellMouseEnter={handleCellMouseEnter}
							handleEditKeyDown={handleEditKeyDown}
							handleEditBlur={handleEditBlur}
							handleSelectCommit={handleSelectCommit}
							handleRowClick={handleRowClick}
							handleRowContextMenuChange={handleRowContextMenuChange}
							onBatchCellEdit={onBatchCellEdit}
							onCellEdit={onCellEdit}
							onFilterAdd={onFilterAdd}
							onBlobAction={onBlobAction}
							onRowAction={onRowAction}
							onRowSelect={onRowSelect}
							ensureRowSelectionForContextMenu={ensureRowSelectionForContextMenu}
							setEditValue={setEditValue}
							onFKNavigate={onFKNavigate}
						/>
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
