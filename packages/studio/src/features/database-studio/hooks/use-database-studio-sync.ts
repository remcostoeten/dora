import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
	getLiveMonitorState,
	setLiveMonitorActiveTable,
	subscribeLiveMonitor
} from '@studio/core/live-monitor'
import { overlayPendingEditsOnRows, type PendingEdit } from '@studio/core/pending-edits'
import { readStudioUrlState, writeStudioUrlState } from '@studio/core/url-state/studio-url-state'
import {
	dropTableSnapshot,
	putTableSnapshot,
	readTableSnapshot
} from '@studio/core/workspace-store'
import { getAdapterError } from '@studio/core/data-provider/types'
import { schemaQueryOptions } from '@studio/core/data-provider/schema-query'
import { isConnectionUnavailableError } from '@studio/shared/utils/error-messages'
import { noop } from '@studio/shared/utils/noop'
import { toast } from '@studio/shared/ui/notifier'
import type { DataAdapter } from '@studio/core/data-provider/types'
import type { ViewActivity } from '@studio/core/workspace-views'
import type { DatabaseSchema } from '@studio/lib/bindings'
import { enrichColumnsWithFKs } from '../utils/fk-enrichment'
import { afterNextPaint } from '../utils/after-next-paint'
import type { LoadingStore } from '../utils/loading-store'
import { reconcileTableData } from '../utils/reconcile-table-data'
import {
	readDefaultPageSnapshot,
	schemaHasTable,
	snapshotQuerySignature,
	snapshotToTableData
} from '../utils/table-snapshot'
import { createDefaultValues } from '../utils/studio-data'
import { getTableRefParts } from '@studio/shared/utils/table-ref'
import type {
	FilterConjunction,
	FilterDescriptor,
	FilterGroup,
	PaginationState,
	SortDescriptor,
	TableData
} from '../types'

type Args = {
	adapter: DataAdapter
	activity: ViewActivity
	workspaceStateKey: string
	loadingStore: LoadingStore
	activeConnectionId?: string
	tableId: string | null
	tableName: string | null
	tableRefName: string | null
	currentQuerySignature: string
	pagination: PaginationState
	sort: SortDescriptor | undefined
	filters: FilterDescriptor[]
	filterConjunction: FilterConjunction
	filterGroup: FilterGroup
	tableData: TableData | null
	draftRow: Record<string, unknown> | null
	draftInsertIndex: number | null
	isApplyingEdits: boolean
	hasPendingEdits: boolean
	getEditsForTable: (tableId: string) => PendingEdit[]
	selectedRows: Set<number>
	selectedCells: Set<string>
	focusedCell: { row: number; col: number } | null
	contextMenuState: import('../components/data-grid').ContextMenuState
	initialRowPK?: string | number | null
	onRowSelectionChange?: (pk: string | number | null) => void
	setTableData: (value: TableData | null) => void
	setVisibleColumns: Dispatch<SetStateAction<Set<string>>>
	setIsTablePending: (value: boolean) => void
	resetQueryState: () => void
	setSelectedRows: Dispatch<SetStateAction<Set<number>>>
	setSelectedCells: Dispatch<SetStateAction<Set<string>>>
	setFocusedCell: Dispatch<SetStateAction<{ row: number; col: number } | null>>
	setContextMenuState: Dispatch<
		SetStateAction<import('../components/data-grid').ContextMenuState>
	>
	setDraftRow: Dispatch<SetStateAction<Record<string, unknown> | null>>
	setDraftInsertIndex: Dispatch<SetStateAction<number | null>>
}

