import { describe, expect, it } from 'vitest'
import { describeBatchCellMutation } from '@studio/core/undo/use-undo'
import { resolveCellChanges } from '@studio/features/database-studio/utils/cell-changes'

const tableData = {
	columns: [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'name', type: 'text', nullable: false, primaryKey: false },
		{ name: 'email', type: 'text', nullable: true, primaryKey: false }
	],
	rows: [
		{ id: 10, name: 'Ada', email: 'ada@example.com' },
		{ id: 20, name: 'Grace', email: null }
	],
	totalCount: 2,
	executionTime: 0
}

describe('resolveCellChanges', function () {
	it('addresses each change by primary key and keeps the previous value', function () {
		expect(
			resolveCellChanges(
				[{ rowIndex: 1, columnName: 'name', value: 'Hopper' }],
				tableData,
				'id'
			)
		).toEqual([
			{
				rowIndex: 1,
				primaryKeyValue: 20,
				columnName: 'name',
				previousValue: 'Grace',
				requestedValue: 'Hopper',
				newValue: 'Hopper'
			}
		])
	})

	it('normalizes an emptied value by nullability', function () {
		const changes = resolveCellChanges(
			[
				{ rowIndex: 0, columnName: 'email', value: '' },
				{ rowIndex: 0, columnName: 'name', value: '' }
			],
			tableData,
			'id'
		)
		expect(changes.map((change) => change.newValue)).toEqual([null, ''])
	})

	it('drops edits that change nothing or point at missing rows and columns', function () {
		expect(
			resolveCellChanges(
				[
					{ rowIndex: 0, columnName: 'name', value: 'Ada' },
					{ rowIndex: 1, columnName: 'email', value: null },
					{ rowIndex: 5, columnName: 'name', value: 'x' },
					{ rowIndex: 0, columnName: 'missing', value: 'x' }
				],
				tableData,
				'id'
			)
		).toEqual([])
	})

	it('lets a later edit to the same cell win', function () {
		const changes = resolveCellChanges(
			[
				{ rowIndex: 0, columnName: 'name', value: 'first' },
				{ rowIndex: 0, columnName: 'name', value: 'second' }
			],
			tableData,
			'id'
		)
		expect(changes).toHaveLength(1)
		expect(changes[0].newValue).toBe('second')
	})
})

describe('describeBatchCellMutation', function () {
	it('names NULL only when every cell was set to it', function () {
		expect(describeBatchCellMutation([{ newValue: null }, { newValue: null }])).toBe(
			'Updated 2 cells to NULL'
		)
		expect(describeBatchCellMutation([{ newValue: null }, { newValue: 'x' }])).toBe(
			'Updated 2 cells'
		)
		expect(describeBatchCellMutation([{ newValue: 'x' }])).toBe('Updated 1 cell')
	})
})
