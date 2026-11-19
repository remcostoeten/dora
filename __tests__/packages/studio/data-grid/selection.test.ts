import { describe, expect, it } from 'vitest'
import {
	getActionRowIndexes,
	getCellKey,
	getCellsInRectangle,
	getColumnCells,
	getRowCells,
	getRowToggle,
	getSelectionSpan,
	parseCellKey
} from '@studio/features/database-studio/components/data-grid/selection'

describe('cell keys', function () {
	it('round-trips a cell position', function () {
		expect(getCellKey(2, 3)).toBe('2:3')
		expect(parseCellKey('2:3')).toEqual({ row: 2, col: 3 })
	})
})

describe('getCellsInRectangle', function () {
	it('covers the rectangle whichever corners are given', function () {
		const expected = new Set(['1:1', '1:2', '2:1', '2:2'])
		expect(getCellsInRectangle({ row: 1, col: 1 }, { row: 2, col: 2 })).toEqual(expected)
		expect(getCellsInRectangle({ row: 2, col: 2 }, { row: 1, col: 1 })).toEqual(expected)
	})
})

describe('getSelectionSpan', function () {
	it('spans the selected rows and columns', function () {
		const selection = new Set(['2:1', '4:3', '3:2'])
		expect(getSelectionSpan(selection, { row: 2, col: 1 }, 'row')).toEqual({ start: 2, end: 4 })
		expect(getSelectionSpan(selection, { row: 2, col: 1 }, 'col')).toEqual({ start: 1, end: 3 })
	})

	it('falls back to the focused cell when nothing is selected', function () {
		expect(getSelectionSpan(new Set(), { row: 5, col: 2 }, 'row')).toEqual({ start: 5, end: 5 })
	})
})

describe('getRowCells and getColumnCells', function () {
	it('selects whole rows', function () {
		expect(getRowCells({ start: 1, end: 2 }, 2)).toEqual(new Set(['1:0', '1:1', '2:0', '2:1']))
	})

	it('selects whole columns of the loaded rows', function () {
		expect(getColumnCells({ start: 2, end: 2 }, 3)).toEqual(new Set(['0:2', '1:2', '2:2']))
	})

	it('returns nothing for an empty grid', function () {
		expect(getRowCells({ start: 0, end: 0 }, 0).size).toBe(0)
		expect(getColumnCells({ start: 0, end: 0 }, 0).size).toBe(0)
	})
})

describe('getRowToggle', function () {
	it('checks every row unless all are already checked', function () {
		expect(getRowToggle({ start: 1, end: 3 }, new Set([1]))).toEqual({
			rowIndexes: [1, 2, 3],
			checked: true
		})
		expect(getRowToggle({ start: 1, end: 3 }, new Set([1, 2, 3]))).toEqual({
			rowIndexes: [1, 2, 3],
			checked: false
		})
	})
})

describe('getActionRowIndexes', function () {
	it('prefers the checked rows', function () {
		const rows = getActionRowIndexes(new Set([1, 3]), new Set(['5:0', '6:0']), {
			row: 6,
			col: 0
		})
		expect(Array.from(rows)).toEqual([1, 3])
	})

	it('covers every row a multi-cell selection spans', function () {
		const rows = getActionRowIndexes(new Set(), new Set(['2:0', '2:1', '4:1']), {
			row: 4,
			col: 1
		})
		expect(Array.from(rows).sort()).toEqual([2, 4])
	})

	it('falls back to the focused row, then to nothing', function () {
		expect(
			Array.from(getActionRowIndexes(new Set(), new Set(['3:2']), { row: 3, col: 2 }))
		).toEqual([3])
		expect(getActionRowIndexes(new Set(), new Set(), null).size).toBe(0)
	})
})
