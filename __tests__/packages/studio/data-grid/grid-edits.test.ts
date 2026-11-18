import { describe, expect, it } from 'vitest'
import {
	describePasteDrop,
	describeSetNullRefusal,
	planClear,
	planFillDown,
	planFillSelection,
	planPaste,
	planSetNull
} from '@studio/features/database-studio/components/data-grid/grid-edits'

const columns = [
	{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
	{ name: 'name', type: 'text', nullable: false, primaryKey: false },
	{ name: 'email', type: 'text', nullable: true, primaryKey: false }
]

const rows = [
	{ id: 1, name: 'Ada', email: 'ada@example.com' },
	{ id: 2, name: 'Grace', email: null },
	{ id: 3, name: 'Linus', email: 'linus@example.com' }
]

describe('planClear', function () {
	it('resets cells to the inferred default and skips primary keys', function () {
		const cells = [
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 1, col: 2 },
			{ row: 9, col: 1 }
		]
		expect(planClear(cells, columns, rows)).toEqual([
			{ rowIndex: 0, columnName: 'name', value: '' },
			{ rowIndex: 1, columnName: 'email', value: null }
		])
	})
})

describe('planSetNull', function () {
	it('sets nullable cells and refuses primary keys and non-nullable columns', function () {
		const cells = [
			{ row: 0, col: 0 },
			{ row: 0, col: 1 },
			{ row: 1, col: 1 },
			{ row: 0, col: 2 }
		]
		expect(planSetNull(cells, columns, rows)).toEqual({
			edits: [{ rowIndex: 0, columnName: 'email', value: null }],
			refusedColumns: ['id', 'name']
		})
	})
})

describe('describeSetNullRefusal', function () {
	it('names the refused columns', function () {
		expect(describeSetNullRefusal([])).toBeNull()
		expect(describeSetNullRefusal(['name'])).toBe('name cannot be NULL')
		expect(describeSetNullRefusal(['id', 'name'])).toBe('id and name cannot be NULL')
		expect(describeSetNullRefusal(['a', 'b', 'c'])).toBe('a, b and c cannot be NULL')
	})
})

describe('planFillDown', function () {
	it('copies the top selected row into the selected cells below it', function () {
		const selection = new Set(['0:1', '1:1', '2:1', '0:2', '1:2', '2:2'])
		expect(planFillDown(selection, { row: 0, col: 1 }, columns, rows)).toEqual([
			{ rowIndex: 1, columnName: 'name', value: 'Ada' },
			{ rowIndex: 2, columnName: 'name', value: 'Ada' },
			{ rowIndex: 1, columnName: 'email', value: 'ada@example.com' },
			{ rowIndex: 2, columnName: 'email', value: 'ada@example.com' }
		])
	})

	it('copies from the row above when one row is selected', function () {
		expect(planFillDown(new Set(['1:1']), { row: 1, col: 1 }, columns, rows)).toEqual([
			{ rowIndex: 1, columnName: 'name', value: 'Ada' }
		])
		expect(planFillDown(new Set(), { row: 2, col: 2 }, columns, rows)).toEqual([
			{ rowIndex: 2, columnName: 'email', value: null }
		])
	})

	it('has nothing to fill on the first row and never writes a primary key', function () {
		expect(planFillDown(new Set(['0:1']), { row: 0, col: 1 }, columns, rows)).toEqual([])
		expect(planFillDown(new Set(['0:0', '1:0']), { row: 0, col: 0 }, columns, rows)).toEqual([])
	})
})

describe('planPaste', function () {
	it('maps a pasted block onto cells from the origin', function () {
		const plan = planPaste(
			[
				['a', 'b'],
				['c', 'd']
			],
			{ row: 1, col: 1 },
			3,
			columns
		)
		expect(plan).toEqual({
			edits: [
				{ rowIndex: 1, columnName: 'name', value: 'a' },
				{ rowIndex: 1, columnName: 'email', value: 'b' },
				{ rowIndex: 2, columnName: 'name', value: 'c' },
				{ rowIndex: 2, columnName: 'email', value: 'd' }
			],
			droppedCells: 0,
			droppedRows: 0,
			droppedColumns: 0
		})
	})

	it('counts the rows, columns and cells that fall outside the grid', function () {
		const plan = planPaste(
			[
				['a', 'b', 'c'],
				['d', 'e', 'f'],
				['g', 'h', 'i']
			],
			{ row: 1, col: 1 },
			3,
			columns
		)
		expect(plan.edits).toHaveLength(4)
		expect(plan.droppedRows).toBe(1)
		expect(plan.droppedColumns).toBe(1)
		expect(plan.droppedCells).toBe(5)
	})

	it('skips blank lines without counting them as dropped', function () {
		const plan = planPaste([['a'], [''], ['b']], { row: 0, col: 1 }, 3, columns)
		expect(plan.edits).toEqual([
			{ rowIndex: 0, columnName: 'name', value: 'a' },
			{ rowIndex: 2, columnName: 'name', value: 'b' }
		])
		expect(plan.droppedCells).toBe(0)
	})
})

describe('describePasteDrop', function () {
	it('says nothing when everything fit', function () {
		expect(
			describePasteDrop({ edits: [], droppedCells: 0, droppedRows: 0, droppedColumns: 0 })
		).toBeNull()
	})

	it('reports how much was dropped and why', function () {
		const edits = planPaste([['a', 'b']], { row: 0, col: 1 }, 3, columns).edits
		expect(
			describePasteDrop({ edits, droppedCells: 5, droppedRows: 1, droppedColumns: 1 })
		).toBe('Pasted 2 cells. 5 cells did not fit: 1 row and 1 column are outside the grid.')
		expect(
			describePasteDrop({ edits, droppedCells: 1, droppedRows: 0, droppedColumns: 1 })
		).toBe('Pasted 2 cells. 1 cell did not fit: 1 column is outside the grid.')
	})
})

describe('planFillSelection', function () {
	it('groups the selected cells by column and skips primary keys', function () {
		expect(planFillSelection(new Set(['1:1', '0:1', '1:2', '0:0']), columns)).toEqual([
			{ columnName: 'name', rowIndexes: [0, 1] },
			{ columnName: 'email', rowIndexes: [1] }
		])
	})
})
