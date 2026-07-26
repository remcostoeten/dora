import type { PendingEdit } from './pending-edits-store'

/**
 * Repaints buffered dry-mode edits over rows freshly loaded from the
 * database. Every reload path (table switch, page/sort/filter change,
 * live-monitor refresh) replaces the grid rows with database values; without
 * this overlay the grid would show the original values while the
 * pending-changes bar still counts N unsaved edits, and Apply would write
 * values the user can no longer see. Rows are matched by primary key, so
 * edits whose row is not on the current page stay buffered but untouched.
 */
export function overlayPendingEditsOnRows(
	rows: Record<string, unknown>[],
	edits: PendingEdit[]
): Record<string, unknown>[] {
	if (edits.length === 0) return rows

	return rows.map(function (row) {
		const matching = edits.filter(function (edit) {
			return row[edit.primaryKeyColumn] === edit.primaryKeyValue
		})
		if (matching.length === 0) return row

		const patched = { ...row }
		for (const edit of matching) {
			patched[edit.columnName] = edit.newValue
		}
		return patched
	})
}
