import { TableSkeleton } from '@studio/shared/ui/skeleton'
import { useToast } from '@studio/shared/ui/use-toast'
import { useAdapter, useDataMutation, useConnections, useSchema } from '@studio/core/data-provider'
import { tableDataCache } from '@studio/core/table-cache'
import { usePendingEdits } from '@studio/core/pending-edits'
import { useTabs } from '@studio/core/tabs'
import { useSettings } from '@studio/core/settings'
import { useEffectiveShortcuts, useShortcut, useActiveScope } from '@studio/core/shortcuts'
import { useUndo } from '@studio/core/undo'
import { getTableRefParts } from '@studio/shared/utils/table-ref'
import { getSourceCaps } from '@studio/features/connections/source-caps'
import { isUiActionVisible } from '@studio/features/connections/ui-actions'
import { askAi, buildSuggestIndexesPrompt } from '@studio/features/ai-assistant/ai-actions'
import { DataFileSessionChrome } from './components/data-file-session-chrome'
import { ImportFilesIntoDuckDbButton } from './components/import-files-into-duckdb-button'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@studio/shared/ui/alert-dialog'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AddRecordDialog } from './components/add-record-dialog'
import { BottomStatusBar } from './components/bottom-status-bar'
import { BulkEditDialog } from './components/bulk-edit-dialog'
import { DataGrid } from './components/data-grid'
import type { ContextMenuState } from './components/data-grid'
import { DropTableDialog } from './components/drop-table-dialog'
import {
	DatabaseStudioNoConnection,
	DatabaseStudioNoTable,
	DatabaseStudioConnectionLoading,
	DatabaseStudioConnectionFailed,
	DatabaseStudioNoTablesFound
} from './components/database-studio-empty-states'
import { DatabaseStudioStructureView } from './components/database-studio-structure-view'
import { PendingChangesBar } from './components/pending-changes-bar'
import { RowDetailPanel } from './components/row-detail-panel'
import { SelectionActionBar } from './components/selection-action-bar'
import { SetNullDialog } from './components/set-null-dialog'
import { StudioToolbar } from './components/studio-toolbar'
import { ExportOptionsDialog, type ExportFormatChoice } from './components/export-options-dialog'
import { ImportCsvDialog } from './components/import-csv-dialog'
import { DataSeederDialog } from './data-seeder-dialog'
import { useDatabaseStudioSync } from './hooks/use-database-studio-sync'
import { useDatabaseStudioActions } from './hooks/use-database-studio-actions'
import { useDatabaseStudioEdits } from './hooks/use-database-studio-edits'
import { useDatabaseStudioCommands } from './hooks/use-database-studio-commands'
import { buildTableCacheKey } from './utils/table-cache'
import { FilterConjunction, FilterDescriptor, FilterGroup, PaginationState, SortDescriptor, TableData, ViewMode } from './types'
import { flatFiltersToGroup, groupToFlatFilters } from '@studio/core/data-provider/filter-sql'
import { ResultChartPanel } from '@studio/features/result-charts/result-chart-panel'
import type { ResultChartConfig } from '@studio/features/result-charts/types'
import { commands } from '@studio/lib/bindings'
import type { ColumnDefinition } from './types'
import type { BlobAction } from './components/cell-context-menu'
import { bytesToBase64, bytesToHex } from './components/cells/blob-utils'

type Props = {
	tableId: string | null
	tableName: string | null
	activeConnectionId?: string
	onAddConnection?: () => void
	onEditConnection?: () => void
	onConnectionSelect?: (connectionId: string) => void
	initialRowPK?: string | number | null
	onRowSelectionChange?: (pk: string | number | null) => void
}

