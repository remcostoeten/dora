import { useCallback, useEffect } from "react";
import { toast } from "@/components/ui/sonner";
import { useDataMutation } from "@/core/data-provider";
import { useUndoStore, Mutation, CellMutation, BatchCellMutation } from "./undo-store";

type UndoOptions = {
	onUndoComplete?: () => void
}

export function useUndo(options: UndoOptions = {}) {
	const { addAction, getLatestAction, removeAction, actions, timeoutDuration } = useUndoStore()
	const { updateCell } = useDataMutation()

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
				}
				return false
			} catch (error) {
				console.error('Failed to undo:', error)
				return false
			}
		},
		[updateCell]
	)

	const undoLatest = useCallback(
		async function () {
			const latestAction = getLatestAction()
			if (!latestAction) {
				toast.info('Nothing to undo')
				return false
			}

			const success = await performUndo(latestAction.mutation)
			if (success) {
				removeAction(latestAction.id)
				toast.success('Undo successful', {
					description: `Reverted: ${latestAction.description}`
				})
				options.onUndoComplete?.()
			} else {
				toast.error('Failed to undo')
			}
			return success
		},
		[getLatestAction, removeAction, performUndo, options]
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
					onClick: function () {
						const action = useUndoStore.getState().getAction(actionId)
						if (action) {
							performUndo(action.mutation).then(function (success) {
								if (success) {
									removeAction(actionId)
									options.onUndoComplete?.()
								}
							})
						}
					}
				},
				duration: timeoutDuration
			})

			return actionId
		},
		[addAction, performUndo, removeAction, timeoutDuration, options]
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
					onClick: function () {
						const action = useUndoStore.getState().getAction(actionId)
						if (action) {
							performUndo(action.mutation).then(function (success) {
								if (success) {
									removeAction(actionId)
									options.onUndoComplete?.()
								}
							})
						}
					}
				},
				duration: timeoutDuration
			})

			return actionId
		},
		[addAction, performUndo, removeAction, timeoutDuration, options]
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
		undoLatest,
		hasUndoableActions: actions.length > 0,
		undoableActionCount: actions.length
	}
}
