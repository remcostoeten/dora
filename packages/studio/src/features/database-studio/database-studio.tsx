import { useToast } from '@studio/shared/ui/use-toast'
import { noop } from '@studio/shared/utils/noop'
import { useAdapter, useDataMutation, useConnections, useSchema } from '@studio/core/data-provider'
import { useConnectionPhase } from '@studio/core/data-provider/connection-phase'
import { usePendingEdits } from '@studio/core/pending-edits'
import { openTab } from '@studio/core/workspace-store'
import { useSettings } from '@studio/core/settings'
import {
	formatShortcutList,
	useEffectiveShortcuts,
	useShortcut,
	useActiveScope,
	type ShortcutName
} from '@studio/core/shortcuts'
import { pickUndoTarget, useUndo } from '@studio/core/undo'
import type { Mutation } from '@studio/core/undo'
import { getTableRefId, getTableRefParts } from '@studio/shared/utils/table-ref'
import {
	getSourceCaps,
	isDataFileSessionConnection
} from '@studio/features/connections/source-caps'
import { isUiActionVisible } from '@studio/features/connections/ui-actions'
import { DataFileSessionChrome } from './components/data-file-session-chrome'
import { ImportFilesIntoDuckDbButton } from './components/import-files-into-duckdb-button'
import {
	lazy,
	memo,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode
} from 'react'
import { AddRecordDialog } from './components/add-record-dialog'
import { BottomStatusBar } from './components/bottom-status-bar'
import { BulkEditDialog } from './components/bulk-edit-dialog'
import { DataGrid } from './components/data-grid'
import {
	describeApplyOutcome,
	describeDeletedRows,
	describeStagedCount
} from './components/data-grid/grid-announce'
import type { GridNotice, StagedAction } from './components/data-grid/grid-edits'
import type { GridLiveMessage } from './components/data-grid/use-grid-announcer'
import { isDataGridEvent } from './components/data-grid/grid-events'
import { getActionRowIndexes } from './components/data-grid/selection'
import type { ContextMenuState } from './components/data-grid'
import { DeleteRowsDialog } from './components/delete-rows-dialog'
import { DiscardEditsDialog } from './components/discard-edits-dialog'
import { PendingSqlPreviewDialog } from './components/pending-sql-preview-dialog'
import { DropTableDialog } from './components/drop-table-dialog'
import { useStableHandlers } from './hooks/use-stable-handlers'
import { createLoadingStore } from './utils/loading-store'
import { memoWhileClosed } from './utils/memo-while-closed'
import { getDraftInsertIndex, getOffsetForRow, getPagedOffset } from './utils/pagination'
import { buildPendingEditsSql, toTableDialect } from './utils/pending-edits-sql'
import { TableLoadingSkeleton } from './components/table-loading-skeleton'
import {
	DatabaseStudioNoConnection,
	DatabaseStudioNoTable,
	DatabaseStudioConnectionLoading,
	DatabaseStudioConnectionFailed,
	DatabaseStudioNoTablesFound
} from './components/database-studio-empty-states'
import { DatabaseStudioStructureView } from './components/database-studio-structure-view'
import { AnimatePresence } from 'framer-motion'
import { PendingChangesBar } from './components/pending-changes-bar'
import { RowDetailPanel } from './components/row-detail-panel'
import { SelectionActionBar } from './components/selection-action-bar'
import { SetNullDialog } from './components/set-null-dialog'
import { StudioToolbar } from './components/studio-toolbar'
import { ExportOptionsDialog, type ExportFormatChoice } from './components/export-options-dialog'
import { ImportCsvDialog } from './components/import-csv-dialog'
const DataSeederDialog = lazy(function () {
	return import('./data-seeder-dialog').then(function (m) {
		return { default: m.DataSeederDialog }
	})
})
import { useDatabaseStudioSync } from './hooks/use-database-studio-sync'
import { useDatabaseStudioActions } from './hooks/use-database-studio-actions'
import { useDatabaseStudioEdits } from './hooks/use-database-studio-edits'
import { useDatabaseStudioCommands } from './hooks/use-database-studio-commands'
import {
	buildQuerySignature,
	readDefaultPageSnapshot,
	snapshotToTableData
} from './utils/table-snapshot'
import { appendRows, removeRowsByPrimaryKey } from './utils/studio-data'
import {
	FilterConjunction,
	FilterDescriptor,
	FilterGroup,
	PaginationState,
	SortDescriptor,
	TableData,
	ViewMode
} from './types'
import { flatFiltersToGroup, groupToFlatFilters } from '@studio/core/data-provider/filter-sql'
const ResultChartPanel = lazy(function () {
	return import('@studio/features/result-charts/result-chart-panel').then(function (m) {
		return { default: m.ResultChartPanel }
	})
})
import type { ResultChartConfig } from '@studio/features/result-charts/types'
import { commands } from '@studio/lib/bindings'
import type { ColumnDefinition } from './types'
import type { BlobAction } from './components/cell-context-menu'
import { bytesToBase64, bytesToHex } from './components/cells/blob-utils'
import { useWorkspaceState } from '@studio/core/workspace-state'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { RecordIllustration } from '@studio/shared/ui/empty-state-illustrations'

const DEFAULT_PAGINATION: PaginationState = { limit: 50, offset: 0 }
const NO_COLUMNS: ColumnDefinition[] = []
const NO_STATEMENTS: string[] = []

const QuietAddRecordDialog = memoWhileClosed(AddRecordDialog)
const QuietRowDetailPanel = memoWhileClosed(RowDetailPanel)
const QuietDropTableDialog = memoWhileClosed(DropTableDialog)
const QuietBulkEditDialog = memoWhileClosed(BulkEditDialog)
const QuietSetNullDialog = memoWhileClosed(SetNullDialog)
const QuietImportCsvDialog = memoWhileClosed(ImportCsvDialog)
const QuietExportOptionsDialog = memoWhileClosed(ExportOptionsDialog)
const QuietPendingChangesBar = memo(PendingChangesBar)

type ConnectionLoadingProps = {
	connectionId?: string
	connectionName?: string
}

function ConnectionLoadingState({ connectionId, connectionName }: ConnectionLoadingProps) {
	const phase = useConnectionPhase(connectionId)
	return <DatabaseStudioConnectionLoading connectionName={connectionName} phase={phase} />
}

type Props = {
	isActive?: boolean
	tableId: string | null
	tableName: string | null
	activeConnectionId?: string
	onAddConnection?: () => void
	onEditConnection?: () => void
	onConnectionSelect?: (connectionId: string) => void
	onOpenSettings?: () => void
	initialRowPK?: string | number | null
	onRowSelectionChange?: (pk: string | number | null) => void
}

