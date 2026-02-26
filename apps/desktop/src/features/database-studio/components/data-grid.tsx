import { ArrowDown, ArrowUp, ArrowUpDown, Database, Check, X } from 'lucide-react'
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useShortcut, useEffectiveShortcuts } from '@/core/shortcuts'
import { Checkbox } from '@/shared/ui/checkbox'
import { cn } from '@/shared/utils/cn'
import { ColumnDefinition, SortDescriptor, FilterDescriptor } from '../types'
import { CellContextMenu } from './cell-context-menu'
import { DateCell } from './cells/date-cell'
import { IpCell } from './cells/ip-cell'
import { TokenCell } from './cells/token-cell'
import { RowContextMenu, RowAction } from './row-context-menu'
import { ScrollHint } from './scroll-hint'

type EditingCell = {
	rowIndex: number
	columnName: string
}

type CellPosition = {
	row: number
	col: number
}

type ContextMenuState = {
	kind: 'cell' | 'row'
	cell: { row: number; col: number }
	x: number
	y: number
} | null

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
	onRowAction?: (action: RowAction, row: Record<string, unknown>, rowIndex: number) => void
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

const MIN_COLUMN_WIDTH = 100
const DEFAULT_COLUMN_WIDTH = 150

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
	const [editingCell, setEditingCell] = useState<EditingCell | null>(null)
	const [editValue, setEditValue] = useState<string>('')
	const editInputRef = useRef<HTMLInputElement>(null)

	const lastClickedRowRef = useRef<number | null>(null)

	const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
	const [resizingColumn, setResizingColumn] = useState<string | null>(null)
	const startXRef = useRef(0)
	const startWidthRef = useRef(0)

	const allSelected = rows.length > 0 && selectedRows.size === rows.length
	const someSelected = selectedRows.size > 0 && selectedRows.size < rows.length

	const [focusedCell, setFocusedCellInternal] = useState<{ row: number; col: number } | null>(
		initialFocusedCell ?? null
	)

	useEffect(() => {
		if (
			initialFocusedCell &&
			(!focusedCell ||
				focusedCell.row !== initialFocusedCell.row ||
				focusedCell.col !== initialFocusedCell.col)
		) {
			setFocusedCellInternal(initialFocusedCell)
			return
		}

		if (!initialFocusedCell && focusedCell) {
			setFocusedCellInternal(null)
		}
	}, [initialFocusedCell, focusedCell])

	const gridRef = useRef<HTMLTableElement>(null)
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	const [internalSelectedCells, setInternalSelectedCells] = useState<Set<string>>(new Set())
	const selectedCellsSet = externalSelectedCells ?? internalSelectedCells
	const selectedCellsByRow = useMemo(() => {
		const byRow = new Map<number, Set<number>>()
		for (const key of selectedCellsSet) {
			const [rowPart, colPart] = key.split(':')
			const rowIndex = Number(rowPart)
			const colIndex = Number(colPart)
			if (Number.isNaN(rowIndex) || Number.isNaN(colIndex)) continue
			const current = byRow.get(rowIndex)
			if (current) {
				current.add(colIndex)
			} else {
				byRow.set(rowIndex, new Set([colIndex]))
			}
		}
		return byRow
	}, [selectedCellsSet])

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

	// Right-click drag state
	const [isRightDragging, setIsRightDragging] = useState(false)
	const rightDragStartRef = useRef<{ x: number; scrollLeft: number } | null>(null)
	const hasRightDraggedRef = useRef(false)
	const pendingNavFrameRef = useRef<number | null>(null)

	function setFocusedCell(cell: { row: number; col: number } | null) {
		setFocusedCellInternal(cell)
		if (onFocusedCellChange) {
			onFocusedCellChange(cell)
		}
	}

	function updateCellSelection(cells: Set<string>) {
		if (onCellSelectionChange) {
			onCellSelectionChange(cells)
		} else {
			setInternalSelectedCells(cells)
		}
	}

	const lastContextMenuCoordsRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

	function handleCellContextMenuChange(open: boolean, row: number, col: number) {
		if (onContextMenuChange) {
			if (open) {
				onContextMenuChange({
					kind: 'cell',
					cell: { row, col },
					x: lastContextMenuCoordsRef.current.x,
					y: lastContextMenuCoordsRef.current.y
				})
			} else {
				onContextMenuChange(null)
			}
		}
	}

	function handleRowContextMenuChange(open: boolean, row: number) {
		if (onContextMenuChange) {
			if (open) {
				onContextMenuChange({
					kind: 'row',
					cell: { row, col: 0 },
					x: lastContextMenuCoordsRef.current.x,
					y: lastContextMenuCoordsRef.current.y
				})
			} else {
				onContextMenuChange(null)
			}
		}
	}

	function handleContextMenuCapture(e: React.MouseEvent) {
		lastContextMenuCoordsRef.current = { x: e.clientX, y: e.clientY }
	}

	function getCellKey(row: number, col: number): string {
		return `${row}:${col}`
	}

	function getCellsInRectangle(start: CellPosition, end: CellPosition): Set<string> {
		const minRow = Math.min(start.row, end.row)
		const maxRow = Math.max(start.row, end.row)
		const minCol = Math.min(start.col, end.col)
		const maxCol = Math.max(start.col, end.col)

		const cells = new Set<string>()
		for (let r = minRow; r <= maxRow; r++) {
			for (let c = minCol; c <= maxCol; c++) {
				cells.add(getCellKey(r, c))
			}
		}
		return cells
	}

	function handleCellMouseDown(e: React.MouseEvent, rowIndex: number, colIndex: number) {
		if (e.button !== 0) return
		if (editingCell) return

		// Simplified logic: Just set focus and let event bubble to row for selection
		const cellPos: CellPosition = { row: rowIndex, col: colIndex }
		setFocusedCell(cellPos)
		setAnchorCell(cellPos)
	}

	useEffect(
		function cleanupPendingFrame() {
			return function () {
				if (pendingNavFrameRef.current !== null) {
					cancelAnimationFrame(pendingNavFrameRef.current)
				}
			}
		},
		[]
	)

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

	const handleRowClick = useCallback(
		function (e: React.MouseEvent, rowIndex: number) {
			if (e.button !== 0) return

			if (e.shiftKey) {
				e.preventDefault()
			}

			if (e.shiftKey && lastClickedRowRef.current !== null && onRowsSelect) {
				const start = Math.min(lastClickedRowRef.current, rowIndex)
				const end = Math.max(lastClickedRowRef.current, rowIndex)
				const range = []
				for (let i = start; i <= end; i++) {
					range.push(i)
				}
				onRowsSelect(range, true)
			} else if (e.ctrlKey || e.metaKey) {
				onRowSelect(rowIndex, !selectedRows.has(rowIndex))
				lastClickedRowRef.current = rowIndex
			} else {
				// Single click only updates the anchor for range selection, does NOT select the row
				lastClickedRowRef.current = rowIndex
			}
		},
		[selectedRows, onRowSelect, onRowsSelect]
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

	function getColumnWidth(colName: string) {
		return columnWidths[colName]
	}

	const handleResizeStart = useCallback(
		function (e: React.MouseEvent, columnName: string) {
			e.preventDefault()
			e.stopPropagation()

			setResizingColumn(columnName)
			startXRef.current = e.clientX

			const currentWidth = columnWidths[columnName]
			if (typeof currentWidth === 'number') {
				startWidthRef.current = currentWidth
			} else {
				const th = (e.target as HTMLElement).closest('th')
				startWidthRef.current = th?.getBoundingClientRect().width ?? DEFAULT_COLUMN_WIDTH
			}
		},
		[columnWidths]
	)

	// Handle mouse move during resize
	useEffect(
		function () {
			if (!resizingColumn) return

			const handleMouseMove = function (e: MouseEvent) {
				const delta = e.clientX - startXRef.current
				const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidthRef.current + delta)

				setColumnWidths(function (prev) {
					return {
						...prev,
						[resizingColumn]: newWidth
					}
				})
			}

			const handleMouseUp = function () {
				setResizingColumn(null)
			}

			document.addEventListener('mousemove', handleMouseMove)
			document.addEventListener('mouseup', handleMouseUp)

			return function () {
				document.removeEventListener('mousemove', handleMouseMove)
				document.removeEventListener('mouseup', handleMouseUp)
			}
		},
		[resizingColumn]
	)

	const handleResizeDoubleClick = useCallback(function (
		e: React.MouseEvent,
		columnName: string,
		columnType?: string
	) {
		e.preventDefault()
		e.stopPropagation()

		const canvas = document.createElement('canvas')
		const ctx = canvas.getContext('2d')
		if (!ctx) {
			setColumnWidths(function (prev) {
				const next = { ...prev }
				delete next[columnName]
				return next
			})
			return
		}

		ctx.font = '12px Inter, system-ui, sans-serif'
		const nameWidth = ctx.measureText(columnName).width

		let typeWidth = 0
		if (columnType && columnType !== 'unknown') {
			ctx.font = "10px 'JetBrains Mono', monospace"
			typeWidth = ctx.measureText(columnType).width
		}

		const sortIconWidth = 16
		const padding = 32
		const gap = typeWidth > 0 ? 8 : 0
		const optimalWidth = Math.ceil(nameWidth + typeWidth + sortIconWidth + padding + gap)
		const finalWidth = Math.max(MIN_COLUMN_WIDTH, optimalWidth)

		setColumnWidths(function (prev) {
			return { ...prev, [columnName]: finalWidth }
		})
	}, [])

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
			if (editingCell && onCellEdit) {
				onCellEdit(editingCell.rowIndex, editingCell.columnName, editValue)
			}
			setEditingCell(null)
			setEditValue('')
		},
		[editingCell, editValue, onCellEdit]
	)

	const handleCancelEdit = useCallback(function () {
		setEditingCell(null)
		setEditValue('')
	}, [])

	const handleEditKeyDown = useCallback(
		function (e: React.KeyboardEvent) {
			if (e.key === 'Enter') {
				e.preventDefault()
				handleSaveEdit()
			} else if (e.key === 'Escape') {
				e.preventDefault()
				handleCancelEdit()
			}
		},
		[handleSaveEdit, handleCancelEdit]
	)

	// Focus input when editing cell changes
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

	const handleGridKeyDown = useCallback(
		function (e: React.KeyboardEvent) {
			if (!focusedCell) return
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
						const rangeCells = getCellsInRectangle(anchorCell, newPos)
						updateCellSelection(rangeCells)
					} else if (!e.shiftKey) {
						setAnchorCell(newPos)
						updateCellSelection(new Set([getCellKey(newRow, newCol)]))
					}
					pendingNavFrameRef.current = null
				})
			}

			switch (e.key) {
				case 'ArrowUp':
					e.preventDefault()
					if (row > 0) moveAndMaybeSelect(row - 1, col)
					break
				case 'ArrowDown':
					e.preventDefault()
					if (row < maxRow) moveAndMaybeSelect(row + 1, col)
					break
				case 'ArrowLeft':
					e.preventDefault()
					if (col > 0) moveAndMaybeSelect(row, col - 1)
					break
				case 'ArrowRight':
					e.preventDefault()
					if (col < maxCol) moveAndMaybeSelect(row, col + 1)
					break
				case 'Tab':
					e.preventDefault()
					if (e.shiftKey) {
						if (col > 0) {
							moveAndMaybeSelect(row, col - 1)
						} else if (row > 0) {
							moveAndMaybeSelect(row - 1, maxCol)
						}
					} else {
						if (col < maxCol) {
							moveAndMaybeSelect(row, col + 1)
						} else if (row < maxRow) {
							moveAndMaybeSelect(row + 1, 0)
						}
					}
					break
				case 'Enter':
					e.preventDefault()
					handleCellDoubleClick(row, columns[col].name, rows[row][columns[col].name])
					break
				case 'Escape':
					e.preventDefault()
					if (pendingNavFrameRef.current !== null) {
						cancelAnimationFrame(pendingNavFrameRef.current)
						pendingNavFrameRef.current = null
					}
					setFocusedCell(null)
					updateCellSelection(new Set())
					break
				case ' ':
					e.preventDefault()
					onRowSelect(row, !selectedRows.has(row))
					break
				case 'c':
					if (e.ctrlKey || e.metaKey) {
						e.preventDefault()
						if (selectedCellsSet.size > 0) {
							const cellsArray = Array.from(selectedCellsSet).map(function (key) {
								const [r, c] = key.split(':').map(Number)
								return { row: r, col: c }
							})
							cellsArray.sort(function (a, b) {
								return a.row === b.row ? a.col - b.col : a.row - b.row
							})
							const minRow = Math.min(...cellsArray.map(function (c) { return c.row }))
							const maxRow = Math.max(...cellsArray.map(function (c) { return c.row }))
							const rowData: string[][] = []
							for (let r = minRow; r <= maxRow; r++) {
								const rowCells = cellsArray.filter(function (c) { return c.row === r })
								const values = rowCells.map(function (cell) {
									const value = rows[cell.row][columns[cell.col].name]
									return value === null || value === undefined ? '' : String(value)
								})
								rowData.push(values)
							}
							const clipboardText = rowData.map(function (r) { return r.join('\t') }).join('\n')
							navigator.clipboard.writeText(clipboardText)
						} else if (focusedCell) {
							const value = rows[focusedCell.row][columns[focusedCell.col].name]
							const text = value === null || value === undefined ? '' : String(value)
							navigator.clipboard.writeText(text)
						}
					}
					break
				case 'v':
					if ((e.ctrlKey || e.metaKey) && focusedCell && onCellEdit) {
						e.preventDefault()
						navigator.clipboard.readText().then(function (clipboardText) {
							if (!clipboardText || !focusedCell) return
							const pasteRows = clipboardText.split('\n').map(function (line) {
								return line.split('\t')
							})
							pasteRows.forEach(function (pasteRow, pasteRowIndex) {
								const targetRow = focusedCell.row + pasteRowIndex
								if (targetRow >= rows.length) return
								pasteRow.forEach(function (pasteValue, pasteColIndex) {
									const targetCol = focusedCell.col + pasteColIndex
									if (targetCol >= columns.length) return
									onCellEdit!(targetRow, columns[targetCol].name, pasteValue)
								})
							})
						}).catch(function () {
							// Clipboard read unavailable — no-op
						})
					}
					break
			}
		},
		[
			focusedCell,
			editingCell,
			rows,
			columns,
			handleCellDoubleClick,
			onRowSelect,
			selectedRows,
			anchorCell,
			selectedCellsSet
		]
	)

	function handleRightDragValues(e: React.MouseEvent | MouseEvent) {
		if (!rightDragStartRef.current || !scrollContainerRef.current) return

		const delta = rightDragStartRef.current.x - e.clientX
		if (Math.abs(delta) > 5) {
			hasRightDraggedRef.current = true
		}

		if (hasRightDraggedRef.current) {
			scrollContainerRef.current.scrollLeft = rightDragStartRef.current.scrollLeft + delta
		}
	}

	useEffect(() => {
		if (!isRightDragging) return

		function handleGlobalMouseMove(e: MouseEvent) {
			handleRightDragValues(e)
		}

		function handleGlobalMouseUp(e: MouseEvent) {
			if (isRightDragging) {
				setIsRightDragging(false)
				rightDragStartRef.current = null
				// We don't reset hasRightDragged yet because we need it for onContextMenu prevention
				setTimeout(() => {
					hasRightDraggedRef.current = false
				}, 50)
			}
		}

		document.addEventListener('mousemove', handleGlobalMouseMove)
		document.addEventListener('mouseup', handleGlobalMouseUp)

		return () => {
			document.removeEventListener('mousemove', handleGlobalMouseMove)
			document.removeEventListener('mouseup', handleGlobalMouseUp)
		}
	}, [isRightDragging])

	if (columns.length === 0) {
		return (
			<div className='flex flex-col items-center justify-center h-full gap-4 p-8'>
				<div className='flex h-16 w-16 items-center justify-center rounded-full bg-muted/50'>
					<svg
						className='h-8 w-8 text-muted-foreground/60'
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth={1.5}
						stroke='currentColor'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5'
						/>
					</svg>
				</div>
				<div className='text-center space-y-1.5'>
					<h3 className='text-sm font-medium text-foreground'>No columns found</h3>
					<p className='text-xs text-muted-foreground max-w-[280px]'>
						This table doesn't have any columns defined yet, or the schema couldn't be loaded.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className='relative h-full w-full'>
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
					if (e.button === 2) {
						// Right click
						if (scrollContainerRef.current) {
							setIsRightDragging(true)
							rightDragStartRef.current = {
								x: e.clientX,
								scrollLeft: scrollContainerRef.current.scrollLeft
							}
							hasRightDraggedRef.current = false
						}
					}
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
					<thead className='sticky top-0 bg-sidebar z-10' role='rowgroup'>
						<tr role='row'>
							{/* Checkbox column */}
							<th
								className='px-4 py-2 text-center border-b border-r border-sidebar-border bg-background sticky left-0 z-30'
								role='columnheader'
								aria-label='Select all rows'
							>
								<Checkbox
									checked={someSelected ? 'indeterminate' : allSelected}
									onCheckedChange={function (checked) {
										onSelectAll(!!checked)
									}}
									className='h-4 w-4'
									aria-label={
										allSelected ? 'Deselect all rows' : 'Select all rows'
									}
								/>
							</th>
							{/* Data columns */}
							{columns.map(function (col) {
								const isSorted = sort?.column === col.name
								const width = getColumnWidth(col.name)

								return (
									<th
										key={col.name}
										className={cn(
											'text-left font-medium border-b border-r border-sidebar-border bg-sidebar-accent/50 last:border-r-0 h-9 cursor-pointer transition-colors hover:bg-sidebar-accent relative select-none min-w-[60px]',
											isSorted && 'bg-sidebar-accent',
											resizingColumn === col.name && 'bg-sidebar-accent'
										)}
										style={width ? { width } : undefined}
										onClick={function () {
											handleSort(col.name)
										}}
									>
										<div className='flex items-center gap-1.5 justify-between group px-3 py-2 overflow-hidden'>
											<div className='flex items-center gap-1.5 overflow-hidden min-w-0'>
												<span className='text-foreground text-xs shrink-0'>
													{col.name}
												</span>
												{col.type && col.type !== 'unknown' && (
													<span className='text-muted-foreground/50 text-[10px] font-normal font-mono lowercase truncate min-w-0'>
														{col.type}
													</span>
												)}
											</div>
											{isSorted && sort ? (
												sort.direction === 'asc' ? (
													<ArrowUp className='h-3 w-3 text-primary shrink-0' />
												) : (
													<ArrowDown className='h-3 w-3 text-primary shrink-0' />
												)
											) : (
												<ArrowUpDown className='h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors shrink-0' />
											)}
										</div>

										{/* Resize handle */}
										<div
											className={cn(
												'absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-primary/50 transition-colors',
												resizingColumn === col.name && 'bg-primary'
											)}
											onMouseDown={function (e) {
												handleResizeStart(e, col.name)
											}}
											onDoubleClick={function (e) {
												handleResizeDoubleClick(e, col.name, col.type)
											}}
											onClick={function (e) {
												e.stopPropagation()
											}}
										/>
									</th>
								)
							})}
						</tr>
					</thead>
					<tbody role='rowgroup'>
						{/* Render draft row at TOP if no specific index is provided (-1 or null) */}
						{draftRow &&
							(draftInsertIndex === undefined ||
								draftInsertIndex === null ||
								draftInsertIndex === -1) && (
								<tr className='bg-emerald-500/10 border-l-2 border-l-emerald-500'>
									<td className='px-1 py-1.5 text-center border-b border-r border-sidebar-border'>
										<div className='flex items-center justify-center gap-1'>
											<button
												onClick={onDraftSave}
												className='text-emerald-500 hover:text-emerald-400 text-xs font-medium'
												title='Save (Enter)'
											>
												✓
											</button>
											<button
												onClick={onDraftCancel}
												className='text-muted-foreground hover:text-destructive text-xs'
												title='Cancel (Escape)'
											>
												✕
											</button>
										</div>
									</td>
									{columns.map(function (col, colIndex) {
										const width = getColumnWidth(col.name)
										const isPrimaryKey = col.primaryKey

										return (
											<td
												key={col.name}
												className='border-b border-r border-sidebar-border last:border-r-0 font-mono text-sm px-0 py-0'
												style={width ? { maxWidth: width } : undefined}
											>
												{isPrimaryKey ? (
													<div className='px-3 py-1.5 text-muted-foreground italic text-xs'>
														auto
													</div>
												) : (
													<input
														type='text'
														autoFocus={
															colIndex === 0 ||
															(colIndex === 1 &&
																columns[0]?.primaryKey)
														}
														value={
															draftRow[col.name] === null
																? ''
																: String(draftRow[col.name] ?? '')
														}
														onChange={function (e) {
															onDraftChange?.(
																col.name,
																e.target.value
															)
														}}
														onKeyDown={function (e) {
															if (e.key === 'Enter') {
																e.preventDefault()
																onDraftSave?.()
															} else if (e.key === 'Escape') {
																e.preventDefault()
																onDraftCancel?.()
															}
														}}
														data-no-shortcuts='true'
														className='w-full h-full bg-transparent px-3 py-1.5 outline-none focus:bg-emerald-500/10 font-mono text-sm'
														placeholder={col.nullable ? 'NULL' : ''}
													/>
												)}
											</td>
										)
									})}
								</tr>
							)}

						{rows.map(function (row, rowIndex) {
							const rowClasses = cn(
								'group transition-colors cursor-pointer',
								selectedRows.has(rowIndex)
									? 'bg-primary/10'
									: rowIndex % 2 === 1
										? 'bg-muted/5 hover:bg-sidebar-accent/30'
										: 'hover:bg-sidebar-accent/30'
							)

							return (
								<React.Fragment key={rowIndex}>
									<RowContextMenu
										key={rowIndex}
										row={row}
										rowIndex={rowIndex}
										columns={columns}
										tableName={tableName}
										onAction={function (action, row, index, batchIndexes) {
											// If batchIndexes provided, we might need to handle it.
											// But currently onRowAction signature is (action, row, index).
											// We should update onRowAction to perform batch if needed?
											// OR we can just handle it here if onRowAction doesn't support it.
											// Wait, I updated RowAction signature in previous step? No, just in RowContextMenu.
											// DatabaseStudio expects specific signature.
											// Let's assume onRowAction in DataGrid props needs update or we handle it.
											// DatabaseStudio handleRowAction only takes 3 args.
											// BUT DatabaseStudio has `rowsForActions`.
											// So if we trigger an action from here, DatabaseStudio should use its `rowsForActions` logic?
											// YES. DatabaseStudio's handleRowAction logic should be "if action is batch-able, use rowsForActions".
											// But handleRowAction in DatabaseStudio currently just does single row logic for 'delete' unless via Bulk Delete button.
											// I need to update DatabaseStudio's handleRowAction to also support batch.
											// For now, let's pass the action up.
											onRowAction?.(action, row, rowIndex)
										}}
										onOpenChange={function (open, row) {
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
											tabIndex={0}
											onKeyDown={function (e) {
												if (e.key === ' ' || e.key === 'Enter') {
													e.preventDefault()
													onRowSelect(
														rowIndex,
														!selectedRows.has(rowIndex)
													)
												}
											}}
										>
											<td
												className={cn(
													'px-4 py-1.5 text-center border-b border-r border-sidebar-border sticky left-0 z-20 transition-colors',
													// Sticky cells must stay opaque; otherwise horizontal scroll content bleeds through.
													'group-hover:bg-sidebar-accent',
													selectedRows.has(rowIndex)
														? 'bg-sidebar-accent'
														: rowIndex % 2 === 1
															? 'bg-muted'
															: 'bg-background'
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

												// Check if cell has pending edits
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
															if (
																action === 'filter-by-value' &&
																onFilterAdd
															) {
																onFilterAdd({
																	column: column.name,
																	operator: 'eq',
																	value: value
																})
															} else if (action === 'edit') {
																handleCellDoubleClick(
																	rowIndex,
																	column.name,
																	value
																)
															} else if (
																action === 'set-null' &&
																onCellEdit
															) {
																onCellEdit(
																	rowIndex,
																	column.name,
																	null
																)
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
															handleCellContextMenuChange(
																open,
																row,
																col
															)
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
																'bg-primary/5 ring-2 ring-inset ring-secondary AAAA  z-10',
																isDirty && 'bg-amber-500/10'
															)}
															style={
																width
																	? { maxWidth: width }
																	: undefined
															}
															data-cell-key={`${rowIndex}:${colIndex}`}
															onMouseDown={function (e) {
																handleCellMouseDown(
																	e,
																	rowIndex,
																	colIndex
																)
															}}
															onMouseEnter={function () {
																handleCellMouseEnter(
																	rowIndex,
																	colIndex
																)
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
																	{formatCellValue(
																		row[col.name],
																		col
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
									{draftRow && draftInsertIndex === rowIndex + 1 && (
										<tr className='bg-emerald-500/10 border-b border-sidebar-border group relative'>
											<td className='w-[30px] border-r border-sidebar-border bg-emerald-500/20 text-center align-middle'>
												<div className='h-full w-full flex items-center justify-center text-emerald-500 font-bold text-xs'>
													+
												</div>
											</td>
											{columns.map(function (col, colIndex) {
												const width = getColumnWidth(col.name)
												const isPrimaryKey = col.primaryKey

												return (
													<td
														key={`draft-${col.name}`}
														className='border-b border-r border-sidebar-border last:border-r-0 font-mono text-sm px-0 py-0'
														style={
															width ? { maxWidth: width } : undefined
														}
													>
														{isPrimaryKey ? (
															<div className='px-3 py-1.5 text-muted-foreground italic text-xs'>
																auto
															</div>
														) : (
															<input
																type='text'
																autoFocus={
																	colIndex === 0 ||
																	(colIndex === 1 &&
																		columns[0]?.primaryKey)
																}
																value={
																	draftRow[col.name] === null
																		? ''
																		: String(
																			draftRow[
																			col.name
																			] ?? ''
																		)
																}
																onChange={function (e) {
																	onDraftChange?.(
																		col.name,
																		e.target.value
																	)
																}}
																onKeyDown={function (e) {
																	if (e.key === 'Enter') {
																		e.preventDefault()
																		onDraftSave?.()
																	} else if (e.key === 'Escape') {
																		e.preventDefault()
																		onDraftCancel?.()
																	}
																}}
																data-no-shortcuts='true'
																className='w-full h-full bg-transparent px-3 py-1.5 outline-none focus:bg-emerald-500/10 font-mono text-sm'
																placeholder={
																	col.nullable ? 'NULL' : ''
																}
															/>
														)}
													</td>
												)
											})}
											<td className='w-[80px] border-b border-sidebar-border p-0'>
												<div className='flex items-center justify-center h-full gap-1 px-2'>
													<button
														onClick={onDraftSave}
														className='text-emerald-500 hover:text-emerald-400 text-xs font-medium'
														title='Save (Enter)'
													>
														✓
													</button>
													<button
														onClick={onDraftCancel}
														className='text-muted-foreground hover:text-destructive text-xs'
														title='Cancel (Escape)'
													>
														✕
													</button>
												</div>
											</td>
										</tr>
									)}
								</React.Fragment>
							)
						})}
						{rows.length === 0 && (
							<tr>
								<td
									colSpan={columns.length + 1}
									className='h-[400px] text-center text-muted-foreground border-b border-sidebar-border'
								>
									<div className='flex flex-col items-center justify-center gap-2'>
										<div className='p-3 rounded-full bg-sidebar-accent'>
											<Database className='h-6 w-6 opacity-50' />
										</div>
										<p className='font-medium'>No results found</p>
										<p className='text-sm opacity-80'>
											Try clearing filters or adding a new record
										</p>
									</div>
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			<ScrollHint containerRef={scrollContainerRef} />
		</div>
	)
}

function formatCellValue(value: unknown, column: ColumnDefinition): React.ReactNode {
	if (value === null || value === undefined) {
		return <span className='text-muted-foreground italic'>NULL</span>
	}

	// Explicit column type handling based on name heuristics or type if available
	const colName = column.name.toLowerCase()

	// IP Addresses
	if (colName.includes('ip_address') || colName.includes('ip_addr')) {
		return <IpCell value={String(value)} />
	}

	// Tokens / Hashes (long strings)
	if (
		(colName.includes('token') ||
			colName.includes('hash') ||
			colName.includes('key') ||
			colName.includes('signature')) &&
		typeof value === 'string' &&
		value.length > 20
	) {
		return <TokenCell value={value} />
	}

	// Dates
	if (
		colName.endsWith('_at') ||
		colName.endsWith('_date') ||
		colName === 'date' ||
		colName === 'timestamp' ||
		column.type?.includes('timestamp') ||
		column.type?.includes('date')
	) {
		return <DateCell value={value} columnName={colName} />
	}

	if (typeof value === 'boolean') {
		return (
			<div className='flex items-center justify-center'>
				{value ? (
					<Check className='w-3.5 h-3.5 text-emerald-500' />
				) : (
					<X className='w-3.5 h-3.5 text-muted-foreground/30' />
				)}
			</div>
		)
	}

	if (typeof value === 'number') {
		return <div className='text-right font-mono text-primary w-full'>{value}</div>
	}

	if (typeof value === 'object') {
		return <span className='text-warning'>{JSON.stringify(value)}</span>
	}

	return <span className='text-foreground'>{String(value)}</span>
}
