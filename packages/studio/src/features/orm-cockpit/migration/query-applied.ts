/**
 * Read the latest applied migration timestamp from the live Drizzle bookkeeping
 * table (`__drizzle_migrations`). Drizzle stores an epoch-ms `created_at` per
 * applied migration; the max of that column is all {@link reconcileMigrations}
 * needs to classify journal entries as applied/pending.
 *
 * The table's location differs by dialect (Postgres defaults to a dedicated
 * `drizzle` schema; MySQL/SQLite put it in the connected database), and a fresh
 * DB simply has no such table — so we try a few candidate queries and treat
 * "all failed" as "table missing → nothing applied yet" rather than an error.
 */

import type { DataAdapter } from '@studio/core/data-provider/types'
import type { Dialect } from '@studio/features/orm-cockpit/ir/types'

export type AppliedResult = {
	/** Max `created_at` (epoch ms) across applied migrations, or null. */
	lastApplied: number | null
	/** True when no `__drizzle_migrations` table could be read. */
	tableMissing: boolean
}

/** Candidate `__drizzle_migrations` locations to probe, in priority order. */
function candidateQueries(dialect: Dialect): string[] {
	if (dialect === 'postgres') {
		return [
			// Drizzle's default migrations schema, then a public-schema fallback.
			'SELECT MAX(created_at) AS last_applied FROM drizzle."__drizzle_migrations"',
			'SELECT MAX(created_at) AS last_applied FROM "__drizzle_migrations"',
		]
	}
	if (dialect === 'mysql') {
		return ['SELECT MAX(created_at) AS last_applied FROM `__drizzle_migrations`']
	}
	return ['SELECT MAX(created_at) AS last_applied FROM "__drizzle_migrations"']
}

export async function queryLastAppliedMigration(
	adapter: DataAdapter,
	connectionId: string,
	dialect: Dialect,
): Promise<AppliedResult> {
	for (const sql of candidateQueries(dialect)) {
		let ok = false
		let value: unknown
		try {
			const result = await adapter.executeQuery(connectionId, sql)
			if (result.ok && !result.data.error) {
				ok = true
				value = result.data.rows[0]?.last_applied
			}
		} catch {
			// Try the next candidate.
		}
		if (ok) {
			return { lastApplied: toEpochMs(value), tableMissing: false }
		}
	}
	return { lastApplied: null, tableMissing: true }
}

/** Coerce a `created_at` cell (number, bigint string, …) to epoch ms, or null. */
function toEpochMs(value: unknown): number | null {
	if (value === null || value === undefined) {
		return null
	}
	const n = typeof value === 'number' ? value : Number(value)
	return Number.isFinite(n) ? n : null
}
