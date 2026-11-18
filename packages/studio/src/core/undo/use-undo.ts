import { useCallback } from 'react'
import { toast } from '@studio/shared/ui/notifier'
import { useDataMutation } from '@studio/core/data-provider'
import {
	useUndoStore,
	Mutation,
	CellMutation,
	BatchCellMutation,
	RowDeletion,
	UndoableAction
} from './undo-store'

type UndoOptions = {
	onUndoComplete?: () => void
	// Applied synchronously before the backend revert runs so the grid reflects
	// the undo instantly. The reconcile in onUndoComplete swaps in authoritative
	// data (e.g. server PKs for re-inserted rows); on failure it resyncs the grid
	// back to the true database state, discarding this optimistic patch.
	onUndoApply?: (mutation: Mutation) => void
}

// Deleting more rows than this keeps no undo snapshot — re-inserting that many
// rows is slow and holding their full contents in memory for the undo window
// would bloat the store. The delete still happens; it is just not undoable.
const MAX_UNDOABLE_DELETE_ROWS = 200

/**
 * @name describeBatchCellMutation
 * @description Words the undo entry for a batch of cell updates, naming NULL
 * only when every cell was set to it.
 *
 * @example
 * describeBatchCellMutation([{ newValue: null }, { newValue: null }])
 * // 'Updated 2 cells to NULL'
 */
export function describeBatchCellMutation(cells: Array<{ newValue: unknown }>): string {
	const base = `Updated ${cells.length} cell${cells.length === 1 ? '' : 's'}`
	const allNull = cells.every(function (cell) {
		return cell.newValue === null
	})
	return allNull ? `${base} to NULL` : base
}

/**
 * @name invertMutation
 * @description Swaps the previous and new values of a cell mutation, so the
 * optimistic repaint written for undo can also paint a redo. A row deletion
 * has no inverse here and is returned unchanged.
 *
 * @example
 * invertMutation({ type: 'cell', previousValue: 'a', newValue: 'b', ...rest })
 * // { type: 'cell', previousValue: 'b', newValue: 'a', ...rest }
 */
export function invertMutation(mutation: Mutation): Mutation {
	if (mutation.type === 'cell') {
		return {
			...mutation,
			previousValue: mutation.newValue,
			newValue: mutation.previousValue
		}
	}
	if (mutation.type === 'batch-cell') {
		return {
			...mutation,
			cells: mutation.cells.map(function (cell) {
				return { ...cell, previousValue: cell.newValue, newValue: cell.previousValue }
			})
		}
	}
	return mutation
}

/**
 * @name pickUndoTarget
 * @description Decides what undo and redo act on: the staged edits while dry
 * mode is on, the committed mutations otherwise.
 *
 * @example
 * pickUndoTarget(true) // 'staged'
 */
export function pickUndoTarget(isDryEditMode: boolean): 'staged' | 'committed' {
	return isDryEditMode ? 'staged' : 'committed'
}

