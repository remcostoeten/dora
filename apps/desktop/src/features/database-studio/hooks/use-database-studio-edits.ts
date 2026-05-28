import { useEffect } from 'react'
import { areValuesEqual } from '@/shared/utils/value-equality'
import { normalizeValueForInsert } from '../utils/studio-data'
import type { TableData } from '../types'

type PendingEdit = {
	primaryKeyColumn: string
	primaryKeyValue: unknown
	columnName: string
	oldValue: unknown
	newValue: unknown
	rowIndex: number
}

type Args = {
	activeConnectionId?: string
	tableId: string | null
	tableRefName: string | null
	tableData: TableData | null
	isDryEditMode: boolean
	pendingEdits: Map<string, { oldValue: unknown }>
	getEditsForTable: (tableId: string) => PendingEdit[]
	hasEdits: (tableId: string) => boolean
	addEdit: (tableId: string, edit: PendingEdit) => void
	removeEdit: (tableId: string, key: string) => void
	clearEdits: (tableId: string) => void
	updateCell: {
		mutate: (payload: Record<string, unknown>, options: { onSuccess: () => void; onError: (error: unknown) => void }) => void
		mutateAsync: (payload: Record<string, unknown>) => Promise<unknown>
	}
	setTableData: (updater: TableData | null | ((prev: TableData | null) => TableData | null)) => void
	setIsApplyingEdits: (value: boolean) => void
	loadTableData: () => void
	trackCellMutation: (
		connectionId: string,
		tableName: string | null,
		primaryKeyColumn: string,
		primaryKeyValue: unknown,
		columnName: string,
		previousValue: unknown,
		newValue: unknown
	) => void
	trackBatchCellMutation: (
		connectionId: string,
		tableName: string | null,
		primaryKeyColumn: string,
		cells: Array<{
			primaryKeyValue: unknown
			columnName: string
			previousValue: unknown
			newValue: unknown
		}>
	) => void
	notifyMissingPrimaryKey: (actionLabel: string) => void
	notifyActionFailure: (title: string, error: unknown) => void
}

