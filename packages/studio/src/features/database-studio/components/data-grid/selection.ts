import { CellPosition } from './types'

export function getCellKey(row: number, col: number): string {
	return `${row}:${col}`
}

export function getCellsInRectangle(start: CellPosition, end: CellPosition): Set<string> {
	const minRow = Math.min(start.row, end.row)
	const maxRow = Math.max(start.row, end.row)
	const minCol = Math.min(start.col, end.col)
	const maxCol = Math.max(start.col, end.col)

	const cells = new Set<string>()
	for (let r = minRow; r <= maxRow; r++) {
		for (let c = minCol; c <= maxCol; c++) {
			cells.add(getCellKey(r, c))
		}
	}
	return cells
}
