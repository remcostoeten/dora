import { describe, expect, it } from 'vitest'
import { overlayPendingEditsOnRows } from './overlay'
import type { PendingEdit } from './pending-edits-store'

function makeEdit(primaryKeyValue: unknown, columnName: string, newValue: unknown): PendingEdit {
	return { primaryKeyColumn: 'id', primaryKeyValue, columnName, oldValue: 'old', newValue }
}

describe('overlayPendingEditsOnRows', function () {
	it('returns the rows untouched when there are no edits', function () {
		const rows = [{ id: 1, name: 'a' }]
		expect(overlayPendingEditsOnRows(rows, [])).toBe(rows)
	})

	it('repaints an edit onto the matching row by primary key', function () {
		const rows = [
			{ id: 1, name: 'a' },
			{ id: 2, name: 'b' }
		]
		const result = overlayPendingEditsOnRows(rows, [makeEdit(2, 'name', 'edited')])
		expect(result[0]).toEqual({ id: 1, name: 'a' })
		expect(result[1]).toEqual({ id: 2, name: 'edited' })
	})

	it('applies multiple edits to the same row', function () {
		const rows = [{ id: 1, name: 'a', email: 'a@x' }]
		const result = overlayPendingEditsOnRows(rows, [
			makeEdit(1, 'name', 'edited'),
			makeEdit(1, 'email', 'edited@x')
		])
		expect(result[0]).toEqual({ id: 1, name: 'edited', email: 'edited@x' })
	})

	it('leaves rows for off-page edits alone', function () {
		const rows = [{ id: 1, name: 'a' }]
		const result = overlayPendingEditsOnRows(rows, [makeEdit(999, 'name', 'edited')])
		expect(result[0]).toEqual({ id: 1, name: 'a' })
	})

	it('matches on the edit\'s own primary key column', function () {
		const rows = [{ uuid: 'k1', name: 'a' }]
		const edit: PendingEdit = {
			primaryKeyColumn: 'uuid',
			primaryKeyValue: 'k1',
			columnName: 'name',
			oldValue: 'a',
			newValue: 'edited'
		}
		expect(overlayPendingEditsOnRows(rows, [edit])[0]).toEqual({ uuid: 'k1', name: 'edited' })
	})

	it('does not mutate the input rows', function () {
		const rows = [{ id: 1, name: 'a' }]
		overlayPendingEditsOnRows(rows, [makeEdit(1, 'name', 'edited')])
		expect(rows[0]).toEqual({ id: 1, name: 'a' })
	})
})