export function useUndo(options: UndoOptions = {}) {
	const {
		addAction,
		addRedoAction,
		getLatestAction,
		getLatestRedoAction,
		removeAction,
		removeRedoAction,
		actions,
		redoActions,
		timeoutDuration
	} = useUndoStore()
	const { updateCell, updateCells, insertRows, deleteRows } = useDataMutation()

	const performUndo = useCallback(
		async function (mutation: Mutation): Promise<boolean> {
			try {
				if (mutation.type === 'cell') {
					await updateCell.mutateAsync({
						connectionId: mutation.connectionId,
						tableName: mutation.tableName,
						primaryKeyColumn: mutation.primaryKeyColumn,
						primaryKeyValue: mutation.primaryKeyValue,
						columnName: mutation.columnName,
						newValue: mutation.previousValue
					})
					return true
				} else if (mutation.type === 'batch-cell') {
					await updateCells.mutateAsync({
						connectionId: mutation.connectionId,
						tableName: mutation.tableName,
						primaryKeyColumn: mutation.primaryKeyColumn,
						cells: mutation.cells.map(function (cell) {
							return {
								primaryKeyValue: cell.primaryKeyValue,
								columnName: cell.columnName,
								newValue: cell.previousValue
							}
						})
					})
					return true
				} else if (mutation.type === 'row-delete') {
					await insertRows.mutateAsync({
						connectionId: mutation.connectionId,
						tableName: mutation.tableName,
						rows: mutation.rows
					})
					return true
				}
				return false
			} catch (error) {
				console.error('Failed to undo:', error)
				return false
			}
		},
		[updateCell, updateCells, insertRows]
	)

	const runUndo = useCallback(
		async function (mutation: Mutation): Promise<boolean> {
			options.onUndoApply?.(mutation)
			const success = await performUndo(mutation)
			// Reconcile on success (authoritative data); on failure resync the grid
			// to the true DB state, discarding the optimistic patch we just applied.
			options.onUndoComplete?.()
			return success
		},
		[performUndo, options]
	)

	const undoAction = useCallback(
		async function (action: UndoableAction): Promise<boolean> {
			const success = await runUndo(action.mutation)
			if (success) {
				removeAction(action.id)
				addRedoAction(action.description, action.mutation)
			}
			return success
		},
		[addRedoAction, removeAction, runUndo]
	)

	const undoLatest = useCallback(
		async function () {
			const latestAction = getLatestAction()
			if (!latestAction) {
				toast.info('Nothing to undo')
				return false
			}

			const success = await undoAction(latestAction)
			if (success) {
				toast.success('Undo successful', {
					description: `Reverted: ${latestAction.description}`
				})
			} else {
				toast.error('Failed to undo')
			}
			return success
		},
		[getLatestAction, undoAction]
	)

	const performRedo = useCallback(
		async function (mutation: Mutation): Promise<boolean> {
			try {
				if (mutation.type === 'cell') {
					await updateCell.mutateAsync({
						connectionId: mutation.connectionId,
						tableName: mutation.tableName,
						primaryKeyColumn: mutation.primaryKeyColumn,
						primaryKeyValue: mutation.primaryKeyValue,
						columnName: mutation.columnName,
						newValue: mutation.newValue
					})
					return true
				}
				if (mutation.type === 'batch-cell') {
					await updateCells.mutateAsync({
						connectionId: mutation.connectionId,
						tableName: mutation.tableName,
						primaryKeyColumn: mutation.primaryKeyColumn,
						cells: mutation.cells.map(function (cell) {
							return {
								primaryKeyValue: cell.primaryKeyValue,
								columnName: cell.columnName,
								newValue: cell.newValue
							}
						})
					})
					return true
				}
				const primaryKeyColumn = mutation.primaryKeyColumn
				if (!primaryKeyColumn) return false
				await deleteRows.mutateAsync({
					connectionId: mutation.connectionId,
					tableName: mutation.tableName,
					primaryKeyColumn,
					primaryKeyValues: mutation.rows.map(function (row) {
						return row[primaryKeyColumn]
					})
				})
				return true
			} catch (error) {
				console.error('Failed to redo:', error)
				return false
			}
		},
		[updateCell, updateCells, deleteRows]
	)

	const redoLatest = useCallback(
		async function () {
			const latestRedo = getLatestRedoAction()
			if (!latestRedo) {
				toast.info('Nothing to redo')
				return false
			}
			if (
				latestRedo.mutation.type === 'row-delete' &&
				!latestRedo.mutation.primaryKeyColumn
			) {
				toast.error('Cannot redo this delete', {
					description: 'The deleted rows were recorded without a primary key.'
				})
				return false
			}

			options.onUndoApply?.(invertMutation(latestRedo.mutation))
			const success = await performRedo(latestRedo.mutation)
			options.onUndoComplete?.()
			if (success) {
				removeRedoAction(latestRedo.id)
				addAction(latestRedo.description, latestRedo.mutation, { keepRedo: true })
				toast.success('Redo successful', {
					description: `Reapplied: ${latestRedo.description}`
				})
			} else {
				toast.error('Failed to redo')
			}
			return success
		},
		[addAction, getLatestRedoAction, options, performRedo, removeRedoAction]
	)

	const trackCellMutation = useCallback(
		function (
			connectionId: string,
			tableName: string,
			primaryKeyColumn: string,
			primaryKeyValue: unknown,
			columnName: string,
			previousValue: unknown,
			newValue: unknown
		): string {
			const mutation: CellMutation = {
				type: 'cell',
				connectionId,
				tableName,
				primaryKeyColumn,
				primaryKeyValue,
				columnName,
				previousValue,
				newValue
			}

			const valueDesc = newValue === null ? 'NULL' : String(newValue)
			const description = `Set ${columnName} to ${valueDesc}`
			const actionId = addAction(description, mutation)

			toast.success(description, {
				description: `Press Ctrl+Z within ${timeoutDuration / 1000}s to undo`,
				action: {
					label: 'Undo',
					kbd: 'Ctrl+Z',
					onClick: function () {
						const action = useUndoStore.getState().getAction(actionId)
						if (action) undoAction(action)
					}
				},
				duration: timeoutDuration
			})

			return actionId
		},
		[addAction, undoAction, timeoutDuration]
	)

	const trackBatchCellMutation = useCallback(
		function (
			connectionId: string,
			tableName: string,
			primaryKeyColumn: string,
			cells: Array<{
				primaryKeyValue: unknown
				columnName: string
				previousValue: unknown
				newValue: unknown
			}>
		): string {
			const mutation: BatchCellMutation = {
				type: 'batch-cell',
				connectionId,
				tableName,
				primaryKeyColumn,
				cells
			}

			const description = describeBatchCellMutation(cells)
			const actionId = addAction(description, mutation)

			toast.success(description, {
				description: `Press Ctrl+Z within ${timeoutDuration / 1000}s to undo`,
				action: {
					label: 'Undo',
					kbd: 'Ctrl+Z',
					onClick: function () {
						const action = useUndoStore.getState().getAction(actionId)
						if (action) undoAction(action)
					}
				},
				duration: timeoutDuration
			})

			return actionId
		},
		[addAction, undoAction, timeoutDuration]
	)

	const trackRowDeletion = useCallback(
		function (
			connectionId: string,
			tableName: string,
			rows: Record<string, unknown>[],
			primaryKeyColumn?: string
		): string | null {
			if (rows.length === 0) return null

			const description = `Deleted ${rows.length} row${rows.length > 1 ? 's' : ''}`

			if (rows.length > MAX_UNDOABLE_DELETE_ROWS) {
				toast.success(description)
				return null
			}

			const mutation: RowDeletion = {
				type: 'row-delete',
				connectionId,
				tableName,
				rows,
				primaryKeyColumn
			}

			const actionId = addAction(description, mutation)

			toast.success(description, {
				description: `Press Ctrl+Z within ${timeoutDuration / 1000}s to undo`,
				action: {
					label: 'Undo',
					kbd: 'Ctrl+Z',
					onClick: function () {
						const action = useUndoStore.getState().getAction(actionId)
						if (action) undoAction(action)
					}
				},
				duration: timeoutDuration
			})

			return actionId
		},
		[addAction, undoAction, timeoutDuration]
	)

	return {
		trackCellMutation,
		trackBatchCellMutation,
		trackRowDeletion,
		undoLatest,
		redoLatest,
		hasRedoableActions: redoActions.length > 0,
		hasUndoableActions: actions.length > 0,
		undoableActionCount: actions.length
	}
}
