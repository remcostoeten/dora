import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useShortcut, useEffectiveShortcuts, useActiveScope } from '@/core/shortcuts'
import { cn } from '@/shared/utils/cn'
import { ColumnDefinition, SortDescriptor, FilterDescriptor } from '../types'
import { NoColumnsState } from './data-grid/empty-states'
import { GridBody } from './data-grid/grid-body'
import { GridHeader } from './data-grid/grid-header'
import { getCellsInRectangle } from './data-grid/selection'
import { CellPosition, ContextMenuState } from './data-grid/types'
import { useCellEditing } from './data-grid/use-cell-editing'
import { useCellSelection } from './data-grid/use-cell-selection'
import { useContextMenuReporting } from './data-grid/use-context-menu-reporting'
import { useFocusedCell } from './data-grid/use-focused-cell'
import { useGridKeyboard } from './data-grid/use-grid-keyboard'
import { useRightDragScroll } from './data-grid/use-right-drag-scroll'
import { useRowSelection } from './data-grid/use-row-selection'
import {
	DEFAULT_COLUMN_WIDTH,
	MIN_COLUMN_WIDTH,
	useColumnResize
} from './data-grid/use-column-resize'
import { RowAction } from './row-context-menu'
import { ScrollHint } from './scroll-hint'
import { useRowVirtualizer } from './data-grid/use-row-virtualizer'

export type { ContextMenuState }

type Props = {
	columns: ColumnDefinition[]
	rows: Record<string, unknown>[]
	selectedRows: Set<number>
	onRowSelect: (rowIndex: number, checked: boolean) => void
	onRowsSelect?: (rowIndices: number[], checked: boolean) => void
	onSelectAll: (checked: boolean) => void
	sort?: SortDescriptor
	onSortChange?: (sort: SortDescriptor | undefined) => void
	onFilterAdd?: (filter: FilterDescriptor) => void
	onCellEdit?: (rowIndex: number, columnName: string, newValue: unknown) => void
	onBatchCellEdit?: (rowIndexes: number[], columnName: string, newValue: unknown) => void
	onRowAction?: (
		action: RowAction,
		row: Record<string, unknown>,
		rowIndex: number,
		batchIndexes?: number[]
	) => void
	tableName?: string
	selectedCells?: Set<string>
	onCellSelectionChange?: (cells: Set<string>) => void
	initialFocusedCell?: { row: number; col: number } | null
	onFocusedCellChange?: (cell: { row: number; col: number } | null) => void
	onContextMenuChange?: (ctx: ContextMenuState) => void
	draftRow?: Record<string, unknown> | null
	onDraftChange?: (columnName: string, value: unknown) => void
	onDraftSave?: () => void
	onDraftCancel?: () => void
	pendingEdits?: Set<string>
	draftInsertIndex?: number | null
}

