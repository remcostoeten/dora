import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import { useLiveMonitor } from '@/core/live-monitor'
import { useNuqsState } from '@/core/url-state/use-nuqs-state'
import { tableDataCache } from '@/core/table-cache'
import { getAdapterError } from '@/core/data-provider/types'
import type { AdapterResult, DataAdapter } from '@/core/data-provider/types'
import type { DatabaseSchema } from '@/lib/bindings'
import { enrichColumnsWithFKs } from '../utils/fk-enrichment'
import { buildTableCacheKey, schemaHasTable } from '../utils/table-cache'
import { createDefaultValues } from '../utils/studio-data'
import { getTableRefParts } from '@/shared/utils/table-ref'
import type { FilterDescriptor, PaginationState, SortDescriptor, TableData } from '../types'

type Args = {
	adapter: DataAdapter
	activeConnectionId?: string
	tableId: string | null
	tableName: string | null
	tableRefName: string | null
	currentCacheKey: string
	pagination: PaginationState
	sort: SortDescriptor | undefined
	filters: FilterDescriptor[]
	tableData: TableData | null
	draftRow: Record<string, unknown> | null
	draftInsertIndex: number | null
	isApplyingEdits: boolean
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
	setContextMenuState: Dispatch<SetStateAction<import('../components/data-grid').ContextMenuState>>
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
		setSelectedCells: setUrlSelectedCells,
		setFocusedCell: setUrlFocusedCell,
		setContextMenuState,
		setDraftRow,
		setDraftInsertIndex
	} = args

	const liveMonitor = useLiveMonitor()
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

	const loadTableData = useCallback(async () => {
		const requestId = loadRequestIdRef.current + 1
		loadRequestIdRef.current = requestId
		const isCurrentRequest = function () {
			return loadRequestIdRef.current === requestId
		}

		if (!tableId || !activeConnectionId) {
			setIsLoading(false)
			return
		}

		setIsLoading(true)

		let schemaForTable: AdapterResult<DatabaseSchema> | null = null
		const cached = tableDataCache.get(currentCacheKey)

		if (cached) {
			setTableData(cached.data)
			if (cached.visibleColumns.length > 0) {
				setVisibleColumns(new Set(cached.visibleColumns))
			}
			setIsTableTransitioning(false)
		}

		try {
			schemaForTable = await adapter.getSchema(activeConnectionId)
			if (!isCurrentRequest()) return
			if (schemaForTable.ok && !schemaHasTable(schemaForTable.data, tableRefName)) {
				console.warn('[DatabaseStudio] Skipping stale table selection:', {
					connectionId: activeConnectionId,
					tableRefName
				})
				setTableData(null)
				setIsTableTransitioning(false)
				setIsLoading(false)
				return
			}
		} catch (error) {
			if (!isCurrentRequest()) return
			console.error('[DatabaseStudio] Failed to validate selected table:', error)
		}

		try {
			const result = await adapter.fetchTableData(
				activeConnectionId,
				tableRefName,
				Math.floor(pagination.offset / pagination.limit),
				pagination.limit,
				sort,
				filters
			)
			if (!isCurrentRequest()) return

			if (result.ok) {
				const data = result.data
				const schemaResult = schemaForTable ?? (await adapter.getSchema(activeConnectionId))
				if (!isCurrentRequest()) return
				if (schemaResult.ok) {
					const { tableName: tableNamePart, schemaName } = getTableRefParts(tableRefName ?? '')
					data.columns = enrichColumnsWithFKs(
						data.columns,
						schemaResult.data,
						tableNamePart,
						schemaName ?? undefined
					)
				}

				setTableData(data)
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
				console.error('[DatabaseStudio] Failed to load table data:', getAdapterError(result))
				if (!cached) {
					setTableData(null)
				}
			}
		} catch (error) {
			if (!isCurrentRequest()) return
			console.error('[DatabaseStudio] Unexpected error loading table data:', error)
			if (!cached) {
				setTableData(null)
			}
		} finally {
			if (isCurrentRequest()) {
				setIsLoading(false)
			}
		}
	}, [
		adapter,
		activeConnectionId,
		currentCacheKey,
		filters,
		pagination.limit,
		pagination.offset,
		setIsLoading,
		setIsTableTransitioning,
		setTableData,
		setVisibleColumns,
		sort,
		tableId,
		tableRefName
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
			if (hasChangeForThisTable && !draftRow && !isApplyingEdits) {
				loadTableData()
			}
		},
		[liveMonitor.recentEvents, draftRow, isApplyingEdits, loadTableData, tableName, tableRefName]
	)

	useEffect(
		function handleTableChange() {
			if (!tableId || !activeConnectionId) return
			setPagination({ limit: 50, offset: 0 })
			setSort(undefined)
			setFilters([])
			initializedFromUrlRef.current = false

			const defaultCacheKey = buildTableCacheKey(activeConnectionId, tableId, 50, 0, undefined, [])
			const cached = tableDataCache.get(defaultCacheKey)

			if (cached) {
				setTableData(cached.data)
				setVisibleColumns(new Set(cached.visibleColumns))
				setIsTableTransitioning(false)
				return
			}

			setVisibleColumns(new Set())
			setIsTableTransitioning(true)
		},
		[activeConnectionId, setFilters, setIsTableTransitioning, setPagination, setSort, setTableData, setVisibleColumns, tableId]
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
				if (row >= 0 && row < tableData.rows.length && col >= 0 && col < tableData.columns.length) {
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
						const pkValue = tableData.rows[firstSelected][primaryKeyColumn.name] as string | number
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
			if (!tableData || !initialRowPK || selectedRows.size > 0 || initializedFromUrlRef.current) return

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
		[draftInsertIndex, draftRow, setAddRecordMode, stableUrlState.addRecordIndex, stableUrlState.addRecordMode]
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
