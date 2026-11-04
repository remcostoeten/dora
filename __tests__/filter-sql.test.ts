import { describe, it, expect } from 'vitest'
import {
	buildWhereClause,
	buildFilterCondition,
	buildWhereClauseFromGroup
} from '@/core/data-provider/filter-sql'
import type { FilterDescriptor } from '@/features/database-studio/types'

describe('buildWhereClause', () => {
	const active: FilterDescriptor = { column: 'status', operator: 'eq', value: 'active' }
	const pending: FilterDescriptor = { column: 'status', operator: 'eq', value: 'pending' }

	it('returns empty string for no filters', () => {
		expect(buildWhereClause([])).toBe('')
		expect(buildWhereClause(undefined)).toBe('')
	})

	it('joins conditions with AND by default', () => {
		expect(buildWhereClause([active, pending])).toBe(
			`"status" = 'active' AND "status" = 'pending'`
		)
	})

	it('joins conditions with OR when requested', () => {
		expect(buildWhereClause([active, pending], 'OR')).toBe(
			`"status" = 'active' OR "status" = 'pending'`
		)
	})

	it('wraps contains/ilike values in wildcards', () => {
		expect(buildFilterCondition({ column: 'name', operator: 'contains', value: 'ab' })).toBe(
			`"name" LIKE '%ab%'`
		)
		expect(buildFilterCondition({ column: 'name', operator: 'ilike', value: 'ab' })).toBe(
			`"name" ILIKE '%ab%'`
		)
	})

	it('escapes single quotes in values', () => {
		expect(buildFilterCondition({ column: 'note', operator: 'eq', value: "O'Brien" })).toBe(
			`"note" = 'O''Brien'`
		)
	})

	it('maps comparison operators', () => {
		expect(buildFilterCondition({ column: 'age', operator: 'gte', value: 18 })).toBe(
			`"age" >= '18'`
		)
	})
})

describe('buildWhereClauseFromGroup', () => {
	it('skips conditions that have no value yet', () => {
		expect(
			buildWhereClauseFromGroup({
				logic: 'AND',
				conditions: [
					{ column: 'id', operator: 'eq', value: '' },
					{ column: 'status', operator: 'eq', value: 'active' }
				]
			})
		).toBe(`"status" = 'active'`)
	})
})
