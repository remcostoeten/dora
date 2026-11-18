import { describe, expect, it } from 'vitest'
import {
	findColumnIndex,
	parseGoToQuery,
	resolveGoToTarget,
	type GoToContext
} from '@studio/features/database-studio/components/data-grid/grid-go-to'

const columns = [
	{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
	{ name: 'full_name', type: 'text', nullable: false, primaryKey: false },
	{ name: 'email_address', type: 'text', nullable: true, primaryKey: false },
	{ name: '2024', type: 'integer', nullable: true, primaryKey: false }
]

function createContext(overrides: Partial<GoToContext> = {}): GoToContext {
	return {
		columns,
		focusedCell: { row: 4, col: 1 },
		loadedRowCount: 50,
		rowNumberOffset: 0,
		totalRowCount: 500,
		...overrides
	}
}

describe('parseGoToQuery', function () {
	it('reads digits as a row and text as a column', function () {
		expect(parseGoToQuery('120')).toEqual({ row: '120', column: null })
		expect(parseGoToQuery(' email ')).toEqual({ row: null, column: 'email' })
	})

	it('splits row and column on a colon or a comma', function () {
		expect(parseGoToQuery('120:email')).toEqual({ row: '120', column: 'email' })
		expect(parseGoToQuery('120, 3')).toEqual({ row: '120', column: '3' })
	})

	it('treats a leading separator as column only', function () {
		expect(parseGoToQuery(':2024')).toEqual({ row: null, column: '2024' })
	})

	it('returns nothing for blank input', function () {
		expect(parseGoToQuery('   ')).toEqual({ row: null, column: null })
	})
})

describe('findColumnIndex', function () {
	it('prefers an exact name, ignoring case', function () {
		expect(findColumnIndex(columns, 'ID')).toBe(0)
		expect(findColumnIndex(columns, '2024')).toBe(3)
	})

	it('reads other digits as a 1-based column position', function () {
		expect(findColumnIndex(columns, '2')).toBe(1)
		expect(findColumnIndex(columns, '9')).toBe(-1)
	})

	it('falls back to a fuzzy match on the column names', function () {
		expect(findColumnIndex(columns, 'email')).toBe(2)
		expect(findColumnIndex(columns, 'fnm')).toBe(1)
		expect(findColumnIndex(columns, 'zzz')).toBe(-1)
	})
})

describe('resolveGoToTarget', function () {
	it('resolves a row and a column inside the loaded page', function () {
		expect(resolveGoToTarget('20:email', createContext())).toEqual({
			status: 'ok',
			absoluteRow: 19,
			col: 2,
			isLoaded: true,
			label: 'Row 20, column email_address'
		})
	})

	it('keeps the focused column for a row and the focused row for a column', function () {
		expect(resolveGoToTarget('7', createContext())).toMatchObject({ absoluteRow: 6, col: 1 })
		expect(resolveGoToTarget('email', createContext())).toMatchObject({
			absoluteRow: 4,
			col: 2
		})
	})

	it('counts rows across pages and flags a row outside the loaded page', function () {
		const context = createContext({ rowNumberOffset: 50, focusedCell: { row: 4, col: 1 } })
		expect(resolveGoToTarget('120', context)).toMatchObject({
			absoluteRow: 119,
			isLoaded: false
		})
		expect(resolveGoToTarget('60', context)).toMatchObject({ absoluteRow: 59, isLoaded: true })
		expect(resolveGoToTarget('email', context)).toMatchObject({ absoluteRow: 54 })
	})

	it('reports what is wrong with the input', function () {
		expect(resolveGoToTarget('', createContext())).toEqual({ status: 'empty' })
		expect(resolveGoToTarget('0', createContext())).toEqual({
			status: 'error',
			message: '"0" is not a row number'
		})
		expect(resolveGoToTarget('x:email', createContext())).toEqual({
			status: 'error',
			message: '"x" is not a row number'
		})
		expect(resolveGoToTarget('501', createContext())).toEqual({
			status: 'error',
			message: 'Row 501 is past the last row (500)'
		})
		expect(resolveGoToTarget('5:zzz', createContext())).toEqual({
			status: 'error',
			message: 'No column matches "zzz"'
		})
	})
})
