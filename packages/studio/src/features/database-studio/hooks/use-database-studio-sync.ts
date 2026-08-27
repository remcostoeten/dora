import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLiveMonitor } from '@studio/core/live-monitor'
import { overlayPendingEditsOnRows, type PendingEdit } from '@studio/core/pending-edits'
import { useNuqsState } from '@studio/core/url-state/use-nuqs-state'
import {
	dropTableSnapshot,
	putTableSnapshot,
	readTableSnapshot,
	type TableSnapshot
} from '@studio/core/workspace-store'
import { getAdapterError } from '@studio/core/data-provider/types'
import { schemaQueryOptions } from '@studio/core/data-provider/schema-query'
import { isConnectionUnavailableError } from '@studio/shared/utils/error-messages'
import { noop } from '@studio/shared/utils/noop'
import { toast } from '@studio/shared/ui/notifier'
import type { DataAdapter } from '@studio/core/data-provider/types'
import type { DatabaseSchema } from '@studio/lib/bindings'
import { enrichColumnsWithFKs } from '../utils/fk-enrichment'
import {
	DEFAULT_QUERY_SIGNATURE,
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
	setIsLoading: (value: boolean) => void
	setIsTableTransitioning: (value: boolean) => void
	setPagination: (value: PaginationState) => void
	setSort: (value: SortDescriptor | undefined) => void
	setFilters: (value: FilterDescriptor[]) => void
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
		setIsLoading,
		setIsTableTransitioning,
		setPagination,
		setSort,
		setFilters,
		setSelectedRows,
		setSelectedCells: setUrlSelectedCells,
		setFocusedCell: setUrlFocusedCell,
		setContextMenuState,
		setDraftRow,
		setDraftInsertIndex
	} = args

	const liveMonitor = useLiveMonitor()
	const queryClient = useQueryClient()
	const {
		urlState,
		setSelectedRow,
		setSelectedCells,
		setFocusedCell,
		setContextMenu,
		setAddRecordMode
	} = useNuqsState()
	const initializedFromUrlRef = useRef(false)
	const isUpdatingUrlRef = useRef(false)
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

	const withPendingEdits = useCallback(function (
		data: TableData,
		forTableId: string | null
	): TableData {
		if (!forTableId) return data
		const edits = getEditsForTableRef.current(forTableId)
		if (edits.length === 0) return data
		return { ...data, rows: overlayPendingEditsOnRows(data.rows, edits) }
	}, [])

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

	// The latest query state, readable from effects without subscribing to it:
	// the table-change and load paths only need it to skip no-op resets.
	const queryStateRef = useRef({ pagination, sort, filters, tableData })
	queryStateRef.current = { pagination, sort, filters, tableData }

	const loadTableData = useCallback(async () => {
		const requestId = loadRequestIdRef.current + 1
		loadRequestIdRef.current = requestId
		const isCurrentRequest = function () {
			return loadRequestIdRef.current === requestId
		}

		if (!tableId || !tableRefName || !activeConnectionId) {
			setIsLoading(false)
			return
		}

		setIsLoading(true)

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
		if (cached && currentView !== displayedViewRef.current) {
			const next = withPendingEdits(snapshotToTableData(cached), tableId)
			if (!isSameTableData(queryStateRef.current.tableData, next)) setTableData(next)
			if (cached.visibleColumns.length > 0) {
				setVisibleColumns(function keepIfEqual(previous) {
					return isSameStringSet(previous, cached.visibleColumns)
						? previous
						: new Set(cached.visibleColumns)
				})
			}
			setIsTableTransitioning(false)
			displayedViewRef.current = currentView
		}

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
			setIsTableTransitioning(false)
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

				setTableData(withPendingEdits(data, tableId))
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

				const snapshotOf = function (columns: TableData['columns']) {
					return {
						connectionId: activeConnectionId,
						tableId: tableRefName,
						columns,
						rows: data.rows,
						totalCount: data.totalCount,
						visibleColumns: nextVisibleColumns,
						offset: pagination.offset,
						limit: pagination.limit,
						sort,
						filters,
						conjunction: filterConjunction,
						filterGroup,
						fetchedAt: Date.now()
					}
				}
				putTableSnapshot(snapshotOf(data.columns))

				if (!resolvedSchema) {
					// Cold path: rows are painted; apply the schema verdict and
					// enrichment when it lands. A schema failure surfaces via
					// the shared ['schema', id] query state, not a toast here.
					setIsLoading(false)
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
						setTableData(withPendingEdits({ ...data, columns: enriched }, tableId))
						putTableSnapshot(snapshotOf(enriched))
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
				setIsTableTransitioning(false)
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
			setIsTableTransitioning(false)
		} finally {
			if (isCurrentRequest()) {
				setIsLoading(false)
			}
		}
	}, [
		adapter,
		activeConnectionId,
		currentQuerySignature,
		filters,
		filterConjunction,
		filterGroup,
		pagination.limit,
		pagination.offset,
		queryClient,
		setIsLoading,
		setIsTableTransitioning,
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
			liveMonitor.setActiveTable(tableRefName ?? null)
			return function () {
				liveMonitor.setActiveTable(null)
			}
		},
		[tableRefName]
	)

	useEffect(
		function reloadOnExternalChange() {
			if (!liveMonitor.recentEvents.length) return
			const hasChangeForThisTable = liveMonitor.recentEvents.some(function (e) {
				return e.tableName === tableRefName || e.tableName === tableName
			})
			// Reloading while dry edits are buffered would repaint database values
			// over them, leaving the pending-changes count describing writes the user
			// can no longer see.
			if (hasChangeForThisTable && !draftRow && !isApplyingEdits && !hasPendingEdits) {
				loadTableData()
			}
		},
		[
			liveMonitor.recentEvents,
			draftRow,
			isApplyingEdits,
			hasPendingEdits,
			loadTableData,
			tableName,
			tableRefName
		]
	)

	useEffect(
		function handleTableChange() {
			if (!tableId || !activeConnectionId) return
			// Every set below is guarded: the per-table workspace state usually
			// already holds these values, and an unconditional reset would cost a
			// second full render on every cached switch.
			const current = queryStateRef.current
			if (current.pagination.limit !== 50 || current.pagination.offset !== 0) {
				setPagination({ limit: 50, offset: 0 })
			}
			if (current.sort !== undefined) setSort(undefined)
			if (current.filters.length > 0) setFilters([])
			initializedFromUrlRef.current = false

			const snapshot = readTableSnapshot(activeConnectionId, tableId)

			if (snapshot && snapshotQuerySignature(snapshot) === DEFAULT_QUERY_SIGNATURE) {
				const next = withPendingEdits(snapshotToTableData(snapshot), tableId)
				if (!isSameTableData(current.tableData, next)) setTableData(next)
				setVisibleColumns(function keepIfEqual(previous) {
					return isSameStringSet(previous, snapshot.visibleColumns)
						? previous
						: new Set(snapshot.visibleColumns)
				})
				setIsTableTransitioning(false)
				return
			}

			setVisibleColumns(function keepIfEmpty(previous) {
				return previous.size === 0 ? previous : new Set()
			})
			setIsTableTransitioning(true)
		},
		[
			activeConnectionId,
			setFilters,
			setIsTableTransitioning,
			setPagination,
			setSort,
			setTableData,
			setVisibleColumns,
			tableId,
			withPendingEdits
		]
	)

	useEffect(
		function clearTransitionOnLoad() {
			if (!tableData) return
			const timer = setTimeout(function () {
				setIsTableTransitioning(false)
			}, 50)
			return function () {
				clearTimeout(timer)
			}
		},
		[setIsTableTransitioning, tableData]
	)

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
					setDraftRow(createDefaultValues(tableData.columns))
					setDraftInsertIndex(stableUrlState.addRecordIndex ?? -1)
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
			stableUrlState,
			tableData
		]
	)

	useEffect(
		function syncSelectedRowToUrl() {
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return
			const firstSelected = selectedRows.size > 0 ? Array.from(selectedRows)[0] : null
			if (firstSelected === stableUrlState.selectedRow) return

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
		[selectedRows, onRowSelectionChange, setSelectedRow, stableUrlState.selectedRow, tableData]
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
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return

			const currentCellsStr = Array.from(stableUrlState.selectedCells).sort().join(',')
			const newCellsStr = Array.from(selectedCells).sort().join(',')
			if (currentCellsStr === newCellsStr) return

			isUpdatingUrlRef.current = true
			setUrlSelectedCells(selectedCells)
			requestAnimationFrame(function () {
				isUpdatingUrlRef.current = false
			})
		},
		[selectedCells, setUrlSelectedCells, stableUrlState.selectedCells]
	)

	useEffect(
		function syncFocusedCellToUrl() {
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return

			const urlCell = stableUrlState.focusedCell
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
		[focusedCell, setUrlFocusedCell, stableUrlState.focusedCell]
	)

	useEffect(
		function syncContextMenuToUrl() {
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return

			const urlCtx = stableUrlState.contextMenu
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
		[contextMenuState, setContextMenu, stableUrlState.contextMenu]
	)

	useEffect(
		function syncAddRecordToUrl() {
			if (!initializedFromUrlRef.current || isUpdatingUrlRef.current) return

			const isAddRecordActive = draftRow !== null
			const isSame =
				stableUrlState.addRecordMode === isAddRecordActive &&
				stableUrlState.addRecordIndex === draftInsertIndex
			if (isSame) return

			isUpdatingUrlRef.current = true
			setAddRecordMode(isAddRecordActive, draftInsertIndex)
			requestAnimationFrame(function () {
				isUpdatingUrlRef.current = false
			})
		},
		[
			draftInsertIndex,
			draftRow,
			setAddRecordMode,
			stableUrlState.addRecordIndex,
			stableUrlState.addRecordMode
		]
	)

	return {
		liveMonitor,
		stableUrlState,
		setSelectedRow,
		setSelectedCells,
		setFocusedCell,
		setContextMenu,
		setAddRecordMode,
		initializedFromUrlRef,
		isUpdatingUrlRef,
		loadTableData
	}
}
type MinimalSchema = Pick<DatabaseSchema, 'tables'>

function isSameTableData(current: TableData | null, next: TableData): boolean {
	return (
		current !== null &&
		current.rows === next.rows &&
		current.columns === next.columns &&
		current.totalCount === next.totalCount
	)
}

function isSameStringSet(current: Set<string>, next: readonly string[]): boolean {
	if (current.size !== next.length) return false
	for (const value of next) {
		if (!current.has(value)) return false
	}
	return true
}
