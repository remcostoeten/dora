import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDatabaseStudioEdits } from '@/features/database-studio/hooks/use-database-studio-edits'
import type { TableData } from '@/features/database-studio/types'

function createTableData(): TableData {
	return {
		columns: [
			{ name: 'id', type: 'int', nullable: false, primaryKey: true },
			{ name: 'name', type: 'text', nullable: false, primaryKey: false }
		],
		rows: [{ id: 1, name: 'Alpha' }],
		totalCount: 1,
		executionTime: 5
	}
}

describe('useDatabaseStudioEdits', function () {
	let tableData: TableData
	let setTableData: any
	let updateCell: any
	let updateCells: any
	let clearEdits: any
	let loadTableData: any
	let trackCellMutation: any
	let trackBatchCellMutation: any
	let notifyMissingPrimaryKey: any
	let notifyActionFailure: any
	let pendingEdits: Map<string, any>
	let edits: Array<{
		primaryKeyColumn: string
		primaryKeyValue: unknown
		columnName: string
		oldValue: unknown
		newValue: unknown
		rowIndex: number
	}>

	beforeEach(function () {
		tableData = createTableData()
		setTableData = vi.fn(function (updater) {
			tableData = typeof updater === 'function' ? updater(tableData) : updater
		})
		updateCell = {
			mutate: vi.fn(),
			mutateAsync: vi.fn().mockResolvedValue(undefined)
		}
		updateCells = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
		clearEdits = vi.fn()
		loadTableData = vi.fn()
		trackCellMutation = vi.fn()
		trackBatchCellMutation = vi.fn()
		notifyMissingPrimaryKey = vi.fn()
		notifyActionFailure = vi.fn()
		pendingEdits = new Map()
		edits = []
	})

	it('does not mutate when a cell edit is a no-op', function () {
		const { result } = renderHook(function () {
			return useDatabaseStudioEdits({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData,
				isDryEditMode: false,
				pendingEdits,
				getEditsForTable: () => edits,
				hasEdits: () => false,
				addEdit: vi.fn(),
				removeEdit: vi.fn(),
				clearEdits,
				updateCell,
				updateCells,
				setTableData,
				setIsApplyingEdits: vi.fn(),
				loadTableData,
				trackCellMutation,
				trackBatchCellMutation,
				notifyMissingPrimaryKey,
				notifyActionFailure
			})
		})

		act(function () {
			result.current.handleCellEdit(0, 'name', 'Alpha')
		})

		expect(updateCell.mutate).not.toHaveBeenCalled()
		expect(setTableData).not.toHaveBeenCalled()
	})

	it('applies and clears pending edits', async function () {
		edits = [
			{
				primaryKeyColumn: 'id',
				primaryKeyValue: 1,
				columnName: 'name',
				oldValue: 'Alpha',
				newValue: 'Beta',
				rowIndex: 0
			}
		]

		const { result } = renderHook(function () {
			return useDatabaseStudioEdits({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData,
				isDryEditMode: false,
				pendingEdits,
				getEditsForTable: () => edits,
				hasEdits: () => true,
				addEdit: vi.fn(),
				removeEdit: vi.fn(),
				clearEdits,
				updateCell,
				updateCells,
				setTableData,
				setIsApplyingEdits: vi.fn(),
				loadTableData,
				trackCellMutation,
				trackBatchCellMutation,
				notifyMissingPrimaryKey,
				notifyActionFailure
			})
		})

		await act(async function () {
			await result.current.handleApplyPendingEdits()
		})

		expect(updateCell.mutateAsync).toHaveBeenCalledTimes(1)
		expect(clearEdits).toHaveBeenCalledWith('users')
		// Dry-edit values are already on screen — the cache is patched, no refetch.
		expect(loadTableData).not.toHaveBeenCalled()
	})

	it('repaints the previous value when a staged edit is undone and the new one on redo', function () {
		const staged = {
			primaryKeyColumn: 'id',
			primaryKeyValue: 1,
			columnName: 'name',
			oldValue: 'Alpha',
			newValue: 'Beta'
		}
		const entry = {
			tableId: 'users',
			changes: [{ key: 'users:1:name', before: null, after: staged }]
		}
		tableData.rows[0].name = 'Beta'
		const revertEdits = vi.fn()
		const removeEdit = vi.fn()
		const undoStagedEdit = vi.fn().mockReturnValueOnce(entry).mockReturnValue(null)
		const redoStagedEdit = vi.fn().mockReturnValueOnce(entry).mockReturnValue(null)

		const { result } = renderHook(function () {
			return useDatabaseStudioEdits({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData,
				isDryEditMode: true,
				pendingEdits,
				getEditsForTable: () => edits,
				hasEdits: () => true,
				addEdit: vi.fn(),
				addEdits: vi.fn(),
				removeEdit,
				revertEdits,
				clearEdits,
				undoStagedEdit,
				redoStagedEdit,
				updateCell,
				updateCells,
				setTableData,
				setIsApplyingEdits: vi.fn(),
				loadTableData,
				trackCellMutation,
				trackBatchCellMutation,
				notifyMissingPrimaryKey,
				notifyActionFailure
			})
		})

		let changed = false
		act(function () {
			changed = result.current.handleUndoStaged()
		})
		expect(changed).toBe(true)
		expect(undoStagedEdit).toHaveBeenCalledWith('users')
		expect(tableData.rows[0].name).toBe('Alpha')

		act(function () {
			changed = result.current.handleRedoStaged()
		})
		expect(changed).toBe(true)
		expect(tableData.rows[0].name).toBe('Beta')

		act(function () {
			changed = result.current.handleUndoStaged()
		})
		expect(changed).toBe(false)
	})

	it('reverts one staged cell or every staged cell of a row by primary key', function () {
		const nameEdit = {
			primaryKeyColumn: 'id',
			primaryKeyValue: 1,
			columnName: 'name',
			oldValue: 'Alpha',
			newValue: 'Beta'
		}
		pendingEdits.set('users:1:name', nameEdit)
		tableData.rows[0].name = 'Beta'
		const revertEdits = vi.fn()
		const removeEdit = vi.fn()
		const undoStagedEdit = vi.fn()
		const redoStagedEdit = vi.fn()

		const { result } = renderHook(function () {
			return useDatabaseStudioEdits({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData,
				isDryEditMode: true,
				pendingEdits,
				getEditsForTable: () => edits,
				hasEdits: () => true,
				addEdit: vi.fn(),
				addEdits: vi.fn(),
				removeEdit,
				revertEdits,
				clearEdits,
				undoStagedEdit,
				redoStagedEdit,
				updateCell,
				updateCells,
				setTableData,
				setIsApplyingEdits: vi.fn(),
				loadTableData,
				trackCellMutation,
				trackBatchCellMutation,
				notifyMissingPrimaryKey,
				notifyActionFailure
			})
		})

		let reverted = -1
		act(function () {
			reverted = result.current.handleRevertStaged(0, 'id')
		})
		expect(reverted).toBe(0)
		expect(revertEdits).not.toHaveBeenCalled()

		act(function () {
			reverted = result.current.handleRevertStaged(0, null)
		})
		expect(reverted).toBe(1)
		expect(revertEdits).toHaveBeenCalledWith('users', ['users:1:name'])
		expect(tableData.rows[0].name).toBe('Alpha')
	})

	it('drops only the edits that landed after a partial apply', async function () {
		edits = [
			{
				primaryKeyColumn: 'id',
				primaryKeyValue: 1,
				columnName: 'name',
				oldValue: 'Alpha',
				newValue: 'Beta',
				rowIndex: 0
			},
			{
				primaryKeyColumn: 'id',
				primaryKeyValue: 1,
				columnName: 'email',
				oldValue: 'old@example.com',
				newValue: 'new@example.com',
				rowIndex: 0
			}
		]
		updateCell.mutateAsync = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('constraint failed'))
		const revertEdits = vi.fn()
		const removeEdit = vi.fn()
		const undoStagedEdit = vi.fn()
		const redoStagedEdit = vi.fn()

		const { result } = renderHook(function () {
			return useDatabaseStudioEdits({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData,
				isDryEditMode: true,
				pendingEdits,
				getEditsForTable: () => edits,
				hasEdits: () => true,
				addEdit: vi.fn(),
				addEdits: vi.fn(),
				removeEdit,
				revertEdits,
				clearEdits,
				undoStagedEdit,
				redoStagedEdit,
				updateCell,
				updateCells,
				setTableData,
				setIsApplyingEdits: vi.fn(),
				loadTableData,
				trackCellMutation,
				trackBatchCellMutation,
				notifyMissingPrimaryKey,
				notifyActionFailure
			})
		})

		await act(async function () {
			await result.current.handleApplyPendingEdits()
		})

		expect(removeEdit.mock.calls).toEqual([['users', 'users:1:name']])
		expect(clearEdits).not.toHaveBeenCalled()
		expect(notifyActionFailure).toHaveBeenCalledTimes(1)
	})

	it('tracks batch edits after successful bulk update', async function () {
		const { result } = renderHook(function () {
			return useDatabaseStudioEdits({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData,
				isDryEditMode: false,
				pendingEdits,
				getEditsForTable: () => edits,
				hasEdits: () => false,
				addEdit: vi.fn(),
				removeEdit: vi.fn(),
				clearEdits,
				updateCell,
				updateCells,
				setTableData,
				setIsApplyingEdits: vi.fn(),
				loadTableData,
				trackCellMutation,
				trackBatchCellMutation,
				notifyMissingPrimaryKey,
				notifyActionFailure
			})
		})

		await act(async function () {
			await result.current.handleBatchCellEdit([0], 'name', 'Beta')
		})

		expect(updateCells.mutateAsync).toHaveBeenCalledTimes(1)
		expect(updateCell.mutateAsync).not.toHaveBeenCalled()
		expect(trackBatchCellMutation).toHaveBeenCalledWith('conn-1', 'users', 'id', [
			{
				primaryKeyValue: 1,
				columnName: 'name',
				previousValue: 'Alpha',
				newValue: 'Beta'
			}
		])
		// Optimistic update keeps the new value on screen without a refetch.
		expect(setTableData).toHaveBeenCalled()
		expect(loadTableData).not.toHaveBeenCalled()
	})
	it('stages batch edits instead of writing them while dry mode is on', async function () {
		const addEdits = vi.fn()
		const { result } = renderHook(function () {
			return useDatabaseStudioEdits({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData,
				isDryEditMode: true,
				pendingEdits,
				getEditsForTable: () => edits,
				hasEdits: () => false,
				addEdit: vi.fn(),
				addEdits,
				revertEdits: vi.fn(),
				removeEdit: vi.fn(),
				clearEdits,
				updateCell,
				updateCells,
				setTableData,
				setIsApplyingEdits: vi.fn(),
				loadTableData,
				trackCellMutation,
				trackBatchCellMutation,
				notifyMissingPrimaryKey,
				notifyActionFailure
			})
		})

		await act(async function () {
			await result.current.handleBatchCellEdit([0], 'name', 'Beta')
		})

		expect(updateCells.mutateAsync).not.toHaveBeenCalled()
		expect(updateCell.mutate).not.toHaveBeenCalled()
		expect(addEdits).toHaveBeenCalledWith('users', [
			{
				primaryKeyColumn: 'id',
				primaryKeyValue: 1,
				columnName: 'name',
				oldValue: 'Alpha',
				newValue: 'Beta'
			}
		])
		expect(tableData.rows[0].name).toBe('Beta')
	})

	it('refuses a batch edit on a table without a primary key', async function () {
		const { result } = renderHook(function () {
			return useDatabaseStudioEdits({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData: {
					...tableData,
					columns: tableData.columns.map(function (column) {
						return { ...column, primaryKey: false }
					})
				},
				isDryEditMode: false,
				pendingEdits,
				getEditsForTable: () => edits,
				hasEdits: () => false,
				addEdit: vi.fn(),
				removeEdit: vi.fn(),
				clearEdits,
				updateCell,
				updateCells,
				setTableData,
				setIsApplyingEdits: vi.fn(),
				loadTableData,
				trackCellMutation,
				trackBatchCellMutation,
				notifyMissingPrimaryKey,
				notifyActionFailure
			})
		})

		await act(async function () {
			await result.current.handleCellsEdit([
				{ rowIndex: 0, columnName: 'name', value: 'Beta' }
			])
		})

		expect(notifyMissingPrimaryKey).toHaveBeenCalledWith('edit cells')
		expect(updateCells.mutateAsync).not.toHaveBeenCalled()
	})
})
