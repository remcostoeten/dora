import { appendRows, createDefaultValues, normalizeRowForInsert, normalizeValueForInsert } from '../utils/studio-data'
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
	setTableData: React.Dispatch<React.SetStateAction<TableData | null>>
	setDraftRow: React.Dispatch<React.SetStateAction<Record<string, unknown> | null>>
	setDraftInsertIndex: React.Dispatch<React.SetStateAction<number | null>>
	setEditingRowState: React.Dispatch<React.SetStateAction<EditingRowState>>
	setDuplicateInitialData: React.Dispatch<React.SetStateAction<Record<string, unknown> | undefined>>
	setAddDialogMode: React.Dispatch<React.SetStateAction<'add' | 'duplicate' | 'edit'>>
	setShowAddDialog: React.Dispatch<React.SetStateAction<boolean>>
	notifyActionFailure: (title: string, error: unknown) => void
	/** Snapshots the current rows so the inserted ones can be highlighted. */
	onRowsAdded: () => void
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
		setTableData,
		setDraftRow,
		setDraftInsertIndex,
		setEditingRowState,
		setDuplicateInitialData,
		setAddDialogMode,
		setShowAddDialog,
		notifyActionFailure,
		onRowsAdded
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

		const snapshot = tableData
		onRowsAdded()
		setTableData(appendRows(tableData, [normalizedDraftRow]))
		setDraftRow(null)
		setDraftInsertIndex(null)

		insertRow.mutate(
			{
				connectionId: activeConnectionId,
				tableName: tableRefName,
				rowData: normalizedDraftRow
			},
			{
				onSuccess: function onInsertSuccess() {
					onLoadTableData()
				},
				onError: function onInsertError(error: unknown) {
					setTableData(snapshot)
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

			setShowAddDialog(false)
			setEditingRowState(null)
			setDuplicateInitialData(undefined)
			setAddDialogMode('add')

			if (changedColumns.length === 0) {
				return
			}

			const normalizedChanges = changedColumns.map(function (column) {
				return { column, newValue: normalizeValueForInsert(column, rowData[column.name]) }
			})

			const snapshot = tableData
			setTableData(function (prev) {
				if (!prev) return prev
				const newRows = prev.rows.map(function (row) {
					if (row[editingRowState.primaryKeyColumn] !== editingRowState.primaryKeyValue) {
						return row
					}
					const patched = { ...row }
					for (const change of normalizedChanges) {
						patched[change.column.name] = change.newValue
					}
					return patched
				})
				return { ...prev, rows: newRows }
			})

			Promise.all(
				normalizedChanges.map(function updateChangedColumn(change) {
					return updateCell.mutateAsync({
						connectionId: activeConnectionId,
						tableName: tableRefName,
						primaryKeyColumn: editingRowState.primaryKeyColumn,
						primaryKeyValue: editingRowState.primaryKeyValue,
						columnName: change.column.name,
						newValue: change.newValue
					})
				})
			)
				.then(function onEditSuccess() {
					onLoadTableData()
				})
				.catch(function onEditError(error) {
					setTableData(snapshot)
					notifyActionFailure('Failed to update row', error)
				})
			return
		}

		const normalizedRowData = normalizeRowForInsert(rowData, tableData.columns)
		const snapshot = tableData
		onRowsAdded()
		setTableData(appendRows(tableData, [normalizedRowData]))
		setShowAddDialog(false)
		setDuplicateInitialData(undefined)
		setAddDialogMode('add')

		insertRow.mutate(
			{
				connectionId: activeConnectionId,
				tableName: tableRefName,
				rowData: normalizedRowData
			},
			{
				onSuccess: function onInsertSuccess() {
					onLoadTableData()
				},
				onError: function onInsertError(error: unknown) {
					setTableData(snapshot)
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
