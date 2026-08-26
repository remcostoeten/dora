import { useCallback } from 'react'
import {
	appendRows,
	buildDuplicateRow,
	canDuplicateWithoutInput,
	createDefaultValues,
	removeRowsByPrimaryKey
} from '../utils/studio-data'
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
	trackRowDeletion: (connectionId: string, tableName: string, rows: Record<string, unknown>[]) => string | null
	setTableData: React.Dispatch<React.SetStateAction<TableData | null>>
	setSelectedRows: React.Dispatch<React.SetStateAction<Set<number>>>
	setShowDeleteConfirmDialog: React.Dispatch<React.SetStateAction<boolean>>
	setPendingSingleDeleteRow: React.Dispatch<
		React.SetStateAction<{
			row: Record<string, unknown>
			primaryKeyColumn: string
			primaryKeyValue: unknown
		} | null>
	>
	setDraftRow: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
	setDraftInsertIndex: React.Dispatch<React.SetStateAction<number | null>>
	setEditingRowState: React.Dispatch<React.SetStateAction<EditingRowState>>
	setDuplicateInitialData: React.Dispatch<React.SetStateAction<Record<string, unknown> | undefined>>
	setAddDialogMode: React.Dispatch<React.SetStateAction<'add' | 'duplicate' | 'edit'>>
	setShowAddDialog: React.Dispatch<React.SetStateAction<boolean>>
	setSelectedRowForDetail: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
	setShowRowDetail: React.Dispatch<React.SetStateAction<boolean>>
	notifyMissingPrimaryKey: (actionLabel: string) => void
	notifyPrimaryKeyNotGenerated: (actionLabel: string) => void
	notifyActionFailure: (title: string, error: unknown) => void
	/** Snapshots the current rows so the inserted ones can be highlighted. */
	onRowsAdded: () => void
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
		trackRowDeletion,
		setTableData,
		setSelectedRows,
		setShowDeleteConfirmDialog,
		setPendingSingleDeleteRow,
		setDraftRow,
		setDraftInsertIndex,
		setEditingRowState,
		setDuplicateInitialData,
		setAddDialogMode,
		setShowAddDialog,
		setSelectedRowForDetail,
		setShowRowDetail,
		notifyMissingPrimaryKey,
		notifyPrimaryKeyNotGenerated,
		notifyActionFailure,
		onRowsAdded
	} = args

	const deleteRowIndexes = useCallback(
		function deleteRowIndexes(rowIndexes: number[]) {
			const primaryKeyColumn = tableData?.columns.find((c) => c.primaryKey)
			if (!primaryKeyColumn || !activeConnectionId || !tableId || !tableData) return

			const deletedRows = rowIndexes.map(function (targetRowIndex) {
				return tableData.rows[targetRowIndex]
			})
			const primaryKeyValues = deletedRows.map(function (row) {
				return row[primaryKeyColumn.name]
			})

			const snapshot = tableData
			setTableData(removeRowsByPrimaryKey(tableData, primaryKeyColumn.name, primaryKeyValues))
			setSelectedRows(new Set())

			deleteRows.mutate(
				{
					connectionId: activeConnectionId,
					tableName: tableRefName,
					primaryKeyColumn: primaryKeyColumn.name,
					primaryKeyValues
				},
				{
					onSuccess: function onDeleteSuccess() {
						trackRowDeletion(activeConnectionId, tableRefName ?? '', deletedRows)
						onLoadTableData()
					},
					onError: function onDeleteError(error: unknown) {
						setTableData(snapshot)
						notifyActionFailure('Failed to delete rows', error)
					}
				}
			)
		},
		[activeConnectionId, deleteRows, notifyActionFailure, onLoadTableData, setPendingSingleDeleteRow, setSelectedRows, setShowDeleteConfirmDialog, setTableData, tableData, tableId, tableRefName, trackRowDeletion]
	)

	const duplicateRowIndexes = useCallback(
		function duplicateRowIndexes(rowIndexes: number[]) {
			if (!activeConnectionId || !tableId || !tableData) return
			if (!canDuplicateWithoutInput(tableData.columns)) {
				notifyPrimaryKeyNotGenerated('duplicate rows')
				return
			}

			const rowsToDuplicate = rowIndexes.map(function (targetRowIndex) {
				return buildDuplicateRow(tableData.rows[targetRowIndex], tableData.columns)
			})
			if (rowsToDuplicate.length === 0) return

			// Optimistically show the copies right away (mirrors the delete path);
			// the reload after the inserts resolve swaps in the authoritative rows
			// with their server-generated primary keys. Roll back on failure.
			const snapshot = tableData
			onRowsAdded()
			setTableData(appendRows(tableData, rowsToDuplicate))
			setSelectedRows(new Set())

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
					onLoadTableData()
				})
				.catch(function (error) {
					setTableData(snapshot)
					notifyActionFailure('Failed to duplicate rows', error)
				})
		},
		[activeConnectionId, insertRow, notifyActionFailure, notifyPrimaryKeyNotGenerated, onLoadTableData, onRowsAdded, setSelectedRows, setTableData, tableData, tableId, tableRefName]
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
				if (canDuplicateWithoutInput(tableData.columns)) {
					duplicateRowIndexes(effectiveRowIndexes)
					break
				}

				if (isBatchAction) {
					notifyPrimaryKeyNotGenerated('duplicate rows')
					break
				}

				// The key is the user's to supply, so the copy goes into a draft row
				// they complete instead of an insert that would collide.
				const defaults = createDefaultValues(tableData.columns)
				setDraftRow({ ...defaults, ...buildDuplicateRow(row, tableData.columns) })
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
