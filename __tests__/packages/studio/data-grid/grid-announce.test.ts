import { describe, expect, it } from 'vitest'
import {
	describeApplyOutcome,
	describeCellSelection,
	describeCellValue,
	describeDeletedRows,
	describeFocusedCell,
	describeFocusedHeader,
	describeRowSelection,
	describeStagedCount
} from '@studio/features/database-studio/components/data-grid/grid-announce'

describe('describeCellValue', function () {
	it('tells NULL from an empty string', function () {
		expect(describeCellValue(null, false)).toBe('NULL')
		expect(describeCellValue(undefined, false)).toBe('NULL')
		expect(describeCellValue('', false)).toBe('empty')
	})

	it('reads other values as text', function () {
		expect(describeCellValue(42, false)).toBe('42')
		expect(describeCellValue(false, false)).toBe('false')
		expect(describeCellValue({ a: 1 }, false)).toBe('{"a":1}')
	})

	it('never reads a value in privacy mode', function () {
		expect(describeCellValue('secret@example.com', true)).toBe('hidden')
		expect(describeCellValue(null, true)).toBe('hidden')
	})
})

describe('describeFocusedCell', function () {
	it('reads column, row and value', function () {
		expect(
			describeFocusedCell({
				column: { name: 'email' },
				rowNumber: 120,
				value: 'ada@example.com',
				masked: false
			})
		).toBe('email, row 120, ada@example.com')
	})

	it('keeps a masked value out of the announcement', function () {
		const text = describeFocusedCell({
			column: { name: 'email' },
			rowNumber: 3,
			value: 'ada@example.com',
			masked: true
		})
		expect(text).toBe('email, row 3, hidden')
	})
})

describe('describeFocusedHeader', function () {
	it('reads the column and its sort state', function () {
		expect(describeFocusedHeader('email')).toBe('email, column header')
		expect(describeFocusedHeader('email', 'asc')).toBe('email, column header, sorted ascending')
		expect(describeFocusedHeader('email', 'desc')).toBe(
			'email, column header, sorted descending'
		)
	})
})

describe('selection announcements', function () {
	it('announces a multi-cell selection only', function () {
		expect(describeCellSelection(1)).toBeNull()
		expect(describeCellSelection(6)).toBe('6 cells selected')
	})

	it('announces row selection changes', function () {
		expect(describeRowSelection(1, 0)).toBe('1 row selected')
		expect(describeRowSelection(3, 1)).toBe('3 rows selected')
		expect(describeRowSelection(0, 3)).toBe('Row selection cleared')
		expect(describeRowSelection(2, 2)).toBeNull()
	})
})

describe('outcome announcements', function () {
	it('reads the staged edit count', function () {
		expect(describeStagedCount(0)).toBe('No edits staged')
		expect(describeStagedCount(1)).toBe('1 edit staged')
		expect(describeStagedCount(3)).toBe('3 edits staged')
	})

	it('reads a full and a partial apply', function () {
		expect(describeApplyOutcome(3, 0)).toBe('3 edits applied')
		expect(describeApplyOutcome(3, 1)).toBe(
			'2 of 3 edits applied, 1 failed and is still staged'
		)
		expect(describeApplyOutcome(4, 2)).toBe(
			'2 of 4 edits applied, 2 failed and are still staged'
		)
	})

	it('reads deleted rows', function () {
		expect(describeDeletedRows(1)).toBe('1 row deleted')
		expect(describeDeletedRows(4)).toBe('4 rows deleted')
	})
})