export function DatabaseStudio({
	isActive = true,
	tableId,
	tableName,
	activeConnectionId,
	onAddConnection,
	onEditConnection,
	onConnectionSelect,
	onOpenSettings,
	initialRowPK,
	onRowSelectionChange
}: Props) {
	const tableRefName = tableId || tableName
	const displayTableName = tableName || getTableRefParts(tableId ?? '').tableName
	// Read once at mount: the last view of this table, when it is the default
	// page the studio is about to request. Painting from it is what makes a
	// return to an already-seen table instant instead of a skeleton.
	const initialSnapshot = readDefaultPageSnapshot(activeConnectionId, tableId)
	const adapter = useAdapter()
	const { toast } = useToast()
	const { data: connections = [] } = useConnections()
	const schemaQuery = useSchema(activeConnectionId)
	const activeConnection = useMemo(
		function () {
			return connections.find(function (connection) {
				return connection.id === activeConnectionId
			})
		},
		[connections, activeConnectionId]
	)
	const sourceCaps = useMemo(
		function () {
			return activeConnection ? getSourceCaps(activeConnection) : null
		},
		[activeConnection]
	)
	// Privacy mode hides every cell's contents. While it is on, the whole data
	// surface is read-only and non-exportable so the values can't leak through
	// edits, copies, or exports — only the structure (tables, columns) is shown.
	const { settings } = useSettings()
	const privacyMaskData = settings.privacyMaskData
	const canEditRows =
		(sourceCaps ? isUiActionVisible('edit-rows', sourceCaps) : false) && !privacyMaskData
	const canImportFile = sourceCaps ? isUiActionVisible('import-csv', sourceCaps) : false
	const canAttachFiles = sourceCaps ? isUiActionVisible('attach-file', sourceCaps) : false
	const canExportFile =
		(sourceCaps ? isUiActionVisible('export-data', sourceCaps) : true) && !privacyMaskData
	const showLiveMonitor = sourceCaps ? isUiActionVisible('live-monitor', sourceCaps) : false
	const existingTableNames = useMemo(
		function () {
			if (!schemaQuery.data) return []
			return schemaQuery.data.tables.map(function (table) {
				return table.name
			})
		},
		[schemaQuery.data]
	)
	const activeConnectionName = activeConnection?.name
	const importFilesAction = useMemo(
		function () {
			if (!canAttachFiles || !activeConnectionId || !activeConnectionName) return null
			return (
				<ImportFilesIntoDuckDbButton
					connectionId={activeConnectionId}
					connectionLabel={activeConnectionName}
					existingTableNames={existingTableNames}
				/>
			)
		},
		[canAttachFiles, activeConnectionId, activeConnectionName, existingTableNames]
	)

	const withDataFileChrome = useCallback(
		function wrapDataFileChrome(node: ReactNode) {
			if (!activeConnection) return node
			return (
				<DataFileSessionChrome
					connection={activeConnection}
					selectedTableName={displayTableName}
					onConnectionSelect={onConnectionSelect}
				>
					{node}
				</DataFileSessionChrome>
			)
		},
		[activeConnection, displayTableName, onConnectionSelect]
	)
	const schemaSummary = useMemo(
		function () {
			if (!schemaQuery.data) {
				return { tableCount: 0, totalRecords: 0 }
			}

			return schemaQuery.data.tables.reduce(
				function (summary, table) {
					return {
						tableCount: summary.tableCount + 1,
						totalRecords: summary.totalRecords + (table.row_count_estimate ?? 0)
					}
				},
				{ tableCount: 0, totalRecords: 0 }
			)
		},
		[schemaQuery.data]
	)
	const { updateCell, updateCells, deleteRows, insertRow, insertRows, duplicateRows } =
		useDataMutation()
	const {
		isDryEditMode,
		setDryEditMode,
		addEdit,
		addEdits,
		removeEdit,
		revertEdits,
		undoStagedEdit,
		redoStagedEdit,
		pendingEdits,
		getEditsForTable,
		getEditCount,
		clearEdits,
		hasEdits
	} = usePendingEdits(activeConnectionId)
	const workspaceStateKey = `${activeConnectionId ?? 'no-connection'}:${tableId ?? 'no-table'}`
	const [isApplyingEdits, setIsApplyingEdits] = useState(false)
	const [tableData, setTableData] = useWorkspaceState<TableData | null>(
		`${workspaceStateKey}:table-data`,
		() => (initialSnapshot ? snapshotToTableData(initialSnapshot) : null)
	)
	const [showAddDialog, setShowAddDialog] = useState(false)
	const [addDialogMode, setAddDialogMode] = useState<'add' | 'duplicate' | 'edit'>('add')
	const [duplicateInitialData, setDuplicateInitialData] = useState<
		Record<string, unknown> | undefined
	>(undefined)
	const [editingRowState, setEditingRowState] = useState<{
		primaryKeyColumn: string
		primaryKeyValue: unknown
		originalRow: Record<string, unknown>
	} | null>(null)
	const [showRowDetail, setShowRowDetail] = useState(false)
	const [selectedRowForDetail, setSelectedRowForDetail] = useState<Record<
		string,
		unknown
	> | null>(null)
	const [loadingStore] = useState(createLoadingStore)
	const [isTablePending, setIsTablePending] = useWorkspaceState(
		`${workspaceStateKey}:pending`,
		() => !initialSnapshot
	)
	const [viewMode, setViewMode] = useState<ViewMode>('content')
	const [chartConfig, setChartConfig] = useState<ResultChartConfig | null>(null)
	const previousTableRef = useRef<{ columns: number; rows: number } | null>(null)
	const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION)
	const [sort, setSort] = useState<SortDescriptor | undefined>()
	const [filters, setFilters] = useState<FilterDescriptor[]>([])
	const [filterConjunction, setFilterConjunction] = useState<FilterConjunction>('AND')
	// Structured AND/OR filter tree (#102). Source of truth for the filter UI and
	// the data fetch. The flat `filters`/`filterConjunction` above are kept in sync
	// as the root-level projection, for cache keys and tab persistence (#98).
	const [filterGroup, setFilterGroup] = useState<FilterGroup>({ logic: 'AND', conditions: [] })
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
	const [showDiscardEditsDialog, setShowDiscardEditsDialog] = useState(false)
	const [showSqlPreviewDialog, setShowSqlPreviewDialog] = useState(false)
	const [showDataSeederDialog, setShowDataSeederDialog] = useState(false)
	const [showImportDialog, setShowImportDialog] = useState(false)
	const [isDdlLoading, setIsDdlLoading] = useState(false)

	const [draftRow, setDraftRow] = useState<Record<string, unknown> | null>(null)
	const [draftInsertIndex, setDraftInsertIndex] = useState<number | null>(null)

	const [visibleColumns, setVisibleColumns] = useWorkspaceState(
		`${workspaceStateKey}:visible-columns`,
		() => {
			return new Set(initialSnapshot?.visibleColumns || [])
		}
	)

	// Same key the grid's resize hook persists to (use-column-resize.ts), so the
	// transition skeleton can render the incoming table's real column widths.
	const [gridColumnWidths] = useWorkspaceState(`${workspaceStateKey}:column-widths`, () => {
		return {} as Record<string, number>
	})
	const skeletonColumns = useMemo(
		function () {
			if (!tableId) return null
			const schemaTable = schemaQuery.data?.tables.find(function (table) {
				return getTableRefId(table) === tableId
			})
			if (!schemaTable) return null
			const columnsForSkeleton =
				visibleColumns.size > 0
					? schemaTable.columns.filter(function (column) {
							return visibleColumns.has(column.name)
						})
					: schemaTable.columns
			if (columnsForSkeleton.length === 0) return null
			return columnsForSkeleton.map(function (column) {
				return { name: column.name, width: gridColumnWidths[column.name] }
			})
		},
		[tableId, schemaQuery.data, visibleColumns, gridColumnWidths]
	)

	const [selectedRows, setSelectedRows] = useWorkspaceState(
		`${workspaceStateKey}:selected-rows`,
		() => {
			return new Set<number>()
		}
	)
	const [selectedCells, setSelectedCells] = useWorkspaceState(
		`${workspaceStateKey}:selected-cells`,
		() => {
			return new Set<string>()
		}
	)
	const [focusedCell, setFocusedCell] = useWorkspaceState<{
		row: number
		col: number
	} | null>(`${workspaceStateKey}:focused-cell`, () => {
		return null
	})
	const [contextMenuState, setContextMenuState] = useWorkspaceState<ContextMenuState>(
		`${workspaceStateKey}:context-menu`,
		() => {
			return null
		}
	)
	const toolbarRef = useRef<HTMLDivElement>(null)
	const gridContainerRef = useRef<HTMLDivElement>(null)
	// Applies an edited filter tree from the FilterBar: stores the group and keeps
	// the flat projection (#98 persistence + cache key) in sync.
	const handleFilterGroupChange = useCallback(function (group: FilterGroup) {
		setFilterGroup(group)
		const flat = groupToFlatFilters(group)
		setFilters(flat.filters)
		setFilterConjunction(flat.conjunction)
	}, [])

	// Flat-filter dispatcher used by the sync hook (restoring persisted filters)
	// and the bulk "filter by value" actions. Accepts both a value and the
	// updater form, and lifts the result back into the structured group so the
	// UI and the data fetch stay consistent. The group's existing logic is
	// preserved (the flat conjunction state mirrors `group.logic`).
	const handleSetFiltersFromSync = useCallback(function (
		next: React.SetStateAction<FilterDescriptor[]>
	) {
		setFilterGroup(function (prevGroup) {
			const prevFlat = groupToFlatFilters(prevGroup).filters
			const resolved = typeof next === 'function' ? next(prevFlat) : next
			setFilters(resolved)
			return flatFiltersToGroup(resolved, prevGroup.logic)
		})
	}, [])

	const currentQuerySignature = useMemo(
		function () {
			return buildQuerySignature(
				pagination.limit,
				pagination.offset,
				sort,
				filters,
				filterConjunction,
				filterGroup
			)
		},
		[pagination.limit, pagination.offset, sort, filters, filterConjunction, filterGroup]
	)
	function resetQueryState() {
		if (pagination.limit !== 50 || pagination.offset !== 0) setPagination(DEFAULT_PAGINATION)
		if (sort !== undefined) setSort(undefined)
		if (filters.length > 0) {
			setFilters([])
			setFilterGroup(function (previous) {
				return flatFiltersToGroup([], previous.logic)
			})
		}
	}

	const { loadTableData } = useDatabaseStudioSync({
		adapter,
		isActive,
		workspaceStateKey,
		loadingStore,
		activeConnectionId,
		tableId,
		tableName,
		tableRefName,
		currentQuerySignature,
		pagination,
		sort,
		filters,
		filterConjunction,
		filterGroup,
		tableData,
		draftRow,
		draftInsertIndex,
		isApplyingEdits,
		hasPendingEdits: Boolean(tableId) && hasEdits(tableId as string),
		getEditsForTable,
		selectedRows,
		selectedCells,
		focusedCell,
		contextMenuState,
		initialRowPK,
		onRowSelectionChange,
		setTableData,
		setVisibleColumns,
		setIsTablePending,
		resetQueryState,
		setSelectedRows,
		setSelectedCells,
		setFocusedCell,
		setContextMenuState,
		setDraftRow,
		setDraftInsertIndex
	})
	useEffect(
		function guardUnloadWithPendingEdits() {
			if (!hasEdits()) return
			function onBeforeUnload(event: BeforeUnloadEvent) {
				event.preventDefault()
				event.returnValue = ''
			}
			window.addEventListener('beforeunload', onBeforeUnload)
			return function () {
				window.removeEventListener('beforeunload', onBeforeUnload)
			}
		},
		[hasEdits]
	)

	const shouldFocusFilterValueRef = useRef(false)

	useEffect(
		function focusNewFilterValue() {
			if (!shouldFocusFilterValueRef.current) return
			shouldFocusFilterValueRef.current = false
			const frame = requestAnimationFrame(() => {
				const inputs = Array.from(
					document.querySelectorAll<HTMLInputElement>('input[aria-label="Filter value"]')
				).filter((input) => !input.closest('[hidden], [aria-hidden="true"]'))
				inputs[inputs.length - 1]?.focus()
			})
			return () => cancelAnimationFrame(frame)
		},
		[filters]
	)

	const pendingGridFocusRef = useRef<{ row: number; col: number } | null>(null)
	const pagedFromDataRef = useRef<TableData | null>(null)

	function handleGridRequestRow(absoluteRowIndex: number, colIndex: number) {
		const offset = getOffsetForRow(absoluteRowIndex, pagination.limit)
		pendingGridFocusRef.current = { row: absoluteRowIndex - offset, col: colIndex }
		pagedFromDataRef.current = tableData
		setPagination({ ...pagination, offset })
	}

	function handleGridPageChange(direction: 'next' | 'prev') {
		const offset = getPagedOffset(pagination, direction, tableData?.totalCount ?? 0)
		if (offset === pagination.offset) return
		pagedFromDataRef.current = tableData
		setPagination({ ...pagination, offset })
	}

	const handleEscapeToGrid = useCallback(function () {
		const grid = gridContainerRef.current?.querySelector<HTMLElement>('table[role="grid"]')
		if (grid) {
			grid.focus()
		}
	}, [])

	useEffect(
		function restoreGridFocusAfterPaging() {
			const pagedFrom = pagedFromDataRef.current
			if (isTablePending || !tableData || !pagedFrom || pagedFrom === tableData) return
			pagedFromDataRef.current = null
			const pending = pendingGridFocusRef.current
			pendingGridFocusRef.current = null
			if (pending && tableData.rows.length > 0) {
				const cell = {
					row: Math.min(pending.row, tableData.rows.length - 1),
					col: pending.col
				}
				setFocusedCell(cell)
				setSelectedCells(new Set([`${cell.row}:${cell.col}`]))
			}
			handleEscapeToGrid()
		},
		[isTablePending, tableData, handleEscapeToGrid, setFocusedCell, setSelectedCells]
	)

	const tableColumns = tableData?.columns
	const filteredColumns = useMemo(
		function () {
			if (!tableColumns) return NO_COLUMNS
			return tableColumns.filter(function (col) {
				return visibleColumns.has(col.name)
			})
		},
		[tableColumns, visibleColumns]
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

	const rowsForActions = useMemo(
		() => getActionRowIndexes(selectedRows, selectedCells, focusedCell),
		[selectedRows, selectedCells, focusedCell]
	)

	const applyUndoOptimistically = useCallback(
		function applyUndoOptimistically(mutation: Mutation) {
			setTableData(function (prev) {
				if (!prev) return prev
				if (mutation.type === 'cell') {
					return {
						...prev,
						rows: prev.rows.map(function (row) {
							return row[mutation.primaryKeyColumn] === mutation.primaryKeyValue
								? { ...row, [mutation.columnName]: mutation.previousValue }
								: row
						})
					}
				}
				if (mutation.type === 'batch-cell') {
					return {
						...prev,
						rows: prev.rows.map(function (row) {
							const matching = mutation.cells.filter(function (cell) {
								return cell.primaryKeyValue === row[mutation.primaryKeyColumn]
							})
							if (matching.length === 0) return row
							const patched = { ...row }
							for (const cell of matching) {
								patched[cell.columnName] = cell.previousValue
							}
							return patched
						})
					}
				}
				if (mutation.type === 'row-delete') {
					return appendRows(prev, mutation.rows)
				}
				return prev
			})
		},
		[setTableData]
	)

	const [gridLiveMessage, setGridLiveMessage] = useState<GridLiveMessage>()
	const gridLiveIdRef = useRef(0)
	const announceToGrid = useCallback(function announceToGrid(text: string) {
		gridLiveIdRef.current += 1
		setGridLiveMessage({ id: gridLiveIdRef.current, text })
	}, [])

	const stagedEditCount = tableId ? getEditCount(tableId) : 0
	const stagedTrackerRef = useRef({ count: stagedEditCount, applying: false, beforeApply: 0 })
	useEffect(
		function announceStagedEdits() {
			const tracker = stagedTrackerRef.current
			if (isApplyingEdits) {
				if (!tracker.applying) tracker.beforeApply = tracker.count
				tracker.applying = true
				tracker.count = stagedEditCount
				return
			}
			if (tracker.applying) {
				tracker.applying = false
				announceToGrid(describeApplyOutcome(tracker.beforeApply, stagedEditCount))
			} else if (stagedEditCount !== tracker.count) {
				announceToGrid(describeStagedCount(stagedEditCount))
			}
			tracker.count = stagedEditCount
		},
		[announceToGrid, isApplyingEdits, stagedEditCount]
	)

	const {
		trackCellMutation,
		trackBatchCellMutation,
		trackRowDeletion: trackRowDeletionForUndo,
		undoLatest,
		redoLatest
	} = useUndo({
		onUndoComplete: loadTableData,
		onUndoApply: applyUndoOptimistically
	})

	function trackRowDeletion(
		connectionId: string,
		deletedFrom: string,
		rows: Record<string, unknown>[],
		primaryKeyColumn?: string
	) {
		announceToGrid(describeDeletedRows(rows.length))
		return trackRowDeletionForUndo(connectionId, deletedFrom, rows, primaryKeyColumn)
	}

	const {
		handleBulkDelete,
		handleBulkCopy,
		handleBulkDuplicate,
		handleExportJson,
		handleExportCsv,
		handleClearSelection,
		handleFilterAdd,
		deleteRowIndexes,
		handleRowAction,
		handleAddRecord,
		handleDraftChange,
		handleDraftSave,
		handleDraftCancel,
		handleAddRecordSubmit,
		highlightedRowIndexes,
		notifyMissingPrimaryKey,
		notifyActionFailure
	} = useDatabaseStudioActions({
		activeConnectionId,
		tableId,
		tableName,
		tableRefName,
		tableData,
		draftRow,
		addDialogMode,
		editingRowState,
		selectedRows,
		rowsForActions,
		settingsConfirmBeforeDelete: settings.confirmBeforeDelete,
		updateCells,
		deleteRows,
		insertRow,
		insertRows,
		duplicateRows,
		onLoadTableData: loadTableData,
		trackRowDeletion,
		setTableData,
		setSelectedRows,
		setSelectedCells,
		setFocusedCell,
		setShowDeleteConfirmDialog,
		setPendingSingleDeleteRow,
		setShowAddDialog,
		setDraftRow,
		setDraftInsertIndex,
		setEditingRowState,
		setDuplicateInitialData,
		setAddDialogMode,
		setSelectedRowForDetail,
		setShowRowDetail,
		setFilters: handleSetFiltersFromSync,
		isReadonlySource: sourceCaps?.isReadonly ?? false,
		isDataFileSession: activeConnection ? isDataFileSessionConnection(activeConnection) : false
	})

	// Re-fetch the original bytes of a blob cell (the grid only has the rendered
	// display string) and copy/save them. Addresses the cell by primary key,
	// reusing the same safe parameter binding as cell edits.
	const handleBlobAction = useCallback(
		async function handleBlobAction(
			action: BlobAction,
			column: ColumnDefinition,
			row: Record<string, unknown>
		) {
			if (!activeConnectionId || !tableRefName) return
			const pkColumn = tableData?.columns.find(function (c) {
				return c.primaryKey
			})
			if (!pkColumn) {
				notifyMissingPrimaryKey('fetch binary cell')
				return
			}
			const tableRef = getTableRefParts(tableRefName)
			try {
				const result = await commands.getBlobBytes(
					activeConnectionId,
					tableRef.tableName,
					tableRef.schemaName,
					pkColumn.name,
					row[pkColumn.name] as never,
					column.name
				)
				if (result.status !== 'ok') {
					notifyActionFailure('Failed to read binary cell', result.error)
					return
				}
				const bytes = result.data

				if (action === 'copy-hex') {
					await navigator.clipboard.writeText('0x' + bytesToHex(bytes))
					toast({ title: `Copied ${bytes.length} bytes as hex` })
				} else if (action === 'copy-base64') {
					await navigator.clipboard.writeText(bytesToBase64(bytes))
					toast({ title: `Copied ${bytes.length} bytes as base64` })
				} else if (action === 'save-file') {
					const { save } = await import('@tauri-apps/plugin-dialog')
					const { writeFile } = await import('@tauri-apps/plugin-fs')
					const path = await save({
						defaultPath: `${displayTableName}_${column.name}.bin`
					})
					if (!path) return
					await writeFile(path, new Uint8Array(bytes))
					toast({ title: `Saved ${bytes.length} bytes to file` })
				}
			} catch (error) {
				notifyActionFailure('Failed to read binary cell', error)
			}
		},
		[
			activeConnectionId,
			tableRefName,
			tableData,
			displayTableName,
			toast,
			notifyMissingPrimaryKey,
			notifyActionFailure
		]
	)

	useEffect(
		function cachePreviousTableDimensions() {
			if (tableData) {
				previousTableRef.current = {
					columns: tableData.columns.length,
					rows: Math.min(tableData.rows.length, 12)
				}
			}
		},
		[tableData]
	)

	useEffect(
		function resetChartConfigForTable() {
			setChartConfig(null)
		},
		[tableId]
	)

	const shortcuts = useEffectiveShortcuts()
	const $ = useShortcut()
	useActiveScope($, 'data-grid', isActive)

	$.bind(shortcuts.refreshTable.combo)
		.in('data-grid')
		.on(
			function () {
				loadTableData()
			},
			{ description: shortcuts.refreshTable.description }
		)

	$.bind(shortcuts.exportTable.combo)
		.in('data-grid')
		.on(
			function () {
				requestExport('json')
			},
			{ description: shortcuts.exportTable.description }
		)

	function handleFocusActionBar() {
		const toolbar = toolbarRef.current
		if (rowsForActions.size === 0 || !toolbar) {
			announceToGrid('Select a row or cell first to use the action bar')
			return
		}
		const firstButton = toolbar.querySelector<HTMLElement>('button:not([disabled])')
		;(firstButton ?? toolbar).focus()
	}

	function handleBarDelete() {
		handleEscapeToGrid()
		handleBulkDelete()
	}

	function handleBarClearSelection() {
		handleClearSelection()
		handleEscapeToGrid()
	}

	$.bind(shortcuts.focusToolbar.combo)
		.in('data-grid')
		.except(['typing', isDataGridEvent])
		.on(handleFocusActionBar, { description: shortcuts.focusToolbar.description })

	$.bind(shortcuts.deleteRows.combo)
		.in('data-grid')
		.except(['typing', isDataGridEvent])
		.on(
			function () {
				if (rowsForActions.size > 0) {
					handleBulkDelete()
				}
			},
			{ description: shortcuts.deleteRows.description }
		)

	const stagedBindings: Array<[ShortcutName, StagedAction]> = [
		['gridToggleDryMode', 'toggle-dry-mode'],
		['gridApplyEdits', 'apply'],
		['gridDiscardEdits', 'discard'],
		['gridPreviewSql', 'preview'],
		['gridUndo', 'undo'],
		['gridRedo', 'redo']
	]
	for (const [name, action] of stagedBindings) {
		$.bind(shortcuts[name].combo)
			.in('data-grid')
			.except(['typing', isDataGridEvent])
			.on(
				function (event) {
					if (!canEditRows) return
					event.preventDefault()
					handleStagedAction(action)
				},
				{ description: shortcuts[name].description }
			)
	}

	$.bind(shortcuts.deselect.combo)
		.in('data-grid')
		.except(['typing', isDataGridEvent])
		.on(
			function () {
				setSelectedRows((current) => (current.size === 0 ? current : new Set()))
				setFocusedCell(null)
				setSelectedCells((current) => (current.size === 0 ? current : new Set()))
			},
			{ description: shortcuts.deselect.description }
		)

	function handleFKNavigate(
		referencedTable: string,
		_referencedColumn: string,
		_value: unknown,
		referencedSchema?: string
	) {
		if (!activeConnectionId) return
		const tableRef = referencedSchema
			? `${referencedSchema}.${referencedTable}`
			: referencedTable
		openTab({
			connectionId: activeConnectionId,
			tableId: tableRef,
			tableName: tableRef,
			label: referencedTable
		})
	}

	// Define all callbacks before any conditional returns
	const handleOpenSetNull = useCallback(() => setShowSetNullDialog(true), [])
	const handleOpenBulkEdit = useCallback(() => setShowBulkEditDialog(true), [])

	async function handleSeederGenerate(data: any[]) {
		if (!activeConnectionId || !tableId) return

		try {
			for (const row of data) {
				await insertRow.mutateAsync({
					connectionId: activeConnectionId,
					tableName: tableRefName ?? tableId,
					rowData: row
				})
			}
			loadTableData()
		} catch (error) {
			notifyActionFailure('Seeder failed', error)
		}
	}

	async function handleImportRows(
		rows: Record<string, unknown>[]
	): Promise<{ imported: number; errors: string[] }> {
		if (!activeConnectionId || !tableId) return { imported: 0, errors: ['No active table'] }
		let imported = 0
		const errors: string[] = []
		for (const row of rows) {
			try {
				await insertRow.mutateAsync({
					connectionId: activeConnectionId,
					tableName: tableRefName ?? tableId,
					rowData: row
				})
				imported++
			} catch (err) {
				errors.push(err instanceof Error ? err.message : String(err))
			}
		}
		if (imported > 0) loadTableData()
		return { imported, errors }
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

	const {
		handleCellEdit,
		handleApplyPendingEdits,
		handleDiscardPendingEdits,
		handleBatchCellEdit,
		handleCellsEdit,
		handleRevertStaged,
		handleUndoStaged,
		handleRedoStaged
	} = useDatabaseStudioEdits({
		activeConnectionId,
		tableId,
		tableRefName,
		tableData,
		isDryEditMode,
		pendingEdits,
		getEditsForTable,
		hasEdits,
		addEdit,
		addEdits,
		removeEdit,
		revertEdits,
		clearEdits,
		undoStagedEdit,
		redoStagedEdit,
		updateCell,
		updateCells,
		setTableData,
		setIsApplyingEdits,
		loadTableData,
		trackCellMutation,
		trackBatchCellMutation,
		notifyMissingPrimaryKey,
		notifyActionFailure
	})

	const {
		handleExport,
		handleExportCsvAll,
		handleExportSqlAll,
		hasActiveFilters,
		handleBackupDatabase,
		handleRestoreDatabase,
		handleCopySchema,
		handleCopyDrizzleSchema,
		handleAddColumn,
		handleDropTable,
		handleDropColumn
	} = useDatabaseStudioCommands({
		adapter,
		activeConnectionId,
		tableId,
		tableName,
		tableRefName,
		tableData,
		sort,
		filters,
		filterConjunction,
		filterGroup,
		loadTableData,
		setTableData,
		setVisibleColumns,
		setIsDdlLoading,
		setShowAddColumnDialog,
		setShowDropTableDialog,
		notifyActionFailure
	})

	// Export dialog (#99): when filters are active, clicking an export action
	// opens a chooser ("Export N matching rows" vs "Export all rows (ignore
	// filters)"). With no active filters, export runs immediately as before.
	const [exportDialogFormat, setExportDialogFormat] = useState<ExportFormatChoice | null>(null)

	const runExport = useCallback(
		function (format: ExportFormatChoice, ignoreFilters: boolean) {
			if (format === 'json') void handleExport(ignoreFilters)
			else if (format === 'csv') void handleExportCsvAll(ignoreFilters)
			else void handleExportSqlAll(ignoreFilters)
		},
		[handleExport, handleExportCsvAll, handleExportSqlAll]
	)

	const requestExport = useCallback(
		function (format: ExportFormatChoice) {
			if (hasActiveFilters) {
				setExportDialogFormat(format)
				return
			}
			runExport(format, false)
		},
		[hasActiveFilters, runExport]
	)

	function requestJsonExport() {
		requestExport('json')
	}

	function requestCsvExport() {
		requestExport('csv')
	}

	function requestSqlExport() {
		requestExport('sql')
	}

	function openImportDialog() {
		setShowImportDialog(true)
	}

	function handleAddDialogOpenChange(open: boolean) {
		setShowAddDialog(open)
		if (!open) {
			setEditingRowState(null)
			setDuplicateInitialData(undefined)
			setAddDialogMode('add')
		}
	}

	function closeRowDetail() {
		setShowRowDetail(false)
	}

	function handleDeleteDialogChange(open: boolean) {
		setShowDeleteConfirmDialog(open)
		if (!open) {
			setPendingSingleDeleteRow(null)
		}
	}

	function handleConfirmDelete() {
		const pendingRow = pendingSingleDeleteRow
		setShowDeleteConfirmDialog(false)
		setPendingSingleDeleteRow(null)
		if (pendingRow && activeConnectionId && tableId) {
			const snapshot = tableData
			if (tableData) {
				setTableData(
					removeRowsByPrimaryKey(tableData, pendingRow.primaryKeyColumn, [
						pendingRow.primaryKeyValue
					])
				)
			}
			deleteRows.mutate(
				{
					connectionId: activeConnectionId,
					tableName: tableRefName ?? tableId,
					primaryKeyColumn: pendingRow.primaryKeyColumn,
					primaryKeyValues: [pendingRow.primaryKeyValue]
				},
				{
					onSuccess: function onSingleDeleteSuccess() {
						trackRowDeletion(
							activeConnectionId,
							tableRefName ?? tableId,
							[pendingRow.row],
							pendingRow.primaryKeyColumn
						)
						loadTableData()
					},
					onError: function onSingleDeleteError(error) {
						setTableData(snapshot)
						notifyActionFailure('Failed to delete row', error)
					}
				}
			)
		} else {
			deleteRowIndexes(Array.from(rowsForActions))
		}
	}

	function handleUndoRedo(direction: 'undo' | 'redo') {
		if (pickUndoTarget(isDryEditMode) === 'committed') {
			const run = direction === 'undo' ? undoLatest() : redoLatest()
			void run.then(function (succeeded) {
				if (!succeeded) return
				announceToGrid(
					direction === 'undo' ? 'Undid the last change' : 'Redid the last change'
				)
			})
			return
		}
		const changed = direction === 'undo' ? handleUndoStaged() : handleRedoStaged()
		const title = changed
			? direction === 'undo'
				? 'Undid the last staged edit'
				: 'Redid the staged edit'
			: `No staged edit to ${direction}`
		toast({ title })
		announceToGrid(title)
	}

	function handleStagedAction(action: StagedAction) {
		if (!tableId) return
		const stagedCount = getEditCount(tableId)
		switch (action) {
			case 'toggle-dry-mode':
				setDryEditMode(!isDryEditMode)
				toast({ title: isDryEditMode ? 'Dry run mode off' : 'Dry run mode on' })
				announceToGrid(isDryEditMode ? 'Dry run mode off' : 'Dry run mode on')
				break
			case 'apply':
				if (stagedCount === 0) {
					toast({ title: 'No staged edits to apply' })
					break
				}
				void handleApplyPendingEdits()
				break
			case 'discard':
				if (stagedCount === 0) {
					toast({ title: 'No staged edits to discard' })
					break
				}
				setShowDiscardEditsDialog(true)
				break
			case 'preview':
				setShowSqlPreviewDialog(true)
				break
			case 'undo':
			case 'redo':
				handleUndoRedo(action)
				break
		}
	}

	function handleGridRevertStaged(rowIndex: number, columnName: string | null) {
		const reverted = handleRevertStaged(rowIndex, columnName)
		if (reverted > 0) return
		const title = columnName ? 'No staged edit in this cell' : 'No staged edits in this row'
		toast({ title })
		announceToGrid(title)
	}

	function handleConfirmDiscardEdits() {
		setShowDiscardEditsDialog(false)
		handleDiscardPendingEdits()
	}

	function handleGridHideColumn(columnName: string) {
		if (filteredColumns.length <= 1) {
			toast({ title: 'Cannot hide the last visible column', variant: 'destructive' })
			return
		}
		handleToggleColumn(columnName, false)
		toast({
			title: `Hid column ${columnName}`,
			description: 'Show it again from the columns menu in the toolbar.'
		})
	}

	function handleGridFilterColumn(columnName: string) {
		handleFilterAdd({ column: columnName, operator: 'eq', value: '' })
		shouldFocusFilterValueRef.current = true
	}

	function handleInsertRowAt(rowIndex: number, position: 'above' | 'below') {
		if (!tableData) return
		handleAddRecord()
		setDraftInsertIndex(getDraftInsertIndex(rowIndex, position))
	}

	function handleGridDraftCancel() {
		handleDraftCancel()
		handleEscapeToGrid()
	}

	function handleGridDraftSave() {
		handleDraftSave()
		handleEscapeToGrid()
	}

	function handleGridNotify(notice: GridNotice) {
		toast({
			title: notice.message,
			variant: notice.level === 'warning' ? 'destructive' : 'default'
		})
	}

	function handleBulkEditSubmit(columnName: string, newValue: unknown) {
		const rowIndexes = Array.from(rowsForActions)
		setShowBulkEditDialog(false)
		setSelectedRows(new Set())
		handleBatchCellEdit(rowIndexes, columnName, newValue)
	}

	function handleSetNullSubmit(columnName: string) {
		const rowIndexes = Array.from(rowsForActions)
		setShowSetNullDialog(false)
		setSelectedRows(new Set())
		handleBatchCellEdit(rowIndexes, columnName, null)
	}

	function handleExportDialogChange(open: boolean) {
		if (!open) setExportDialogFormat(null)
	}

	function exportMatchingRows() {
		if (exportDialogFormat) runExport(exportDialogFormat, false)
	}

	function exportAllRows() {
		if (exportDialogFormat) runExport(exportDialogFormat, true)
	}

	const on = useStableHandlers({
		refresh: loadTableData,
		exportJson: canExportFile ? requestJsonExport : noop,
		exportCsv: canExportFile ? requestCsvExport : undefined,
		exportSql: canExportFile ? requestSqlExport : undefined,
		backup: handleBackupDatabase,
		restore: handleRestoreDatabase,
		addRecord: canEditRows ? handleAddRecord : undefined,
		importCsv: canImportFile ? openImportDialog : undefined,
		toggleColumn: handleToggleColumn,
		dryEditModeChange: canEditRows ? setDryEditMode : undefined,
		copySchema: handleCopySchema,
		copyDrizzleSchema: handleCopyDrizzleSchema,
		rowSelect: handleRowSelect,
		rowsSelect: handleRowsSelect,
		selectAll: handleSelectAll,
		filterAdd: handleFilterAdd,
		blobAction: handleBlobAction,
		cellEdit: canEditRows ? handleCellEdit : undefined,
		deleteSelectedRows: canEditRows ? handleBulkDelete : undefined,
		focusActionBar: handleFocusActionBar,
		batchCellEdit: canEditRows ? handleBatchCellEdit : undefined,
		cellsEdit: canEditRows ? handleCellsEdit : undefined,
		insertRow: canEditRows ? handleInsertRowAt : undefined,
		gridNotify: handleGridNotify,
		stagedAction: canEditRows ? handleStagedAction : undefined,
		revertStaged: canEditRows ? handleGridRevertStaged : undefined,
		rowAction: handleRowAction,
		draftChange: handleDraftChange,
		draftSave: handleGridDraftSave,
		draftCancel: handleGridDraftCancel,
		fkNavigate: handleFKNavigate,
		applyPendingEdits: handleApplyPendingEdits,
		discardPendingEdits: handleDiscardPendingEdits,
		addDialogOpenChange: handleAddDialogOpenChange,
		addRecordSubmit: handleAddRecordSubmit,
		closeRowDetail,
		dropTable: handleDropTable,
		deleteDialogChange: handleDeleteDialogChange,
		confirmDelete: handleConfirmDelete,
		bulkEditSubmit: handleBulkEditSubmit,
		setNullSubmit: handleSetNullSubmit,
		importRows: handleImportRows,
		exportDialogChange: handleExportDialogChange,
		exportMatchingRows,
		exportAllRows
	})

	// No connection selected
	if (!activeConnectionId) {
		return <DatabaseStudioNoConnection onAddConnection={onAddConnection} />
	}

	// A dead connection is checked before the table branches: a table restored
	// from the previous session would otherwise render a grid whose every fetch
	// fails, leaving a skeleton that never resolves behind a stack of toasts.
	if (schemaQuery.isError) {
		return withDataFileChrome(
			<DatabaseStudioConnectionFailed
				connectionName={activeConnection?.name}
				errorMessage={
					schemaQuery.error instanceof Error ? schemaQuery.error.message : undefined
				}
				onRetry={function () {
					void schemaQuery.refetch()
				}}
				onEditConnection={onEditConnection}
			/>
		)
	}

	// No table selected
	if (!tableId) {
		if (schemaQuery.isLoading && !schemaQuery.data) {
			return withDataFileChrome(
				<ConnectionLoadingState
					connectionId={activeConnectionId}
					connectionName={activeConnection?.name}
				/>
			)
		}

		if (schemaQuery.data && schemaSummary.tableCount === 0) {
			return withDataFileChrome(
				<DatabaseStudioNoTablesFound connectionName={activeConnection?.name} />
			)
		}

		return withDataFileChrome(
			<DatabaseStudioNoTable
				connectionName={activeConnection?.name}
				tableCount={schemaSummary.tableCount}
				totalRecords={schemaSummary.totalRecords}
				onOpenSettings={onOpenSettings}
			/>
		)
	}

	// Structure view
	if (viewMode === 'structure' && tableData) {
		return withDataFileChrome(
			<DatabaseStudioStructureView
				displayTableName={displayTableName}
				tableData={tableData}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				onRefresh={on.refresh}
				onExport={on.exportJson}
				onExportCsv={on.exportCsv}
				onExportSql={on.exportSql}
				onBackup={on.backup}
				onRestore={on.restore}
				loadingStore={loadingStore}
				onCopySchema={on.copySchema}
				onCopyDrizzleSchema={on.copyDrizzleSchema}
				showLiveMonitor={showLiveMonitor}
				pagination={pagination}
				onPaginationChange={setPagination}
				showAddColumnDialog={showAddColumnDialog}
				onShowAddColumnDialogChange={setShowAddColumnDialog}
				onAddColumn={canEditRows ? handleAddColumn : undefined}
				showDropTableDialog={showDropTableDialog}
				onShowDropTableDialogChange={setShowDropTableDialog}
				onDropTable={canEditRows ? handleDropTable : undefined}
				onDropColumn={canEditRows ? handleDropColumn : undefined}
				isDdlLoading={isDdlLoading}
			/>
		)
	}

	const toolbar = (
		<StudioToolbar
			viewMode={viewMode}
			onViewModeChange={setViewMode}
			onRefresh={on.refresh}
			onExport={on.exportJson}
			onExportCsv={on.exportCsv}
			onExportSql={on.exportSql}
			onBackup={on.backup}
			onRestore={on.restore}
			onAddRecord={on.addRecord}
			onImportCsv={on.importCsv}
			importFilesAction={importFilesAction}
			loadingStore={loadingStore}
			filterGroup={filterGroup}
			onFilterGroupChange={handleFilterGroupChange}
			columns={tableData?.columns}
			visibleColumns={visibleColumns}
			onToggleColumn={on.toggleColumn}
			isDryEditMode={isDryEditMode}
			onDryEditModeChange={on.dryEditModeChange}
			onCopySchema={on.copySchema}
			onCopyDrizzleSchema={on.copyDrizzleSchema}
			showLiveMonitor={showLiveMonitor}
		/>
	)

	if (viewMode === 'chart' && tableData) {
		return withDataFileChrome(
			<div className='flex h-full min-h-0 flex-col bg-background relative'>
				{toolbar}
				<div className='min-h-0 flex-1'>
					<Suspense fallback={null}>
						<ResultChartPanel
							columns={tableData.columns}
							rows={tableData.rows}
							config={chartConfig}
							onConfigChange={setChartConfig}
							title={`${displayTableName} chart`}
						/>
					</Suspense>
				</div>
			</div>
		)
	}

	const isGridShown = Boolean(tableData) && !isTablePending
	const pendingEditCount = getEditCount(tableId)

	// Content view (default)
	return withDataFileChrome(
		<div className='flex h-full min-h-0 flex-col bg-background relative'>
			{toolbar}

			<div
				ref={gridContainerRef}
				className='relative min-h-0 flex-1 overflow-hidden'
				role='region'
				aria-label={`Table data for ${displayTableName}`}
				aria-busy={isTablePending && !tableData}
			>
				{tableData && isGridShown && (
					<div className='h-full min-h-0'>
						<DataGrid
							columns={filteredColumns}
							rows={tableData.rows}
							selectedRows={selectedRows}
							onRowSelect={on.rowSelect}
							onRowsSelect={on.rowsSelect}
							onSelectAll={on.selectAll}
							sort={sort}
							onSortChange={setSort}
							onFilterAdd={on.filterAdd}
							onBlobAction={on.blobAction}
							onCellEdit={on.cellEdit}
							onDeleteSelectedRows={on.deleteSelectedRows}
							onFocusActionBar={on.focusActionBar}
							onBatchCellEdit={on.batchCellEdit}
							onRowAction={on.rowAction}
							canEditRows={canEditRows}
							tableName={displayTableName}
							selectedCells={selectedCells}
							onCellSelectionChange={setSelectedCells}
							initialFocusedCell={focusedCell}
							onFocusedCellChange={setFocusedCell}
							onContextMenuChange={setContextMenuState}
							draftRow={draftRow}
							onDraftChange={on.draftChange}
							onDraftSave={on.draftSave}
							onDraftCancel={on.draftCancel}
							pendingEdits={pendingEditsSet}
							highlightedRows={highlightedRowIndexes}
							draftInsertIndex={draftInsertIndex}
							onFKNavigate={on.fkNavigate}
							workspaceStateKey={workspaceStateKey}
							rowNumberOffset={pagination.offset}
							totalRowCount={tableData.totalCount}
							onRequestRow={handleGridRequestRow}
							onPageChange={handleGridPageChange}
							onCellsEdit={on.cellsEdit}
							onInsertRow={on.insertRow}
							onNotify={on.gridNotify}
							onStagedAction={on.stagedAction}
							onRevertStaged={on.revertStaged}
							onHideColumn={handleGridHideColumn}
							onFilterColumn={handleGridFilterColumn}
							liveMessage={gridLiveMessage}
						/>
					</div>
				)}
				<TableLoadingSkeleton
					active={isTablePending}
					rows={previousTableRef.current?.rows || 12}
					columns={
						skeletonColumns ??
						Math.min(previousTableRef.current?.columns || visibleColumns.size || 6, 8)
					}
				/>
				{!tableData && !isTablePending && (
					<EmptyState
						role='status'
						aria-live='polite'
						size='sm'
						illustration={<RecordIllustration />}
						title='No data available'
						description='This table returned nothing to show.'
					/>
				)}
			</div>

			<AnimatePresence>
				{tableData &&
					(settings.selectionBarStyle === 'static' || !settings.selectionBarStyle) &&
					rowsForActions.size > 0 && (
						<SelectionActionBar
							ref={toolbarRef}
							selectedCount={rowsForActions.size}
							onDelete={canEditRows ? handleBarDelete : undefined}
							onCopy={privacyMaskData ? undefined : handleBulkCopy}
							onSetNull={canEditRows ? handleOpenSetNull : undefined}
							onDuplicate={canEditRows ? handleBulkDuplicate : undefined}
							onExportJson={canExportFile ? handleExportJson : undefined}
							onExportCsv={canExportFile ? handleExportCsv : undefined}
							onBulkEdit={canEditRows ? handleOpenBulkEdit : undefined}
							onSave={canEditRows ? handleApplyPendingEdits : undefined}
							pendingEditCount={pendingEditCount}
							onClearSelection={handleBarClearSelection}
							focusShortcut={formatShortcutList(shortcuts.focusToolbar.combo)}
							onEscapeToGrid={handleEscapeToGrid}
							mode='static'
						/>
					)}
			</AnimatePresence>

			{(tableData || isTablePending) && (
				<BottomStatusBar
					pagination={pagination}
					onPaginationChange={setPagination}
					rowCount={tableData?.rows.length ?? 0}
					totalCount={tableData?.totalCount ?? 0}
					executionTime={tableData?.executionTime ?? 0}
					showLiveMonitor={showLiveMonitor}
					isPending={!isGridShown}
				/>
			)}

			<AnimatePresence>
				{tableData &&
					settings.selectionBarStyle === 'floating' &&
					rowsForActions.size > 0 && (
						<SelectionActionBar
							ref={toolbarRef}
							selectedCount={rowsForActions.size}
							onDelete={canEditRows ? handleBarDelete : undefined}
							onCopy={privacyMaskData ? undefined : handleBulkCopy}
							onDuplicate={canEditRows ? handleBulkDuplicate : undefined}
							onExportJson={canExportFile ? handleExportJson : undefined}
							onExportCsv={canExportFile ? handleExportCsv : undefined}
							onSetNull={canEditRows ? handleOpenSetNull : undefined}
							onBulkEdit={canEditRows ? handleOpenBulkEdit : undefined}
							onSave={canEditRows ? handleApplyPendingEdits : undefined}
							pendingEditCount={pendingEditCount}
							onClearSelection={handleBarClearSelection}
							focusShortcut={formatShortcutList(shortcuts.focusToolbar.combo)}
							onEscapeToGrid={handleEscapeToGrid}
							mode='floating'
						/>
					)}
			</AnimatePresence>

			{canEditRows && (
				<QuietPendingChangesBar
					editCount={pendingEditCount}
					isApplying={isApplyingEdits}
					onApply={on.applyPendingEdits}
					onCancel={on.discardPendingEdits}
					applyShortcut={formatShortcutList(shortcuts.gridApplyEdits.combo)}
					discardShortcut={formatShortcutList(shortcuts.gridDiscardEdits.combo)}
				/>
			)}

			<QuietAddRecordDialog
				open={showAddDialog}
				onOpenChange={on.addDialogOpenChange}
				columns={tableData?.columns || NO_COLUMNS}
				onSubmit={on.addRecordSubmit}
				isLoading={insertRow.isPending || updateCell.isPending}
				initialData={duplicateInitialData}
				mode={addDialogMode}
			/>

			{tableData && selectedRowForDetail && (
				<QuietRowDetailPanel
					open={showRowDetail}
					onClose={on.closeRowDetail}
					row={selectedRowForDetail}
					columns={tableData.columns}
					tableName={displayTableName}
				/>
			)}

			<QuietDropTableDialog
				open={showDropTableDialog}
				onOpenChange={setShowDropTableDialog}
				tableName={displayTableName || ''}
				onConfirm={on.dropTable}
				isLoading={isDdlLoading}
			/>

			<DiscardEditsDialog
				open={showDiscardEditsDialog}
				onOpenChange={setShowDiscardEditsDialog}
				editCount={tableId ? getEditCount(tableId) : 0}
				onConfirm={handleConfirmDiscardEdits}
				onReturnFocus={handleEscapeToGrid}
			/>

			<PendingSqlPreviewDialog
				open={showSqlPreviewDialog}
				onOpenChange={setShowSqlPreviewDialog}
				statements={
					showSqlPreviewDialog && tableId
						? buildPendingEditsSql(
								getEditsForTable(tableId),
								tableRefName ?? tableId,
								toTableDialect(activeConnection?.type)
							)
						: NO_STATEMENTS
				}
				onApply={canEditRows ? on.applyPendingEdits : undefined}
				onReturnFocus={handleEscapeToGrid}
			/>

			<DeleteRowsDialog
				open={showDeleteConfirmDialog}
				onOpenChange={on.deleteDialogChange}
				target={
					pendingSingleDeleteRow
						? '1 row'
						: `${rowsForActions.size} row${rowsForActions.size !== 1 ? 's' : ''}`
				}
				onConfirm={on.confirmDelete}
			/>

			{tableData && (
				<QuietBulkEditDialog
					open={showBulkEditDialog}
					onOpenChange={setShowBulkEditDialog}
					columns={tableData.columns}
					selectedCount={rowsForActions.size}
					onSubmit={on.bulkEditSubmit}
				/>
			)}

			{tableData && (
				<QuietSetNullDialog
					open={showSetNullDialog}
					onOpenChange={setShowSetNullDialog}
					columns={tableData.columns}
					selectedCount={rowsForActions.size}
					onSubmit={on.setNullSubmit}
				/>
			)}

			{tableData && canImportFile && (
				<QuietImportCsvDialog
					open={showImportDialog}
					onOpenChange={setShowImportDialog}
					columns={tableData.columns}
					onImport={on.importRows}
				/>
			)}

			{tableData && showDataSeederDialog && (
				<Suspense fallback={null}>
					<DataSeederDialog
						open={showDataSeederDialog}
						onOpenChange={setShowDataSeederDialog}
						tableName={displayTableName || ''}
						columns={tableData.columns.map((c) => ({
							name: c.name,
							type: c.type,
							isNullable: c.nullable,
							isPrimaryKey: c.primaryKey
						}))}
						onGenerate={handleSeederGenerate}
					/>
				</Suspense>
			)}

			<QuietExportOptionsDialog
				open={exportDialogFormat !== null}
				onOpenChange={on.exportDialogChange}
				format={exportDialogFormat ?? 'json'}
				matchingRowCount={tableData?.totalCount}
				onExportMatching={on.exportMatchingRows}
				onExportAll={on.exportAllRows}
			/>
		</div>
	)
}