export function useDatabaseStudioEdits(args: Args) {
	const {
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
	} = args

	function handleCellEdit(rowIndex: number, columnName: string, newValue: unknown) {
		if (!tableId || !activeConnectionId || !tableData) return

		const row = tableData.rows[rowIndex]
		if (!row) return

		const editedColumn = tableData.columns.find(function (c) {
			return c.name === columnName
		})
		const normalizedNewValue = editedColumn
			? normalizeValueForInsert(editedColumn, newValue)
			: newValue

		if (areValuesEqual(row[columnName], normalizedNewValue)) return

		const primaryKeyColumn = tableData.columns.find(function (c) {
			return c.primaryKey
		})
		if (!primaryKeyColumn) {
			notifyMissingPrimaryKey('edit cell')
			return
		}

		if (isDryEditMode) {
			const key = `${tableId}:${String(row[primaryKeyColumn.name])}:${columnName}`
			const existingEdit = pendingEdits.get(key)
			const oldValue = existingEdit ? existingEdit.oldValue : row[columnName]

			if (areValuesEqual(oldValue, normalizedNewValue)) {
				removeEdit(tableId, key)
				setTableData(function (prev) {
					if (!prev) return prev
					const newRows = [...prev.rows]
					newRows[rowIndex] = { ...newRows[rowIndex], [columnName]: oldValue }
					return { ...prev, rows: newRows }
				})
				return
			}

			addEdit(tableId, {
				rowIndex,
				primaryKeyColumn: primaryKeyColumn.name,
				primaryKeyValue: row[primaryKeyColumn.name],
				columnName,
				oldValue,
				newValue: normalizedNewValue
			})

			setTableData(function (prev) {
				if (!prev) return prev
				const newRows = [...prev.rows]
				newRows[rowIndex] = { ...newRows[rowIndex], [columnName]: normalizedNewValue }
				return { ...prev, rows: newRows }
			})
			return
		}

		const previousValue = row[columnName]
		setTableData(function (prev) {
			if (!prev) return prev
			const newRows = [...prev.rows]
			newRows[rowIndex] = { ...newRows[rowIndex], [columnName]: normalizedNewValue }
			return { ...prev, rows: newRows }
		})

		updateCell.mutate(
			{
				connectionId: activeConnectionId,
				tableName: tableRefName,
				primaryKeyColumn: primaryKeyColumn.name,
				primaryKeyValue: row[primaryKeyColumn.name],
				columnName,
				newValue: normalizedNewValue
			},
			{
				onSuccess: function () {
					trackCellMutation(
						activeConnectionId,
						tableRefName,
						primaryKeyColumn.name,
						row[primaryKeyColumn.name],
						columnName,
						previousValue,
						normalizedNewValue
					)
					loadTableData()
				},
				onError: function (error) {
					setTableData(function (prev) {
						if (!prev) return prev
						const revertedRows = [...prev.rows]
						revertedRows[rowIndex] = { ...revertedRows[rowIndex], [columnName]: previousValue }
						return { ...prev, rows: revertedRows }
					})
					notifyActionFailure('Failed to update cell', error)
				}
			}
		)
	}

	useEffect(
		function bindDryEditUndo() {
			function handleKeyDown(e: KeyboardEvent) {
				if (!(e.ctrlKey || e.metaKey) || e.key !== 'z' || e.shiftKey) return
				if (!isDryEditMode || !tableId || !hasEdits(tableId)) return

				const target = e.target as HTMLElement
				const isInput =
					target.tagName === 'INPUT' ||
					target.tagName === 'TEXTAREA' ||
					target.isContentEditable
				if (isInput) return

				e.preventDefault()
				e.stopPropagation()

				const edits = getEditsForTable(tableId)
				const lastEdit = edits[edits.length - 1]
				if (!lastEdit) return

				const key = `${tableId}:${String(lastEdit.primaryKeyValue)}:${lastEdit.columnName}`
				removeEdit(tableId, key)
				setTableData(function (prev) {
					if (!prev) return prev
					const newRows = [...prev.rows]
					if (newRows[lastEdit.rowIndex]) {
						newRows[lastEdit.rowIndex] = {
							...newRows[lastEdit.rowIndex],
							[lastEdit.columnName]: lastEdit.oldValue
						}
					}
					return { ...prev, rows: newRows }
				})
			}

			window.addEventListener('keydown', handleKeyDown, true)
			return function () {
				window.removeEventListener('keydown', handleKeyDown, true)
			}
		},
		[isDryEditMode, tableId, hasEdits, getEditsForTable, removeEdit, setTableData]
	)

	async function handleApplyPendingEdits() {
		if (!activeConnectionId || !tableId) return

		const edits = getEditsForTable(tableId)
		if (edits.length === 0) return

		setIsApplyingEdits(true)
		try {
			for (const edit of edits) {
				await updateCell.mutateAsync({
					connectionId: activeConnectionId,
					tableName: tableRefName,
					primaryKeyColumn: edit.primaryKeyColumn,
					primaryKeyValue: edit.primaryKeyValue,
					columnName: edit.columnName,
					newValue: edit.newValue
				})
			}
			clearEdits(tableId)
			loadTableData()
		} catch (error) {
			notifyActionFailure('Failed to apply changes', error)
		} finally {
			setIsApplyingEdits(false)
		}
	}

	function handleDiscardPendingEdits() {
		if (!tableId) return
		clearEdits(tableId)
		loadTableData()
	}

	async function handleBatchCellEdit(
		rowIndexes: number[],
		columnName: string,
		newValue: unknown
	) {
		if (!tableId || !activeConnectionId || !tableData) return

		const primaryKeyColumn = tableData.columns.find(function (c) {
			return c.primaryKey
		})
		if (!primaryKeyColumn) {
			notifyMissingPrimaryKey('apply bulk edits')
			return
		}

		const cellsToTrack = rowIndexes.map(function (rowIndex) {
			const row = tableData.rows[rowIndex]
			return {
				primaryKeyValue: row[primaryKeyColumn.name],
				columnName,
				previousValue: row[columnName],
				newValue
			}
		})

		try {
			await Promise.all(
				rowIndexes.map(async function (rowIndex) {
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

			trackBatchCellMutation(
				activeConnectionId,
				tableRefName,
				primaryKeyColumn.name,
				cellsToTrack
			)
			loadTableData()
		} catch (error) {
			notifyActionFailure('Failed to update cells', error)
		}
	}

	return {
		handleCellEdit,
		handleApplyPendingEdits,
		handleDiscardPendingEdits,
		handleBatchCellEdit
	}
}
