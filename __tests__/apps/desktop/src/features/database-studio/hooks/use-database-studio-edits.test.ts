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
	let clearEdits: any
	let loadTableData: any
	let trackCellMutation: any
	let trackBatchCellMutation: any
	let notifyMissingPrimaryKey: any
	let notifyActionFailure: any
	let pendingEdits: Map<string, { oldValue: unknown }>
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
		expect(loadTableData).toHaveBeenCalledTimes(1)
	})

	it('restores the previous edit value on ctrl-z', function () {
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
		pendingEdits.set('users:1:name', { oldValue: 'Alpha' })

		renderHook(function () {
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
				removeEdit: vi.fn(),
				clearEdits,
				updateCell,
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
			window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
		})

		expect(tableData.rows[0].name).toBe('Alpha')
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

		expect(updateCell.mutateAsync).toHaveBeenCalledTimes(1)
		expect(trackBatchCellMutation).toHaveBeenCalledWith(
			'conn-1',
			'users',
			'id',
			[
				{
					primaryKeyValue: 1,
					columnName: 'name',
					previousValue: 'Alpha',
					newValue: 'Beta'
				}
			]
		)
		expect(loadTableData).toHaveBeenCalledTimes(1)
	})
})