export function DatabaseStudio({
	tableId,
	tableName,
	activeConnectionId,
	onAddConnection,
	onEditConnection,
	onConnectionSelect,
	initialRowPK,
	onRowSelectionChange
}: Props) {
	const tableRefName = tableId || tableName
	const displayTableName = tableName || getTableRefParts(tableId).tableName
	const initialCacheEntry = tableDataCache.get(
		buildTableCacheKey(activeConnectionId, tableId, 50, 0, undefined, [])
	)
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
	const canEditRows = sourceCaps ? isUiActionVisible('edit-rows', sourceCaps) : false
	const canImportFile = sourceCaps ? isUiActionVisible('import-csv', sourceCaps) : false
	const canAttachFiles = sourceCaps ? isUiActionVisible('attach-file', sourceCaps) : false
	const canExportFile = sourceCaps ? isUiActionVisible('export-data', sourceCaps) : true
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
	const importFilesAction =
		canAttachFiles && activeConnectionId && activeConnection ? (
			<ImportFilesIntoDuckDbButton
				connectionId={activeConnectionId}
				connectionLabel={activeConnection.name}
				existingTableNames={existingTableNames}
			/>
		) : null

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
	const [isLoading, setIsLoading] = useState(false)
	const [isTableTransitioning, setIsTableTransitioning] = useState(!initialCacheEntry)
	const [viewMode, setViewMode] = useState<ViewMode>('content')
	const [chartConfig, setChartConfig] = useState<ResultChartConfig | null>(null)
	const previousTableRef = useRef<{ columns: number; rows: number } | null>(null)
	const [pagination, setPagination] = useState<PaginationState>({ limit: 50, offset: 0 })
	const [sort, setSort] = useState<SortDescriptor | undefined>()
	const [filters, setFilters] = useState<FilterDescriptor[]>([])
	const [filterConjunction, setFilterConjunction] = useState<FilterConjunction>('AND')
	// Structured AND/OR filter tree (#102). Source of truth for the filter UI and
	// the data fetch. The flat `filters`/`filterConjunction` above are kept in sync
	// as the root-level projection, for cache keys and tab persistence (#98).
	const [filterGroup, setFilterGroup] = useState<FilterGroup>({ logic: 'AND', conditions: [] })
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
	const [showImportDialog, setShowImportDialog] = useState(false)
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

	const currentCacheKey = useMemo(
		function () {
			return buildTableCacheKey(
				activeConnectionId,
				tableId,
				pagination.limit,
				pagination.offset,
				sort,
				filters,
				filterConjunction,
				filterGroup
			)
		},
		[activeConnectionId, tableId, pagination.limit, pagination.offset, sort, filters, filterConjunction, filterGroup]
	)
	const {
		liveMonitor,
		stableUrlState,
		loadTableData
	} = useDatabaseStudioSync({
		adapter,
		activeConnectionId,
		tableId,
		tableName,
		tableRefName,
		currentCacheKey,
		pagination,
		sort,
		filters,
		filterConjunction,
		filterGroup,
		tableData,
		draftRow,
		draftInsertIndex,
		isApplyingEdits,
		selectedRows,
		selectedCells,
		focusedCell,
		contextMenuState,
		initialRowPK,
		onRowSelectionChange,
		setTableData,
		setVisibleColumns,
		setIsLoading,
		setIsTableTransitioning,
		setPagination,
		setSort,
		setFilters: handleSetFiltersFromSync,
		setSelectedRows,
		setSelectedCells,
		setFocusedCell,
		setContextMenuState,
		setDraftRow,
		setDraftInsertIndex
	})

	const handleEscapeToGrid = useCallback(function () {
		const grid = gridContainerRef.current?.querySelector<HTMLElement>('table[role="grid"]')
		if (grid) {
			grid.focus()
		}
	}, [])

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
		updateCell,
		deleteRows,
		insertRow,
		onLoadTableData: loadTableData,
		setSelectedRows,
		setSelectedCells,
		setFocusedCell,
		setShowDeleteConfirmDialog,
		setPendingSingleDeleteRow,
		setShowAddDialog,
		setIsBulkActionLoading,
		setDraftRow,
		setDraftInsertIndex,
		setEditingRowState,
		setDuplicateInitialData,
		setAddDialogMode,
		setSelectedRowForDetail,
		setShowRowDetail,
		setFilters: handleSetFiltersFromSync,
		displayTableName
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

	useEffect(
		function cachePreviousTableDimensions() {
			if (tableData && !isLoading) {
				previousTableRef.current = {
					columns: tableData.columns.length,
					rows: Math.min(tableData.rows.length, 12)
				}
			}
		},
		[tableData, isLoading]
	)

	useEffect(
		function resetChartConfigForTable() {
			setChartConfig(null)
		},
		[tableId]
	)

	const shortcuts = useEffectiveShortcuts()
	const $ = useShortcut()
	useActiveScope($, 'data-grid')

	$.bind(shortcuts.refreshTable.combo).on(
		function () { loadTableData() },
		{ description: shortcuts.refreshTable.description }
	)

	$.bind(shortcuts.exportTable.combo).on(
		function () { requestExport('json') },
		{ description: shortcuts.exportTable.description }
	)

	$.bind(shortcuts.focusToolbar.combo).on(
		function () {
			if (rowsForActions.size > 0 && toolbarRef.current) {
				toolbarRef.current.focus()
				// Optionally find the first button and focus it?
				// For now, focusing the container (which has accessible children) is a good start,
				// but usually we want to focus the first interactive element.
				const firstButton = toolbarRef.current.querySelector('button')
				if (firstButton) {
					;(firstButton as HTMLElement).focus()
				}
			}
		},
		{ description: shortcuts.focusToolbar.description }
	)

	$.bind(shortcuts.deleteRows.combo)
		.except('typing')
		.on(
			function () {
				if (rowsForActions.size > 0 && !isBulkActionLoading) {
					handleBulkDelete()
				}
			},
			{ description: shortcuts.deleteRows.description }
		)

	$.bind(shortcuts.deselect.combo).on(
		function () {
			setSelectedRows(new Set())
			setFocusedCell(null)
			setSelectedCells(new Set())
		},
		{ description: shortcuts.deselect.description }
	)

	const { trackCellMutation, trackBatchCellMutation } = useUndo({ onUndoComplete: loadTableData })

	const { openTab } = useTabs()

	function handleFKNavigate(referencedTable: string, _referencedColumn: string, _value: unknown, referencedSchema?: string) {
		if (!activeConnectionId) return
		const tableRef = referencedSchema ? `${referencedSchema}.${referencedTable}` : referencedTable
		openTab({
			connectionId: activeConnectionId,
			tableId: tableRef,
			tableName: tableRef,
			label: referencedTable,
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
					tableName: tableRefName,
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
					tableName: tableRefName,
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
		handleBatchCellEdit
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
		removeEdit,
		clearEdits,
		updateCell,
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

	const handleSuggestIndexes = useCallback(
		function () {
			if (!tableData) return
			const columnLines = tableData.columns
				.map(function (col) {
					const flags: string[] = [col.type]
					if (col.primaryKey) flags.push('PRIMARY KEY')
					if (!col.nullable) flags.push('NOT NULL')
					if (col.foreignKey) {
						flags.push(
							`REFERENCES ${col.foreignKey.referencedTable}(${col.foreignKey.referencedColumn})`
						)
					}
					return `  ${col.name} ${flags.join(' ')}`
				})
				.join('\n')
			const schema = `CREATE TABLE ${displayTableName} (\n${columnLines}\n);`
			const queries =
				'No recent query samples available; base suggestions on the schema and common access patterns.'
			askAi(buildSuggestIndexesPrompt(schema, queries))
		},
		[tableData, displayTableName]
	)

	// No connection selected
	if (!activeConnectionId) {
		return (
			<DatabaseStudioNoConnection onAddConnection={onAddConnection} />
		)
	}

	// No table selected
	if (!tableId) {
		if (schemaQuery.isLoading && !schemaQuery.data) {
			return withDataFileChrome(
				<DatabaseStudioConnectionLoading connectionName={activeConnection?.name} />
			)
		}

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
				onRefresh={loadTableData}
				onExport={canExportFile ? function () { requestExport('json') } : function () {}}
				onExportCsv={canExportFile ? function () { requestExport('csv') } : undefined}
				onExportSql={canExportFile ? function () { requestExport('sql') } : undefined}
				onBackup={handleBackupDatabase}
				onRestore={handleRestoreDatabase}
				isLoading={isLoading}
				onCopySchema={handleCopySchema}
				onCopyDrizzleSchema={handleCopyDrizzleSchema}
				liveMonitorConfig={showLiveMonitor ? liveMonitor.config : undefined}
				onLiveMonitorConfigChange={showLiveMonitor ? liveMonitor.setConfig : undefined}
				isLiveMonitorPolling={showLiveMonitor ? liveMonitor.isPolling : false}
				changeEvents={showLiveMonitor ? liveMonitor.recentEvents : undefined}
				unreadChangeCount={showLiveMonitor ? liveMonitor.unreadCount : undefined}
				onClearChangeEvents={showLiveMonitor ? liveMonitor.clearEvents : undefined}
				onMarkChangesRead={showLiveMonitor ? liveMonitor.markRead : undefined}
				pagination={pagination}
				onPaginationChange={setPagination}
				liveMonitorIntervalMs={liveMonitor.config.intervalMs}
				lastPolledAt={liveMonitor.recentEvents[0]?.timestamp ?? null}
				liveMonitorError={liveMonitor.monitorError}
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

	if (viewMode === 'chart' && tableData) {
		return withDataFileChrome(
			<div className='flex h-full min-h-0 flex-col bg-background relative'>
				<StudioToolbar
					tableName={displayTableName}
					viewMode={viewMode}
					onViewModeChange={setViewMode}
					onRefresh={loadTableData}
					onExport={canExportFile ? function () { requestExport('json') } : function () {}}
					onExportCsv={canExportFile ? function () { requestExport('csv') } : undefined}
					onExportSql={canExportFile ? function () { requestExport('sql') } : undefined}
					onBackup={handleBackupDatabase}
					onRestore={handleRestoreDatabase}
					onAddRecord={canEditRows ? handleAddRecord : undefined}
					onImportCsv={canImportFile ? function () { setShowImportDialog(true) } : undefined}
					importFilesAction={importFilesAction}
					isLoading={isLoading}
					filterGroup={filterGroup}
					onFilterGroupChange={handleFilterGroupChange}
					columns={tableData.columns}
					visibleColumns={visibleColumns}
					onToggleColumn={handleToggleColumn}
					isDryEditMode={isDryEditMode}
					onDryEditModeChange={canEditRows ? setDryEditMode : undefined}
					onCopySchema={handleCopySchema}
					onCopyDrizzleSchema={handleCopyDrizzleSchema}
					onSuggestIndexes={handleSuggestIndexes}
					liveMonitorConfig={showLiveMonitor ? liveMonitor.config : undefined}
					onLiveMonitorConfigChange={showLiveMonitor ? liveMonitor.setConfig : undefined}
					isLiveMonitorPolling={showLiveMonitor ? liveMonitor.isPolling : false}
					changeEvents={showLiveMonitor ? liveMonitor.recentEvents : undefined}
					unreadChangeCount={showLiveMonitor ? liveMonitor.unreadCount : undefined}
					onClearChangeEvents={showLiveMonitor ? liveMonitor.clearEvents : undefined}
					onMarkChangesRead={showLiveMonitor ? liveMonitor.markRead : undefined}
				/>
				<div className='min-h-0 flex-1'>
					<ResultChartPanel
						columns={tableData.columns}
						rows={tableData.rows}
						config={chartConfig}
						onConfigChange={setChartConfig}
						title={`${displayTableName} chart`}
					/>
				</div>
			</div>
		)
	}

	// Content view (default)
	return withDataFileChrome(
		<div className='flex h-full min-h-0 flex-col bg-background relative'>
			<div role='status' aria-live='polite' aria-atomic='true' className='sr-only'>
				{selectionAnnouncement}
			</div>
			<StudioToolbar
				tableName={displayTableName}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				onRefresh={loadTableData}
				onExport={canExportFile ? function () { requestExport('json') } : function () {}}
				onExportCsv={canExportFile ? function () { requestExport('csv') } : undefined}
				onExportSql={canExportFile ? function () { requestExport('sql') } : undefined}
				onBackup={handleBackupDatabase}
				onRestore={handleRestoreDatabase}
				onAddRecord={canEditRows ? handleAddRecord : undefined}
				onImportCsv={canImportFile ? function () { setShowImportDialog(true) } : undefined}
				importFilesAction={importFilesAction}
				isLoading={isLoading}
				filterGroup={filterGroup}
				onFilterGroupChange={handleFilterGroupChange}
				columns={tableData?.columns || []}
				visibleColumns={visibleColumns}
				onToggleColumn={handleToggleColumn}
				isDryEditMode={isDryEditMode}
				onDryEditModeChange={canEditRows ? setDryEditMode : undefined}
				onCopySchema={handleCopySchema}
				onCopyDrizzleSchema={handleCopyDrizzleSchema}
				onSuggestIndexes={handleSuggestIndexes}
				liveMonitorConfig={showLiveMonitor ? liveMonitor.config : undefined}
				onLiveMonitorConfigChange={showLiveMonitor ? liveMonitor.setConfig : undefined}
				isLiveMonitorPolling={showLiveMonitor ? liveMonitor.isPolling : false}
				changeEvents={showLiveMonitor ? liveMonitor.recentEvents : undefined}
				unreadChangeCount={showLiveMonitor ? liveMonitor.unreadCount : undefined}
				onClearChangeEvents={showLiveMonitor ? liveMonitor.clearEvents : undefined}
				onMarkChangesRead={showLiveMonitor ? liveMonitor.markRead : undefined}
			/>

			<div
				ref={gridContainerRef}
				className='relative min-h-0 flex-1 overflow-hidden'
				role='region'
				aria-label={`Table data for ${displayTableName}`}
				aria-busy={isLoading && !tableData}
			>
				{tableData && (
					<div
						className='h-full min-h-0 transition-opacity duration-150'
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
							onBlobAction={handleBlobAction}
							onCellEdit={canEditRows ? handleCellEdit : undefined}
							onDeleteSelectedRows={canEditRows ? handleBulkDelete : undefined}
							onBatchCellEdit={canEditRows ? handleBatchCellEdit : undefined}
							onRowAction={canEditRows ? handleRowAction : undefined}
							tableName={displayTableName}
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
							onFKNavigate={handleFKNavigate}
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
							columns={Math.min(
								previousTableRef.current?.columns || visibleColumns.size || 6,
								8
							)}
						/>
					</div>
				)}
				{!tableData && !isTableTransitioning && (
					<div
						className='flex items-center justify-center h-full'
						role='status'
						aria-live='polite'
					>
						<div className='text-muted-foreground text-sm'>No data available</div>
					</div>
				)}
			</div>

			{tableData && settings.selectionBarStyle === 'static' && rowsForActions.size > 0 && (
				<SelectionActionBar
					ref={toolbarRef}
					selectedCount={rowsForActions.size}
					onDelete={canEditRows ? handleBulkDelete : undefined}
					onCopy={handleBulkCopy}
					onSetNull={canEditRows ? handleOpenSetNull : undefined}
					onDuplicate={canEditRows ? handleBulkDuplicate : undefined}
					onExportJson={canExportFile ? handleExportJson : undefined}
					onExportCsv={canExportFile ? handleExportCsv : undefined}
					onBulkEdit={canEditRows ? handleOpenBulkEdit : undefined}
					onSave={canEditRows ? handleApplyPendingEdits : undefined}
					pendingEditCount={tableId ? getEditCount(tableId) : 0}
					onClearSelection={handleClearSelection}
					onEscapeToGrid={handleEscapeToGrid}
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
					liveMonitorEnabled={showLiveMonitor ? liveMonitor.config.enabled : undefined}
					liveMonitorIntervalMs={liveMonitor.config.intervalMs}
					lastPolledAt={liveMonitor.recentEvents[0]?.timestamp ?? null}
					changesDetected={liveMonitor.unreadCount}
					liveMonitorError={liveMonitor.monitorError}
				/>
			)}

			{/* Render floating bar if mode is floating OR default (undefined) */}
			{tableData &&
				(settings.selectionBarStyle === 'floating' || !settings.selectionBarStyle) &&
				rowsForActions.size > 0 && (
					<SelectionActionBar
						ref={toolbarRef}
						selectedCount={rowsForActions.size}
						onDelete={canEditRows ? handleBulkDelete : undefined}
						onCopy={handleBulkCopy}
						onDuplicate={canEditRows ? handleBulkDuplicate : undefined}
						onExportJson={canExportFile ? handleExportJson : undefined}
						onExportCsv={canExportFile ? handleExportCsv : undefined}
						onSetNull={canEditRows ? handleOpenSetNull : undefined}
						onBulkEdit={canEditRows ? handleOpenBulkEdit : undefined}
						onSave={canEditRows ? handleApplyPendingEdits : undefined}
						pendingEditCount={tableId ? getEditCount(tableId) : 0}
						onClearSelection={handleClearSelection}
						onEscapeToGrid={handleEscapeToGrid}
						mode='floating'
					/>
				)}

			{tableId && canEditRows && hasEdits(tableId) && (
				<PendingChangesBar
					editCount={getEditCount(tableId)}
					isApplying={isApplyingEdits}
					onApply={handleApplyPendingEdits}
					onCancel={handleDiscardPendingEdits}
				/>
			)}

			<AddRecordDialog
				open={showAddDialog}
				onOpenChange={function handleAddDialogOpenChange(open) {
					setShowAddDialog(open)
					if (!open) {
						setEditingRowState(null)
						setDuplicateInitialData(undefined)
						setAddDialogMode('add')
					}
				}}
				columns={tableData?.columns || []}
				onSubmit={handleAddRecordSubmit}
				isLoading={insertRow.isPending || updateCell.isPending}
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
					tableName={displayTableName}
				/>
			)}

			<DropTableDialog
				open={showDropTableDialog}
				onOpenChange={setShowDropTableDialog}
				tableName={displayTableName || ''}
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
							{pendingSingleDeleteRow
								? '1 row'
								: `${selectedRows.size} selected row${selectedRows.size !== 1 ? 's' : ''}`}{' '}
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
											tableName: tableRefName,
											primaryKeyColumn:
												pendingSingleDeleteRow.primaryKeyColumn,
											primaryKeyValues: [
												pendingSingleDeleteRow.primaryKeyValue
											]
										},
										{
											onSuccess: function onSingleDeleteSuccess() {
												loadTableData()
												setShowDeleteConfirmDialog(false)
												setPendingSingleDeleteRow(null)
											},
											onError: function onSingleDeleteError(error) {
												notifyActionFailure('Failed to delete row', error)
											}
										}
									)
								} else {
									deleteRowIndexes(Array.from(rowsForActions))
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
							notifyMissingPrimaryKey('apply bulk edits')
							return
						}

						setIsBulkActionLoading(true)
						const rowIndexes = Array.from(selectedRows)

						Promise.all(
							rowIndexes.map(function (rowIndex) {
								const row = tableData.rows[rowIndex]
								return updateCell.mutateAsync({
									connectionId: activeConnectionId,
									tableName: tableRefName,
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
								notifyActionFailure('Failed to update rows', error)
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
							notifyMissingPrimaryKey('set NULL')
							return
						}

						setIsBulkActionLoading(true)
						const rowIndexes = Array.from(selectedRows)

						Promise.all(
							rowIndexes.map(function (rowIndex) {
								const row = tableData.rows[rowIndex]
								return updateCell.mutateAsync({
									connectionId: activeConnectionId,
									tableName: tableRefName,
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
								notifyActionFailure('Failed to set NULL', error)
							})
							.finally(function () {
								setIsBulkActionLoading(false)
							})
					}}
				/>
			)}

			{tableData && canImportFile && (
				<ImportCsvDialog
					open={showImportDialog}
					onOpenChange={setShowImportDialog}
					columns={tableData.columns}
					onImport={handleImportRows}
				/>
			)}

			{tableData && (
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
			)}

			<ExportOptionsDialog
				open={exportDialogFormat !== null}
				onOpenChange={function (open) {
					if (!open) setExportDialogFormat(null)
				}}
				format={exportDialogFormat ?? 'json'}
				matchingRowCount={tableData?.totalCount}
				onExportMatching={function () {
					if (exportDialogFormat) runExport(exportDialogFormat, false)
				}}
				onExportAll={function () {
					if (exportDialogFormat) runExport(exportDialogFormat, true)
				}}
			/>
		</div>
	)
}
