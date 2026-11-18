export const MIN_COLUMN_WIDTH = 100
export const DEFAULT_COLUMN_WIDTH = 150
export const COLUMN_RESIZE_STEP = 10

/**
 * @name getResizedWidth
 * @description Returns a column width after a keyboard resize step, never
 * below the minimum column width.
 *
 * @example
 * getResizedWidth(150, -10) // 140
 */
export function getResizedWidth(currentWidth: number, delta: number): number {
	return Math.max(MIN_COLUMN_WIDTH, currentWidth + delta)
}
