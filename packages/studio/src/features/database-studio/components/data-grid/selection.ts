import { CellPosition } from './types'

/**
 * @name getCellKey
 * @description Builds the `row:col` key that identifies a cell in the
 * selection set and in the `data-cell-key` attribute.
 *
 * @example
 * getCellKey(2, 3) // '2:3'
 */
export function getCellKey(row: number, col: number): string {
	return `${row}:${col}`
}

/**
 * @name parseCellKey
 * @description Splits a `row:col` cell key back into a cell position.
 *
 * @example
 * parseCellKey('2:3') // { row: 2, col: 3 }
 */
export function parseCellKey(key: string): CellPosition {
	const [row, col] = key.split(':').map(Number)
	return { row, col }
}

/**
 * @name getCellId
 * @description Builds the DOM id of a cell, used for `aria-activedescendant`.
 *
 * @example
 * getCellId('data-grid-r1', 2, 3) // 'data-grid-r1-cell-2-3'
 */
export function getCellId(gridId: string, row: number, col: number): string {
	return `${gridId}-cell-${row}-${col}`
}

/**
 * @name getHeaderCellId
 * @description Builds the DOM id of a column header cell, used for
 * `aria-activedescendant` while the header row holds the roving focus.
 *
 * @example
 * getHeaderCellId('data-grid-r1', 3) // 'data-grid-r1-header-3'
 */
export function getHeaderCellId(gridId: string, col: number): string {
	return `${gridId}-header-${col}`
}

/**
 * @name getCellsInRectangle
 * @description Returns the keys of every cell in the rectangle spanned by two
 * corner cells, in any order.
 *
 * @example
 * getCellsInRectangle({ row: 0, col: 0 }, { row: 1, col: 1 })
 * // Set { '0:0', '0:1', '1:0', '1:1' }
 */
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

export type IndexSpan = {
	start: number
	end: number
}

/**
 * @name getSelectionSpan
 * @description Returns the rows or columns covered by the cell selection as an
 * inclusive span, falling back to the focused cell when nothing is selected.
 *
 * @example
 * getSelectionSpan(new Set(['2:1', '4:3']), { row: 2, col: 1 }, 'row')
 * // { start: 2, end: 4 }
 */
export function getSelectionSpan(
	selectedCells: ReadonlySet<string>,
	focusedCell: CellPosition,
	axis: 'row' | 'col'
): IndexSpan {
	let start = focusedCell[axis]
	let end = focusedCell[axis]
	for (const key of selectedCells) {
		const index = parseCellKey(key)[axis]
		if (Number.isNaN(index)) continue
		start = Math.min(start, index)
		end = Math.max(end, index)
	}
	return { start, end }
}

/**
 * @name getRowCells
 * @description Returns the keys of every cell in an inclusive span of rows.
 *
 * @example
 * getRowCells({ start: 1, end: 1 }, 3) // Set { '1:0', '1:1', '1:2' }
 */
export function getRowCells(rows: IndexSpan, colCount: number): Set<string> {
	if (colCount <= 0) return new Set()
	return getCellsInRectangle({ row: rows.start, col: 0 }, { row: rows.end, col: colCount - 1 })
}

/**
 * @name getColumnCells
 * @description Returns the keys of every loaded cell in an inclusive span of
 * columns.
 *
 * @example
 * getColumnCells({ start: 2, end: 2 }, 2) // Set { '0:2', '1:2' }
 */
export function getColumnCells(cols: IndexSpan, rowCount: number): Set<string> {
	if (rowCount <= 0) return new Set()
	return getCellsInRectangle({ row: 0, col: cols.start }, { row: rowCount - 1, col: cols.end })
}

/**
 * @name getRowToggle
 * @description Decides what Space does to a span of rows: it checks them all,
 * unless every one is already checked, in which case it unchecks them.
 *
 * @example
 * getRowToggle({ start: 1, end: 2 }, new Set([1]))
 * // { rowIndexes: [1, 2], checked: true }
 */
export function getRowToggle(
	rows: IndexSpan,
	selectedRows: ReadonlySet<number>
): { rowIndexes: number[]; checked: boolean } {
	const rowIndexes: number[] = []
	for (let rowIndex = rows.start; rowIndex <= rows.end; rowIndex++) {
		rowIndexes.push(rowIndex)
	}
	return { rowIndexes, checked: !rowIndexes.every((rowIndex) => selectedRows.has(rowIndex)) }
}

/**
 * @name getActionRowIndexes
 * @description Resolves the rows the selection bar and the delete command act
 * on: the checked rows when there are any, otherwise every row the cell
 * selection spans, otherwise the focused cell's row.
 *
 * @example
 * getActionRowIndexes(new Set(), new Set(['2:0', '4:1']), { row: 4, col: 1 })
 * // Set { 2, 4 }
 */
export function getActionRowIndexes(
	selectedRows: Set<number>,
	selectedCells: Set<string>,
	focusedCell: CellPosition | null
): Set<number> {
	if (selectedRows.size > 0) return selectedRows
	if (selectedCells.size > 1) {
		const rows = new Set<number>()
		for (const key of selectedCells) rows.add(parseCellKey(key).row)
		return rows
	}
	if (focusedCell) return new Set([focusedCell.row])
	return new Set<number>()
}
