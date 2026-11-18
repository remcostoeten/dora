import { describe, expect, it } from 'vitest'
import {
	applyStagedPatches,
	createEditKey,
	dropEdits,
	getRevertPatches,
	getStagedPatches,
	redoStaged,
	revertEdits,
	stageEdits,
	undoStaged,
	type PendingEdit,
	type StagedState
} from '@studio/core/pending-edits/staged-history'

function createState(): StagedState {
	return { pendingEdits: new Map(), undoStack: [], redoStack: [] }
}

function edit(primaryKeyValue: number, columnName: string, oldValue: unknown, newValue: unknown) {
	return { primaryKeyColumn: 'id', primaryKeyValue, columnName, oldValue, newValue }
}

const nameEdit: PendingEdit = edit(1, 'name', 'Ada', 'Grace')
const emailEdit: PendingEdit = edit(1, 'email', 'a@x.io', 'g@x.io')
const otherRowEdit: PendingEdit = edit(2, 'name', 'Linus', 'Ken')

describe('createEditKey', function () {
	it('addresses an edit by table, primary key value and column', function () {
		expect(createEditKey('users', 7, 'email')).toBe('users:7:email')
	})
})

describe('stageEdits', function () {
	it('stages a batch as one undo step and clears the redo stack of the table', function () {
		const staged = stageEdits(createState(), 'users', [nameEdit, emailEdit])
		expect(Array.from(staged.pendingEdits.keys())).toEqual(['users:1:name', 'users:1:email'])
		expect(staged.undoStack).toHaveLength(1)

		const undone = undoStaged(staged, 'users').state
		expect(undone.redoStack).toHaveLength(1)
		expect(stageEdits(undone, 'users', [otherRowEdit]).redoStack).toHaveLength(0)
	})

	it('replaces an edit that is already staged for the same cell', function () {
		const first = stageEdits(createState(), 'users', [nameEdit])
		const second = stageEdits(first, 'users', [edit(1, 'name', 'Ada', 'Hopper')])
		expect(second.pendingEdits.get('users:1:name')?.newValue).toBe('Hopper')
		expect(second.pendingEdits.size).toBe(1)
	})
})

describe('revertEdits', function () {
	it('removes staged edits as one undo step and ignores keys that are not staged', function () {
		const staged = stageEdits(createState(), 'users', [nameEdit, emailEdit, otherRowEdit])
		const reverted = revertEdits(staged, 'users', [
			'users:1:name',
			'users:1:email',
			'users:9:x'
		])
		expect(Array.from(reverted.pendingEdits.keys())).toEqual(['users:2:name'])
		expect(reverted.undoStack).toHaveLength(2)

		const restored = undoStaged(reverted, 'users').state
		expect(restored.pendingEdits.size).toBe(3)
	})

	it('leaves the state alone when nothing matched', function () {
		const state = createState()
		expect(revertEdits(state, 'users', ['users:1:name'])).toBe(state)
	})
})

describe('dropEdits', function () {
	it('drops only the given edits and forgets the history of the table', function () {
		const staged = stageEdits(createState(), 'users', [nameEdit, otherRowEdit])
		const dropped = dropEdits(staged, 'users', ['users:1:name'])
		expect(Array.from(dropped.pendingEdits.keys())).toEqual(['users:2:name'])
		expect(dropped.undoStack).toHaveLength(0)
	})

	it('drops every edit of one table and keeps the other tables', function () {
		const staged = stageEdits(stageEdits(createState(), 'users', [nameEdit]), 'orders', [
			edit(5, 'total', 10, 20)
		])
		const dropped = dropEdits(staged, 'users')
		expect(Array.from(dropped.pendingEdits.keys())).toEqual(['orders:5:total'])
		expect(dropped.undoStack).toHaveLength(1)
	})

	it('drops everything without a table', function () {
		const staged = stageEdits(createState(), 'users', [nameEdit])
		expect(dropEdits(staged).pendingEdits.size).toBe(0)
	})
})

describe('undoStaged and redoStaged', function () {
	it('walks back and forward through the steps of one table', function () {
		const first = stageEdits(createState(), 'users', [nameEdit])
		const second = stageEdits(first, 'users', [edit(1, 'name', 'Ada', 'Hopper')])

		const undone = undoStaged(second, 'users')
		expect(undone.state.pendingEdits.get('users:1:name')?.newValue).toBe('Grace')

		const undoneTwice = undoStaged(undone.state, 'users')
		expect(undoneTwice.state.pendingEdits.size).toBe(0)
		expect(undoStaged(undoneTwice.state, 'users').entry).toBeNull()

		const redone = redoStaged(undoneTwice.state, 'users')
		expect(redone.state.pendingEdits.get('users:1:name')?.newValue).toBe('Grace')
		const redoneTwice = redoStaged(redone.state, 'users')
		expect(redoneTwice.state.pendingEdits.get('users:1:name')?.newValue).toBe('Hopper')
		expect(redoStaged(redoneTwice.state, 'users').entry).toBeNull()
	})

	it('only touches the steps of the requested table', function () {
		const staged = stageEdits(stageEdits(createState(), 'users', [nameEdit]), 'orders', [
			edit(5, 'total', 10, 20)
		])
		const undone = undoStaged(staged, 'users')
		expect(undone.entry?.tableId).toBe('users')
		expect(Array.from(undone.state.pendingEdits.keys())).toEqual(['orders:5:total'])
	})
})

describe('getStagedPatches', function () {
	it('paints the original value when undo removes the only staged edit', function () {
		const { entry } = undoStaged(stageEdits(createState(), 'users', [nameEdit]), 'users')
		expect(entry && getStagedPatches(entry, 'undo')).toEqual([
			{ primaryKeyColumn: 'id', primaryKeyValue: 1, columnName: 'name', value: 'Ada' }
		])
		expect(entry && getStagedPatches(entry, 'redo')).toEqual([
			{ primaryKeyColumn: 'id', primaryKeyValue: 1, columnName: 'name', value: 'Grace' }
		])
	})

	it('paints the earlier staged value when undo restores a replaced edit', function () {
		const first = stageEdits(createState(), 'users', [nameEdit])
		const second = stageEdits(first, 'users', [edit(1, 'name', 'Ada', 'Hopper')])
		const { entry } = undoStaged(second, 'users')
		expect(entry && getStagedPatches(entry, 'undo')[0].value).toBe('Grace')
	})

	it('paints the staged value again when a revert is undone', function () {
		const staged = stageEdits(createState(), 'users', [nameEdit])
		const { entry } = undoStaged(revertEdits(staged, 'users', ['users:1:name']), 'users')
		expect(entry && getStagedPatches(entry, 'undo')[0].value).toBe('Grace')
		expect(entry && getStagedPatches(entry, 'redo')[0].value).toBe('Ada')
	})
})

describe('applyStagedPatches', function () {
	it('paints by primary key and leaves rows that are not on the page', function () {
		const rows = [
			{ id: 2, name: 'Ken' },
			{ id: 1, name: 'Grace' }
		]
		const patched = applyStagedPatches(
			rows,
			getRevertPatches([nameEdit, edit(9, 'name', 'x', 'y')])
		)
		expect(patched).toEqual([
			{ id: 2, name: 'Ken' },
			{ id: 1, name: 'Ada' }
		])
		expect(patched[0]).toBe(rows[0])
	})
})
