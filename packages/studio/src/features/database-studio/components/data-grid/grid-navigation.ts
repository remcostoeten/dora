import { CellPosition } from './types'

export type GridBounds = {
	rowCount: number
	colCount: number
}

export type GridDirection = 'up' | 'down' | 'left' | 'right'

/**
 * @name getStepTarget
 * @description Returns the cell one step away from `from` in `direction`,
 * clamped to the grid. At an edge it returns `from` unchanged.
 *
 * @example
 * getStepTarget({ row: 0, col: 2 }, 'up', { rowCount: 10, colCount: 4 })
 * // { row: 0, col: 2 }
 */
export function getStepTarget(
	from: CellPosition,
	direction: GridDirection,
	bounds: GridBounds
): CellPosition {
	const maxRow = bounds.rowCount - 1
	const maxCol = bounds.colCount - 1
	switch (direction) {
		case 'up':
			return { row: Math.max(from.row - 1, 0), col: from.col }
		case 'down':
			return { row: Math.min(from.row + 1, maxRow), col: from.col }
		case 'left':
			return { row: from.row, col: Math.max(from.col - 1, 0) }
		case 'right':
			return { row: from.row, col: Math.min(from.col + 1, maxCol) }
	}
}

/**
 * @name getEdgeTarget
 * @description Returns the cell at the edge of the grid in `direction`, keeping
 * the other axis of `from`.
 *
 * @example
 * getEdgeTarget({ row: 3, col: 2 }, 'down', { rowCount: 10, colCount: 4 })
 * // { row: 9, col: 2 }
 */
export function getEdgeTarget(
	from: CellPosition,
	direction: GridDirection,
	bounds: GridBounds
): CellPosition {
	switch (direction) {
		case 'up':
			return { row: 0, col: from.col }
		case 'down':
			return { row: bounds.rowCount - 1, col: from.col }
		case 'left':
			return { row: from.row, col: 0 }
		case 'right':
			return { row: from.row, col: bounds.colCount - 1 }
	}
}

/**
 * @name getTabTarget
 * @description Returns the next or previous cell in reading order, wrapping
 * across rows. Returns null past the first or last cell, where Tab leaves the
 * grid.
 *
 * @example
 * getTabTarget({ row: 0, col: 3 }, false, { rowCount: 10, colCount: 4 })
 * // { row: 1, col: 0 }
 */
export function getTabTarget(
	from: CellPosition,
	backwards: boolean,
	bounds: GridBounds
): CellPosition | null {
	const maxRow = bounds.rowCount - 1
	const maxCol = bounds.colCount - 1
	if (backwards) {
		if (from.col > 0) return { row: from.row, col: from.col - 1 }
		if (from.row > 0) return { row: from.row - 1, col: maxCol }
		return null
	}
	if (from.col < maxCol) return { row: from.row, col: from.col + 1 }
	if (from.row < maxRow) return { row: from.row + 1, col: 0 }
	return null
}

/**
 * @name clampToBounds
 * @description Pulls a cell position back inside the grid after rows or
 * columns were removed. Returns null when the grid is empty.
 *
 * @example
 * clampToBounds({ row: 12, col: 1 }, { rowCount: 10, colCount: 4 })
 * // { row: 9, col: 1 }
 */
export function clampToBounds(cell: CellPosition, bounds: GridBounds): CellPosition | null {
	if (bounds.rowCount <= 0 || bounds.colCount <= 0) return null
	return {
		row: Math.min(Math.max(cell.row, 0), bounds.rowCount - 1),
		col: Math.min(Math.max(cell.col, 0), bounds.colCount - 1)
	}
}

/**
 * @name isSameCell
 * @description Whether two cell positions address the same cell.
 *
 * @example
 * isSameCell({ row: 1, col: 2 }, { row: 1, col: 2 }) // true
 */
export function isSameCell(a: CellPosition, b: CellPosition): boolean {
	return a.row === b.row && a.col === b.col
}
