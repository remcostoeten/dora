import { createDefaultValues, normalizeRowForInsert, normalizeValueForInsert } from '../utils/studio-data'
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
	draftRow: Record<string, unknown> | null
	addDialogMode: 'add' | 'duplicate' | 'edit'
	editingRowState: EditingRowState
	updateCell: { mutateAsync: Function }
	insertRow: { mutateAsync: Function; mutate: Function }
	onLoadTableData: () => void
	setDraftRow: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
	setDraftInsertIndex: React.Dispatch<React.SetStateAction<number | null>>
	setEditingRowState: React.Dispatch<React.SetStateAction<EditingRowState>>
	setDuplicateInitialData: React.Dispatch<React.SetStateAction<Record<string, unknown> | undefined>>
	setAddDialogMode: React.Dispatch<React.SetStateAction<'add' | 'duplicate' | 'edit'>>
	setShowAddDialog: React.Dispatch<React.SetStateAction<boolean>>
	notifyActionFailure: (title: string, error: unknown) => void
}

export function useDatabaseStudioDraftRow(args: Args) {
	const {
		activeConnectionId,
		tableId,
		tableRefName,
		tableData,
		draftRow,
		addDialogMode,
		editingRowState,
		updateCell,
		insertRow,
		onLoadTableData,
		setDraftRow,
		setDraftInsertIndex,
		setEditingRowState,
		setDuplicateInitialData,
		setAddDialogMode,
		setShowAddDialog,
		notifyActionFailure
	} = args

	function handleAddRecord() {
		if (!tableData) return
		setEditingRowState(null)
		setDuplicateInitialData(undefined)
		setAddDialogMode('add')
		setDraftRow(createDefaultValues(tableData.columns))
		setDraftInsertIndex(-1)
	}

	function handleDraftChange(columnName: string, value: unknown) {
		setDraftRow(function (prev) {
			if (!prev) return prev
			return { ...prev, [columnName]: value }
		})
	}

	function handleDraftSave() {
		if (!activeConnectionId || !tableId || !draftRow || !tableData) return
		const normalizedDraftRow = normalizeRowForInsert(draftRow, tableData.columns)

		insertRow.mutate(
			{
				connectionId: activeConnectionId,
				tableName: tableRefName,
				rowData: normalizedDraftRow
			},
			{
				onSuccess: function onInsertSuccess() {
					setDraftRow(null)
					setDraftInsertIndex(null)
					onLoadTableData()
				},
				onError: function onInsertError(error: unknown) {
					notifyActionFailure('Failed to create row', error)
				}
			}
		)
	}

	function handleDraftCancel() {
		setDraftRow(null)
		setDraftInsertIndex(null)
	}

	function handleAddRecordSubmit(rowData: Record<string, unknown>) {
		if (!activeConnectionId || !tableId || !tableData) return
		if (addDialogMode === 'edit' && editingRowState) {
			const changedColumns = tableData.columns
				.filter(function isEditableColumn(column) {
					return !column.primaryKey
				})
				.filter(function hasChangedValue(column) {
					return rowData[column.name] !== editingRowState.originalRow[column.name]
				})

			if (changedColumns.length === 0) {
				setShowAddDialog(false)
				setEditingRowState(null)
				setDuplicateInitialData(undefined)
				setAddDialogMode('add')
				return
			}

			Promise.all(
				changedColumns.map(function updateChangedColumn(column) {
					return updateCell.mutateAsync({
						connectionId: activeConnectionId,
						tableName: tableRefName,
						primaryKeyColumn: editingRowState.primaryKeyColumn,
						primaryKeyValue: editingRowState.primaryKeyValue,
						columnName: column.name,
						newValue: normalizeValueForInsert(column, rowData[column.name])
					})
				})
			)
				.then(function onEditSuccess() {
					setShowAddDialog(false)
					setEditingRowState(null)
					setDuplicateInitialData(undefined)
					setAddDialogMode('add')
					onLoadTableData()
				})
				.catch(function onEditError(error) {
					notifyActionFailure('Failed to update row', error)
				})
			return
		}

		const normalizedRowData = normalizeRowForInsert(rowData, tableData.columns)
		insertRow.mutate(
			{
				connectionId: activeConnectionId,
				tableName: tableRefName,
				rowData: normalizedRowData
			},
			{
				onSuccess: function onInsertSuccess() {
					setShowAddDialog(false)
					setDuplicateInitialData(undefined)
					setAddDialogMode('add')
					onLoadTableData()
				},
				onError: function onInsertError(error: unknown) {
					notifyActionFailure('Failed to create row', error)
				}
			}
		)
	}

	return {
		handleAddRecord,
		handleDraftChange,
		handleDraftSave,
		handleDraftCancel,
		handleAddRecordSubmit
	}
}
