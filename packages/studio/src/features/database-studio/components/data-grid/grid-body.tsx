import React, { memo } from 'react'
import type { VirtualItem } from '@tanstack/react-virtual'
import { Checkbox } from '@studio/shared/ui/checkbox'
import { cn } from '@studio/shared/utils/cn'
import { ColumnDefinition } from '../../types'
import { formatCellValue } from './cell-value'
import { DraftRow } from './draft-row'
import { NoRowsState } from './empty-states'
import { FKNavigateIcon } from './fk-icon'
import { EditingCell } from './types'

type GridRowProps = {
	row: Record<string, unknown>
	rowIndex: number
	columns: ColumnDefinition[]
	masked?: boolean
	isRowSelected: boolean
	/** Inserted moments ago; tinted until the highlight times out. */
	isRowRecentlyAdded: boolean
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
	onCellContextMenu: (rowIndex: number, colIndex: number) => void
	onRowContextMenu: (rowIndex: number) => void
	handleCellDoubleClick: (rowIndex: number, columnName: string, currentValue: unknown) => void
	handleCellMouseDown: (e: React.MouseEvent, rowIndex: number, colIndex: number) => void
	handleCellMouseEnter: (rowIndex: number, colIndex: number) => void
	handleEditKeyDown: (e: React.KeyboardEvent) => void
	handleEditBlur: () => void
	handleSelectCommit: (value: string) => void
	handleRowClick: (e: React.MouseEvent, rowIndex: number) => void
	onRowSelect: (rowIndex: number, checked: boolean) => void
	setEditValue: (value: string) => void
	onFKNavigate?: (referencedTable: string, referencedColumn: string, value: unknown) => void
	measureRow?: (element: HTMLTableRowElement | null) => void
}

/**
 * One data row, memoized so grid-level state churn (editing keystrokes, focus
 * moves, drag selection) only re-renders the rows it touches instead of every
 * visible cell. Context menus are not rendered here: a cell only arms the
 * grid's shared menu from `onContextMenu`.
 */
const GridRow = memo(function GridRow({
	row,
	rowIndex,
	columns,
	masked,
	isRowSelected,
	isRowRecentlyAdded,
	rowSelectedCols,
	focusedCol,
	editingColumnName,
	editValue,
	pendingEdits,
	primaryKeyColumnName,
	getColumnWidth,
	editInputRef,
	onCellContextMenu,
	onRowContextMenu,
	handleCellDoubleClick,
	handleCellMouseDown,
	handleCellMouseEnter,
	handleEditKeyDown,
	handleEditBlur,
	handleSelectCommit,
	handleRowClick,
	onRowSelect,
	setEditValue,
	onFKNavigate,
	measureRow
}: GridRowProps) {
	const rowBackgroundClasses = isRowSelected
		? 'bg-primary/10'
		: isRowRecentlyAdded
			? 'bg-emerald-500/10 hover:bg-emerald-500/20'
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
	// The row tint can't reach the opaque sticky cell, so a new row is marked
	// there with a solid gutter bar that stays visible during horizontal scroll.
	const stickyCellAccentClasses = isRowRecentlyAdded
		? 'shadow-[inset_3px_0_0_0_var(--color-emerald-500)]'
		: undefined

	return (
		<tr
			ref={measureRow}
			data-index={rowIndex}
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
					stickyCellBackgroundClasses,
					stickyCellAccentClasses
				)}
				role='gridcell'
				onContextMenu={function () {
					onRowContextMenu(rowIndex)
				}}
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
					<td
						key={col.name}
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
						onContextMenu={function () {
							onCellContextMenu(rowIndex, colIndex)
						}}
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
				)
			})}
		</tr>
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
	onCellContextMenu: (rowIndex: number, colIndex: number) => void
	onRowContextMenu: (rowIndex: number) => void
	handleCellDoubleClick: (rowIndex: number, columnName: string, currentValue: unknown) => void
	handleCellMouseDown: (e: React.MouseEvent, rowIndex: number, colIndex: number) => void
	handleCellMouseEnter: (rowIndex: number, colIndex: number) => void
	handleEditKeyDown: (e: React.KeyboardEvent) => void
	handleEditBlur: () => void
	handleSelectCommit: (value: string) => void
	handleRowClick: (e: React.MouseEvent, rowIndex: number) => void
	onDraftCancel?: () => void
	onDraftChange?: (columnName: string, value: unknown) => void
	onDraftSave?: () => void
	onRowSelect: (rowIndex: number, checked: boolean) => void
	pendingEdits?: Set<string>
	primaryKeyColumnName?: string
	rows: Record<string, unknown>[]
	selectedCellsByRow: Map<number, Set<number>>
	selectedRows: Set<number>
	/** Row indexes inserted moments ago, tinted until the highlight times out. */
	highlightedRows?: ReadonlySet<number>
	/** Privacy mode: mask every cell value and disable editing. */
	masked?: boolean
	setEditValue: (value: string) => void
	onFKNavigate?: (referencedTable: string, referencedColumn: string, value: unknown) => void
	/** Pass virtual rows from useRowVirtualizer. Null = render all (non-virtual). */
	virtualRows?: VirtualItem[] | null
	/** Total scroll height when virtualizing. */
	totalVirtualSize?: number | null
	measureRow?: (element: HTMLTableRowElement | null) => void
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
	onCellContextMenu,
	onRowContextMenu,
	handleCellDoubleClick,
	handleCellMouseDown,
	handleCellMouseEnter,
	handleEditKeyDown,
	handleEditBlur,
	handleSelectCommit,
	handleRowClick,
	onDraftCancel,
	onDraftChange,
	onDraftSave,
	onRowSelect,
	pendingEdits,
	primaryKeyColumnName,
	rows,
	selectedCellsByRow,
	selectedRows,
	highlightedRows,
	masked,
	setEditValue,
	onFKNavigate,
	virtualRows,
	totalVirtualSize,
	measureRow
}: GridBodyProps) {
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
				(virtualRows[virtualRows.length - 1].start +
					virtualRows[virtualRows.length - 1].size)
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
							masked={masked}
							isRowSelected={selectedRows.has(rowIndex)}
							isRowRecentlyAdded={highlightedRows?.has(rowIndex) ?? false}
							rowSelectedCols={selectedCellsByRow.get(rowIndex)}
							focusedCol={focusedCell?.row === rowIndex ? focusedCell.col : null}
							editingColumnName={isEditingRow ? editingCell.columnName : null}
							editValue={isEditingRow ? editValue : ''}
							pendingEdits={pendingEdits}
							primaryKeyColumnName={primaryKeyColumnName}
							getColumnWidth={getColumnWidth}
							editInputRef={editInputRef}
							onCellContextMenu={onCellContextMenu}
							onRowContextMenu={onRowContextMenu}
							handleCellDoubleClick={handleCellDoubleClick}
							handleCellMouseDown={handleCellMouseDown}
							handleCellMouseEnter={handleCellMouseEnter}
							handleEditKeyDown={handleEditKeyDown}
							handleEditBlur={handleEditBlur}
							handleSelectCommit={handleSelectCommit}
							handleRowClick={handleRowClick}
							onRowSelect={onRowSelect}
							setEditValue={setEditValue}
							onFKNavigate={onFKNavigate}
							measureRow={measureRow}
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
			{bottomPad > 0 && (
				<tr style={{ height: bottomPad }}>
					<td colSpan={columns.length + 1} />
				</tr>
			)}

			{rows.length === 0 && <NoRowsState colSpan={columns.length + 1} />}
		</tbody>
	)
}
