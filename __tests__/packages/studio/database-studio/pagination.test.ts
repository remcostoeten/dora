import { describe, expect, it } from 'vitest'
import { getOffsetForRow, getPagedOffset } from '@studio/features/database-studio/utils/pagination'

describe('getPagedOffset', function () {
	it('moves one page forward and back', function () {
		expect(getPagedOffset({ limit: 50, offset: 50 }, 'next', 120)).toBe(100)
		expect(getPagedOffset({ limit: 50, offset: 50 }, 'prev', 120)).toBe(0)
	})

	it('stays put on the first and last page', function () {
		expect(getPagedOffset({ limit: 50, offset: 100 }, 'next', 120)).toBe(100)
		expect(getPagedOffset({ limit: 50, offset: 0 }, 'prev', 120)).toBe(0)
		expect(getPagedOffset({ limit: 50, offset: 50 }, 'next', 100)).toBe(50)
	})
})

describe('getOffsetForRow', function () {
	it('returns the offset of the page that holds the row', function () {
		expect(getOffsetForRow(0, 50)).toBe(0)
		expect(getOffsetForRow(49, 50)).toBe(0)
		expect(getOffsetForRow(119, 50)).toBe(100)
	})
})
