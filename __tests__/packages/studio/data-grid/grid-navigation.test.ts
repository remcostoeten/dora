import { describe, expect, it } from 'vitest'
import {
	clampToBounds,
	getEdgeTarget,
	getPageTarget,
	getStepTarget,
	getTabTarget,
	getVisibleRowCount,
	isSameCell
} from '@studio/features/database-studio/components/data-grid/grid-navigation'

const bounds = { rowCount: 5, colCount: 3 }

describe('getVisibleRowCount', function () {
	it('counts whole rows below the header', function () {
		expect(getVisibleRowCount(376, 34, 36)).toBe(10)
		expect(getVisibleRowCount(380, 34, 36)).toBe(10)
	})

	it('never returns less than one row', function () {
		expect(getVisibleRowCount(40, 34, 36)).toBe(1)
	})

	it('falls back to ten rows when the viewport is not measured', function () {
		expect(getVisibleRowCount(0, 34, 36)).toBe(10)
	})
})

describe('getPageTarget', function () {
	const tall = { rowCount: 50, colCount: 3 }

	it('moves by one page and keeps the column', function () {
		expect(getPageTarget({ row: 3, col: 1 }, 'down', 10, tall)).toEqual({ row: 13, col: 1 })
		expect(getPageTarget({ row: 23, col: 1 }, 'up', 10, tall)).toEqual({ row: 13, col: 1 })
	})

	it('clamps to the first and last row', function () {
		expect(getPageTarget({ row: 45, col: 0 }, 'down', 10, tall)).toEqual({ row: 49, col: 0 })
		expect(getPageTarget({ row: 4, col: 0 }, 'up', 10, tall)).toEqual({ row: 0, col: 0 })
	})
})

describe('getStepTarget', function () {
	it('moves one cell in each direction', function () {
		const from = { row: 2, col: 1 }
		expect(getStepTarget(from, 'up', bounds)).toEqual({ row: 1, col: 1 })
		expect(getStepTarget(from, 'down', bounds)).toEqual({ row: 3, col: 1 })
		expect(getStepTarget(from, 'left', bounds)).toEqual({ row: 2, col: 0 })
		expect(getStepTarget(from, 'right', bounds)).toEqual({ row: 2, col: 2 })
	})

	it('stays put at every edge', function () {
		expect(getStepTarget({ row: 0, col: 0 }, 'up', bounds)).toEqual({ row: 0, col: 0 })
		expect(getStepTarget({ row: 0, col: 0 }, 'left', bounds)).toEqual({ row: 0, col: 0 })
		expect(getStepTarget({ row: 4, col: 2 }, 'down', bounds)).toEqual({ row: 4, col: 2 })
		expect(getStepTarget({ row: 4, col: 2 }, 'right', bounds)).toEqual({ row: 4, col: 2 })
	})
})

describe('getEdgeTarget', function () {
	it('jumps to the edge and keeps the other axis', function () {
		const from = { row: 2, col: 1 }
		expect(getEdgeTarget(from, 'up', bounds)).toEqual({ row: 0, col: 1 })
		expect(getEdgeTarget(from, 'down', bounds)).toEqual({ row: 4, col: 1 })
		expect(getEdgeTarget(from, 'left', bounds)).toEqual({ row: 2, col: 0 })
		expect(getEdgeTarget(from, 'right', bounds)).toEqual({ row: 2, col: 2 })
	})
})

describe('getTabTarget', function () {
	it('walks cells in reading order and wraps across rows', function () {
		expect(getTabTarget({ row: 0, col: 1 }, false, bounds)).toEqual({ row: 0, col: 2 })
		expect(getTabTarget({ row: 0, col: 2 }, false, bounds)).toEqual({ row: 1, col: 0 })
		expect(getTabTarget({ row: 1, col: 0 }, true, bounds)).toEqual({ row: 0, col: 2 })
	})

	it('returns null past the first and last cell so Tab leaves the grid', function () {
		expect(getTabTarget({ row: 4, col: 2 }, false, bounds)).toBeNull()
		expect(getTabTarget({ row: 0, col: 0 }, true, bounds)).toBeNull()
	})
})

describe('clampToBounds', function () {
	it('pulls a stale position back inside the grid', function () {
		expect(clampToBounds({ row: 9, col: 7 }, bounds)).toEqual({ row: 4, col: 2 })
	})

	it('returns null for an empty grid', function () {
		expect(clampToBounds({ row: 0, col: 0 }, { rowCount: 0, colCount: 3 })).toBeNull()
	})
})

describe('isSameCell', function () {
	it('compares both axes', function () {
		expect(isSameCell({ row: 1, col: 2 }, { row: 1, col: 2 })).toBe(true)
		expect(isSameCell({ row: 1, col: 2 }, { row: 2, col: 1 })).toBe(false)
	})
})
