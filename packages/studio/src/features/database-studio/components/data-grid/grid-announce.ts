import { ColumnDefinition } from '../../types'

type CellAnnouncement = {
	column: Pick<ColumnDefinition, 'name'>
	rowNumber: number
	value: unknown
	masked: boolean
}

function pluralize(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * @name describeCellValue
 * @description Words a cell value for a screen reader. Privacy mode is checked
 * before the value is read, so a masked value never reaches the announcement.
 * NULL and an empty string are told apart, as they are on screen.
 *
 * @example
 * describeCellValue(null, false) // 'NULL'
 * describeCellValue('', false) // 'empty'
 * describeCellValue('secret', true) // 'hidden'
 */
export function describeCellValue(value: unknown, masked: boolean): string {
	if (masked) return 'hidden'
	if (value === null || value === undefined) return 'NULL'
	if (value === '') return 'empty'
	if (typeof value === 'object') return JSON.stringify(value)
	return String(value)
}

/**
 * @name describeFocusedCell
 * @description Words the focused cell as "column, row N, value".
 *
 * @example
 * describeFocusedCell({ column: { name: 'email' }, rowNumber: 120, value: null, masked: false })
 * // 'email, row 120, NULL'
 */
export function describeFocusedCell(cell: CellAnnouncement): string {
	const value = describeCellValue(cell.value, cell.masked)
	return `${cell.column.name}, row ${cell.rowNumber}, ${value}`
}

/**
 * @name describeFocusedHeader
 * @description Words the focused column header with its sort state.
 *
 * @example
 * describeFocusedHeader('email', 'asc') // 'email, column header, sorted ascending'
 */
export function describeFocusedHeader(columnName: string, sort?: 'asc' | 'desc'): string {
	const base = `${columnName}, column header`
	if (!sort) return base
	return `${base}, sorted ${sort === 'asc' ? 'ascending' : 'descending'}`
}

/**
 * @name describeCellSelection
 * @description Words a change in the number of selected cells. A single cell
 * is the focused cell and is not announced as a selection.
 *
 * @example
 * describeCellSelection(6) // '6 cells selected'
 */
export function describeCellSelection(count: number): string | null {
	return count > 1 ? `${pluralize(count, 'cell')} selected` : null
}

/**
 * @name describeRowSelection
 * @description Words a change in the number of checked rows.
 *
 * @example
 * describeRowSelection(3, 0) // '3 rows selected'
 * describeRowSelection(0, 3) // 'Row selection cleared'
 */
export function describeRowSelection(count: number, previousCount: number): string | null {
	if (count === previousCount) return null
	if (count === 0) return 'Row selection cleared'
	return `${pluralize(count, 'row')} selected`
}

/**
 * @name describeStagedCount
 * @description Words the number of edits staged in dry run mode.
 *
 * @example
 * describeStagedCount(3) // '3 edits staged'
 */
export function describeStagedCount(count: number): string {
	return count === 0 ? 'No edits staged' : `${pluralize(count, 'edit')} staged`
}

/**
 * @name describeApplyOutcome
 * @description Words the result of applying staged edits from the number
 * staged before and the number still staged after. Edits that are still
 * staged are the ones the database rejected.
 *
 * @example
 * describeApplyOutcome(3, 0) // '3 edits applied'
 * describeApplyOutcome(3, 1) // '2 of 3 edits applied, 1 failed and is still staged'
 */
export function describeApplyOutcome(stagedBefore: number, stagedAfter: number): string {
	const applied = Math.max(0, stagedBefore - stagedAfter)
	if (stagedAfter === 0) return `${pluralize(applied, 'edit')} applied`
	const verb = stagedAfter === 1 ? 'is' : 'are'
	return `${applied} of ${pluralize(stagedBefore, 'edit')} applied, ${stagedAfter} failed and ${verb} still staged`
}

/**
 * @name describeDeletedRows
 * @description Words the number of rows a delete removed.
 *
 * @example
 * describeDeletedRows(2) // '2 rows deleted'
 */
export function describeDeletedRows(count: number): string {
	return `${pluralize(count, 'row')} deleted`
}
