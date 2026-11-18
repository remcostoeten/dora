import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invertMutation, pickUndoTarget, useUndoStore } from '@studio/core/undo'
import type { Mutation } from '@studio/core/undo'

const cellMutation: Mutation = {
	type: 'cell',
	connectionId: 'conn',
	tableName: 'users',
	primaryKeyColumn: 'id',
	primaryKeyValue: 1,
	columnName: 'name',
	previousValue: 'Ada',
	newValue: 'Grace'
}

describe('pickUndoTarget', function () {
	it('targets staged edits in dry mode and committed mutations otherwise', function () {
		expect(pickUndoTarget(true)).toBe('staged')
		expect(pickUndoTarget(false)).toBe('committed')
	})
})

describe('invertMutation', function () {
	it('swaps the values of a cell mutation', function () {
		expect(invertMutation(cellMutation)).toMatchObject({
			previousValue: 'Grace',
			newValue: 'Ada'
		})
	})

	it('swaps the values of every cell in a batch', function () {
		const inverted = invertMutation({
			type: 'batch-cell',
			connectionId: 'conn',
			tableName: 'users',
			primaryKeyColumn: 'id',
			cells: [{ primaryKeyValue: 1, columnName: 'name', previousValue: 'a', newValue: 'b' }]
		})
		expect(inverted).toMatchObject({ cells: [{ previousValue: 'b', newValue: 'a' }] })
	})

	it('returns a row deletion unchanged', function () {
		const deletion: Mutation = {
			type: 'row-delete',
			connectionId: 'conn',
			tableName: 'users',
			rows: [{ id: 1 }],
			primaryKeyColumn: 'id'
		}
		expect(invertMutation(deletion)).toBe(deletion)
	})
})

describe('undo store redo stack', function () {
	beforeEach(function () {
		vi.useFakeTimers()
		useUndoStore.setState({ actions: [], redoActions: [] })
	})

	afterEach(function () {
		vi.useRealTimers()
	})

	it('clears redo on a new mutation but keeps it when a redo is put back', function () {
		const store = useUndoStore.getState()
		store.addRedoAction('Set name to Grace', cellMutation)
		store.addAction('redo put back', cellMutation, { keepRedo: true })
		expect(useUndoStore.getState().redoActions).toHaveLength(1)

		store.addAction('a new edit', cellMutation)
		expect(useUndoStore.getState().redoActions).toHaveLength(0)
	})

	it('expires a redo entry after the undo window', function () {
		const store = useUndoStore.getState()
		store.addRedoAction('Set name to Grace', cellMutation)
		expect(useUndoStore.getState().getLatestRedoAction()?.description).toBe('Set name to Grace')

		vi.advanceTimersByTime(store.timeoutDuration + 1)
		expect(useUndoStore.getState().getLatestRedoAction()).toBeUndefined()
	})
})
