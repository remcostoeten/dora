import { describe, expect, it } from 'vitest'
import { reconcileMigrations } from '@studio/features/orm-cockpit/migration/migration-status'
import type { JournalEntry } from '@studio/features/orm-cockpit/migration/read-journal'

const ENTRIES: JournalEntry[] = [
	{ idx: 0, tag: '0000_init', when: 1000 },
	{ idx: 1, tag: '0001_users', when: 2000 },
	{ idx: 2, tag: '0002_posts', when: 3000 },
]

describe('reconcileMigrations', function () {
	it('marks entries at or before lastApplied as applied (drizzle semantics)', function () {
		const status = reconcileMigrations(ENTRIES, 2000, false)
		expect(status.rows.map((r) => r.state)).toEqual(['applied', 'applied', 'pending'])
		expect(status.appliedCount).toBe(2)
		expect(status.pendingCount).toBe(1)
		expect(status.tableMissing).toBe(false)
	})

	it('treats everything as pending when the table is missing', function () {
		const status = reconcileMigrations(ENTRIES, null, true)
		expect(status.rows.every((r) => r.state === 'pending')).toBe(true)
		expect(status.appliedCount).toBe(0)
		expect(status.pendingCount).toBe(3)
		expect(status.tableMissing).toBe(true)
	})

	it('marks all applied when lastApplied is at/after the newest entry', function () {
		const status = reconcileMigrations(ENTRIES, 9999, false)
		expect(status.appliedCount).toBe(3)
		expect(status.pendingCount).toBe(0)
	})

	it('handles an empty journal', function () {
		const status = reconcileMigrations([], null, true)
		expect(status.rows).toEqual([])
		expect(status.appliedCount).toBe(0)
		expect(status.pendingCount).toBe(0)
	})
})
