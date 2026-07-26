import { useEffect } from 'react'
import { areValuesEqual } from '@studio/shared/utils/value-equality'
import { createEditKey } from '@studio/core/pending-edits/pending-edits-store'
import { tableDataCache } from '@studio/core/table-cache'
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
	currentCacheKey: string
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
		currentCacheKey,
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
			const key = createEditKey(tableId, row[primaryKeyColumn.name], columnName)
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
					const cached = tableDataCache.get(currentCacheKey)
					if (cached) {
						const patchedRows = cached.data.rows.map(function (cachedRow) {
							if (cachedRow[primaryKeyColumn.name] === row[primaryKeyColumn.name]) {
								return { ...cachedRow, [columnName]: normalizedNewValue }
							}
							return cachedRow
						})
						tableDataCache.set(currentCacheKey, {
							...cached,
							data: { ...cached.data, rows: patchedRows }
						})
					}
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

				const key = createEditKey(tableId, lastEdit.primaryKeyValue, lastEdit.columnName)
				removeEdit(tableId, key)
				setTableData(function (prev) {
					if (!prev) return prev
					// Resolve by primary key, not a stored page position: after a
					// sort, filter or page change that index points at a different row.
					const index = prev.rows.findIndex(function (row) {
						return row[lastEdit.primaryKeyColumn] === lastEdit.primaryKeyValue
					})
					if (index === -1) return prev

					const newRows = [...prev.rows]
					newRows[index] = {
						...newRows[index],
						[lastEdit.columnName]: lastEdit.oldValue
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
					removeEdit(tableId, createEditKey(tableId, edit.primaryKeyValue, edit.columnName))
				}
			}

			// The edited values are already on screen from dry-edit mode, so
			// patch the cached page instead of reloading (mirrors handleCellEdit).
			const cached = tableDataCache.get(currentCacheKey)
			if (cached) {
				const patchedRows = cached.data.rows.map(function (cachedRow) {
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
				tableDataCache.set(currentCacheKey, {
					...cached,
					data: { ...cached.data, rows: patchedRows }
				})
			}

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

		const editedPrimaryKeyValues = new Set(
			cellsToTrack.map(function (cell) {
				return cell.primaryKeyValue
			})
		)

		const snapshot = tableData
		setTableData(function (prev) {
			if (!prev) return prev
			const newRows = prev.rows.map(function (row) {
				if (editedPrimaryKeyValues.has(row[primaryKeyColumn.name])) {
					return { ...row, [columnName]: newValue }
				}
				return row
			})
			return { ...prev, rows: newRows }
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
			// Keep the optimistic values on screen — no refetch (mirrors
			// handleCellEdit). Patch the cached page so reopening the table later
			// shows the new values instead of the stale pre-edit ones.
			const cached = tableDataCache.get(currentCacheKey)
			if (cached) {
				const patchedRows = cached.data.rows.map(function (cachedRow) {
					if (editedPrimaryKeyValues.has(cachedRow[primaryKeyColumn.name])) {
						return { ...cachedRow, [columnName]: newValue }
					}
					return cachedRow
				})
				tableDataCache.set(currentCacheKey, {
					...cached,
					data: { ...cached.data, rows: patchedRows }
				})
			}
		} catch (error) {
			setTableData(snapshot)
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
