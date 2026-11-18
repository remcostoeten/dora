import { areValuesEqual } from '@studio/shared/utils/value-equality'
import { createEditKey } from '@studio/core/pending-edits/pending-edits-store'
import {
	applyStagedPatches,
	getRevertPatches,
	getStagedPatches,
	type StagedCellPatch,
	type StagedEntry
} from '@studio/core/pending-edits/staged-history'
import { resolveCellChanges, type RequestedCellEdit } from '../utils/cell-changes'
import { patchSnapshotRows } from '../utils/table-snapshot'
import { normalizeValueForInsert } from '../utils/studio-data'
import type { TableData } from '../types'

type PendingEdit = {
	primaryKeyColumn: string
	primaryKeyValue: unknown
	columnName: string
	oldValue: unknown
	newValue: unknown
}

// Names the rows and columns that failed so the toast points at something the
// user can act on, instead of a bare "failed to apply changes".
function describeFailedEdits(failed: { edit: PendingEdit; reason: unknown }[]): string {
	return failed
		.map(function ({ edit, reason }) {
			const message = reason instanceof Error ? reason.message : String(reason)
			return `${edit.primaryKeyColumn}=${String(edit.primaryKeyValue)} · ${edit.columnName}: ${message}`
		})
		.join('\n')
}