export function useDatabaseStudioSync(args: Args) {
	const {
		adapter,
		activity,
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
		hasPendingEdits,
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
	} = args

	const queryClient = useQueryClient()
	const initializedFromUrlRef = useRef(false)
	const loadRequestIdRef = useRef(0)
	const restoredFromPKRef = useRef(false)
	// The snapshot currently painted on screen, as `conn::table` plus the query
	// signature. Used to tell a genuine view switch (paint the snapshot for an
	// instant result) apart from an in-place refresh of the view already shown
	// (don't repaint the now-stale snapshot — it flashes the pre-mutation rows
	// before the fetch returns).
	const displayedViewRef = useRef<string | null>(null)
	// Read through a ref so loadTableData's identity doesn't change on every
	// buffered edit — its identity drives the loadWhenQueryChanges effect, and
	// reloading on each keystroke of a dry edit would defeat the buffer.
	const getEditsForTableRef = useRef(getEditsForTable)
	getEditsForTableRef.current = getEditsForTable
	const onRowSelectionChangeRef = useRef(onRowSelectionChange)
	onRowSelectionChangeRef.current = onRowSelectionChange

	const withPendingEdits = useCallback(function (
		data: TableData,
		forTableId: string | null
	): TableData {
		if (!forTableId) return data
		const edits = getEditsForTableRef.current(forTableId)
		if (edits.length === 0) return data
		return { ...data, rows: overlayPendingEditsOnRows(data.rows, edits) }
	}, [])

	// The latest query state, readable from effects without subscribing to it.
	const queryStateRef = useRef({ tableData })
	queryStateRef.current = { tableData }

	const [preparedViewKey, setPreparedViewKey] = useState(workspaceStateKey)
	if (preparedViewKey !== workspaceStateKey) {
		setPreparedViewKey(workspaceStateKey)
		if (tableId && activeConnectionId) {
			resetQueryState()
			const snapshot = readDefaultPageSnapshot(activeConnectionId, tableId)
			if (snapshot) {
				const next = reconcileTableData(
					tableData,
					withPendingEdits(snapshotToTableData(snapshot), tableId)
				)
				if (next !== tableData) setTableData(next)
				setVisibleColumns(function keepIfEqual(previous) {
					return isSameStringSet(previous, snapshot.visibleColumns)
						? previous
						: new Set(snapshot.visibleColumns)
				})
				setIsTablePending(false)
			} else {
				setVisibleColumns(function keepIfEmpty(previous) {
					return previous.size === 0 ? previous : new Set()
				})
				setIsTablePending(true)
			}
		}
	}

	const externalChangeRef = useRef(false)

	const loadTableData = useCallback(async () => {
		const requestId = loadRequestIdRef.current + 1
		loadRequestIdRef.current = requestId
		const isCurrentRequest = function () {
			return loadRequestIdRef.current === requestId
		}
		externalChangeRef.current = false

		if (!tableId || !tableRefName || !activeConnectionId) {
			loadingStore.set('idle')
			return
		}

		const currentView = `${activeConnectionId}::${tableId}::${currentQuerySignature}`
		const snapshot = readTableSnapshot(activeConnectionId, tableRefName)
		const cached =
			snapshot && snapshotQuerySignature(snapshot) === currentQuerySignature
				? snapshot
				: undefined

		// Skip the instant snapshot-paint when we're refreshing the view already on
		// screen — e.g. after a delete/insert/column change. The snapshot is stale
		// relative to the mutation, so painting it here is the "flash back to the
		// old state". Keep the current rows visible and swap in fresh data.
		let paintedFromSnapshot = false
		if (cached && currentView !== displayedViewRef.current) {
			paintedFromSnapshot = true
			const current = queryStateRef.current.tableData
			const next = reconcileTableData(
				current,
				withPendingEdits(snapshotToTableData(cached), tableId)
			)
			if (next !== current) setTableData(next)
			if (cached.visibleColumns.length > 0) {
				setVisibleColumns(function keepIfEqual(previous) {
					return isSameStringSet(previous, cached.visibleColumns)
						? previous
						: new Set(cached.visibleColumns)
				})
			}
			setIsTablePending(false)
			displayedViewRef.current = currentView
		}

		loadingStore.set(paintedFromSnapshot ? 'revalidating' : 'loading')

		// The schema fetch races the row fetch instead of gating it: it goes
		// through the shared react-query entry (single-flight with useSchema)
		// and is only needed for the stale-table guard and FK enrichment, both
		// of which can apply after rows are on screen.
		let resolvedSchema: DatabaseSchema | null = null
		const schemaPromise = queryClient
			.fetchQuery(schemaQueryOptions(adapter, queryClient, activeConnectionId))
			.then(function (schema: DatabaseSchema) {
				resolvedSchema = schema
				return schema
			})
		schemaPromise.catch(noop)

		const handleStaleTable = function () {
			console.warn('[DatabaseStudio] Skipping stale table selection:', {
				connectionId: activeConnectionId,
				tableRefName
			})
			setTableData(null)
			dropTableSnapshot(activeConnectionId, tableRefName)
			setIsTablePending(false)
		}

		const fetchRows = function () {
			return adapter.fetchTableData(
				activeConnectionId,
				tableRefName,
				Math.floor(pagination.offset / pagination.limit),
				pagination.limit,
				sort,
				filters,
				filterConjunction,
				filterGroup
			)
		}

		try {
			// Lets the snapshot paint reach the screen before the refresh fetch starts.
			if (paintedFromSnapshot) {
				await afterNextPaint()
				if (!isCurrentRequest()) return
			}

			let result = await fetchRows()
			if (!isCurrentRequest()) return

			// Cold boot: the connection opens inside the schema queryFn, so a
			// connection-unavailable fetch means it raced ahead of connect.
			// Wait for the schema query to settle and retry exactly once.
			if (!result.ok && isConnectionUnavailableError(getAdapterError(result))) {
				try {
					await schemaPromise
				} catch {
					noop()
				}
				if (!isCurrentRequest()) return
				result = await fetchRows()
				if (!isCurrentRequest()) return
			}

			if (result.ok) {
				const data = result.data
				const { tableName: tableNamePart, schemaName } = getTableRefParts(tableRefName)

				if (resolvedSchema) {
					// Warm path (cached schema): guard and enrich before the
					// single paint, exactly like the old serial ordering.
					if (!schemaHasTable(resolvedSchema, tableRefName)) {
						handleStaleTable()
						return
					}
					data.columns = enrichColumnsWithFKs(
						data.columns,
						resolvedSchema,
						tableNamePart,
						schemaName ?? undefined
					)
				}

				const current = queryStateRef.current.tableData
				const next = reconcileTableData(current, withPendingEdits(data, tableId))
				if (next !== current) setTableData(next)
				displayedViewRef.current = currentView
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
				setIsTablePending(false)

				const snapshotRows =
					getEditsForTableRef.current(tableId).length > 0 ? data.rows : next.rows
				const snapshotOf = function (columns: TableData['columns']) {
					return {
						connectionId: activeConnectionId,
						tableId: tableRefName,
						columns,
						rows: snapshotRows,
						totalCount: data.totalCount,
						visibleColumns: nextVisibleColumns,
						offset: pagination.offset,
						limit: pagination.limit,
						sort,
						filters,
						conjunction: filterConjunction,
						filterGroup,
						fetchedAt: Date.now(),
						executionTime: next.executionTime
					}
				}
				putTableSnapshot(snapshotOf(next.columns))

				if (!resolvedSchema) {
					// Cold path: rows are painted; apply the schema verdict and
					// enrichment when it lands. A schema failure surfaces via
					// the shared ['schema', id] query state, not a toast here.
					loadingStore.set('idle')
					let schema: DatabaseSchema | null = null
					try {
						schema = await schemaPromise
					} catch (error) {
						console.error('[DatabaseStudio] Failed to validate selected table:', error)
					}
					if (!isCurrentRequest() || !schema) return
					if (!schemaHasTable(schema, tableRefName)) {
						handleStaleTable()
						return
					}
					const enriched = enrichColumnsWithFKs(
						data.columns,
						schema,
						tableNamePart,
						schemaName ?? undefined
					)
					if (enriched !== data.columns) {
						const shown = queryStateRef.current.tableData
						const withForeignKeys = reconcileTableData(
							shown,
							withPendingEdits({ ...data, columns: enriched }, tableId)
						)
						if (withForeignKeys !== shown) setTableData(withForeignKeys)
						putTableSnapshot(snapshotOf(withForeignKeys.columns))
					}
				}
			} else {
				// Buffer the error until the schema verdict: a dropped table's
				// failing fetch should resolve to the silent stale-table clear,
				// not an error toast for a table that no longer exists.
				const errorMessage = getAdapterError(result)
				let tableMissing = false
				try {
					const schema = await schemaPromise
					tableMissing = !schemaHasTable(schema, tableRefName)
				} catch {
					noop()
				}
				if (!isCurrentRequest()) return
				if (tableMissing) {
					handleStaleTable()
					return
				}
				console.error('[DatabaseStudio] Failed to load table data:', errorMessage)
				if (!isConnectionUnavailableError(errorMessage)) {
					toast.error('Failed to load table data', {
						description: errorMessage
					})
				}
				if (!cached) {
					setTableData(null)
				}
				setIsTablePending(false)
			}
		} catch (error) {
			if (!isCurrentRequest()) return
			console.error('[DatabaseStudio] Unexpected error loading table data:', error)
			if (!isConnectionUnavailableError(error)) {
				toast.error('Failed to load table data', {
					description: error instanceof Error ? error.message : String(error)
				})
			}
			if (!cached) {
				setTableData(null)
			}
			setIsTablePending(false)
		} finally {
			if (isCurrentRequest()) {
				loadingStore.set('idle')
			}
		}
	}, [
		adapter,
		activeConnectionId,
		currentQuerySignature,
		filters,
		filterConjunction,
		filterGroup,
		loadingStore,
		pagination.limit,
		pagination.offset,
		queryClient,
		setIsTablePending,
		setTableData,
		setVisibleColumns,
		sort,
		tableId,
		tableRefName,
		withPendingEdits
	])

	useEffect(
		function loadWhenQueryChanges() {
			loadTableData()
		},
		[loadTableData]
	)

	useEffect(
		function syncActiveTable() {
			setLiveMonitorActiveTable(tableRefName ?? null)
			return function () {
				setLiveMonitorActiveTable(null)
			}
		},
		[tableRefName]
	)

	const canReloadForExternalChange = !draftRow && !isApplyingEdits && !hasPendingEdits

	useEffect(
		function reloadOnExternalChange() {
			function applyPendingChange() {
				if (
					!externalChangeRef.current ||
					!canReloadForExternalChange ||
					!activity.isActive()
				)
					return
				loadTableData()
			}

			applyPendingChange()

			let seenEvents = getLiveMonitorState().recentEvents
			const stopWatchingLiveMonitor = subscribeLiveMonitor(function onLiveMonitorChange() {
				const events = getLiveMonitorState().recentEvents
				if (events === seenEvents) return
				const lastSeenId = seenEvents[0]?.id
				seenEvents = events
				for (const event of events) {
					if (event.id === lastSeenId) break
					if (event.tableName === tableRefName || event.tableName === tableName) {
						externalChangeRef.current = true
						break
					}
				}
				applyPendingChange()
			})
			const stopWatchingActivity = activity.subscribe(applyPendingChange)
			return function () {
				stopWatchingActivity()
				stopWatchingLiveMonitor()
			}
		},
		[activity, canReloadForExternalChange, loadTableData, tableName, tableRefName]
	)

	useEffect(
		function handleTableChange() {
			if (!tableId || !activeConnectionId) return
			initializedFromUrlRef.current = false
		},
		[activeConnectionId, tableId]
	)

	useEffect(
		function initializeFromUrl() {
			if (initializedFromUrlRef.current || !tableData) return
			initializedFromUrlRef.current = true

			const urlState = readStudioUrlState()

			if (urlState.selectedRow !== null) {
				if (urlState.selectedRow >= 0 && urlState.selectedRow < tableData.rows.length) {
					setSelectedRows(new Set([urlState.selectedRow]))
				}
			}
			if (urlState.selectedCells.size > 0) {
				const validCells = new Set<string>()
				for (const cellKey of urlState.selectedCells) {
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
			if (urlState.focusedCell) {
				const { row, col } = urlState.focusedCell
				if (
					row >= 0 &&
					row < tableData.rows.length &&
					col >= 0 &&
					col < tableData.columns.length
				) {
					setFocusedCell(urlState.focusedCell)
				}
			}
			if (urlState.contextMenu) {
				const { cell } = urlState.contextMenu
				if (cell.row >= 0 && cell.row < tableData.rows.length) {
					setContextMenuState(urlState.contextMenu)
				}
			}
			if (urlState.addRecordMode) {
				if (
					urlState.addRecordIndex === null ||
					(urlState.addRecordIndex >= -1 &&
						urlState.addRecordIndex <= tableData.rows.length)
				) {
					setDraftRow(createDefaultValues(tableData.columns))
					setDraftInsertIndex(urlState.addRecordIndex ?? -1)
				}
			}
		},
		[
			setContextMenuState,
			setDraftInsertIndex,
			setDraftRow,
			setFocusedCell,
			setSelectedCells,
			setSelectedRows,
			tableData
		]
	)

	useEffect(
		function syncSelectedRowToUrl() {
			if (!initializedFromUrlRef.current) return
			const firstSelected = selectedRows.size > 0 ? Array.from(selectedRows)[0] : null
			if (firstSelected === readStudioUrlState().selectedRow) return

			writeStudioUrlState({ selectedRow: firstSelected })

			const notifyRowSelection = onRowSelectionChangeRef.current
			const shown = queryStateRef.current.tableData
			if (notifyRowSelection && shown) {
				if (firstSelected !== null && shown.rows[firstSelected]) {
					const primaryKeyColumn = shown.columns.find(function (c) {
						return c.primaryKey
					})
					if (primaryKeyColumn) {
						const pkValue = shown.rows[firstSelected][primaryKeyColumn.name] as
							| string
							| number
						notifyRowSelection(pkValue)
					}
				} else if (selectedRows.size === 0) {
					notifyRowSelection(null)
				}
			}
		},
		[selectedRows]
	)

	useEffect(
		function restoreSelectionFromPK() {
			if (restoredFromPKRef.current) return
			if (!tableData) return

			// Consume the one-shot the moment data is available — this is our single
			// restore opportunity. `initialRowPK` no longer changes during the session
			// (it's persisted without React state), so without consuming the ref here
			// a later selection-clear would re-run this and resurrect the launch row.
			restoredFromPKRef.current = true

			if (!initialRowPK || selectedRows.size > 0 || initializedFromUrlRef.current) return

			const primaryKeyColumn = tableData.columns.find((c) => c.primaryKey)
			if (!primaryKeyColumn) return

			const rowIndex = tableData.rows.findIndex(
				(row) => String(row[primaryKeyColumn.name]) === String(initialRowPK)
			)

			if (rowIndex !== -1) {
				setSelectedRows(new Set([rowIndex]))
			}
		},
		[initialRowPK, selectedRows.size, tableData, setSelectedRows]
	)

	useEffect(
		function syncCellsToUrl() {
			if (!initializedFromUrlRef.current) return
			writeStudioUrlState({ selectedCells })
		},
		[selectedCells]
	)

	useEffect(
		function syncFocusedCellToUrl() {
			if (!initializedFromUrlRef.current) return
			writeStudioUrlState({ focusedCell })
		},
		[focusedCell]
	)

	useEffect(
		function syncContextMenuToUrl() {
			if (!initializedFromUrlRef.current) return
			writeStudioUrlState({ contextMenu: contextMenuState })
		},
		[contextMenuState]
	)

	useEffect(
		function syncAddRecordToUrl() {
			if (!initializedFromUrlRef.current) return
			writeStudioUrlState({
				addRecordMode: draftRow !== null,
				addRecordIndex: draftInsertIndex
			})
		},
		[draftInsertIndex, draftRow]
	)

	return { loadTableData }
}

function isSameStringSet(current: Set<string>, next: readonly string[]): boolean {
	if (current.size !== next.length) return false
	for (const value of next) {
		if (!current.has(value)) return false
	}
	return true
}
