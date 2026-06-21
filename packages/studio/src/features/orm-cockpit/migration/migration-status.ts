/**
 * Reconcile a repo's migration journal against what the live database has
 * applied. Mirrors Drizzle's own migrator semantics: it stamps each applied
 * migration's `when` into the `__drizzle_migrations` table and, on the next run,
 * applies every journal entry whose `when` is greater than the latest applied
 * timestamp. So an entry is "applied" iff `entry.when <= lastApplied`.
 *
 * Pure and dialect-agnostic — the SQL that fetches `lastApplied` lives in
 * `query-applied.ts`; this just folds the two sides together.
 */

import type { JournalEntry } from '@studio/features/orm-cockpit/migration/read-journal'

export type MigrationState = 'applied' | 'pending'

export type MigrationStatusRow = {
	idx: number
	tag: string
	when: number
	state: MigrationState
}

export type MigrationStatus = {
	rows: MigrationStatusRow[]
	appliedCount: number
	pendingCount: number
	/**
	 * True when the live DB has no `__drizzle_migrations` table (or it was
	 * unreadable). Every entry is then treated as pending and the UI can explain
	 * that no migrations have been applied to this database yet.
	 */
	tableMissing: boolean
}

/**
 * @param lastApplied the maximum `created_at` (epoch ms) in the live
 *   `__drizzle_migrations` table, or null when the table is missing/empty.
 */
export function reconcileMigrations(
	entries: JournalEntry[],
	lastApplied: number | null,
	tableMissing: boolean,
): MigrationStatus {
	let appliedCount = 0
	const rows = entries.map(function (entry): MigrationStatusRow {
		const applied = lastApplied !== null && entry.when <= lastApplied
		if (applied) {
			appliedCount++
		}
		return {
			idx: entry.idx,
			tag: entry.tag,
			when: entry.when,
			state: applied ? 'applied' : 'pending',
		}
	})

	return {
		rows,
		appliedCount,
		pendingCount: rows.length - appliedCount,
		tableMissing,
	}
}
