import { areValuesEqual } from '@studio/shared/utils/value-equality'
import type { TableData } from '../types'

type PlainRecord = Record<string, unknown>

function isSameRecord(previous: PlainRecord, next: PlainRecord): boolean {
	if (previous === next) return true
	let count = 0
	for (const key in previous) {
		count += 1
		if (!(key in next)) return false
		if (!areValuesEqual(previous[key], next[key])) return false
	}
	return count === Object.keys(next).length
}

function reconcileList<Item extends PlainRecord>(previous: Item[], next: Item[]): Item[] {
	if (previous === next) return previous
	let reused = 0
	const merged = next.map(function (item, index) {
		const before = previous[index]
		if (before !== undefined && isSameRecord(before, item)) {
			reused += 1
			return before
		}
		return item
	})
	return reused === next.length && previous.length === next.length ? previous : merged
}

/**
 * @name reconcileTableData
 * @description Merges freshly fetched table data into what the grid already
 * shows, keeping the previous object wherever the values are equal: an
 * unchanged row keeps its identity, an unchanged row or column list keeps its
 * array, and a fetch that changed nothing returns `previous` itself. Memoized
 * rows then skip re-rendering, and a refresh that found no difference commits
 * nothing. The execution time of an identical fetch is ignored, except when the
 * data on screen came from a snapshot that carried none.
 *
 * @example
 * const next = reconcileTableData(tableData, result.data)
 * if (next !== tableData) setTableData(next)
 */
export function reconcileTableData(previous: TableData | null, next: TableData): TableData {
	if (!previous) return next
	if (previous === next) return previous

	const columns = reconcileList(previous.columns, next.columns)
	const rows = reconcileList(previous.rows, next.rows)
	const isUnchanged =
		columns === previous.columns &&
		rows === previous.rows &&
		previous.totalCount === next.totalCount

	if (isUnchanged) {
		if (previous.executionTime === 0 && next.executionTime !== 0) {
			return { ...previous, executionTime: next.executionTime }
		}
		return previous
	}

	return { ...next, columns, rows }
}