type Args = {
	activeConnectionId?: string
	tableId: string | null
	tableRefName: string | null
	tableData: TableData | null
	isDryEditMode: boolean
	pendingEdits: Map<string, PendingEdit>
	getEditsForTable: (tableId: string) => PendingEdit[]
	hasEdits: (tableId: string) => boolean
	addEdit: (tableId: string, edit: PendingEdit) => void
	addEdits: (tableId: string, edits: PendingEdit[]) => void
	removeEdit: (tableId: string, key: string) => void
	revertEdits: (tableId: string, keys: string[]) => void
	clearEdits: (tableId: string) => void
	undoStagedEdit: (tableId: string) => StagedEntry | null
	redoStagedEdit: (tableId: string) => StagedEntry | null
	updateCell: {
		mutate: (
			payload: Record<string, unknown>,
			options: { onSuccess: () => void; onError: (error: unknown) => void }
		) => void
		mutateAsync: (payload: Record<string, unknown>) => Promise<unknown>
	}
	updateCells: { mutateAsync: Function }
	setTableData: (
		updater: TableData | null | ((prev: TableData | null) => TableData | null)
	) => void
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
		addEdit,
		addEdits,
		removeEdit,
		revertEdits,
		clearEdits,
		undoStagedEdit,
		redoStagedEdit,
		updateCell,
		updateCells,
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
			const key = createEditKey(tableId, row[primaryKeyColumn.name], columnName)
			const existingEdit = pendingEdits.get(key)
			const oldValue = existingEdit ? existingEdit.oldValue : row[columnName]

			if (areValuesEqual(oldValue, normalizedNewValue)) {
				revertEdits(tableId, [key])
				setTableData(function (prev) {
					if (!prev) return prev
					const newRows = [...prev.rows]
					newRows[rowIndex] = { ...newRows[rowIndex], [columnName]: oldValue }
					return { ...prev, rows: newRows }
				})
				return
			}

			addEdit(tableId, {
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
					// Keep the optimistic value on screen — no refetch. Reloading
					// here repaints the stale cached page first (the pre-edit
					// value), which is the "flash back to original" the user sees.
					// Patch the cached page so reopening the table later shows the
					// new value too, instead of the stale pre-edit one.
					patchSnapshotRows(activeConnectionId, tableRefName, function (cachedRow) {
						if (cachedRow[primaryKeyColumn.name] === row[primaryKeyColumn.name]) {
							return { ...cachedRow, [columnName]: normalizedNewValue }
						}
						return cachedRow
					})
				},
				onError: function (error) {
					setTableData(function (prev) {
						if (!prev) return prev
						const revertedRows = [...prev.rows]
						revertedRows[rowIndex] = {
							...revertedRows[rowIndex],
							[columnName]: previousValue
						}
						return { ...prev, rows: revertedRows }
					})
					notifyActionFailure('Failed to update cell', error)
				}
			}
		)
	}

	function paintStagedPatches(patches: StagedCellPatch[]) {
		setTableData(function (prev) {
			if (!prev) return prev
			return { ...prev, rows: applyStagedPatches(prev.rows, patches) }
		})
	}

	function handleUndoStaged(): boolean {
		if (!tableId) return false
		const entry = undoStagedEdit(tableId)
		if (!entry) return false
		paintStagedPatches(getStagedPatches(entry, 'undo'))
		return true
	}

	function handleRedoStaged(): boolean {
		if (!tableId) return false
		const entry = redoStagedEdit(tableId)
		if (!entry) return false
		paintStagedPatches(getStagedPatches(entry, 'redo'))
		return true
	}

	function handleRevertStaged(rowIndex: number, columnName: string | null): number {
		if (!tableId || !tableData) return 0
		const row = tableData.rows[rowIndex]
		const primaryKeyColumn = tableData.columns.find(function (c) {
			return c.primaryKey
		})
		if (!row || !primaryKeyColumn) return 0

		const columnNames = columnName
			? [columnName]
			: tableData.columns.map(function (column) {
					return column.name
				})
		const keys: string[] = []
		const reverted: PendingEdit[] = []
		for (const name of columnNames) {
			const key = createEditKey(tableId, row[primaryKeyColumn.name], name)
			const edit = pendingEdits.get(key)
			if (!edit) continue
			keys.push(key)
			reverted.push(edit)
		}
		if (keys.length === 0) return 0

		revertEdits(tableId, keys)
		paintStagedPatches(getRevertPatches(reverted))
		return keys.length
	}

	async function handleApplyPendingEdits() {
		if (!activeConnectionId || !tableId) return

		const edits = getEditsForTable(tableId)
		if (edits.length === 0) return

		setIsApplyingEdits(true)
		try {
			const outcomes = await Promise.allSettled(
				edits.map(function (edit) {
					return updateCell.mutateAsync({
						connectionId: activeConnectionId,
						tableName: tableRefName,
						primaryKeyColumn: edit.primaryKeyColumn,
						primaryKeyValue: edit.primaryKeyValue,
						columnName: edit.columnName,
						newValue: edit.newValue
					})
				})
			)

			const applied: PendingEdit[] = []
			const failed: { edit: PendingEdit; reason: unknown }[] = []

			outcomes.forEach(function (outcome, index) {
				const edit = edits[index]
				if (outcome.status === 'fulfilled') {
					applied.push(edit)
				} else {
					failed.push({ edit, reason: outcome.reason })
				}
			})

			// Drop only what actually landed, so a retry does not re-issue
			// updates the database has already accepted.
			if (failed.length === 0) {
				clearEdits(tableId)
			} else {
				for (const edit of applied) {
					removeEdit(
						tableId,
						createEditKey(tableId, edit.primaryKeyValue, edit.columnName)
					)
				}
			}

			// The edited values are already on screen from dry-edit mode, so
			// patch the cached page instead of reloading (mirrors handleCellEdit).
			patchSnapshotRows(activeConnectionId, tableRefName, function (cachedRow) {
				const matching = applied.filter(function (edit) {
					return cachedRow[edit.primaryKeyColumn] === edit.primaryKeyValue
				})
				if (matching.length === 0) return cachedRow
				const patched = { ...cachedRow }
				for (const edit of matching) {
					patched[edit.columnName] = edit.newValue
				}
				return patched
			})

			if (failed.length > 0) {
				// Put the failed cells back to their pre-edit values on screen so
				// the grid stops showing writes the database rejected.
				setTableData(function (current) {
					if (!current) return current
					const rows = current.rows.map(function (row) {
						const matching = failed.filter(function (entry) {
							return row[entry.edit.primaryKeyColumn] === entry.edit.primaryKeyValue
						})
						if (matching.length === 0) return row
						const reverted = { ...row }
						for (const entry of matching) {
							reverted[entry.edit.columnName] = entry.edit.oldValue
						}
						return reverted
					})
					return { ...current, rows }
				})

				notifyActionFailure(
					`Failed to apply ${failed.length} of ${edits.length} change(s)`,
					describeFailedEdits(failed)
				)
			}
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

	async function handleCellsEdit(edits: RequestedCellEdit[]) {
		if (!tableId || !activeConnectionId || !tableData) return

		const primaryKeyColumn = tableData.columns.find(function (c) {
			return c.primaryKey
		})
		if (!primaryKeyColumn) {
			notifyMissingPrimaryKey('edit cells')
			return
		}

		const primaryKeyColumnName = primaryKeyColumn.name
		const changes = resolveCellChanges(edits, tableData, primaryKeyColumnName)
		if (changes.length === 0) return

		if (isDryEditMode) {
			const staged: PendingEdit[] = []
			const backToOriginal: string[] = []
			const patches: StagedCellPatch[] = []
			for (const change of changes) {
				const key = createEditKey(tableId, change.primaryKeyValue, change.columnName)
				const existing = pendingEdits.get(key)
				const oldValue = existing ? existing.oldValue : change.previousValue
				patches.push({
					primaryKeyColumn: primaryKeyColumnName,
					primaryKeyValue: change.primaryKeyValue,
					columnName: change.columnName,
					value: change.newValue
				})
				if (areValuesEqual(oldValue, change.newValue)) {
					backToOriginal.push(key)
					continue
				}
				staged.push({
					primaryKeyColumn: primaryKeyColumnName,
					primaryKeyValue: change.primaryKeyValue,
					columnName: change.columnName,
					oldValue,
					newValue: change.newValue
				})
			}
			if (backToOriginal.length > 0) revertEdits(tableId, backToOriginal)
			if (staged.length > 0) addEdits(tableId, staged)
			paintStagedPatches(patches)
			return
		}

		const snapshot = tableData
		function applyChangesToRow(row: Record<string, unknown>) {
			const matching = changes.filter(function (change) {
				return row[primaryKeyColumnName] === change.primaryKeyValue
			})
			if (matching.length === 0) return row
			const patched = { ...row }
			for (const change of matching) {
				patched[change.columnName] = change.newValue
			}
			return patched
		}

		setTableData(function (prev) {
			if (!prev) return prev
			return { ...prev, rows: prev.rows.map(applyChangesToRow) }
		})

		try {
			await updateCells.mutateAsync({
				connectionId: activeConnectionId,
				tableName: tableRefName,
				primaryKeyColumn: primaryKeyColumn.name,
				cells: changes.map(function (change) {
					return {
						primaryKeyValue: change.primaryKeyValue,
						columnName: change.columnName,
						newValue: change.newValue
					}
				})
			})

			trackBatchCellMutation(
				activeConnectionId,
				tableRefName,
				primaryKeyColumn.name,
				changes.map(function (change) {
					return {
						primaryKeyValue: change.primaryKeyValue,
						columnName: change.columnName,
						previousValue: change.previousValue,
						newValue: change.newValue
					}
				})
			)
			patchSnapshotRows(activeConnectionId, tableRefName, applyChangesToRow)
		} catch (error) {
			setTableData(snapshot)
			notifyActionFailure('Failed to update cells', error)
		}
	}

	function handleBatchCellEdit(rowIndexes: number[], columnName: string, newValue: unknown) {
		return handleCellsEdit(
			rowIndexes.map(function (rowIndex) {
				return { rowIndex, columnName, value: newValue }
			})
		)
	}

	return {
		handleCellEdit,
		handleApplyPendingEdits,
		handleDiscardPendingEdits,
		handleBatchCellEdit,
		handleCellsEdit,
		handleRevertStaged,
		handleUndoStaged,
		handleRedoStaged
	}
}
