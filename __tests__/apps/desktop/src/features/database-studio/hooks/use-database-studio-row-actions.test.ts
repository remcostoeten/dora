import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDatabaseStudioRowActions } from '@/features/database-studio/hooks/use-database-studio-row-actions'
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

describe('useDatabaseStudioRowActions', function () {
	let tableData: TableData
	let insertRow: any
	let deleteRows: any
	let setDraftRow: any

	beforeEach(function () {
		tableData = createTableData()
		insertRow = { mutateAsync: vi.fn().mockResolvedValue(undefined) }
		deleteRows = { mutate: vi.fn() }
		setDraftRow = vi.fn()
	})

	it('duplicates a single row straight into the grid when the key is generated', async function () {
		const setTableData = vi.fn()
		const onRowsAdded = vi.fn()

		const { result } = renderHook(function () {
			return useDatabaseStudioRowActions({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData,
				settingsConfirmBeforeDelete: false,
				deleteRows,
				insertRow,
				onLoadTableData: vi.fn(),
				setTableData,
				setSelectedRows: vi.fn(),
				setShowDeleteConfirmDialog: vi.fn(),
				setPendingSingleDeleteRow: vi.fn(),
				setDraftRow,
				setDraftInsertIndex: vi.fn(),
				setEditingRowState: vi.fn(),
				setDuplicateInitialData: vi.fn(),
				setAddDialogMode: vi.fn(),
				setShowAddDialog: vi.fn(),
				setSelectedRowForDetail: vi.fn(),
				setShowRowDetail: vi.fn(),
				notifyMissingPrimaryKey: vi.fn(),
				notifyPrimaryKeyNotGenerated: vi.fn(),
				notifyActionFailure: vi.fn(),
				onRowsAdded
			})
		})

		await act(async function () {
			result.current.handleRowAction('duplicate', tableData.rows[0], 0)
		})

		expect(setDraftRow).not.toHaveBeenCalled()
		expect(onRowsAdded).toHaveBeenCalledTimes(1)

		const optimistic = setTableData.mock.calls[0][0] as TableData
		expect(optimistic.rows).toHaveLength(2)
		expect(optimistic.rows[1]).toEqual({ name: 'Alpha' })
		expect(optimistic.totalCount).toBe(2)
		expect(insertRow.mutateAsync).toHaveBeenCalledTimes(1)
		expect(insertRow.mutateAsync.mock.calls[0][0].rowData).toEqual({ name: 'Alpha' })
	})

	it('optimistically appends duplicated rows before the inserts resolve', async function () {
		const multiRow: TableData = {
			columns: [
				{ name: 'id', type: 'int', nullable: false, primaryKey: true },
				{ name: 'name', type: 'text', nullable: false, primaryKey: false }
			],
			rows: [
				{ id: 1, name: 'Alpha' },
				{ id: 2, name: 'Beta' }
			],
			totalCount: 2,
			executionTime: 5
		}
		const setTableData = vi.fn()
		const onLoadTableData = vi.fn()
		let resolveInsert: (v?: unknown) => void = function () {}
		insertRow = {
			mutateAsync: vi.fn().mockImplementation(function () {
				return new Promise(function (resolve) {
					resolveInsert = resolve
				})
			})
		}

		const { result } = renderHook(function () {
			return useDatabaseStudioRowActions({
				activeConnectionId: 'conn-1',
				tableId: 'users',
				tableRefName: 'users',
				tableData: multiRow,
				settingsConfirmBeforeDelete: false,
				deleteRows,
				insertRow,
				onLoadTableData,
				setTableData,
				setSelectedRows: vi.fn(),
				setShowDeleteConfirmDialog: vi.fn(),
				setPendingSingleDeleteRow: vi.fn(),
				setDraftRow,
				setDraftInsertIndex: vi.fn(),
				setEditingRowState: vi.fn(),
				setDuplicateInitialData: vi.fn(),
				setAddDialogMode: vi.fn(),
				setShowAddDialog: vi.fn(),
				setSelectedRowForDetail: vi.fn(),
				setShowRowDetail: vi.fn(),
				notifyMissingPrimaryKey: vi.fn(),
				notifyPrimaryKeyNotGenerated: vi.fn(),
				notifyActionFailure: vi.fn(),
				onRowsAdded: vi.fn()
			})
		})

		await act(async function () {
			result.current.handleRowAction('duplicate', multiRow.rows[0], 0, [0, 1])
		})

		// The grid is updated synchronously, before any insert resolves.
		expect(setTableData).toHaveBeenCalledTimes(1)
		const optimistic = setTableData.mock.calls[0][0] as TableData
		expect(optimistic.rows).toHaveLength(4)
		expect(optimistic.totalCount).toBe(4)
		expect(insertRow.mutateAsync).toHaveBeenCalledTimes(2)
		// The reload only happens once the inserts settle, not before.
		expect(onLoadTableData).not.toHaveBeenCalled()

		await act(async function () {
			resolveInsert()
			await Promise.resolve()
		})
	})

	it('keeps a natural primary key in the draft, blanked, instead of dropping it', function () {
		// Regression: `dashboard_users (github_login text PRIMARY KEY, added_at)` —
		// stripping the key made the insert fail with a not-null violation.
		const naturalKey: TableData = {
			columns: [
				{ name: 'github_login', type: 'text', nullable: false, primaryKey: true },
				{ name: 'added_at', type: 'timestamptz', nullable: false, primaryKey: false }
			],
			rows: [{ github_login: 'octocat', added_at: '2026-07-28T21:06:37Z' }],
			totalCount: 1,
			executionTime: 5
		}

		const { result } = renderHook(function () {
			return useDatabaseStudioRowActions({
				activeConnectionId: 'conn-1',
				tableId: 'dashboard_users',
				tableRefName: 'dashboard_users',
				tableData: naturalKey,
				settingsConfirmBeforeDelete: false,
				deleteRows,
				insertRow,
				onLoadTableData: vi.fn(),
				setSelectedRows: vi.fn(),
				setShowDeleteConfirmDialog: vi.fn(),
				setPendingSingleDeleteRow: vi.fn(),
				setDraftRow,
				setDraftInsertIndex: vi.fn(),
				setEditingRowState: vi.fn(),
				setDuplicateInitialData: vi.fn(),
				setAddDialogMode: vi.fn(),
				setShowAddDialog: vi.fn(),
				setSelectedRowForDetail: vi.fn(),
				setShowRowDetail: vi.fn(),
				notifyMissingPrimaryKey: vi.fn(),
				notifyPrimaryKeyNotGenerated: vi.fn(),
				notifyActionFailure: vi.fn(),
				onRowsAdded: vi.fn()
			})
		})

		act(function () {
			result.current.handleRowAction('duplicate', naturalKey.rows[0], 0)
		})

		const draft = setDraftRow.mock.calls[0][0] as Record<string, unknown>
		expect(draft.github_login).toBe('')
		expect(draft.added_at).toBe('2026-07-28T21:06:37Z')
	})

	it('refuses a batch duplicate when the primary key is not database-generated', function () {
		const naturalKey: TableData = {
			columns: [
				{ name: 'slug', type: 'varchar', nullable: false, primaryKey: true },
				{ name: 'title', type: 'text', nullable: false, primaryKey: false }
			],
			rows: [
				{ slug: 'a', title: 'A' },
				{ slug: 'b', title: 'B' }
			],
			totalCount: 2,
			executionTime: 5
		}
		const setTableData = vi.fn()
		const notifyPrimaryKeyNotGenerated = vi.fn()

		const { result } = renderHook(function () {
			return useDatabaseStudioRowActions({
				activeConnectionId: 'conn-1',
				tableId: 'posts',
				tableRefName: 'posts',
				tableData: naturalKey,
				settingsConfirmBeforeDelete: false,
				deleteRows,
				insertRow,
				onLoadTableData: vi.fn(),
				setTableData,
				setSelectedRows: vi.fn(),
				setShowDeleteConfirmDialog: vi.fn(),
				setPendingSingleDeleteRow: vi.fn(),
				setDraftRow,
				setDraftInsertIndex: vi.fn(),
				setEditingRowState: vi.fn(),
				setDuplicateInitialData: vi.fn(),
				setAddDialogMode: vi.fn(),
				setShowAddDialog: vi.fn(),
				setSelectedRowForDetail: vi.fn(),
				setShowRowDetail: vi.fn(),
				notifyMissingPrimaryKey: vi.fn(),
				notifyPrimaryKeyNotGenerated,
				notifyActionFailure: vi.fn(),
				onRowsAdded: vi.fn()
			})
		})

		act(function () {
			result.current.handleRowAction('duplicate', naturalKey.rows[0], 0, [0, 1])
		})

		expect(notifyPrimaryKeyNotGenerated).toHaveBeenCalledWith('duplicate rows')
		expect(insertRow.mutateAsync).not.toHaveBeenCalled()
		expect(setTableData).not.toHaveBeenCalled()
	})
})
