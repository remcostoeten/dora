import { useCallback } from 'react'
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
	setSelectedRows: React.Dispatch<React.SetStateAction<Set<number>>>
	setSelectedCells: React.Dispatch<React.SetStateAction<Set<string>>>
	setFocusedCell: React.Dispatch<React.SetStateAction<{ row: number; col: number } | null>>
	setShowDeleteConfirmDialog: React.Dispatch<React.SetStateAction<boolean>>
	setIsBulkActionLoading: React.Dispatch<React.SetStateAction<boolean>>
	setFilters: React.Dispatch<React.SetStateAction<FilterDescriptor[]>>
	notifyActionFailure: (title: string, error: unknown) => void
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
		setSelectedRows,
		setSelectedCells,
		setFocusedCell,
		setShowDeleteConfirmDialog,
		setIsBulkActionLoading,
		setFilters,
		notifyActionFailure
	} = args

	const handleBulkDelete = useCallback(function () {
		const primaryKeyColumn = tableData?.columns.find((c) => c.primaryKey)
		if (!primaryKeyColumn || !activeConnectionId || !tableId || !tableData) return
		if (settingsConfirmBeforeDelete) {
			setShowDeleteConfirmDialog(true)
			return
		}
		const primaryKeyValues = Array.from(rowsForActions).map((rowIndex) => tableData.rows[rowIndex][primaryKeyColumn.name])
		deleteRows.mutate(
			{ connectionId: activeConnectionId, tableName: tableRefName, primaryKeyColumn: primaryKeyColumn.name, primaryKeyValues },
			{
				onSuccess: function () {
					setSelectedRows(new Set())
					onLoadTableData()
					setShowDeleteConfirmDialog(false)
				},
				onError: function (error: Error) {
					notifyActionFailure('Failed to delete rows', error)
				}
			}
		)
	}, [activeConnectionId, deleteRows, notifyActionFailure, onLoadTableData, rowsForActions, setSelectedRows, setShowDeleteConfirmDialog, settingsConfirmBeforeDelete, tableData, tableId, tableRefName])

	const handleBulkCopy = useCallback(function () {
		if (!tableData) return
		const rowsData = Array.from(rowsForActions).map((rowIndex) => tableData.rows[rowIndex])
		navigator.clipboard.writeText(JSON.stringify(rowsData, null, 2))
	}, [rowsForActions, tableData])

	const handleBulkDuplicate = useCallback(function () {
		const primaryKeyColumn = tableData?.columns.find((c) => c.primaryKey)
		if (!activeConnectionId || !tableId || !tableData) return
		const rowsToDuplicate = Array.from(rowsForActions).map((rowIndex) => {
			const row = { ...tableData.rows[rowIndex] }
			if (primaryKeyColumn) delete row[primaryKeyColumn.name]
			return row
		})
		setIsBulkActionLoading(true)
		Promise.all(rowsToDuplicate.map((rowData) => insertRow.mutateAsync({ connectionId: activeConnectionId, tableName: tableRefName, rowData })))
			.then(function () {
				setSelectedRows(new Set())
				onLoadTableData()
			})
			.catch(function (error) {
				notifyActionFailure('Failed to duplicate rows', error)
			})
			.finally(function () {
				setIsBulkActionLoading(false)
			})
	}, [activeConnectionId, insertRow, notifyActionFailure, onLoadTableData, rowsForActions, setIsBulkActionLoading, setSelectedRows, tableData, tableId, tableRefName])

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
