import { TableSkeleton } from '@studio/shared/ui/skeleton'
import { useToast } from '@studio/shared/ui/use-toast'
import { useAdapter, useDataMutation } from '@studio/core/data-provider'
import { tableDataCache } from '@studio/core/table-cache'
import { usePendingEdits } from '@studio/core/pending-edits'
import { useTabs } from '@studio/core/tabs'
import { useSettings } from '@studio/core/settings'
import { useEffectiveShortcuts, useShortcut, useActiveScope } from '@studio/core/shortcuts'
import { useUndo } from '@studio/core/undo'
import { getTableRefParts } from '@studio/shared/utils/table-ref'
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddRecordDialog } from './components/add-record-dialog'
import { BottomStatusBar } from './components/bottom-status-bar'
import { BulkEditDialog } from './components/bulk-edit-dialog'
import { DataGrid } from './components/data-grid'
import type { ContextMenuState } from './components/data-grid'
import { DropTableDialog } from './components/drop-table-dialog'
import {
	DatabaseStudioNoConnection,
	DatabaseStudioNoTable
} from './components/database-studio-empty-states'
import { DatabaseStudioStructureView } from './components/database-studio-structure-view'
import { PendingChangesBar } from './components/pending-changes-bar'
import { RowDetailPanel } from './components/row-detail-panel'
import { SelectionActionBar } from './components/selection-action-bar'
import { SetNullDialog } from './components/set-null-dialog'
import { StudioToolbar } from './components/studio-toolbar'
import { ImportCsvDialog } from './components/import-csv-dialog'
import { DataSeederDialog } from './data-seeder-dialog'
import { useDatabaseStudioSync } from './hooks/use-database-studio-sync'
import { useDatabaseStudioActions } from './hooks/use-database-studio-actions'
import { useDatabaseStudioEdits } from './hooks/use-database-studio-edits'
import { useDatabaseStudioCommands } from './hooks/use-database-studio-commands'
import { buildTableCacheKey } from './utils/table-cache'
import { FilterDescriptor, PaginationState, SortDescriptor, TableData, ViewMode } from './types'

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
	const tableRefName = tableId || tableName
	const displayTableName = tableName || getTableRefParts(tableId).tableName
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
		setFilters,
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
		setFilters,
		displayTableName
	})

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

	const shortcuts = useEffectiveShortcuts()
	const $ = useShortcut()
	useActiveScope($, 'data-grid')

	$.bind(shortcuts.refreshTable.combo).on(
		function () { loadTableData() },
		{ description: shortcuts.refreshTable.description }
	)

	$.bind(shortcuts.exportTable.combo).on(
		function () { handleExport() },
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

	$.bind(shortcuts.deleteRows.combo).on(
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
		handleCopySchema,
		handleCopyDrizzleSchema,
		handleAddColumn,
		handleDropTable
	} = useDatabaseStudioCommands({
		adapter,
		activeConnectionId,
		tableId,
		tableName,
		tableRefName,
		tableData,
		loadTableData,
		setIsDdlLoading,
		setShowAddColumnDialog,
		setShowDropTableDialog,
		notifyActionFailure
	})

	// No connection selected
	if (!activeConnectionId) {
		return (
			<DatabaseStudioNoConnection
				onToggleSidebar={onToggleSidebar}
				isSidebarOpen={isSidebarOpen}
				onAddConnection={onAddConnection}
			/>
		)
	}

	// No table selected
	if (!tableId) {
		return (
			<DatabaseStudioNoTable
				onToggleSidebar={onToggleSidebar}
				isSidebarOpen={isSidebarOpen}
			/>
		)
	}

	// Structure view
	if (viewMode === 'structure' && tableData) {
		return (
			<DatabaseStudioStructureView
				displayTableName={displayTableName}
				tableData={tableData}
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
				changeEvents={liveMonitor.recentEvents}
				unreadChangeCount={liveMonitor.unreadCount}
				onClearChangeEvents={liveMonitor.clearEvents}
				onMarkChangesRead={liveMonitor.markRead}
				pagination={pagination}
				onPaginationChange={setPagination}
				liveMonitorIntervalMs={liveMonitor.config.intervalMs}
				lastPolledAt={liveMonitor.recentEvents[0]?.timestamp ?? null}
				liveMonitorError={liveMonitor.monitorError}
				showAddColumnDialog={showAddColumnDialog}
				onShowAddColumnDialogChange={setShowAddColumnDialog}
				onAddColumn={handleAddColumn}
				showDropTableDialog={showDropTableDialog}
				onShowDropTableDialogChange={setShowDropTableDialog}
				onDropTable={handleDropTable}
				isDdlLoading={isDdlLoading}
			/>
		)
	}

	// Content view (default)
	return (
		<div className='flex h-full min-h-0 flex-col bg-background relative'>
			<div role='status' aria-live='polite' aria-atomic='true' className='sr-only'>
				{selectionAnnouncement}
			</div>
			<StudioToolbar
				tableName={displayTableName}
				viewMode={viewMode}
				onViewModeChange={setViewMode}
				onToggleSidebar={onToggleSidebar}
				isSidebarOpen={isSidebarOpen}
				onRefresh={loadTableData}
				onExport={handleExport}
				onExportCsv={handleExportCsvAll}
				onExportSql={handleExportSqlAll}
				onAddRecord={handleAddRecord}
				onImportCsv={() => setShowImportDialog(true)}
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
				changeEvents={liveMonitor.recentEvents}
				unreadChangeCount={liveMonitor.unreadCount}
				onClearChangeEvents={liveMonitor.clearEvents}
				onMarkChangesRead={liveMonitor.markRead}
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
							onCellEdit={handleCellEdit}
							onBatchCellEdit={handleBatchCellEdit}
							onRowAction={handleRowAction}
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
					onDelete={handleBulkDelete}
					onCopy={handleBulkCopy}
					onSetNull={handleOpenSetNull}
					onDuplicate={handleBulkDuplicate}
					onExportJson={handleExportJson}
					onExportCsv={handleExportCsv}
					onBulkEdit={handleOpenBulkEdit}
					onSave={handleApplyPendingEdits}
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
					liveMonitorEnabled={liveMonitor.config.enabled}
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
						onDelete={handleBulkDelete}
						onCopy={handleBulkCopy}
						onDuplicate={handleBulkDuplicate}
						onExportJson={handleExportJson}
						onExportCsv={handleExportCsv}
						onSetNull={handleOpenSetNull}
						onBulkEdit={handleOpenBulkEdit}
						onSave={handleApplyPendingEdits}
						pendingEditCount={tableId ? getEditCount(tableId) : 0}
						onClearSelection={handleClearSelection}
						onEscapeToGrid={handleEscapeToGrid}
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

			{tableData && (
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
		</div>
	)
}