export function DataGrid({
	columns,
	rows,
	selectedRows,
	onRowSelect,
	onRowsSelect,
	onSelectAll,
	sort,
	onSortChange,
	onFilterAdd,
	onCellEdit,
	onBatchCellEdit,
	onRowAction,
	tableName,
	selectedCells: externalSelectedCells,
	onCellSelectionChange,
	initialFocusedCell,
	onFocusedCellChange,
	onContextMenuChange,
	draftRow,
	onDraftChange,
	onDraftSave,
	onDraftCancel,
	pendingEdits,
	draftInsertIndex
}: Props) {
	const lastClickedRowRef = useRef<number | null>(null)

	const { resizingColumn, getColumnWidth, handleResizeStart, handleResizeDoubleClick } =
		useColumnResize()

	const allSelected = rows.length > 0 && selectedRows.size === rows.length
	const someSelected = selectedRows.size > 0 && selectedRows.size < rows.length

	const { focusedCell, setFocusedCell } = useFocusedCell(initialFocusedCell, onFocusedCellChange)

	const gridRef = useRef<HTMLTableElement>(null)
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	const { selectedCellsSet, selectedCellsByRow, updateCellSelection } = useCellSelection(
		externalSelectedCells,
		onCellSelectionChange
	)

	const effectiveSelectedRows = useMemo(() => {
		if (selectedRows.size > 0) return selectedRows
		if (focusedCell) return new Set([focusedCell.row])
		return new Set<number>()
	}, [selectedRows, focusedCell])

	const primaryKeyColumnName = useMemo(() => {
		return columns.find(function (c) {
			return c.primaryKey
		})?.name
	}, [columns])
	const [anchorCell, setAnchorCell] = useState<CellPosition | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [dragStart, setDragStart] = useState<CellPosition | null>(null)

	const { hasRightDraggedRef, isRightDragging, handleRightDragStart } =
		useRightDragScroll(scrollContainerRef)

	// Virtualize when we have > 100 rows — zero overhead for small datasets
	const VIRTUALIZE_THRESHOLD = 100
	const { virtualRows, totalSize } = useRowVirtualizer({
		scrollContainerRef,
		rowCount: rows.length,
		enabled: rows.length > VIRTUALIZE_THRESHOLD,
	})

	const {
		editingCell,
		setEditingCell,
		editValue,
		setEditValue,
		editInputRef,
		handleCellDoubleClick,
		handleSaveEdit,
		handleEditKeyDown
	} = useCellEditing({
		columns,
		gridRef,
		onCellEdit,
		rows,
		setAnchorCell,
		setFocusedCell,
		updateCellSelection
	})

	const { handleCellContextMenuChange, handleRowContextMenuChange, handleContextMenuCapture } =
		useContextMenuReporting(onContextMenuChange)

	function handleCellMouseDown(e: React.MouseEvent, rowIndex: number, colIndex: number) {
		if (e.button !== 0) return
		if (editingCell) {
			// Clicking another cell while editing – commit the in-flight edit
			// then fall through so the new cell gets focused.
			handleSaveEdit()
		}

		// Simplified logic: Just set focus and let event bubble to row for selection
		const cellPos: CellPosition = { row: rowIndex, col: colIndex }
		setFocusedCell(cellPos)
		setAnchorCell(cellPos)
	}

	const { handleRowClick, ensureRowSelectionForContextMenu } = useRowSelection({
		lastClickedRowRef,
		onRowSelect,
		onRowsSelect,
		onSelectAll,
		selectedRows
	})

	useEffect(
		function keepFocusedCellInView() {
			if (!focusedCell || !gridRef.current) return
			const targetCell = gridRef.current.querySelector(
				`[data-cell-key="${focusedCell.row}:${focusedCell.col}"]`
			) as HTMLElement | null
			if (targetCell) {
				targetCell.scrollIntoView({
					block: 'nearest',
					inline: 'nearest'
				})
			}
		},
		[focusedCell]
	)

	function handleCellMouseEnter(rowIndex: number, colIndex: number) {
		if (!isDragging || !dragStart) return

		const cellPos: CellPosition = { row: rowIndex, col: colIndex }
		const rangeCells = getCellsInRectangle(dragStart, cellPos)
		updateCellSelection(rangeCells)
	}

	useEffect(
		function () {
			if (!isDragging) return

			function handleMouseUp() {
				setIsDragging(false)
				setDragStart(null)
			}

			document.addEventListener('mouseup', handleMouseUp)
			return function () {
				document.removeEventListener('mouseup', handleMouseUp)
			}
		},
		[isDragging]
	)

	/* ... existing code ... */
	const shortcuts = useEffectiveShortcuts()
	const $ = useShortcut()
	useActiveScope($, 'data-grid')

	$.bind(shortcuts.selectAll.combo)
		.except('typing')
		.on(
			function () {
				onSelectAll(!allSelected)
			},
			{ description: shortcuts.selectAll.description }
		)

	$.bind(shortcuts.deselect.combo)
		.except('typing')
		.on(
			function () {
				if (selectedRows.size > 0) {
					onSelectAll(false)
				}
			},
			{ description: shortcuts.deselect.description }
		)

	function handleSort(columnName: string) {
		if (!onSortChange) return

		if (sort?.column === columnName) {
			if (sort.direction === 'asc') {
				onSortChange({ column: columnName, direction: 'desc' })
			} else {
				onSortChange(undefined)
			}
		} else {
			onSortChange({ column: columnName, direction: 'asc' })
		}
	}

	const handleGridKeyDown = useGridKeyboard({
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
		startCellEdit: handleCellDoubleClick,
		updateCellSelection
	})

	if (columns.length === 0) {
		return <NoColumnsState />
	}

	return (
		<div className='relative h-full w-full overflow-hidden'>
			<div
				ref={scrollContainerRef}
				className={cn(
					'h-full w-full overflow-auto',
					isRightDragging && 'cursor-grabbing select-none'
				)}
				style={{ scrollbarGutter: 'stable' }}
				onContextMenuCapture={function (e) {
					if (hasRightDraggedRef.current) {
						e.preventDefault()
						e.stopPropagation()
						return
					}
					handleContextMenuCapture(e)
				}}
				onMouseDown={function (e) {
					handleRightDragStart(e)
				}}
				onWheel={function (e) {
					if (e.shiftKey) {
						e.preventDefault()
						e.currentTarget.scrollLeft += e.deltaY
					}
				}}
			>
				<table
					ref={gridRef}
					className='text-sm border-collapse select-none'
					style={{ tableLayout: 'auto', minWidth: '100%' }}
					role='grid'
					aria-label={tableName ? `Data grid for ${tableName}` : 'Data grid'}
					aria-rowcount={rows.length}
					aria-colcount={columns.length + 1}
					tabIndex={0}
					onKeyDown={handleGridKeyDown}
				>
					<colgroup>
						<col style={{ width: 30, minWidth: 30 }} />
						{columns.map(function (col) {
							const width = getColumnWidth(col.name)
							return (
								<col
									key={col.name}
									style={{
										width: width || DEFAULT_COLUMN_WIDTH,
										minWidth: MIN_COLUMN_WIDTH
									}}
								/>
							)
						})}
					</colgroup>
					<GridHeader
						allSelected={allSelected}
						columns={columns}
						getColumnWidth={getColumnWidth}
						onResizeDoubleClick={handleResizeDoubleClick}
						onResizeStart={handleResizeStart}
						onSelectAll={onSelectAll}
						onSort={handleSort}
						resizingColumn={resizingColumn}
						someSelected={someSelected}
						sort={sort}
					/>
					<GridBody
						columns={columns}
						draftInsertIndex={draftInsertIndex}
						draftRow={draftRow}
						editInputRef={editInputRef}
						editingCell={editingCell}
						editValue={editValue}
						effectiveSelectedRows={effectiveSelectedRows}
						focusedCell={focusedCell}
						getColumnWidth={getColumnWidth}
						handleCellContextMenuChange={handleCellContextMenuChange}
						handleCellDoubleClick={handleCellDoubleClick}
						handleCellMouseDown={handleCellMouseDown}
						handleCellMouseEnter={handleCellMouseEnter}
						handleEditKeyDown={handleEditKeyDown}
						handleRowClick={handleRowClick}
						handleRowContextMenuChange={handleRowContextMenuChange}
						handleSaveEdit={handleSaveEdit}
						onBatchCellEdit={onBatchCellEdit}
						onCellEdit={onCellEdit}
						onDraftCancel={onDraftCancel}
						onDraftChange={onDraftChange}
						onDraftSave={onDraftSave}
						onFilterAdd={onFilterAdd}
						onRowAction={onRowAction}
						onRowSelect={onRowSelect}
						pendingEdits={pendingEdits}
						primaryKeyColumnName={primaryKeyColumnName}
						rows={rows}
						selectedCellsByRow={selectedCellsByRow}
						selectedRows={selectedRows}
						tableName={tableName}
							ensureRowSelectionForContextMenu={ensureRowSelectionForContextMenu}
						setEditValue={setEditValue}
						virtualRows={virtualRows}
						totalVirtualSize={totalSize}
					/>
				</table>
			</div>
			<ScrollHint containerRef={scrollContainerRef} />
		</div>
	)
}
