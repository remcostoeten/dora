import { areValuesEqual } from '@studio/shared/utils/value-equality'
import type { TableData } from '../types'
import { normalizeValueForInsert } from './studio-data'

export type RequestedCellEdit = {
	rowIndex: number
	columnName: string
	value: unknown
}

export type CellChange = {
	rowIndex: number
	primaryKeyValue: unknown
	columnName: string
	previousValue: unknown
	requestedValue: unknown
	newValue: unknown
}

/**
 * @name resolveCellChanges
 * @description Turns edits addressed by row index into changes addressed by
 * primary key. Each value is normalized once with `normalizeValueForInsert`,
 * edits that change nothing are dropped, and a later edit to the same cell
 * replaces an earlier one.
 *
 * @example
 * resolveCellChanges([{ rowIndex: 0, columnName: 'name', value: 'Ada' }], tableData, 'id')
 * // [{ rowIndex: 0, primaryKeyValue: 1, columnName: 'name', previousValue: 'Bob', requestedValue: 'Ada', newValue: 'Ada' }]
 */
export function resolveCellChanges(
	edits: RequestedCellEdit[],
	tableData: TableData,
	primaryKeyColumn: string
): CellChange[] {
	const changes = new Map<string, CellChange>()
	for (const edit of edits) {
		const row = tableData.rows[edit.rowIndex]
		const column = tableData.columns.find((candidate) => candidate.name === edit.columnName)
		if (!row || !column) continue
		const newValue = normalizeValueForInsert(column, edit.value)
		const key = `${edit.rowIndex}:${edit.columnName}`
		if (areValuesEqual(row[edit.columnName], newValue)) {
			changes.delete(key)
			continue
		}
		changes.set(key, {
			rowIndex: edit.rowIndex,
			primaryKeyValue: row[primaryKeyColumn],
			columnName: edit.columnName,
			previousValue: row[edit.columnName],
			requestedValue: edit.value,
			newValue
		})
	}
	return Array.from(changes.values())
}
