import { TableSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import { convertSchemaToDrizzle } from '@/core/data-generation/sql-to-drizzle'
import { useAdapter, useDataMutation } from '@/core/data-provider'
import { getAdapterError } from '@/core/data-provider/types'
import { usePendingEdits } from '@/core/pending-edits'
import { useSettings } from '@/core/settings'
import { useEffectiveShortcuts, useShortcut } from '@/core/shortcuts'
import { useUndo } from '@/core/undo'
import { ContextMenuState, useUrlState } from '@/core/url-state'
import { commands } from '@/lib/bindings'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { AlertTriangle, Columns, Database, PanelLeft, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddColumnDialog, ColumnFormData } from './components/add-column-dialog'
import { AddRecordDialog } from './components/add-record-dialog'
import { BottomStatusBar } from './components/bottom-status-bar'
import { BulkEditDialog } from './components/bulk-edit-dialog'
import { DataGrid } from './components/data-grid'
import { DropTableDialog } from './components/drop-table-dialog'
import { PendingChangesBar } from './components/pending-changes-bar'
import { RowDetailPanel } from './components/row-detail-panel'
import { SelectionActionBar } from './components/selection-action-bar'
import { SetNullDialog } from './components/set-null-dialog'
import { StudioToolbar } from './components/studio-toolbar'
import { DataSeederDialog } from './data-seeder-dialog'
import { useLiveMonitor } from './hooks/use-live-monitor'
import {
	ColumnDefinition,
	FilterDescriptor,
	PaginationState,
	SortDescriptor,
	TableData,
	ViewMode
} from './types'

type Props = {
	tableId: string | null
	tableName: string | null
	onToggleSidebar?: () => void
	activeConnectionId?: string
	onAddConnection?: () => void
	isSidebarOpen?: boolean
	initialRowPK?: string | number | null
	onRowSelectionChange?: (pk: string | number | null) => void
}

type TableCacheEntry = {
	data: TableData
	visibleColumns: string[]
}

const tableDataCache = new Map<string, TableCacheEntry>()

/** Clear the table data cache. Call this after executing SQL that modifies data. */
export function clearTableDataCache() {
	tableDataCache.clear()
}

function buildTableCacheKey(
	connectionId: string | undefined,
	tableId: string | null,
	limit: number,
	offset: number,
	sort: SortDescriptor | undefined,
	filters: FilterDescriptor[]
) {
	return JSON.stringify({
		connectionId: connectionId || '',
		tableId: tableId || '',
		limit,
		offset,
		sort: sort || null,
		filters
	})
}

export function DatabaseStudio({
	tableId,
	tableName,
	onToggleSidebar,
	activeConnectionId,
	onAddConnection,
	isSidebarOpen,
	initialRowPK,
	onRowSelectionChange
}: Props) {
	const initialCacheEntry = tableDataCache.get(
		buildTableCacheKey(activeConnectionId, tableId, 50, 0, undefined, [])
	)
	const adapter = useAdapter()
	const { toast } = useToast()
	const { updateCell, deleteRows, insertRow } = useDataMutation()
	const { settings } = useSettings()
	const {
		isDryEditMode,
		setDryEditMode,
		addEdit,
		removeEdit,
		pendingEdits,
		getEditsForTable,
		getEditCount,
		clearEdits,
		hasEdits
	} = usePendingEdits()
	const [isApplyingEdits, setIsApplyingEdits] = useState(false)
	const [tableData, setTableData] = useState<TableData | null>(
		initialCacheEntry ? initialCacheEntry.data : null
	)
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [addDialogMode, setAddDialogMode] = useState<'add' | 'duplicate'>('add')
	const [duplicateInitialData, setDuplicateInitialData] = useState<
		Record<string, unknown> | undefined
	>(undefined)
	const [showRowDetail, setShowRowDetail] = useState(false)
	const [selectedRowForDetail, setSelectedRowForDetail] = useState<Record<
		string,
		unknown
	> | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [isTableTransitioning, setIsTableTransitioning] = useState(!initialCacheEntry)
	const [viewMode, setViewMode] = useState<ViewMode>('content')
	const previousTableRef = useRef<{ columns: number; rows: number } | null>(null)
	const [pagination, setPagination] = useState<PaginationState>({ limit: 50, offset: 0 })
	const [sort, setSort] = useState<SortDescriptor | undefined>()
	const [filters, setFilters] = useState<FilterDescriptor[]>([])
	const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
	const [showAddColumnDialog, setShowAddColumnDialog] = useState(false)
	const [showDropTableDialog, setShowDropTableDialog] = useState(false)
	const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
	const [pendingSingleDeleteRow, setPendingSingleDeleteRow] = useState<{
		row: Record<string, unknown>
		primaryKeyColumn: string
		primaryKeyValue: unknown
	} | null>(null)
	const [showBulkEditDialog, setShowBulkEditDialog] = useState(false)
	const [showSetNullDialog, setShowSetNullDialog] = useState(false)
	const [showDataSeederDialog, setShowDataSeederDialog] = useState(false)
	const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
	const [isDdlLoading, setIsDdlLoading] = useState(false)

	const [selectionAnnouncement, setSelectionAnnouncement] = useState('')
	const [draftRow, setDraftRow] = useState<Record<string, unknown> | null>(null)
	const [draftInsertIndex, setDraftInsertIndex] = useState<number | null>(null)

	const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
		new Set(initialCacheEntry?.visibleColumns || [])
	)

	const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
	const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null)
	const [contextMenuState, setContextMenuState] = useState<ContextMenuState>(null)
	const toolbarRef = useRef<HTMLDivElement>(null)

	const {
		urlState,
		setSelectedRow,
		setSelectedCells: setUrlSelectedCells,
		setFocusedCell: setUrlFocusedCell,
		setContextMenu,
		setAddRecordMode
	} = useUrlState()
	const initializedFromUrlRef = useRef(false)
	const isUpdatingUrlRef = useRef(false)
	const currentCacheKey = useMemo(
		function () {
			return buildTableCacheKey(
				activeConnectionId,
				tableId,
				pagination.limit,
				pagination.offset,
				sort,
				filters
			)
		},
		[activeConnectionId, tableId, pagination.limit, pagination.offset, sort, filters]
	)

	const stableUrlState = useMemo(
		function () {
			return urlState
		},
		[
			urlState.selectedRow,
			urlState.focusedCell?.row,
			urlState.focusedCell?.col,
			urlState.addRecordMode,
			urlState.addRecordIndex
		]
	)
	const filteredColumns = useMemo(
		function () {
			if (!tableData) return []
			return tableData.columns.filter(function (col) {
				return visibleColumns.has(col.name)
			})
		},
		[tableData, visibleColumns]
	)
	const pendingEditsSet = useMemo(
		function () {
			if (!tableId) return undefined
			return new Set(
				getEditsForTable(tableId).map(function (e) {
					return `${e.primaryKeyValue}:${e.columnName}`
				})
			)
		},
		[tableId, pendingEdits, getEditsForTable]
	)

	const rowsForActions = useMemo(() => {
		if (selectedRows.size > 0) return selectedRows
		if (focusedCell) return new Set([focusedCell.row])
		return new Set<number>()
	}, [selectedRows, focusedCell])

	useEffect(
		function announceSelection() {
			if (rowsForActions.size > 0) {
				const count = rowsForActions.size
				setSelectionAnnouncement(
					`${count} row${count !== 1 ? 's' : ''} selected. Press Alt+T to access row actions.`
				)
			} else {
				setSelectionAnnouncement('')
			}
		},
		[rowsForActions.size]
	)

	useEffect(function cachePreviousTableDimensions() {
		if (tableData && !isLoading) {
			previousTableRef.current = {
				columns: tableData.columns.length,
				rows: Math.min(tableData.rows.length, 12)
			}
		}
	}, [tableData, isLoading])

	const loadTableData = useCallback(async () => {
		if (!tableId || !activeConnectionId) {
			return
		}

		const cached = tableDataCache.get(currentCacheKey)
		if (cached) {
			setTableData(cached.data)
			if (cached.visibleColumns.length > 0) {
				setVisibleColumns(new Set(cached.visibleColumns))
			}
			setIsTableTransitioning(false)
		}

		setIsLoading(true)
		setSelectedRows(new Set())

		try {
			const result = await adapter.fetchTableData(
				activeConnectionId,
				tableName || tableId,
				Math.floor(pagination.offset / pagination.limit),
				pagination.limit,
				sort,
				filters
			)

			if (result.ok) {
				const data = result.data
				setTableData(data)

				// If it's a new table or first load, reset visible columns to show all
				let nextVisibleColumns: string[] = []
				if (data.columns.length > 0) {
					setVisibleColumns((prev) => {
						if (prev.size === 0) {
							nextVisibleColumns = data.columns.map((c) => c.name)
							return new Set(nextVisibleColumns)
						}

						nextVisibleColumns = Array.from(prev)
						return prev
					})
				}

				tableDataCache.set(currentCacheKey, {
					data,
					visibleColumns: nextVisibleColumns
				})
			} else {
				console.error(
					'[DatabaseStudio] Failed to load table data:',
					getAdapterError(result)
				)
				if (!cached) {
					setTableData(null)
				}
			}
		} catch (error) {
			console.error('[DatabaseStudio] Unexpected error loading table data:', error)
			if (!cached) {
				setTableData(null)
			}
		} finally {
			setIsLoading(false)
		}
	}, [
		adapter,
		tableId,
		tableName,
		activeConnectionId,
		currentCacheKey,
		pagination.limit,
		pagination.offset,
		sort,
		filters
	])

	const shortcuts = useEffectiveShortcuts()
	const $ = useShortcut()

	$.bind(shortcuts.focusToolbar.combo)
		.on(function () {
			if (rowsForActions.size > 0 && toolbarRef.current) {
				toolbarRef.current.focus()
				// Optionally find the first button and focus it?
				// For now, focusing the container (which has accessible children) is a good start,
				// but usually we want to focus the first interactive element.
				const firstButton = toolbarRef.current.querySelector('button')
				if (firstButton) {
					; (firstButton as HTMLElement).focus()
				}
			}
		}, { description: shortcuts.focusToolbar.description })

	$.bind(shortcuts.deleteRows.combo)
		.on(function () {
			if (rowsForActions.size > 0 && !isBulkActionLoading) {
				handleBulkDelete()
			}
		}, { description: shortcuts.deleteRows.description })

	$.bind(shortcuts.deselect.combo)
		.on(function () {
			setSelectedRows(new Set())
			setFocusedCell(null)
			setSelectedCells(new Set())
		}, { description: shortcuts.deselect.description })

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(
		function () {
			loadTableData()
		},
		[tableId, activeConnectionId, pagination.limit, pagination.offset, sort, filters]
	)

	const { trackCellMutation, trackBatchCellMutation } = useUndo({ onUndoComplete: loadTableData })

	const liveMonitor = useLiveMonitor({
		adapter,
		connectionId: activeConnectionId,
		tableName: tableName || tableId,
		tableData,
		sort,
		filters,
		paginationLimit: pagination.limit,
		paginationOffset: pagination.offset,
		isPaused: draftRow !== null || isApplyingEdits,
		onDataChanged: loadTableData
	})

	useEffect(function handleTableChange() {
		if (!tableId || !activeConnectionId) return
		setPagination({ limit: 50, offset: 0 })
		setSort(undefined)
		setFilters([])
		initializedFromUrlRef.current = false

		const defaultCacheKey = buildTableCacheKey(
			activeConnectionId,
			tableId,
			50,
			0,
			undefined,
			[]
		)
		const cached = tableDataCache.get(defaultCacheKey)

		if (cached) {
			setTableData(cached.data)
			setVisibleColumns(new Set(cached.visibleColumns))
			setIsTableTransitioning(false)
			return
		}

		setVisibleColumns(new Set())
		setIsTableTransitioning(true)
	}, [tableId, activeConnectionId])

	useEffect(function clearTransitionOnLoad() {
		if (!isLoading && tableData) {
			const timer = setTimeout(function () {
				setIsTableTransitioning(false)
			}, 50)
			return function () {
				clearTimeout(timer)
			}
		}
	}, [isLoading, tableData])

	useEffect(
		function initializeFromUrl() {
			if (initializedFromUrlRef.current || !tableData) return
			initializedFromUrlRef.current = true

			if (stableUrlState.selectedRow !== null) {
				if (
					stableUrlState.selectedRow >= 0 &&
					stableUrlState.selectedRow < tableData.rows.length
				) {
					setSelectedRows(new Set([stableUrlState.selectedRow]))
				}
			}
			if (stableUrlState.selectedCells.size > 0) {
				const validCells = new Set<string>()
				for (const cellKey of stableUrlState.selectedCells) {
					const parts = cellKey.split(':')
					if (parts.length === 2) {
						const r = parseInt(parts[0], 10)
						const c = parseInt(parts[1], 10)
						if (
							!isNaN(r) &&
							!isNaN(c) &&
							r >= 0 &&
							r < tableData.rows.length &&
							c >= 0 &&
							c < tableData.columns.length
						) {
							validCells.add(cellKey)
						}
					}
				}
				if (validCells.size > 0) {
					setSelectedCells(validCells)
				}
			}
			if (stableUrlState.focusedCell) {
				const { row, col } = stableUrlState.focusedCell
				if (
					row >= 0 &&
					row < tableData.rows.length &&
					col >= 0 &&
					col < tableData.columns.length
				) {
					setFocusedCell(stableUrlState.focusedCell)
				}
			}
			if (stableUrlState.contextMenu) {
				const { cell } = stableUrlState.contextMenu
				if (cell.row >= 0 && cell.row < tableData.rows.length) {
					setContextMenuState(stableUrlState.contextMenu)
				}
			}
			if (stableUrlState.addRecordMode && tableData) {
				if (
					stableUrlState.addRecordIndex === null ||
					(stableUrlState.addRecordIndex >= -1 &&
						stableUrlState.addRecordIndex <= tableData.rows.length)
				) {
					const defaults = createDefaultValues(tableData.columns)
					setDraftRow(defaults)
					setDraftInsertIndex(stableUrlState.addRecordIndex ?? -1)
				}
			}
		},
		[tableData, stableUrlState]
	)

	useEffect(
		function syncSelectedRowToUrl() {
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return
			const firstSelected = selectedRows.size > 0 ? Array.from(selectedRows)[0] : null
			if (firstSelected === urlState.selectedRow) return

			isUpdatingUrlRef.current = true
			setSelectedRow(firstSelected)
			requestAnimationFrame(function () {
				isUpdatingUrlRef.current = false
			})

			if (onRowSelectionChange && tableData) {
				if (firstSelected !== null && tableData.rows[firstSelected]) {
					const primaryKeyColumn = tableData.columns.find(function (c) {
						return c.primaryKey
					})
					if (primaryKeyColumn) {
						const pkValue = tableData.rows[firstSelected][primaryKeyColumn.name] as
							| string
							| number
						onRowSelectionChange(pkValue)
					}
				} else if (selectedRows.size === 0) {
					onRowSelectionChange(null)
				}
			}
		},
		[selectedRows, onRowSelectionChange, tableData, urlState.selectedRow, setSelectedRow]
	)

	// Restore selection from initialRowPK
	useEffect(
		function restoreSelectionFromPK() {
			if (
				!tableData ||
				!initialRowPK ||
				selectedRows.size > 0 ||
				initializedFromUrlRef.current
			)
				return

			const primaryKeyColumn = tableData.columns.find((c) => c.primaryKey)
			if (!primaryKeyColumn) return

			const rowIndex = tableData.rows.findIndex(
				(row) => String(row[primaryKeyColumn.name]) === String(initialRowPK)
			)

			if (rowIndex !== -1) {
				setSelectedRows(new Set([rowIndex]))
				// Mark as initialized so URL sync doesn't overwrite it immediately?
				// Actually syncSelectedRowToUrl will run and update URL, which is fine.
			}
		},
		[tableData, initialRowPK] // Run when data loads or initialPK changes
	)

	useEffect(
		function syncCellsToUrl() {
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return

			const currentCellsStr = Array.from(urlState.selectedCells).sort().join(',')
			const newCellsStr = Array.from(selectedCells).sort().join(',')
			if (currentCellsStr === newCellsStr) return

			isUpdatingUrlRef.current = true
			setUrlSelectedCells(selectedCells)
			requestAnimationFrame(function () {
				isUpdatingUrlRef.current = false
			})
		},
		[selectedCells, urlState.selectedCells, setUrlSelectedCells]
	)

	useEffect(
		function syncFocusedCellToUrl() {
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return

			const urlCell = urlState.focusedCell
			const isSame =
				(urlCell === null && focusedCell === null) ||
				(urlCell !== null &&
					focusedCell !== null &&
					urlCell.row === focusedCell.row &&
					urlCell.col === focusedCell.col)
			if (isSame) return

			isUpdatingUrlRef.current = true
			setUrlFocusedCell(focusedCell)
			requestAnimationFrame(function () {
				isUpdatingUrlRef.current = false
			})
		},
		[focusedCell, urlState.focusedCell, setUrlFocusedCell]
	)

	useEffect(
		function syncContextMenuToUrl() {
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return

			const urlCtx = urlState.contextMenu
			const isSame =
				(urlCtx === null && contextMenuState === null) ||
				(urlCtx !== null &&
					contextMenuState !== null &&
					urlCtx.kind === contextMenuState.kind &&
					urlCtx.cell.row === contextMenuState.cell.row &&
					urlCtx.cell.col === contextMenuState.cell.col)
			if (isSame) return

			isUpdatingUrlRef.current = true
			setContextMenu(contextMenuState)
			requestAnimationFrame(function () {
				isUpdatingUrlRef.current = false
			})
		},
		[contextMenuState, urlState.contextMenu, setContextMenu]
	)

	useEffect(
		function syncAddRecordToUrl() {
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return

			const isAddRecordActive = draftRow !== null
			const isSame =
				urlState.addRecordMode === isAddRecordActive &&
				urlState.addRecordIndex === draftInsertIndex
			if (isSame) return

			isUpdatingUrlRef.current = true
			setAddRecordMode(isAddRecordActive, draftInsertIndex)
			requestAnimationFrame(function () {
				isUpdatingUrlRef.current = false
			})
		},
		[
			draftRow,
			draftInsertIndex,
			urlState.addRecordMode,
			urlState.addRecordIndex,
			setAddRecordMode
		]
	)

	// Define all callbacks before any conditional returns
	const handleBulkDelete = useCallback(() => {
		const primaryKeyColumn = tableData?.columns.find((c) => c.primaryKey)
		if (!primaryKeyColumn || !activeConnectionId || !tableId || !tableData) return

		if (settings.confirmBeforeDelete) {
			setShowDeleteConfirmDialog(true)
			return
		}

		performBulkDelete()
	}, [tableData, activeConnectionId, tableId, settings.confirmBeforeDelete])

	const performBulkDelete = useCallback(() => {
		const primaryKeyColumn = tableData?.columns.find((c) => c.primaryKey)
		if (!primaryKeyColumn || !activeConnectionId || !tableId || !tableData) return

		const primaryKeyValues = Array.from(rowsForActions).map(function (rowIndex) {
			return tableData.rows[rowIndex][primaryKeyColumn.name]
		})

		deleteRows.mutate(
			{
				connectionId: activeConnectionId,
				tableName: tableName || tableId,
				primaryKeyColumn: primaryKeyColumn.name,
				primaryKeyValues
			},
			{
				onSuccess: function () {
					setSelectedRows(new Set())
					loadTableData()
					setShowDeleteConfirmDialog(false)
				},
				onError: function (error: Error) {
					toast({
						title: 'Failed to delete rows',
						description: error.message,
						variant: 'destructive'
					})
				}
			}
		)
	}, [
		tableData,
		activeConnectionId,
		tableId,
		tableName,
		selectedRows,
		deleteRows,
		loadTableData
	])

	const handleBulkCopy = useCallback(() => {
		if (!tableData) return
		const rowsData = Array.from(rowsForActions).map(function (rowIndex) {
			return tableData.rows[rowIndex]
		})
		navigator.clipboard.writeText(JSON.stringify(rowsData, null, 2))
	}, [tableData, rowsForActions])

	const handleBulkDuplicate = useCallback(() => {
		const primaryKeyColumn = tableData?.columns.find((c) => c.primaryKey)
		if (!activeConnectionId || !tableId || !tableData) return

		const rowsToDuplicate = Array.from(rowsForActions).map(function (rowIndex) {
			const row = { ...tableData.rows[rowIndex] }
			if (primaryKeyColumn) {
				delete row[primaryKeyColumn.name]
			}
			return row
		})

		setIsBulkActionLoading(true)
		Promise.all(
			rowsToDuplicate.map(function (rowData) {
				return insertRow.mutateAsync({
					connectionId: activeConnectionId,
					tableName: tableName || tableId,
					rowData
				})
			})
		)
			.then(function () {
				setSelectedRows(new Set())
				loadTableData()
			})
			.catch(function (error) {
				console.error('Failed to duplicate rows:', error)
				toast({
					title: 'Failed to duplicate rows',
					description: error instanceof Error ? error.message : 'An error occurred',
					variant: 'destructive'
				})
			})
			.finally(function () {
				setIsBulkActionLoading(false)
			})
	}, [tableData, activeConnectionId, tableId, tableName, rowsForActions, insertRow, loadTableData])

	const handleExportJson = useCallback(() => {
		if (!tableData) return
		const rowsData = Array.from(rowsForActions).map(function (rowIndex) {
			return tableData.rows[rowIndex]
		})
		const jsonString = JSON.stringify(rowsData, null, 2)
		const blob = new Blob([jsonString], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${tableName || 'data'}_selected.json`
		a.click()
		URL.revokeObjectURL(url)
	}, [tableData, rowsForActions, tableName])

	const handleExportCsv = useCallback(() => {
		if (!tableData) return
		const rowsData = Array.from(rowsForActions).map(function (rowIndex) {
			return tableData.rows[rowIndex]
		})

		if (rowsData.length === 0) return

		const headers = Object.keys(rowsData[0])
		const csvRows = [
			headers.join(','),
			...rowsData.map(function (row) {
				return headers
					.map(function (header) {
						const value = row[header]
						if (value === null || value === undefined) return ''
						const stringValue = String(value)
						if (
							stringValue.includes(',') ||
							stringValue.includes('"') ||
							stringValue.includes('\n')
						) {
							return `"${stringValue.replace(/"/g, '""')}"`
						}
						return stringValue
					})
					.join(',')
			})
		]

		const csvString = csvRows.join('\n')
		const blob = new Blob([csvString], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${tableName || 'data'}_selected.csv`
		a.click()
		URL.revokeObjectURL(url)
	}, [tableData, rowsForActions, tableName])

	const handleClearSelection = useCallback(() => {
		setSelectedRows(new Set())
		if (selectedRows.size === 0) {
			setFocusedCell(null)
			setSelectedCells(new Set())
		}
	}, [selectedRows.size])
	const handleOpenSetNull = useCallback(() => setShowSetNullDialog(true), [])
	const handleOpenBulkEdit = useCallback(() => setShowBulkEditDialog(true), [])
	const handleOpenDataSeeder = useCallback(() => setShowDataSeederDialog(true), [])
	const handleFilterAdd = useCallback(function (filter: FilterDescriptor) {
		setFilters(function (prev) {
			return [...prev, filter]
		})
	}, [])

	async function handleSeederGenerate(data: any[]) {
		if (!activeConnectionId || !tableId) return

		try {
			for (const row of data) {
				await insertRow.mutateAsync({
					connectionId: activeConnectionId,
					tableName: tableName || tableId,
					rowData: row
				})
			}
			loadTableData()
		} catch (error) {
			console.error('Failed to seed data:', error)
			toast({
				title: 'Seeder failed',
				description: error instanceof Error ? error.message : 'An error occurred',
				variant: 'destructive'
			})
		}
	}

	function handleToggleColumn(columnName: string, visible: boolean) {
		setVisibleColumns((prev) => {
			const next = new Set(prev)
			if (visible) {
				next.add(columnName)
			} else {
				next.delete(columnName)
			}
			return next
		})
	}

	function handleRowSelect(rowIndex: number, checked: boolean) {
		setSelectedRows((prev) => {
			const next = new Set(prev)
			if (checked) {
				next.add(rowIndex)
			} else {
				next.delete(rowIndex)
			}
			return next
		})
	}

	function handleRowsSelect(rowIndices: number[], checked: boolean) {
		setSelectedRows((prev) => {
			const next = new Set(prev)
			if (checked) {
				rowIndices.forEach((i) => next.add(i))
			} else {
				rowIndices.forEach((i) => next.delete(i))
			}
			return next
		})
	}

	function handleSelectAll(checked: boolean) {
		if (checked && tableData) {
			setSelectedRows(new Set(tableData.rows.map((_, i) => i)))
		} else {
			setSelectedRows(new Set())
		}
	}

	function handleCellEdit(rowIndex: number, columnName: string, newValue: unknown) {
		if (!tableId || !activeConnectionId || !tableData) return

		const row = tableData.rows[rowIndex]
		const primaryKeyColumn = tableData.columns.find(function (c) {
			return c.primaryKey
		})
		if (!primaryKeyColumn) {
			console.error('No primary key found')
			return
		}

		if (isDryEditMode) {
			// Check if there's already a pending edit to preserve the ORIGINAL value
			const key = `${tableId}:${String(row[primaryKeyColumn.name])}:${columnName}`
			const existingEdit = pendingEdits.get(key)
			const oldValue = existingEdit ? existingEdit.oldValue : row[columnName]

			addEdit(tableId, {
				rowIndex,
				primaryKeyColumn: primaryKeyColumn.name,
				primaryKeyValue: row[primaryKeyColumn.name],
				columnName,
				oldValue,
				newValue
			})

			setTableData(function (prev) {
				if (!prev) return prev
				const newRows = [...prev.rows]
				newRows[rowIndex] = { ...newRows[rowIndex], [columnName]: newValue }
				return { ...prev, rows: newRows }
			})
		} else {
			const previousValue = row[columnName]
			updateCell.mutate(
				{
					connectionId: activeConnectionId,
					tableName: tableName || tableId,
					primaryKeyColumn: primaryKeyColumn.name,
					primaryKeyValue: row[primaryKeyColumn.name],
					columnName,
					newValue
				},
				{
					onSuccess: function () {
						trackCellMutation(
							activeConnectionId,
							tableName || tableId,
							primaryKeyColumn.name,
							row[primaryKeyColumn.name],
							columnName,
							previousValue,
							newValue
						)
						loadTableData()
					},
					onError: function (error) {
						console.error('Failed to update cell:', error)
						toast({
							title: 'Failed to update cell',
							description: error instanceof Error ? error.message : 'An error occurred',
							variant: 'destructive'
						})
					}
				}
			)
		}
	}

	// Handle Undo for Pending Edits (Ctrl+Z)
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
				if (isDryEditMode && tableId && hasEdits(tableId)) {
					// Check if we are inside an input (default undo) vs grid navigation
					// If target is body or grid container, we perform our undo.
					const target = e.target as HTMLElement
					const isInput =
						target.tagName === 'INPUT' ||
						target.tagName === 'TEXTAREA' ||
						target.isContentEditable

					if (!isInput) {
						e.preventDefault()
						e.stopPropagation()

						const edits = getEditsForTable(tableId)
						const lastEdit = edits[edits.length - 1]

						if (lastEdit) {
							const key = `${tableId}:${String(lastEdit.primaryKeyValue)}:${lastEdit.columnName}`
							removeEdit(tableId, key)

							setTableData((prev) => {
								if (!prev) return prev
								const newRows = [...prev.rows]
								// We trust rowIndex from the edit, assuming table hasn't been re-sorted/filtered in a way that invalidates indices.
								// Ideal: find row by PK. But for now using index as stored.
								if (newRows[lastEdit.rowIndex]) {
									newRows[lastEdit.rowIndex] = {
										...newRows[lastEdit.rowIndex],
										[lastEdit.columnName]: lastEdit.oldValue
									}
								}
								return { ...prev, rows: newRows }
							})
						}
					}
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown, true)
		return () => window.removeEventListener('keydown', handleKeyDown, true)
	}, [isDryEditMode, tableId, hasEdits, getEditsForTable, removeEdit])

	async function handleApplyPendingEdits() {
		if (!activeConnectionId || !tableId) return

		const edits = getEditsForTable(tableId)
		if (edits.length === 0) return

		setIsApplyingEdits(true)
		try {
			for (const edit of edits) {
				await updateCell.mutateAsync({
					connectionId: activeConnectionId,
					tableName: tableName || tableId,
					primaryKeyColumn: edit.primaryKeyColumn,
					primaryKeyValue: edit.primaryKeyValue,
					columnName: edit.columnName,
					newValue: edit.newValue
				})
			}
			clearEdits(tableId)
			loadTableData()
		} catch (error) {
			console.error('Failed to apply edits:', error)
			toast({
				title: 'Failed to apply changes',
				description: error instanceof Error ? error.message : 'An error occurred',
				variant: 'destructive'
			})
		} finally {
			setIsApplyingEdits(false)
		}
	}

	function handleDiscardPendingEdits() {
		if (!tableId) return
		clearEdits(tableId)
		loadTableData()
	}

	async function handleBatchCellEdit(
		rowIndexes: number[],
		columnName: string,
		newValue: unknown
	) {
		if (!tableId || !activeConnectionId || !tableData) return

		const primaryKeyColumn = tableData.columns.find(function (c) {
			return c.primaryKey
		})
		if (!primaryKeyColumn) {
			console.error('No primary key found')
			return
		}

		const cellsToTrack = rowIndexes.map(function (rowIndex) {
			const row = tableData.rows[rowIndex]
			return {
				primaryKeyValue: row[primaryKeyColumn.name],
				columnName,
				previousValue: row[columnName],
				newValue
			}
		})

		try {
			await Promise.all(
				rowIndexes.map(async function (rowIndex) {
					const row = tableData.rows[rowIndex]
					return updateCell.mutateAsync({
						connectionId: activeConnectionId,
						tableName: tableName || tableId,
						primaryKeyColumn: primaryKeyColumn.name,
						primaryKeyValue: row[primaryKeyColumn.name],
						columnName,
						newValue
					})
				})
			)

			trackBatchCellMutation(
				activeConnectionId,
				tableName || tableId,
				primaryKeyColumn.name,
				cellsToTrack
			)

			loadTableData()
		} catch (error) {
			console.error('Failed to batch update cells:', error)
			toast({
				title: 'Failed to update cells',
				description: error instanceof Error ? error.message : 'An error occurred',
				variant: 'destructive'
			})
		}
	}

	async function handleRowAction(action: string, row: Record<string, unknown>, rowIndex: number) {
		if (!tableId || !activeConnectionId || !tableData) return

		const primaryKeyColumn = tableData.columns.find((c) => c.primaryKey)
		if (!primaryKeyColumn) {
			console.error('No primary key found')
			return
		}

		switch (action) {
			case 'delete':
				if (settings.confirmBeforeDelete) {
					setPendingSingleDeleteRow({
						row,
						primaryKeyColumn: primaryKeyColumn.name,
						primaryKeyValue: row[primaryKeyColumn.name]
					})
					setShowDeleteConfirmDialog(true)
					return
				}

				deleteRows.mutate(
					{
						connectionId: activeConnectionId,
						tableName: tableName || tableId,
						primaryKeyColumn: primaryKeyColumn.name,
						primaryKeyValues: [row[primaryKeyColumn.name]]
					},
					{
						onSuccess: function onDeleteSuccess() {
							loadTableData()
						},
						onError: function onDeleteError(error) {
							console.error('Failed to delete row:', error)
						}
					}
				)
				break
			case 'view':
				setSelectedRowForDetail(row)
				setShowRowDetail(true)
				break
			case 'edit':
				setDuplicateInitialData(row)
				setAddDialogMode('add')
				setShowAddDialog(true)
				break
			case 'duplicate':
				const duplicateData = { ...row }
				if (primaryKeyColumn) {
					delete duplicateData[primaryKeyColumn.name]
				}
				// Prefill any missing required timestamp fields if not present in source
				const defaults = createDefaultValues(tableData.columns)
				setDraftRow({ ...defaults, ...duplicateData })
				setDraftInsertIndex(rowIndex + 1)

				// Focus will be handled by the DataGrid effect for new draft row
				break
			default:
				break
		}
	}

	function createDefaultValues(columns: ColumnDefinition[]): Record<string, unknown> {
		const defaults: Record<string, unknown> = {}
		const now = new Date().toISOString()

		for (const col of columns) {
			if (col.primaryKey) continue

			const type = col.type.toLowerCase()
			const name = col.name.toLowerCase()
			if (type.includes('timestamp') || type.includes('datetime') || type.includes('date')) {
				defaults[col.name] = now
			} else if (name.includes('created') || name.includes('updated') || name === 'date') {
				defaults[col.name] = now
			} else {
				defaults[col.name] = col.nullable ? null : ''
			}
		}
		return defaults
	}

	function normalizeValueForInsert(column: ColumnDefinition, value: unknown): unknown {
		const type = column.type.toLowerCase()
		const isIntegerType = type.includes('int') || type.includes('serial')
		const isFloatType =
			type.includes('float') ||
			type.includes('double') ||
			type.includes('decimal') ||
			type.includes('numeric')
		const isBooleanType = type.includes('bool')
		const isJsonType = type.includes('json')

		if (value === null || value === undefined) {
			return column.nullable ? null : value
		}

		if (typeof value === 'string') {
			const trimmed = value.trim()

			if (trimmed === '') {
				if (column.nullable) return null
				if (isIntegerType || isFloatType) return 0
				if (isBooleanType) return false
				return ''
			}

			if (isIntegerType) {
				const parsed = Number.parseInt(trimmed, 10)
				return Number.isNaN(parsed) ? (column.nullable ? null : 0) : parsed
			}

			if (isFloatType) {
				const parsed = Number.parseFloat(trimmed)
				return Number.isNaN(parsed) ? (column.nullable ? null : 0) : parsed
			}

			if (isBooleanType) {
				const normalized = trimmed.toLowerCase()
				return (
					normalized === 'true' ||
					normalized === '1' ||
					normalized === 't' ||
					normalized === 'yes' ||
					normalized === 'on'
				)
			}

			if (isJsonType) {
				try {
					return JSON.parse(trimmed)
				} catch {
					return trimmed
				}
			}

			return value
		}

		return value
	}

	function normalizeRowForInsert(
		rowData: Record<string, unknown>,
		columns: ColumnDefinition[]
	): Record<string, unknown> {
		const byName = new Map(
			columns.map(function (column) {
				return [column.name, column] as const
			})
		)
		const normalized: Record<string, unknown> = {}

		for (const [key, value] of Object.entries(rowData)) {
			const column = byName.get(key)
			normalized[key] = column ? normalizeValueForInsert(column, value) : value
		}

		return normalized
	}

	function handleAddRecord() {
		if (!tableData) return
		const defaults = createDefaultValues(tableData.columns)
		setDraftRow(defaults)
		setDraftInsertIndex(-1) // -1 indicates top of the table
	}

	function handleDraftChange(columnName: string, value: unknown) {
		setDraftRow(function (prev) {
			if (!prev) return prev
			return { ...prev, [columnName]: value }
		})
	}

	function handleDraftSave() {
		if (!activeConnectionId || !tableId || !draftRow || !tableData) return
		const normalizedDraftRow = normalizeRowForInsert(draftRow, tableData.columns)

		insertRow.mutate(
			{
				connectionId: activeConnectionId,
				tableName: tableName || tableId,
				rowData: normalizedDraftRow
			},
			{
				onSuccess: function onInsertSuccess() {
					setDraftRow(null)
					setDraftInsertIndex(null)
					loadTableData()
				},
				onError: function onInsertError(error) {
					console.error('Failed to insert row:', error)
					toast({
						title: 'Failed to create row',
						description: error instanceof Error ? error.message : 'An error occurred',
						variant: 'destructive'
					})
				}
			}
		)
	}

	function handleDraftCancel() {
		setDraftRow(null)
		setDraftInsertIndex(null)
	}

	function handleAddRecordSubmit(rowData: Record<string, unknown>) {
		if (!activeConnectionId || !tableId || !tableData) return
		const normalizedRowData = normalizeRowForInsert(rowData, tableData.columns)

		insertRow.mutate(
			{
				connectionId: activeConnectionId,
				tableName: tableName || tableId,
				rowData: normalizedRowData
			},
			{
				onSuccess: function onInsertSuccess() {
					setShowAddDialog(false)
					loadTableData()
				},
				onError: function onInsertError(error) {
					console.error('Failed to insert row:', error)
				}
			}
		)
	}

	function handleExport() {
		if (!tableData || tableData.rows.length === 0) return

		const jsonString = JSON.stringify(tableData.rows, null, 2)
		const blob = new Blob([jsonString], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${tableName || 'data'}.json`
		a.click()
		URL.revokeObjectURL(url)
	}

	function handleExportCsvAll() {
		if (!tableData || tableData.rows.length === 0) return

		const headers = tableData.columns.map(function (col) { return col.name })
		const csvRows = [
			headers.join(','),
			...tableData.rows.map(function (row) {
				return headers
					.map(function (header) {
						const value = row[header]
						if (value === null || value === undefined) return ''
						const stringValue = String(value)
						if (
							stringValue.includes(',') ||
							stringValue.includes('"') ||
							stringValue.includes('\n')
						) {
							return `"${stringValue.replace(/"/g, '""')}"`
						}
						return stringValue
					})
					.join(',')
			})
		]

		const csvString = csvRows.join('\n')
		const blob = new Blob([csvString], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${tableName || 'data'}.csv`
		a.click()
		URL.revokeObjectURL(url)
	}

	async function handleExportSqlAll() {
		if (!activeConnectionId || !tableId || !tableData || tableData.rows.length === 0) return

		const result = await commands.exportTable(
			activeConnectionId,
			tableName || tableId,
			null,
			'sql_insert',
			null
		)

		if (result.status === 'ok') {
			const blob = new Blob([result.data], { type: 'text/sql' })
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = `${tableName || 'data'}.sql`
			a.click()
			URL.revokeObjectURL(url)
		}
	}

	async function handleCopySchema() {
		if (!activeConnectionId) return

		try {
			const result = await adapter.getDatabaseDDL(activeConnectionId)
			if (result.ok) {
				navigator.clipboard.writeText(result.data)
				toast({
					title: 'Schema copied',
					description: 'Database schema DDL copied to clipboard.'
				})
			} else {
				throw new Error(getAdapterError(result))
			}
		} catch (error) {
			console.error('Failed to copy schema:', error)
			toast({
				title: 'Error copying schema',
				description: error instanceof Error ? error.message : 'Unknown error',
				variant: 'destructive'
			})
		}
	}

	async function handleCopyDrizzleSchema() {
		if (!activeConnectionId) return

		try {
			const schemaResult = await adapter.getSchema(activeConnectionId)
			if (schemaResult.ok) {
				const drizzleSchema = convertSchemaToDrizzle(schemaResult.data)
				navigator.clipboard.writeText(drizzleSchema)
				toast({
					title: 'Drizzle schema copied',
					description: 'Database schema as Drizzle ORM format copied to clipboard.'
				})
			} else {
				throw new Error(getAdapterError(schemaResult))
			}
		} catch (error) {
			console.error('Failed to copy Drizzle schema:', error)
			toast({
				title: 'Error copying schema',
				description: error instanceof Error ? error.message : 'Unknown error',
				variant: 'destructive'
			})
		}
	}

	async function handleAddColumn(columnDef: ColumnFormData) {
		if (!activeConnectionId || !tableName) return

		setIsDdlLoading(true)
		try {
			let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${columnDef.name}" ${columnDef.type}`
			if (!columnDef.nullable) {
				sql += ' NOT NULL'
			}
			if (columnDef.defaultValue.trim()) {
				sql += ` DEFAULT ${columnDef.defaultValue}`
			}

			const result = await commands.executeBatch(activeConnectionId, [sql])
			if (result.status === 'ok') {
				setShowAddColumnDialog(false)
				loadTableData()
			} else {
				console.error('Failed to add column:', result.error)
			}
		} catch (error) {
			console.error('Failed to add column:', error)
		} finally {
			setIsDdlLoading(false)
		}
	}

	async function handleDropTable() {
		if (!activeConnectionId || !tableName) return

		setIsDdlLoading(true)
		try {
			const result = await adapter.dropTable(activeConnectionId, tableName)
			if (result.ok) {
				setShowDropTableDialog(false)
				toast({ title: 'Table dropped', description: `"${tableName}" has been removed.` })
			} else {
				const errorMessage = getAdapterError(result)
				console.error('Failed to drop table:', errorMessage)
				toast({
					title: 'Failed to drop table',
					description: errorMessage,
					variant: 'destructive'
				})
			}
		} catch (error) {
			console.error('Failed to drop table:', error)
			toast({ title: 'Failed to drop table', description: String(error), variant: 'destructive' })
		} finally {
			setIsDdlLoading(false)
		}
	}

	// No connection selected
	if (!activeConnectionId) {
		return (
			<div className='flex flex-col h-full bg-background/50'>
				{onToggleSidebar && (
					<div className='flex items-center h-10 border-b border-sidebar-border bg-sidebar/50 shrink-0 px-3'>
						<Button
							variant='ghost'
							size='icon'
							className='h-7 w-7 text-muted-foreground hover:text-sidebar-foreground'
							onClick={onToggleSidebar}
							title='Toggle sidebar'
						>
							<PanelLeft
								className={`h-4 w-4 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`}
							/>
						</Button>
						<span className='ml-3 text-xs font-medium text-muted-foreground/70 tracking-wide uppercase'>
							Database Studio
						</span>
					</div>
				)}

				<div className='flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300'>
					<div className='w-20 h-20 bg-sidebar-accent/30 rounded-full flex items-center justify-center mb-6 ring-1 ring-sidebar-border/50 shadow-sm backdrop-blur-sm'>
						<Database className='w-10 h-10 text-primary/60' strokeWidth={1.5} />
					</div>
					<h2 className='text-xl font-semibold mb-2 text-foreground tracking-tight'>
						No Database Connected
					</h2>
					<p className='text-muted-foreground text-center max-w-sm mb-8 leading-relaxed text-sm'>
						Select a connection from the sidebar to view its tables, or create a new
						connection to get started.
					</p>

					{onAddConnection && (
						<Button
							onClick={onAddConnection}
							className='gap-2 shadow-md hover:shadow-lg transition-all'
						>
							<Plus className='w-4 h-4' />
							Add Connection
						</Button>
					)}
				</div>
			</div>
		)
	}

	// No table selected
	if (!tableId) {
		return (
			<div className='flex flex-col h-full bg-background/50'>
				{onToggleSidebar && (
					<div className='flex items-center h-10 border-b border-sidebar-border bg-sidebar/50 shrink-0 px-3'>
						<Button
							variant='ghost'
							size='icon'
							className='h-7 w-7 text-muted-foreground hover:text-sidebar-foreground'
							onClick={onToggleSidebar}
							title='Toggle sidebar'
						>
							<PanelLeft
								className={`h-4 w-4 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`}
							/>
						</Button>
						<span className='ml-3 text-xs font-medium text-muted-foreground/70 tracking-wide uppercase'>
							Database Studio
						</span>
					</div>
				)}

				<div className='flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-300'>
					<div className='w-20 h-20 bg-sidebar-accent/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-sidebar-border/30'>
						<svg
							className='h-10 w-10 text-muted-foreground/50'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='1.5'
						>
							<rect x='3' y='3' width='18' height='18' rx='2' />
							<line x1='9' y1='3' x2='9' y2='21' />
						</svg>
					</div>
					<h1 className='text-xl font-semibold text-foreground mb-2 tracking-tight'>
						No Table Selected
					</h1>
					<p className='text-muted-foreground text-sm max-w-xs'>
						Select a table from the sidebar list to browse its records, structure, and
						relationships.
					</p>
				</div>
			</div>
		)
	}

	// Structure view
	if (viewMode === 'structure' && tableData) {
		return (
			<div className='flex flex-col h-full bg-background'>
				<StudioToolbar
					tableName={tableName || tableId}
					viewMode={viewMode}
					onViewModeChange={setViewMode}
					onToggleSidebar={onToggleSidebar}
					isSidebarOpen={isSidebarOpen}
					onRefresh={loadTableData}
					onExport={handleExport}
					onExportCsv={handleExportCsvAll}
					onExportSql={handleExportSqlAll}
					isLoading={isLoading}
					onCopySchema={handleCopySchema}
					onCopyDrizzleSchema={handleCopyDrizzleSchema}
					liveMonitorConfig={liveMonitor.config}
					onLiveMonitorConfigChange={liveMonitor.setConfig}
					isLiveMonitorPolling={liveMonitor.isPolling}
					changeEvents={liveMonitor.changeEvents}
					unreadChangeCount={liveMonitor.unreadCount}
					onClearChangeEvents={liveMonitor.clearEvents}
					onMarkChangesRead={liveMonitor.markRead}
				/>

				<div className='flex-1 overflow-auto p-4'>
					<div className='max-w-2xl'>
						<h2 className='text-lg font-medium text-sidebar-foreground mb-4'>
							Table Structure
						</h2>
						<table className='w-full text-sm'>
							<thead>
								<tr className='border-b border-sidebar-border'>
									<th className='text-left py-2 px-3 text-muted-foreground font-medium'>
										Column
									</th>
									<th className='text-left py-2 px-3 text-muted-foreground font-medium'>
										Type
									</th>
									<th className='text-left py-2 px-3 text-muted-foreground font-medium'>
										Nullable
									</th>
									<th className='text-left py-2 px-3 text-muted-foreground font-medium'>
										Primary Key
									</th>
								</tr>
							</thead>
							<tbody>
								{tableData.columns.map((col: ColumnDefinition) => (
									<tr
										key={col.name}
										className='border-b border-sidebar-border/50'
									>
										<td className='py-2 px-3 font-mono text-sidebar-foreground'>
											{col.name}
										</td>
										<td className='py-2 px-3 font-mono text-primary'>
											{col.type}
										</td>
										<td className='py-2 px-3'>
											{col.nullable ? (
												<span className='text-muted-foreground'>Yes</span>
											) : (
												<span className='text-warning'>No</span>
											)}
										</td>
										<td className='py-2 px-3'>
											{col.primaryKey && (
												<span className='text-warning font-medium'>PK</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>

						<div className='flex gap-2 mt-6'>
							<Button
								variant='outline'
								size='sm'
								onClick={function () {
									setShowAddColumnDialog(true)
								}}
								className='gap-2'
							>
								<Columns className='h-4 w-4' />
								Add Column
							</Button>
							<Button
								variant='outline'
								size='sm'
								onClick={function () {
									setShowDropTableDialog(true)
								}}
								className='gap-2 text-destructive hover:text-destructive'
							>
								<Trash2 className='h-4 w-4' />
								Drop Table
							</Button>
						</div>
					</div>
				</div>

				<BottomStatusBar
					pagination={pagination}
					onPaginationChange={setPagination}
					rowCount={tableData.rows.length}
					totalCount={tableData.totalCount}
					executionTime={tableData.executionTime}
					liveMonitorEnabled={liveMonitor.config.enabled}
					liveMonitorIntervalMs={liveMonitor.config.intervalMs}
					lastPolledAt={liveMonitor.lastPolledAt}
					changesDetected={liveMonitor.unreadCount}
				/>

				<AddColumnDialog
					open={showAddColumnDialog}
					onOpenChange={setShowAddColumnDialog}
					tableName={tableName || tableId}
					onSubmit={handleAddColumn}
					isLoading={isDdlLoading}
				/>

				<DropTableDialog
					open={showDropTableDialog}
					onOpenChange={setShowDropTableDialog}
					tableName={tableName || tableId}
					onConfirm={handleDropTable}
					isLoading={isDdlLoading}
				/>
			</div>
		)
	}

	// Content view (default)
	return (
		<div className='flex flex-col h-full bg-background relative'>
			<div
				role='status'
				aria-live='polite'
				aria-atomic='true'
				className='sr-only'
			>
				{selectionAnnouncement}
			</div>
			<StudioToolbar
				tableName={tableName || tableId}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				onToggleSidebar={onToggleSidebar}
				isSidebarOpen={isSidebarOpen}
				onRefresh={loadTableData}
				onExport={handleExport}
				onExportCsv={handleExportCsvAll}
				onExportSql={handleExportSqlAll}
				onAddRecord={handleAddRecord}
				isLoading={isLoading}
				filters={filters}
				onFiltersChange={setFilters}
				columns={tableData?.columns || []}
				visibleColumns={visibleColumns}
				onToggleColumn={handleToggleColumn}
				isDryEditMode={isDryEditMode}
				onDryEditModeChange={setDryEditMode}
				onCopySchema={handleCopySchema}
				onCopyDrizzleSchema={handleCopyDrizzleSchema}
				liveMonitorConfig={liveMonitor.config}
				onLiveMonitorConfigChange={liveMonitor.setConfig}
				isLiveMonitorPolling={liveMonitor.isPolling}
				changeEvents={liveMonitor.changeEvents}
				unreadChangeCount={liveMonitor.unreadCount}
				onClearChangeEvents={liveMonitor.clearEvents}
				onMarkChangesRead={liveMonitor.markRead}
			/>

			<div
				className='flex-1 overflow-hidden relative'
				role='region'
				aria-label={`Table data for ${tableName || tableId}`}
				aria-busy={isLoading && !tableData}
			>
				{tableData && (
					<div
						className='transition-opacity duration-150'
						style={{ opacity: isTableTransitioning ? 0 : 1 }}
					>
						<DataGrid
							columns={filteredColumns}
							rows={tableData.rows}
							selectedRows={selectedRows}
							onRowSelect={handleRowSelect}
							onRowsSelect={handleRowsSelect}
							onSelectAll={handleSelectAll}
							sort={sort}
							onSortChange={setSort}
							onFilterAdd={handleFilterAdd}
							onCellEdit={handleCellEdit}
							onBatchCellEdit={handleBatchCellEdit}
							onRowAction={handleRowAction}
							tableName={tableName || tableId}
							selectedCells={selectedCells}
							onCellSelectionChange={setSelectedCells}
							initialFocusedCell={focusedCell}
							onFocusedCellChange={setFocusedCell}
							onContextMenuChange={setContextMenuState}
							draftRow={draftRow}
							onDraftChange={handleDraftChange}
							onDraftSave={handleDraftSave}
							onDraftCancel={handleDraftCancel}
							pendingEdits={pendingEditsSet}
							draftInsertIndex={draftInsertIndex}
						/>
					</div>
				)}
				{isTableTransitioning && (
					<div
						className='absolute inset-0 bg-background z-10 animate-in fade-in duration-100'
						role='status'
						aria-live='polite'
						aria-label='Loading table data'
					>
						<TableSkeleton
							rows={previousTableRef.current?.rows || 12}
							columns={Math.min(previousTableRef.current?.columns || visibleColumns.size || 6, 8)}
						/>
					</div>
				)}
				{!tableData && !isTableTransitioning && (
					<div className='flex items-center justify-center h-full' role='status' aria-live='polite'>
						<div className='text-muted-foreground text-sm'>No data available</div>
					</div>
				)}
			</div>

			{tableData && settings.selectionBarStyle === 'static' && rowsForActions.size > 0 && (
				<SelectionActionBar
					ref={toolbarRef}
					selectedCount={rowsForActions.size}
					onDelete={handleBulkDelete}
					onCopy={handleBulkCopy}
					onSetNull={handleOpenSetNull}
					onDuplicate={handleBulkDuplicate}
					onExportJson={handleExportJson}
					onExportCsv={handleExportCsv}
					onBulkEdit={handleOpenBulkEdit}
					onClearSelection={handleClearSelection}
					mode='static'
				/>
			)}

			{tableData && (
				<BottomStatusBar
					pagination={pagination}
					onPaginationChange={setPagination}
					rowCount={tableData.rows.length}
					totalCount={tableData.totalCount}
					executionTime={tableData.executionTime}
					liveMonitorEnabled={liveMonitor.config.enabled}
					liveMonitorIntervalMs={liveMonitor.config.intervalMs}
					lastPolledAt={liveMonitor.lastPolledAt}
					changesDetected={liveMonitor.unreadCount}
				/>
			)}

			{/* Render floating bar if mode is floating OR default (undefined) */}
			{tableData &&
				(settings.selectionBarStyle === 'floating' || !settings.selectionBarStyle) &&
				rowsForActions.size > 0 && (
					<SelectionActionBar
						ref={toolbarRef}
						selectedCount={rowsForActions.size}
						onDelete={handleBulkDelete}
						onCopy={handleBulkCopy}
						onDuplicate={handleBulkDuplicate}
						onExportJson={handleExportJson}
						onExportCsv={handleExportCsv}
						onSetNull={handleOpenSetNull}
						onBulkEdit={handleOpenBulkEdit}
						onClearSelection={handleClearSelection}
						mode='floating'
					/>
				)}

			{tableId && hasEdits(tableId) && (
				<PendingChangesBar
					editCount={getEditCount(tableId)}
					isApplying={isApplyingEdits}
					onApply={handleApplyPendingEdits}
					onCancel={handleDiscardPendingEdits}
				/>
			)}

			<AddRecordDialog
				open={showAddDialog}
				onOpenChange={setShowAddDialog}
				columns={tableData?.columns || []}
				onSubmit={handleAddRecordSubmit}
				isLoading={insertRow.isPending}
				initialData={duplicateInitialData}
				mode={addDialogMode}
			/>

			{tableData && selectedRowForDetail && (
				<RowDetailPanel
					open={showRowDetail}
					onClose={function closeRowDetail() {
						setShowRowDetail(false)
					}}
					row={selectedRowForDetail}
					columns={tableData.columns}
					tableName={tableName || tableId}
				/>
			)}

			<DropTableDialog
				open={showDropTableDialog}
				onOpenChange={setShowDropTableDialog}
				tableName={tableName || tableId || ''}
				onConfirm={handleDropTable}
				isLoading={isDdlLoading}
			/>

			<AlertDialog
				open={showDeleteConfirmDialog}
				onOpenChange={function handleDeleteDialogChange(open) {
					setShowDeleteConfirmDialog(open)
					if (!open) {
						setPendingSingleDeleteRow(null)
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete{' '}
							{pendingSingleDeleteRow ? '1 row' : `${selectedRows.size} selected row${selectedRows.size !== 1 ? 's' : ''}`}{' '}
							from the database.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={function handleConfirmDelete(e) {
								e.preventDefault()
								if (pendingSingleDeleteRow && activeConnectionId && tableId) {
									deleteRows.mutate(
										{
											connectionId: activeConnectionId,
											tableName: tableName || tableId,
											primaryKeyColumn: pendingSingleDeleteRow.primaryKeyColumn,
											primaryKeyValues: [pendingSingleDeleteRow.primaryKeyValue]
										},
										{
											onSuccess: function onSingleDeleteSuccess() {
												loadTableData()
												setShowDeleteConfirmDialog(false)
												setPendingSingleDeleteRow(null)
											},
											onError: function onSingleDeleteError(error) {
												console.error('Failed to delete row:', error)
											}
										}
									)
								} else {
									performBulkDelete()
								}
							}}
							className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{tableData && (
				<BulkEditDialog
					open={showBulkEditDialog}
					onOpenChange={setShowBulkEditDialog}
					columns={tableData.columns}
					selectedCount={selectedRows.size}
					isLoading={isBulkActionLoading}
					onSubmit={function handleBulkEditSubmit(columnName: string, newValue: unknown) {
						if (!activeConnectionId || !tableId || !tableData) return

						const primaryKeyColumn = tableData.columns.find(function (c) {
							return c.primaryKey
						})
						if (!primaryKeyColumn) {
							console.error('No primary key found')
							return
						}

						setIsBulkActionLoading(true)
						const rowIndexes = Array.from(selectedRows)

						Promise.all(
							rowIndexes.map(function (rowIndex) {
								const row = tableData.rows[rowIndex]
								return updateCell.mutateAsync({
									connectionId: activeConnectionId,
									tableName: tableName || tableId,
									primaryKeyColumn: primaryKeyColumn.name,
									primaryKeyValue: row[primaryKeyColumn.name],
									columnName,
									newValue
								})
							})
						)
							.then(function () {
								setShowBulkEditDialog(false)
								setSelectedRows(new Set())
								loadTableData()
							})
							.catch(function (error) {
								console.error('Failed to bulk edit:', error)
								toast({
									title: 'Failed to update rows',
									description: error instanceof Error ? error.message : 'An error occurred',
									variant: 'destructive'
								})
							})
							.finally(function () {
								setIsBulkActionLoading(false)
							})
					}}
				/>
			)}

			{tableData && (
				<SetNullDialog
					open={showSetNullDialog}
					onOpenChange={setShowSetNullDialog}
					columns={tableData.columns}
					selectedCount={selectedRows.size}
					isLoading={isBulkActionLoading}
					onSubmit={function handleSetNullSubmit(columnName: string) {
						if (!activeConnectionId || !tableId || !tableData) return

						const primaryKeyColumn = tableData.columns.find(function (c) {
							return c.primaryKey
						})
						if (!primaryKeyColumn) {
							console.error('No primary key found')
							return
						}

						setIsBulkActionLoading(true)
						const rowIndexes = Array.from(selectedRows)

						Promise.all(
							rowIndexes.map(function (rowIndex) {
								const row = tableData.rows[rowIndex]
								return updateCell.mutateAsync({
									connectionId: activeConnectionId,
									tableName: tableName || tableId,
									primaryKeyColumn: primaryKeyColumn.name,
									primaryKeyValue: row[primaryKeyColumn.name],
									columnName,
									newValue: null
								})
							})
						)
							.then(function () {
								setShowSetNullDialog(false)
								setSelectedRows(new Set())
								loadTableData()
							})
							.catch(function (error) {
								console.error('Failed to set null:', error)
								toast({
									title: 'Failed to set NULL',
									description: error instanceof Error ? error.message : 'An error occurred',
									variant: 'destructive'
								})
							})
							.finally(function () {
								setIsBulkActionLoading(false)
							})
					}}
				/>
			)}

			{tableData && (
				<DataSeederDialog
					open={showDataSeederDialog}
					onOpenChange={setShowDataSeederDialog}
					tableName={tableName || tableId || ''}
					columns={tableData.columns.map((c) => ({
						name: c.name,
						type: c.type,
						isNullable: c.nullable,
						isPrimaryKey: c.primaryKey
					}))}
					onGenerate={handleSeederGenerate}
				/>
			)}
		</div>
	)
}
