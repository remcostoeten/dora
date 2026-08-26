import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TableData } from '../types'

/** How long a freshly inserted row stays tinted, measured from its last repaint. */
const HIGHLIGHT_DURATION_MS = 4000
/** Ceiling on the whole highlight, so a churning grid can't keep it alive forever. */
const MAX_HIGHLIGHT_DURATION_MS = 15000

const NO_HIGHLIGHTED_ROWS: ReadonlySet<number> = new Set<number>()

function rowKey(row: Record<string, unknown>, primaryKeyColumnName: string): string | null {
	const value = row[primaryKeyColumnName]
	if (value === null || value === undefined) return null
	return String(value)
}

type RecentlyAddedRows = {
	/** Indexes into `tableData.rows` that arrived since the last `markRowsAdded`. */
	highlightedRowIndexes: ReadonlySet<number>
	/** Call immediately before an optimistic insert paints its rows. */
	markRowsAdded: () => void
}

/**
 * Tracks which rows in the grid are new, so an insert can be pointed out after
 * it lands. Rows are identified by primary key against a baseline snapshotted
 * at `markRowsAdded` time: an optimistically painted copy has no key yet and
 * reads as new, and so does the authoritative row that replaces it once the
 * reload assigns its generated key — the highlight survives the swap without
 * the caller tracking either.
 *
 * Tables without a primary key cannot be diffed across a reload, so they get no
 * highlight rather than a wrong one.
 */
export function useRecentlyAddedRows(
	tableData: TableData | null,
	primaryKeyColumnName: string | undefined
): RecentlyAddedRows {
	const [baselineKeys, setBaselineKeys] = useState<ReadonlySet<string> | null>(null)
	const tableDataRef = useRef(tableData)
	tableDataRef.current = tableData

	const markRowsAdded = useCallback(
		function markRowsAdded() {
			const current = tableDataRef.current
			if (!current || !primaryKeyColumnName) return
			const keys = new Set<string>()
			for (const row of current.rows) {
				const key = rowKey(row, primaryKeyColumnName)
				if (key !== null) keys.add(key)
			}
			setBaselineKeys(keys)
		},
		[primaryKeyColumnName]
	)

	const highlightedRowIndexes = useMemo(
		function collectNewRowIndexes() {
			if (!baselineKeys || !tableData || !primaryKeyColumnName) return NO_HIGHLIGHTED_ROWS
			const indexes = new Set<number>()
			tableData.rows.forEach(function (row, index) {
				const key = rowKey(row, primaryKeyColumnName)
				if (key === null || !baselineKeys.has(key)) indexes.add(index)
			})
			return indexes
		},
		[baselineKeys, primaryKeyColumnName, tableData]
	)

	useEffect(
		function fadeHighlightOut() {
			if (!baselineKeys) return
			// Restarted by every repaint while tracking, so the countdown runs from
			// the moment the authoritative rows land rather than from the optimistic
			// paint that preceded them.
			const timer = setTimeout(function () {
				setBaselineKeys(null)
			}, HIGHLIGHT_DURATION_MS)
			return function () {
				clearTimeout(timer)
			}
		},
		[baselineKeys, tableData]
	)

	useEffect(
		function capHighlightLifetime() {
			if (!baselineKeys) return
			const timer = setTimeout(function () {
				setBaselineKeys(null)
			}, MAX_HIGHLIGHT_DURATION_MS)
			return function () {
				clearTimeout(timer)
			}
		},
		[baselineKeys]
	)

	return { highlightedRowIndexes, markRowsAdded }
}
