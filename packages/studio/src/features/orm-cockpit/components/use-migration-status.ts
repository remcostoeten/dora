/**
 * Loads the Drizzle *migration status* for the linked project: which migrations
 * exist in the repo's journal and which the live database has applied. This is
 * the "read my migrations" companion to the drift view — it reads
 * `<out>/meta/_journal.json` and the live `__drizzle_migrations` table and
 * reconciles them (see `migration-status.ts`).
 *
 * Drizzle-only for now; Prisma surfaces an unsupported note. Re-runs whenever
 * the linked folder, connection, or dialect changes.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdapter } from '@studio/core/data-provider'
import type { Dialect } from '@studio/features/orm-cockpit/ir/types'
import type { DetectedOrm } from '@studio/features/orm-cockpit/link/detect-orm'
import { readDrizzleJournal } from '@studio/features/orm-cockpit/link/link-api'
import { queryLastAppliedMigration } from '@studio/features/orm-cockpit/migration/query-applied'
import {
	reconcileMigrations,
	type MigrationStatus,
} from '@studio/features/orm-cockpit/migration/migration-status'

export type MigrationStatusState = {
	loading: boolean
	/** Reconciled status, or null before the first load / when unavailable. */
	status: MigrationStatus | null
	/** Non-fatal explanation when there's nothing to show (no journal, Prisma, …). */
	note: string | null
	reload: () => void
}

type Args = {
	folder: string | null
	configPath: string | undefined
	orm: DetectedOrm | null
	connectionId: string | undefined
	dialect: Dialect
}

export function useMigrationStatus({
	folder,
	configPath,
	orm,
	connectionId,
	dialect,
}: Args): MigrationStatusState {
	const adapter = useAdapter()
	const [loading, setLoading] = useState(false)
	const [status, setStatus] = useState<MigrationStatus | null>(null)
	const [note, setNote] = useState<string | null>(null)
	const runIdRef = useRef(0)

	const load = useCallback(
		async function () {
			const runId = ++runIdRef.current
			setStatus(null)
			setNote(null)

			if (!folder || !orm) {
				return
			}
			if (orm !== 'drizzle') {
				setNote('Migration status is currently only available for Drizzle projects.')
				return
			}
			if (!connectionId) {
				setNote('Select a database connection to see which migrations are applied.')
				return
			}

			setLoading(true)
			try {
				const journal = await readDrizzleJournal(folder, configPath)
				if (runId !== runIdRef.current) return

				if (journal.entries.length === 0) {
					setNote(
						'No migration journal found. Run `drizzle-kit generate` to create migrations, or this project may use push-style sync (see the Drift tab).',
					)
					return
				}

				const applied = await queryLastAppliedMigration(adapter, connectionId, dialect)
				if (runId !== runIdRef.current) return

				setStatus(
					reconcileMigrations(journal.entries, applied.lastApplied, applied.tableMissing),
				)
			} finally {
				if (runId === runIdRef.current) {
					setLoading(false)
				}
			}
		},
		[adapter, folder, configPath, orm, connectionId, dialect],
	)

	useEffect(
		function () {
			void load()
		},
		[load],
	)

	return { loading, status, note, reload: load }
}
