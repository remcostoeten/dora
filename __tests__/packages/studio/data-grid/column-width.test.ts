import { describe, expect, it } from 'vitest'
import {
	COLUMN_RESIZE_STEP,
	MIN_COLUMN_WIDTH,
	getResizedWidth
} from '@studio/features/database-studio/components/data-grid/column-width'

describe('getResizedWidth', function () {
	it('moves the width by one step', function () {
		expect(getResizedWidth(150, COLUMN_RESIZE_STEP)).toBe(160)
		expect(getResizedWidth(150, -COLUMN_RESIZE_STEP)).toBe(140)
	})

	it('never goes below the minimum column width', function () {
		expect(getResizedWidth(MIN_COLUMN_WIDTH, -COLUMN_RESIZE_STEP)).toBe(MIN_COLUMN_WIDTH)
		expect(getResizedWidth(104, -COLUMN_RESIZE_STEP)).toBe(MIN_COLUMN_WIDTH)
	})
})
