import { describe, expect, it } from 'vitest'
import { areValuesEqual } from '@studio/shared/utils/value-equality'

describe('areValuesEqual', function () {
	it('treats identical primitives as equal', function () {
		expect(areValuesEqual('a', 'a')).toBe(true)
		expect(areValuesEqual(1, 1)).toBe(true)
		expect(areValuesEqual(null, null)).toBe(true)
	})

	it('compares nested arrays and objects deeply', function () {
		expect(areValuesEqual([1, { ok: true }], [1, { ok: true }])).toBe(true)
		expect(areValuesEqual({ a: [1, 2] }, { a: [1, 2] })).toBe(true)
	})

	it('rejects structural differences', function () {
		expect(areValuesEqual({ a: 1 }, { a: 2 })).toBe(false)
		expect(areValuesEqual([1, 2], [1, 2, 3])).toBe(false)
	})
})
