import { describe, expect, it } from 'vitest'
import type { ColumnDefinition } from '../types'
import { normalizeValueForInsert } from './studio-data'

function col(type: string, nullable = true): ColumnDefinition {
	return { name: 'c', type, nullable, primaryKey: false }
}

describe('normalizeValueForInsert', () => {
	it('parses normal integers to numbers', () => {
		expect(normalizeValueForInsert(col('integer'), '42')).toBe(42)
		expect(normalizeValueForInsert(col('int4'), '-7')).toBe(-7)
	})

	it('keeps BIGINT values beyond the safe-integer range as exact strings', () => {
		// 9007199254740993 (2^53 + 1) cannot be represented exactly as a JS number.
		expect(normalizeValueForInsert(col('bigint'), '9007199254740993')).toBe('9007199254740993')
		expect(normalizeValueForInsert(col('int8'), '123456789012345678901234')).toBe(
			'123456789012345678901234'
		)
	})

	it('parses normal floats to numbers', () => {
		expect(normalizeValueForInsert(col('double precision'), '19.95')).toBe(19.95)
		expect(normalizeValueForInsert(col('numeric'), '0.5')).toBe(0.5)
	})

	it('keeps high-precision decimals as exact strings', () => {
		expect(normalizeValueForInsert(col('numeric'), '123.4567890123456789')).toBe(
			'123.4567890123456789'
		)
	})

	it('does not turn short decimals with trailing zeros into strings', () => {
		// Avoids spurious string conversions (and thus spurious writes).
		expect(normalizeValueForInsert(col('numeric'), '19.50')).toBe(19.5)
	})

	it('coerces booleans and handles null/empty', () => {
		expect(normalizeValueForInsert(col('boolean'), 'true')).toBe(true)
		expect(normalizeValueForInsert(col('boolean'), '0')).toBe(false)
		expect(normalizeValueForInsert(col('integer', true), '')).toBe(null)
		expect(normalizeValueForInsert(col('integer', false), '')).toBe(0)
	})

	it('leaves timestamp/uuid/text values as strings', () => {
		expect(normalizeValueForInsert(col('timestamp'), '2024-01-01 10:00:00')).toBe(
			'2024-01-01 10:00:00'
		)
		expect(normalizeValueForInsert(col('uuid'), 'a-b-c')).toBe('a-b-c')
	})
})
