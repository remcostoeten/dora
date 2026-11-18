import { fuzzyMatchScore } from '@studio/features/command-palette/fuzzy-match'
import { ColumnDefinition } from '../../types'
import { CellPosition } from './types'

export type GoToQuery = {
	row: string | null
	column: string | null
}

export type GoToContext = {
	columns: ColumnDefinition[]
	focusedCell: CellPosition | null
	loadedRowCount: number
	rowNumberOffset: number
	totalRowCount: number
}

export type GoToResult =
	| { status: 'empty' }
	| { status: 'error'; message: string }
	| {
			status: 'ok'
			absoluteRow: number
			col: number
			isLoaded: boolean
			label: string
	  }

/**
 * @name parseGoToQuery
 * @description Splits go-to-cell input into a row part and a column part.
 * `120` is a row, `email` a column, `120:email` and `120,3` both, and a
 * leading separator such as `:2024` forces a column whose name is a number.
 *
 * @example
 * parseGoToQuery('120:email') // { row: '120', column: 'email' }
 */
export function parseGoToQuery(input: string): GoToQuery {
	const text = input.trim()
	// The first colon or comma separates the row from the column.
	const separator = text.search(/[:,]/)
	if (separator === -1) {
		if (text === '') return { row: null, column: null }
		// Digits alone are a row number.
		return /^\d+$/.test(text) ? { row: text, column: null } : { row: null, column: text }
	}
	const row = text.slice(0, separator).trim()
	const column = text.slice(separator + 1).trim()
	return { row: row === '' ? null : row, column: column === '' ? null : column }
}

/**
 * @name findColumnIndex
 * @description Resolves a column token to a column index. An exact name wins,
 * then a 1-based column number, then the best fuzzy match on the names.
 * Returns -1 when nothing matches.
 *
 * @example
 * findColumnIndex([{ name: 'id' }, { name: 'email_address' }], 'eml') // 1
 */
export function findColumnIndex(columns: Pick<ColumnDefinition, 'name'>[], token: string): number {
	const wanted = token.trim().toLowerCase()
	if (wanted === '') return -1

	const exact = columns.findIndex((column) => column.name.toLowerCase() === wanted)
	if (exact !== -1) return exact

	// Digits alone are a 1-based column position.
	if (/^\d+$/.test(wanted)) {
		const position = Number(wanted)
		return position >= 1 && position <= columns.length ? position - 1 : -1
	}

	let bestIndex = -1
	let bestScore = Number.NEGATIVE_INFINITY
	columns.forEach((column, index) => {
		const score = fuzzyMatchScore(wanted, column.name)
		if (score !== null && score > bestScore) {
			bestScore = score
			bestIndex = index
		}
	})
	return bestIndex
}

/**
 * @name resolveGoToTarget
 * @description Turns go-to-cell input into a target cell. Row numbers are
 * 1-based and absolute across pages, so the result says whether the row is in
 * the loaded page or has to be requested from the owner. A column on its own
 * keeps the focused row, a row on its own keeps the focused column.
 *
 * @example
 * resolveGoToTarget('120:email', context)
 * // { status: 'ok', absoluteRow: 119, col: 2, isLoaded: false, label: 'Row 120, column email' }
 */
export function resolveGoToTarget(input: string, context: GoToContext): GoToResult {
	const query = parseGoToQuery(input)
	if (query.row === null && query.column === null) return { status: 'empty' }
	if (context.columns.length === 0) return { status: 'error', message: 'The grid has no columns' }

	const current = context.focusedCell
	let absoluteRow = context.rowNumberOffset + (current?.row ?? 0)
	if (query.row !== null) {
		// Row numbers are whole and start at 1.
		if (!/^\d+$/.test(query.row) || Number(query.row) < 1) {
			return { status: 'error', message: `"${query.row}" is not a row number` }
		}
		absoluteRow = Number(query.row) - 1
	}
	if (absoluteRow >= context.totalRowCount) {
		return {
			status: 'error',
			message:
				context.totalRowCount === 0
					? 'The table has no rows'
					: `Row ${absoluteRow + 1} is past the last row (${context.totalRowCount})`
		}
	}

	let col = current?.col ?? 0
	if (query.column !== null) {
		col = findColumnIndex(context.columns, query.column)
		if (col === -1) return { status: 'error', message: `No column matches "${query.column}"` }
	}

	const loadedIndex = absoluteRow - context.rowNumberOffset
	return {
		status: 'ok',
		absoluteRow,
		col,
		isLoaded: loadedIndex >= 0 && loadedIndex < context.loadedRowCount,
		label: `Row ${absoluteRow + 1}, column ${context.columns[col].name}`
	}
}
