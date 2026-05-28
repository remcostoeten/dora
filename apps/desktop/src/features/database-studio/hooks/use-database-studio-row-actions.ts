import { useCallback } from 'react'
import { createDefaultValues } from '../utils/studio-data'
import type { TableData } from '../types'

type EditingRowState = {
	primaryKeyColumn: string
	primaryKeyValue: unknown
	originalRow: Record<string, unknown>
} | null

type Args = {
	activeConnectionId?: string
	tableId: string | null
	tableRefName: string | null
	tableData: TableData | null
	settingsConfirmBeforeDelete: boolean
	deleteRows: { mutate: Function }
	insertRow: { mutateAsync: Function }
	onLoadTableData: () => void
	setSelectedRows: React.Dispatch<React.SetStateAction<Set<number>>>
	setShowDeleteConfirmDialog: React.Dispatch<React.SetStateAction<boolean>>
	setPendingSingleDeleteRow: React.Dispatch<
		React.SetStateAction<{
			row: Record<string, unknown>
			primaryKeyColumn: string
			primaryKeyValue: unknown
		} | null>
	>
	setIsBulkActionLoading: React.Dispatch<React.SetStateAction<boolean>>
	setDraftRow: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
	setDraftInsertIndex: React.Dispatch<React.SetStateAction<number | null>>
	setEditingRowState: React.Dispatch<React.SetStateAction<EditingRowState>>
	setDuplicateInitialData: React.Dispatch<React.SetStateAction<Record<string, unknown> | undefined>>
	setAddDialogMode: React.Dispatch<React.SetStateAction<'add' | 'duplicate' | 'edit'>>
	setShowAddDialog: React.Dispatch<React.SetStateAction<boolean>>
	setSelectedRowForDetail: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
	setShowRowDetail: React.Dispatch<React.SetStateAction<boolean>>
	notifyMissingPrimaryKey: (actionLabel: string) => void
	notifyActionFailure: (title: string, error: unknown) => void
}

export function useDatabaseStudioRowActions(args: Args) {
	const {
		activeConnectionId,
		tableId,
		tableRefName,
		tableData,
		settingsConfirmBeforeDelete,
		deleteRows,
		insertRow,
		onLoadTableData,
		setSelectedRows,
		setShowDeleteConfirmDialog,
		setPendingSingleDeleteRow,
		setIsBulkActionLoading,
		setDraftRow,
		setDraftInsertIndex,
		setEditingRowState,
		setDuplicateInitialData,
		setAddDialogMode,
		setShowAddDialog,
		setSelectedRowForDetail,
		setShowRowDetail,
		notifyMissingPrimaryKey,
		notifyActionFailure
	} = args

	const deleteRowIndexes = useCallback(
		function deleteRowIndexes(rowIndexes: number[]) {
			const primaryKeyColumn = tableData?.columns.find((c) => c.primaryKey)
			if (!primaryKeyColumn || !activeConnectionId || !tableId || !tableData) return

			const primaryKeyValues = rowIndexes.map(function (targetRowIndex) {
				return tableData.rows[targetRowIndex][primaryKeyColumn.name]
			})

			deleteRows.mutate(
				{
					connectionId: activeConnectionId,
					tableName: tableRefName,
					primaryKeyColumn: primaryKeyColumn.name,
					primaryKeyValues
				},
				{
					onSuccess: function onDeleteSuccess() {
						setSelectedRows(new Set())
						onLoadTableData()
						setShowDeleteConfirmDialog(false)
						setPendingSingleDeleteRow(null)
					},
					onError: function onDeleteError(error: unknown) {
						notifyActionFailure('Failed to delete rows', error)
					}
				}
			)
		},
		[activeConnectionId, deleteRows, notifyActionFailure, onLoadTableData, setPendingSingleDeleteRow, setSelectedRows, setShowDeleteConfirmDialog, tableData, tableId, tableRefName]
	)

	const duplicateRowIndexes = useCallback(
		function duplicateRowIndexes(rowIndexes: number[]) {
			const primaryKeyColumn = tableData?.columns.find((c) => c.primaryKey)
			if (!activeConnectionId || !tableId || !tableData) return

			const rowsToDuplicate = rowIndexes.map(function (targetRowIndex) {
				const row = { ...tableData.rows[targetRowIndex] }
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
						tableName: tableRefName,
						rowData
					})
				})
			)
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
		},
		[activeConnectionId, insertRow, notifyActionFailure, onLoadTableData, setIsBulkActionLoading, setSelectedRows, tableData, tableId, tableRefName]
	)

	async function handleRowAction(
		action: string,
		row: Record<string, unknown>,
		rowIndex: number,
		batchIndexes?: number[]
	) {
		if (!tableId || !activeConnectionId || !tableData) return

		const primaryKeyColumn = tableData.columns.find((c) => c.primaryKey)
		if (!primaryKeyColumn) {
			notifyMissingPrimaryKey('perform this row action')
			return
		}
		const effectiveRowIndexes =
			batchIndexes && batchIndexes.length > 1 ? batchIndexes : [rowIndex]
		const isBatchAction = effectiveRowIndexes.length > 1

		switch (action) {
			case 'delete':
				if (settingsConfirmBeforeDelete && !isBatchAction) {
					setPendingSingleDeleteRow({
						row,
						primaryKeyColumn: primaryKeyColumn.name,
						primaryKeyValue: row[primaryKeyColumn.name]
					})
					setShowDeleteConfirmDialog(true)
					return
				}

				if (settingsConfirmBeforeDelete && isBatchAction) {
					setPendingSingleDeleteRow(null)
					setSelectedRows(new Set(effectiveRowIndexes))
					setShowDeleteConfirmDialog(true)
					return
				}

				deleteRowIndexes(effectiveRowIndexes)
				break
			case 'view':
				setSelectedRowForDetail(row)
				setShowRowDetail(true)
				break
			case 'edit':
				setDuplicateInitialData(row)
				setEditingRowState({
					primaryKeyColumn: primaryKeyColumn.name,
					primaryKeyValue: row[primaryKeyColumn.name],
					originalRow: row
				})
				setAddDialogMode('edit')
				setShowAddDialog(true)
				break
			case 'duplicate': {
				if (isBatchAction) {
					duplicateRowIndexes(effectiveRowIndexes)
					break
				}

				const duplicateData = { ...row }
				delete duplicateData[primaryKeyColumn.name]
				const defaults = createDefaultValues(tableData.columns)
				setDraftRow({ ...defaults, ...duplicateData })
				setDraftInsertIndex(rowIndex + 1)
				break
			}
			default:
				break
		}
	}

	return {
		deleteRowIndexes,
		handleRowAction
	}
}
