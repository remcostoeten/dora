import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDatabaseStudioEdits } from '@studio/features/database-studio/hooks/use-database-studio-edits'

type Edit = {
	primaryKeyColumn: string
	primaryKeyValue: unknown
	columnName: string
	oldValue: unknown
	newValue: unknown
}

const TABLE_ID = 'public.users'

function makeEdit(id: number, column: string, oldValue: string, newValue: string): Edit {
	return {
		primaryKeyColumn: 'id',
		primaryKeyValue: id,
		columnName: column,
		oldValue,
		newValue
	}
}

function setup(edits: Edit[], failFor: (payload: Record<string, unknown>) => boolean) {
	const removed: string[] = []
	const cleared: string[] = []
	const failures: { title: string; error: unknown }[] = []
	let tableData = {
		columns: [{ name: 'id', primaryKey: true }, { name: 'name' }, { name: 'email' }],
		rows: edits.map(function (edit) {
			return { id: edit.primaryKeyValue, [edit.columnName]: edit.newValue }
		})
	}

	const args = {
		activeConnectionId: 'conn-1',
		tableId: TABLE_ID,
		tableRefName: 'public.users',
		tableData,
		currentCacheKey: 'cache-key',
		isDryEditMode: true,
		pendingEdits: new Map(),
		getEditsForTable: function () { return edits },
		hasEdits: function () { return edits.length > 0 },
		addEdit: vi.fn(),
		removeEdit: function (_tableId: string, key: string) { removed.push(key) },
		clearEdits: function (tableId: string) { cleared.push(tableId) },
		updateCell: {
			mutate: vi.fn(),
			mutateAsync: function (payload: Record<string, unknown>) {
				if (failFor(payload)) return Promise.reject(new Error('constraint violation'))
				return Promise.resolve({ affected_rows: 1 })
			}
		},
		setTableData: function (updater: unknown) {
			tableData = typeof updater === 'function' ? (updater as (p: unknown) => typeof tableData)(tableData) : (updater as typeof tableData)
		},
		setIsApplyingEdits: vi.fn(),
		loadTableData: vi.fn(),
		trackCellMutation: vi.fn(),
		trackBatchCellMutation: vi.fn(),
		notifyMissingPrimaryKey: vi.fn(),
		notifyActionFailure: function (title: string, error: unknown) { failures.push({ title, error }) }
	}

	const { result } = renderHook(() => useDatabaseStudioEdits(args as never))
	return { result, removed, cleared, failures, getTableData: function () { return tableData } }
}

describe('handleApplyPendingEdits partial failure', function () {
	it('keeps only the failed edit pending', async function () {
		const edits = [
			makeEdit(1, 'name', 'a', 'A'),
			makeEdit(2, 'name', 'b', 'B'),
			makeEdit(3, 'name', 'c', 'C')
		]
		const ctx = setup(edits, function (payload) { return payload.primaryKeyValue === 2 })

		await act(async function () {
			await ctx.result.current.handleApplyPendingEdits()
		})

		expect(ctx.removed).toEqual([
			`${TABLE_ID}:1:name`,
			`${TABLE_ID}:3:name`
		])
		expect(ctx.removed).not.toContain(`${TABLE_ID}:2:name`)
	})

	it('does not clear the whole buffer on partial failure', async function () {
		const edits = [makeEdit(1, 'name', 'a', 'A'), makeEdit(2, 'name', 'b', 'B')]
		const ctx = setup(edits, function (payload) { return payload.primaryKeyValue === 2 })

		await act(async function () {
			await ctx.result.current.handleApplyPendingEdits()
		})

		expect(ctx.cleared).toEqual([])
	})

	it('names the failing row and column in the error', async function () {
		const edits = [makeEdit(1, 'name', 'a', 'A'), makeEdit(2, 'email', 'b', 'B')]
		const ctx = setup(edits, function (payload) { return payload.primaryKeyValue === 2 })

		await act(async function () {
			await ctx.result.current.handleApplyPendingEdits()
		})

		expect(ctx.failures).toHaveLength(1)
		expect(ctx.failures[0].title).toBe('Failed to apply 1 of 2 change(s)')
		expect(String(ctx.failures[0].error)).toContain('id=2')
		expect(String(ctx.failures[0].error)).toContain('email')
		expect(String(ctx.failures[0].error)).toContain('constraint violation')
	})

	it('reverts the failed cell on screen to its pre-edit value', async function () {
		const edits = [makeEdit(1, 'name', 'a', 'A'), makeEdit(2, 'name', 'b', 'B')]
		const ctx = setup(edits, function (payload) { return payload.primaryKeyValue === 2 })

		await act(async function () {
			await ctx.result.current.handleApplyPendingEdits()
		})

		const rows = ctx.getTableData().rows
		expect(rows.find(function (r) { return r.id === 2 })?.name).toBe('b')
		expect(rows.find(function (r) { return r.id === 1 })?.name).toBe('A')
	})

	it('clears the buffer in one go when all succeed', async function () {
		const edits = [makeEdit(1, 'name', 'a', 'A'), makeEdit(2, 'name', 'b', 'B')]
		const ctx = setup(edits, function () { return false })

		await act(async function () {
			await ctx.result.current.handleApplyPendingEdits()
		})

		expect(ctx.cleared).toEqual([TABLE_ID])
		expect(ctx.removed).toEqual([])
		expect(ctx.failures).toEqual([])
	})
})
