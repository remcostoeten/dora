import { useCallback, useEffect } from 'react'
import { toast } from '@studio/shared/ui/notifier'
import { useDataMutation } from '@studio/core/data-provider'
import { useUndoStore, Mutation, CellMutation, BatchCellMutation, RowDeletion } from './undo-store'

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

export function useUndo(options: UndoOptions = {}) {
	const { addAction, getLatestAction, removeAction, actions, timeoutDuration } = useUndoStore()
	const { updateCell, insertRow } = useDataMutation()

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
					await Promise.all(
						mutation.cells.map(function (cell) {
							return updateCell.mutateAsync({
								connectionId: mutation.connectionId,
								tableName: mutation.tableName,
								primaryKeyColumn: mutation.primaryKeyColumn,
								primaryKeyValue: cell.primaryKeyValue,
								columnName: cell.columnName,
								newValue: cell.previousValue
							})
						})
					)
					return true
				} else if (mutation.type === 'row-delete') {
					await Promise.all(
						mutation.rows.map(function (rowData) {
							return insertRow.mutateAsync({
								connectionId: mutation.connectionId,
								tableName: mutation.tableName,
								rowData
							})
						})
					)
					return true
				}
				return false
			} catch (error) {
				console.error('Failed to undo:', error)
				return false
			}
		},
		[updateCell, insertRow]
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

	const undoLatest = useCallback(
		async function () {
			const latestAction = getLatestAction()
			if (!latestAction) {
				toast.info('Nothing to undo')
				return false
			}

			const success = await runUndo(latestAction.mutation)
			if (success) {
				removeAction(latestAction.id)
				toast.success('Undo successful', {
					description: `Reverted: ${latestAction.description}`
				})
			} else {
				toast.error('Failed to undo')
			}
			return success
		},
		[getLatestAction, removeAction, runUndo]
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
						if (action) {
							runUndo(action.mutation).then(function (success) {
								if (success) {
									removeAction(actionId)
								}
							})
						}
					}
				},
				duration: timeoutDuration
			})

			return actionId
		},
		[addAction, runUndo, removeAction, timeoutDuration, options]
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

			const description = `Updated ${cells.length} cell${cells.length > 1 ? 's' : ''} to NULL`
			const actionId = addAction(description, mutation)

			toast.success(description, {
				description: `Press Ctrl+Z within ${timeoutDuration / 1000}s to undo`,
				action: {
					label: 'Undo',
					kbd: 'Ctrl+Z',
					onClick: function () {
						const action = useUndoStore.getState().getAction(actionId)
						if (action) {
							runUndo(action.mutation).then(function (success) {
								if (success) {
									removeAction(actionId)
								}
							})
						}
					}
				},
				duration: timeoutDuration
			})

			return actionId
		},
		[addAction, runUndo, removeAction, timeoutDuration, options]
	)

	const trackRowDeletion = useCallback(
		function (
			connectionId: string,
			tableName: string,
			rows: Record<string, unknown>[]
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
				rows
			}

			const actionId = addAction(description, mutation)

			toast.success(description, {
				description: `Press Ctrl+Z within ${timeoutDuration / 1000}s to undo`,
				action: {
					label: 'Undo',
					kbd: 'Ctrl+Z',
					onClick: function () {
						const action = useUndoStore.getState().getAction(actionId)
						if (action) {
							runUndo(action.mutation).then(function (success) {
								if (success) {
									removeAction(actionId)
								}
							})
						}
					}
				},
				duration: timeoutDuration
			})

			return actionId
		},
		[addAction, runUndo, removeAction, timeoutDuration, options]
	)

	useEffect(
		function () {
			function handleKeyDown(e: KeyboardEvent) {
				if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
					const target = e.target as HTMLElement
					const isInInput =
						target.tagName === 'INPUT' ||
						target.tagName === 'TEXTAREA' ||
						target.isContentEditable ||
						target.getAttribute('data-no-shortcuts') === 'true'

					if (isInInput) return

					const latestAction = getLatestAction()
					if (latestAction) {
						e.preventDefault()
						undoLatest()
					}
				}
			}

			window.addEventListener('keydown', handleKeyDown)
			return function () {
				window.removeEventListener('keydown', handleKeyDown)
			}
		},
		[getLatestAction, undoLatest]
	)

	return {
		trackCellMutation,
		trackBatchCellMutation,
		trackRowDeletion,
		undoLatest,
		hasUndoableActions: actions.length > 0,
		undoableActionCount: actions.length
	}
}
