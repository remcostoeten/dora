import { ColumnDefinition } from '../../types'
import { noop } from '@studio/shared/utils/noop'
import { getCellKey } from './selection'
import { CellPosition } from './types'

/**
 * @name getCellsToClear
 * @description Returns the cells a clear command acts on: the cell selection,
 * or the focused cell when nothing is selected.
 *
 * @example
 * getCellsToClear(new Set(), { row: 2, col: 3 }) // [{ row: 2, col: 3 }]
 */
export function getCellsToClear(
	selectedCellsSet: Set<string>,
	focusedCell: CellPosition
): CellPosition[] {
	const keys =
		selectedCellsSet.size > 0
			? selectedCellsSet
			: new Set([getCellKey(focusedCell.row, focusedCell.col)])
	return Array.from(keys, function (key) {
		const [row, col] = key.split(':').map(Number)
		return { row, col }
	})
}

export function copySelectionToClipboard(
	selectedCellsSet: Set<string>,
	focusedCell: CellPosition | null,
	rows: Record<string, unknown>[],
	columns: ColumnDefinition[]
) {
	if (selectedCellsSet.size > 0) {
		const cellsArray = Array.from(selectedCellsSet).map(function (key) {
			const [row, col] = key.split(':').map(Number)
			return { row, col }
		})
		cellsArray.sort(function (a, b) {
			return a.row === b.row ? a.col - b.col : a.row - b.row
		})
		const minRow = Math.min(
			...cellsArray.map(function (cell) {
				return cell.row
			})
		)
		const maxRow = Math.max(
			...cellsArray.map(function (cell) {
				return cell.row
			})
		)
		const rowData: string[][] = []
		for (let row = minRow; row <= maxRow; row++) {
			const rowCells = cellsArray.filter(function (cell) {
				return cell.row === row
			})
			const values = rowCells.map(function (cell) {
				const value = rows[cell.row][columns[cell.col].name]
				return value === null || value === undefined ? '' : String(value)
			})
			rowData.push(values)
		}
		navigator.clipboard.writeText(
			rowData
				.map(function (row) {
					return row.join('\t')
				})
				.join('\n')
		)
		return
	}

	if (focusedCell) {
		const column = columns[focusedCell.col]
		const value = column ? rows[focusedCell.row]?.[column.name] : undefined
		navigator.clipboard.writeText(value === null || value === undefined ? '' : String(value))
	}
}

/**
 * @name parseClipboardGrid
 * @description Splits clipboard text into a grid of cell values. Normalises
 * CRLF and CR line endings so no `\r` ends up in a cell, and drops the single
 * trailing newline most copy sources append so it does not become a phantom
 * row that overwrites the row below the paste target.
 *
 * @example
 * parseClipboardGrid('a\tb\r\nc\td\n') // [['a', 'b'], ['c', 'd']]
 */
export function parseClipboardGrid(clipboardText: string): string[][] {
	return clipboardText
		.replace(/\r\n?/g, '\n')
		.replace(/\n$/, '')
		.split('\n')
		.map(function (line) {
			return line.split('\t')
		})
}

function isEmptyPasteRow(pasteRow: string[]): boolean {
	return pasteRow.length === 1 && pasteRow[0] === ''
}

export function pasteClipboardIntoGrid(
	focusedCell: CellPosition,
	rowCount: number,
	columns: ColumnDefinition[],
	onCellEdit: (rowIndex: number, columnName: string, newValue: unknown) => void
) {
	navigator.clipboard
		.readText()
		.then(function (clipboardText) {
			if (!clipboardText) return
			const pasteRows = parseClipboardGrid(clipboardText)
			pasteRows.forEach(function (pasteRow, pasteRowIndex) {
				if (isEmptyPasteRow(pasteRow)) return
				const targetRow = focusedCell.row + pasteRowIndex
				if (targetRow >= rowCount) return
				pasteRow.forEach(function (pasteValue, pasteColIndex) {
					const targetCol = focusedCell.col + pasteColIndex
					if (targetCol >= columns.length) return
					onCellEdit(targetRow, columns[targetCol].name, pasteValue)
				})
			})
		})
		.catch(noop)
}
