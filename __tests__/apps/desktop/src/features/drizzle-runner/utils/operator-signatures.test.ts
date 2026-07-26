import { describe, expect, it } from 'vitest'
import {
	DRIZZLE_OPERATOR_SIGNATURES,
	findEnclosingOperatorCall
} from '@/features/drizzle-runner/utils/operator-signatures'

describe('DRIZZLE_OPERATOR_SIGNATURES', function () {
	it('documents eq with two parameters', function () {
		const eq = DRIZZLE_OPERATOR_SIGNATURES.eq
		expect(eq.signature).toBe('eq(column, value)')
		expect(eq.parameters).toHaveLength(2)
	})

	it('covers the operators the completion provider offers', function () {
		for (const name of ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'inArray', 'and', 'or']) {
			expect(DRIZZLE_OPERATOR_SIGNATURES[name]).toBeDefined()
		}
	})
})

describe('findEnclosingOperatorCall', function () {
	it('detects the first argument right after the opening paren', function () {
		expect(findEnclosingOperatorCall('db.query.users.findMany({ where: eq(')).toEqual({
			name: 'eq',
			activeParameter: 0
		})
	})

	it('detects the second argument after a comma', function () {
		expect(findEnclosingOperatorCall('eq(users.id, ')).toEqual({
			name: 'eq',
			activeParameter: 1
		})
	})

	it('ignores completed nested calls', function () {
		expect(findEnclosingOperatorCall('and(eq(users.id, 1), eq(users.name, ')).toEqual({
			name: 'eq',
			activeParameter: 1
		})
	})

	it('resolves the outer operator once an inner call closes', function () {
		expect(findEnclosingOperatorCall('and(eq(users.id, 1), ')).toEqual({
			name: 'and',
			activeParameter: 1
		})
	})

	it('does not count commas inside string literals', function () {
		expect(findEnclosingOperatorCall("like(users.name, 'a,b")).toEqual({
			name: 'like',
			activeParameter: 1
		})
	})

	it('does not count commas inside array literals', function () {
		expect(findEnclosingOperatorCall('inArray(users.id, [1, 2, ')).toEqual({
			name: 'inArray',
			activeParameter: 1
		})
	})

	it('returns null outside any operator call', function () {
		expect(findEnclosingOperatorCall('db.query.users.findMany({ limit: 10, ')).toBeNull()
	})

	it('returns null for an unknown function call', function () {
		expect(findEnclosingOperatorCall('myHelper(users.id, ')).toBeNull()
	})

	it('walks out of an unknown inner call to the enclosing operator', function () {
		expect(findEnclosingOperatorCall('and(x, lower(users.name')).toEqual({
			name: 'and',
			activeParameter: 1
		})
	})

	it('handles between with three arguments', function () {
		expect(findEnclosingOperatorCall('between(orders.total, 10, ')).toEqual({
			name: 'between',
			activeParameter: 2
		})
	})
})
