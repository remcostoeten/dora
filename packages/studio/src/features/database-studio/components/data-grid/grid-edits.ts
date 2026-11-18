import { ColumnDefinition } from '../../types'
import { getColumnDefault } from '../../utils/studio-data'
import { getSelectionSpan, parseCellKey } from './selection'
import { CellPosition } from './types'

export type CellEdit = {
	rowIndex: number
	columnName: string
	value: unknown
}

export type GridNotice = {
	level: 'info' | 'warning'
	message: string
}

export type StagedAction = 'toggle-dry-mode' | 'apply' | 'discard' | 'preview' | 'undo' | 'redo'

type Rows = Record<string, unknown>[]

function pluralize(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * @name planClear
 * @description Builds the edits that reset cells to the grid's inferred
 * default. Primary keys and cells outside the loaded rows are left alone.
 *
 * @example
 * planClear([{ row: 0, col: 1 }], columns, rows)
 * // [{ rowIndex: 0, columnName: 'name', value: '' }]
 */
export function planClear(
	cells: CellPosition[],
	columns: ColumnDefinition[],
	rows: Rows
): CellEdit[] {
	const edits: CellEdit[] = []
	for (const cell of cells) {
		const column = columns[cell.col]
		if (!column || column.primaryKey || !rows[cell.row]) continue
		edits.push({ rowIndex: cell.row, columnName: column.name, value: getColumnDefault(column) })
	}
	return edits
}

export type SetNullPlan = {
	edits: CellEdit[]
	refusedColumns: string[]
}

/**
 * @name planSetNull
 * @description Builds the edits that set cells to NULL and lists the columns
 * that were refused because they are not nullable or are a primary key.
 *
 * @example
 * planSetNull([{ row: 0, col: 1 }, { row: 0, col: 2 }], columns, rows)
 * // { edits: [{ rowIndex: 0, columnName: 'email', value: null }], refusedColumns: ['name'] }
 */
export function planSetNull(
	cells: CellPosition[],
	columns: ColumnDefinition[],
	rows: Rows
): SetNullPlan {
	const edits: CellEdit[] = []
	const refused = new Set<string>()
	for (const cell of cells) {
		const column = columns[cell.col]
		if (!column || !rows[cell.row]) continue
		if (column.primaryKey || !column.nullable) {
			refused.add(column.name)
			continue
		}
		edits.push({ rowIndex: cell.row, columnName: column.name, value: null })
	}
	return { edits, refusedColumns: Array.from(refused) }
}

/**
 * @name describeSetNullRefusal
 * @description Words the notice for columns that cannot be set to NULL.
 * Returns null when nothing was refused.
 *
 * @example
 * describeSetNullRefusal(['id', 'name']) // 'id and name cannot be NULL'
 */
export function describeSetNullRefusal(refusedColumns: string[]): string | null {
	if (refusedColumns.length === 0) return null
	if (refusedColumns.length === 1) return `${refusedColumns[0]} cannot be NULL`
	const last = refusedColumns[refusedColumns.length - 1]
	return `${refusedColumns.slice(0, -1).join(', ')} and ${last} cannot be NULL`
}

/**
 * @name planFillDown
 * @description Builds the edits for fill down. With a selection that spans
 * several rows, every selected cell takes the value of the top selected row in
 * its column. With one row, each cell takes the value from the row above.
 * Primary keys are left alone.
 *
 * @example
 * planFillDown(new Set(['0:1', '1:1', '2:1']), { row: 0, col: 1 }, columns, rows)
 * // [{ rowIndex: 1, columnName: 'name', value: 'Ada' }, { rowIndex: 2, columnName: 'name', value: 'Ada' }]
 */
export function planFillDown(
	selectedCells: ReadonlySet<string>,
	focusedCell: CellPosition,
	columns: ColumnDefinition[],
	rows: Rows
): CellEdit[] {
	const cells =
		selectedCells.size > 0 ? Array.from(selectedCells, parseCellKey) : [{ ...focusedCell }]
	const span = getSelectionSpan(selectedCells, focusedCell, 'row')
	const sourceRow = span.start === span.end ? span.start - 1 : span.start
	const source = rows[sourceRow]
	if (!source) return []

	const edits: CellEdit[] = []
	for (const cell of cells) {
		const column = columns[cell.col]
		if (!column || column.primaryKey || !rows[cell.row] || cell.row === sourceRow) continue
		edits.push({ rowIndex: cell.row, columnName: column.name, value: source[column.name] })
	}
	return edits
}

export type PastePlan = {
	edits: CellEdit[]
	droppedCells: number
	droppedRows: number
	droppedColumns: number
}

/**
 * @name planPaste
 * @description Maps a pasted grid of values onto cells starting at `origin`
 * and counts what fell outside the loaded rows and columns, so the user can be
 * told how much was dropped.
 *
 * @example
 * planPaste([['a', 'b', 'c']], { row: 0, col: 1 }, 5, columns)
 * // { edits: [...2 edits], droppedCells: 1, droppedRows: 0, droppedColumns: 1 }
 */
export function planPaste(
	pasteRows: string[][],
	origin: CellPosition,
	rowCount: number,
	columns: ColumnDefinition[]
): PastePlan {
	const edits: CellEdit[] = []
	let droppedCells = 0
	let droppedRows = 0
	let widest = 0

	pasteRows.forEach((pasteRow, pasteRowIndex) => {
		if (pasteRow.length === 1 && pasteRow[0] === '') return
		widest = Math.max(widest, pasteRow.length)
		const rowIndex = origin.row + pasteRowIndex
		if (rowIndex >= rowCount) {
			droppedRows++
			droppedCells += pasteRow.length
			return
		}
		pasteRow.forEach((value, pasteColIndex) => {
			const column = columns[origin.col + pasteColIndex]
			if (!column) {
				droppedCells++
				return
			}
			edits.push({ rowIndex, columnName: column.name, value })
		})
	})

	const droppedColumns = Math.max(0, origin.col + widest - columns.length)
	return { edits, droppedCells, droppedRows, droppedColumns }
}

/**
 * @name describePasteDrop
 * @description Words the notice for a paste that was clipped. Returns null
 * when everything fit.
 *
 * @example
 * describePasteDrop({ edits, droppedCells: 8, droppedRows: 2, droppedColumns: 1 })
 * // 'Pasted 12 cells. 8 cells did not fit: 2 rows and 1 column are outside the grid.'
 */
export function describePasteDrop(plan: PastePlan): string | null {
	if (plan.droppedCells === 0) return null
	const outside: string[] = []
	if (plan.droppedRows > 0) outside.push(pluralize(plan.droppedRows, 'row'))
	if (plan.droppedColumns > 0) outside.push(pluralize(plan.droppedColumns, 'column'))
	const verb = plan.droppedRows + plan.droppedColumns === 1 ? 'is' : 'are'
	return (
		`Pasted ${pluralize(plan.edits.length, 'cell')}. ` +
		`${pluralize(plan.droppedCells, 'cell')} did not fit: ` +
		`${outside.join(' and ')} ${verb} outside the grid.`
	)
}

export type ColumnFill = {
	columnName: string
	rowIndexes: number[]
}

/**
 * @name planFillSelection
 * @description Groups the selected cells by column for writing one value into
 * all of them, one batch per column. Primary keys are left alone.
 *
 * @example
 * planFillSelection(new Set(['0:1', '1:1', '1:2']), columns)
 * // [{ columnName: 'name', rowIndexes: [0, 1] }, { columnName: 'email', rowIndexes: [1] }]
 */
export function planFillSelection(
	selectedCells: ReadonlySet<string>,
	columns: ColumnDefinition[]
): ColumnFill[] {
	const byColumn = new Map<string, number[]>()
	for (const key of selectedCells) {
		const cell = parseCellKey(key)
		const column = columns[cell.col]
		if (!column || column.primaryKey) continue
		const rowIndexes = byColumn.get(column.name) ?? []
		rowIndexes.push(cell.row)
		byColumn.set(column.name, rowIndexes)
	}
	return Array.from(byColumn, ([columnName, rowIndexes]) => ({
		columnName,
		rowIndexes: rowIndexes.sort((a, b) => a - b)
	}))
}
