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

	it('prepares duplicate rows without the primary key field', function () {
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
				setSelectedRows: vi.fn(),
				setShowDeleteConfirmDialog: vi.fn(),
				setPendingSingleDeleteRow: vi.fn(),
				setIsBulkActionLoading: vi.fn(),
				setDraftRow,
				setDraftInsertIndex: vi.fn(),
				setEditingRowState: vi.fn(),
				setDuplicateInitialData: vi.fn(),
				setAddDialogMode: vi.fn(),
				setShowAddDialog: vi.fn(),
				setSelectedRowForDetail: vi.fn(),
				setShowRowDetail: vi.fn(),
				notifyMissingPrimaryKey: vi.fn(),
				notifyActionFailure: vi.fn()
			})
		})

		act(function () {
			result.current.handleRowAction('duplicate', tableData.rows[0], 0)
		})

		expect(setDraftRow).toHaveBeenCalledTimes(1)
		const draft = setDraftRow.mock.calls[0][0] as Record<string, unknown>
		expect(draft.id).toBeUndefined()
		expect(draft.name).toBe('Alpha')
	})
})
