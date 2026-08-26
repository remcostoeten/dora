import { useCallback } from 'react'
import {
	appendRows,
	buildDuplicateRow,
	canDuplicateWithoutInput,
	removeRowsByPrimaryKey
} from '../utils/studio-data'
import type { FilterDescriptor, TableData } from '../types'

type Args = {
	activeConnectionId?: string
	tableId: string | null
	tableName: string | null
	tableRefName: string | null
	tableData: TableData | null
	selectedRows: Set<number>
	rowsForActions: Set<number>
	settingsConfirmBeforeDelete: boolean
	deleteRows: { mutate: Function }
	insertRow: { mutateAsync: Function }
	onLoadTableData: () => void
	trackRowDeletion: (connectionId: string, tableName: string, rows: Record<string, unknown>[]) => string | null
	setTableData: React.Dispatch<React.SetStateAction<TableData | null>>
	setSelectedRows: React.Dispatch<React.SetStateAction<Set<number>>>
	setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>
	setFocusedCell: React.Dispatch<React.SetStateAction<{ row: number; col: number } | null>>
	setShowDeleteConfirmDialog: React.Dispatch<React.SetStateAction<boolean>>
	setFilters: React.Dispatch<React.SetStateAction<FilterDescriptor[]>>
	notifyPrimaryKeyNotGenerated: (actionLabel: string) => void
	notifyActionFailure: (title: string, error: unknown) => void
	/** Snapshots the current rows so the inserted ones can be highlighted. */
	onRowsAdded: () => void
}

export function useDatabaseStudioBulkActions(args: Args) {
	const {
		activeConnectionId,
		tableId,
		tableName,
		tableRefName,
		tableData,
		selectedRows,
		rowsForActions,
		settingsConfirmBeforeDelete,
		deleteRows,
		insertRow,
		onLoadTableData,
		trackRowDeletion,
		setTableData,
		setSelectedRows,
		setSelectedCells,
		setFocusedCell,
		setShowDeleteConfirmDialog,
		setFilters,
		notifyPrimaryKeyNotGenerated,
		notifyActionFailure,
		onRowsAdded
	} = args

	const handleBulkDelete = useCallback(function () {
		const primaryKeyColumn = tableData?.columns.find((c) => c.primaryKey)
		if (!primaryKeyColumn || !activeConnectionId || !tableId || !tableData) return
		if (settingsConfirmBeforeDelete) {
			setShowDeleteConfirmDialog(true)
			return
		}
		const deletedRows = Array.from(rowsForActions).map((rowIndex) => tableData.rows[rowIndex])
		const primaryKeyValues = deletedRows.map((row) => row[primaryKeyColumn.name])
		const snapshot = tableData
		setTableData(removeRowsByPrimaryKey(tableData, primaryKeyColumn.name, primaryKeyValues))
		setSelectedRows(new Set())
		deleteRows.mutate(
			{ connectionId: activeConnectionId, tableName: tableRefName, primaryKeyColumn: primaryKeyColumn.name, primaryKeyValues },
			{
				onSuccess: function () {
					trackRowDeletion(activeConnectionId, tableRefName ?? '', deletedRows)
					onLoadTableData()
					setShowDeleteConfirmDialog(false)
				},
				onError: function (error: Error) {
					setTableData(snapshot)
					notifyActionFailure('Failed to delete rows', error)
				}
			}
		)
	}, [activeConnectionId, deleteRows, notifyActionFailure, onLoadTableData, rowsForActions, setSelectedRows, setShowDeleteConfirmDialog, setTableData, settingsConfirmBeforeDelete, tableData, tableId, tableRefName, trackRowDeletion])

	const handleBulkCopy = useCallback(function () {
		if (!tableData) return
		const rowsData = Array.from(rowsForActions).map((rowIndex) => tableData.rows[rowIndex])
		navigator.clipboard.writeText(JSON.stringify(rowsData, null, 2))
	}, [rowsForActions, tableData])

	const handleBulkDuplicate = useCallback(function () {
		if (!activeConnectionId || !tableId || !tableData) return
		if (!canDuplicateWithoutInput(tableData.columns)) {
			notifyPrimaryKeyNotGenerated('duplicate rows')
			return
		}
		const rowsToDuplicate = Array.from(rowsForActions).map((rowIndex) =>
			buildDuplicateRow(tableData.rows[rowIndex], tableData.columns)
		)
		if (rowsToDuplicate.length === 0) return

		// Show the copies immediately; reconcile with authoritative rows on reload,
		// roll back on failure (mirrors handleBulkDelete).
		const snapshot = tableData
		onRowsAdded()
		setTableData(appendRows(tableData, rowsToDuplicate))
		setSelectedRows(new Set())
		Promise.all(rowsToDuplicate.map((rowData) => insertRow.mutateAsync({ connectionId: activeConnectionId, tableName: tableRefName, rowData })))
			.then(function () {
				onLoadTableData()
			})
			.catch(function (error) {
				setTableData(snapshot)
				notifyActionFailure('Failed to duplicate rows', error)
			})
	}, [activeConnectionId, insertRow, notifyActionFailure, notifyPrimaryKeyNotGenerated, onLoadTableData, onRowsAdded, rowsForActions, setSelectedRows, setTableData, tableData, tableId, tableRefName])

	const handleExportJson = useCallback(function () {
		if (!tableData) return
		const rowsData = Array.from(rowsForActions).map((rowIndex) => tableData.rows[rowIndex])
		const blob = new Blob([JSON.stringify(rowsData, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${tableName || 'data'}_selected.json`
		a.click()
		URL.revokeObjectURL(url)
	}, [rowsForActions, tableData, tableName])

	const handleExportCsv = useCallback(function () {
		if (!tableData) return
		const rowsData = Array.from(rowsForActions).map((rowIndex) => tableData.rows[rowIndex])
		if (rowsData.length === 0) return
		const headers = Object.keys(rowsData[0])
		const csvRows = [headers.join(','), ...rowsData.map((row) => headers.map((header) => {
			const value = row[header]
			if (value === null || value === undefined) return ''
			const stringValue = String(value)
			return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
				? `"${stringValue.replace(/"/g, '""')}"`
				: stringValue
		}).join(','))]
		const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${tableName || 'data'}_selected.csv`
		a.click()
		URL.revokeObjectURL(url)
	}, [rowsForActions, tableData, tableName])

	const handleClearSelection = useCallback(function () {
		setSelectedRows(new Set())
		if (selectedRows.size === 0) {
			setFocusedCell(null)
			setSelectedCells(new Set())
		}
	}, [selectedRows.size, setFocusedCell, setSelectedCells, setSelectedRows])

	const handleFilterAdd = useCallback(function (filter: FilterDescriptor) {
		setFilters((prev) => [...prev, filter])
	}, [setFilters])

	return {
		handleBulkDelete,
		handleBulkCopy,
		handleBulkDuplicate,
		handleExportJson,
		handleExportCsv,
		handleClearSelection,
		handleFilterAdd
	}
}
