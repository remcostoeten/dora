import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	configureTableSnapshotPersistence,
	putTableSnapshot,
	readTableSnapshot,
	resetWorkspaceStore
} from '@studio/core/workspace-store'
import type { TableSnapshot } from '@studio/core/workspace-store'
import {
	DEFAULT_PAGE_LIMIT,
	EMPTY_FILTER_GROUP
} from '@studio/features/database-studio/utils/table-snapshot'

const STORAGE_KEY = 'dora.table-snapshots.v1'

function snapshot(overrides: Partial<TableSnapshot> = {}): TableSnapshot {
	return {
		connectionId: 'conn-1',
		tableId: 'users',
		columns: [{ name: 'id', data_type: 'INTEGER' } as TableSnapshot['columns'][number]],
		rows: [{ id: 1 }],
		totalCount: 1,
		visibleColumns: ['id'],
		offset: 0,
		limit: DEFAULT_PAGE_LIMIT,
		sort: undefined,
		filters: [],
		conjunction: 'AND',
		filterGroup: EMPTY_FILTER_GROUP,
		fetchedAt: 1000,
		...overrides
	}
}

describe('snapshot persistence', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		window.localStorage.clear()
		resetWorkspaceStore()
	})

	afterEach(() => {
		configureTableSnapshotPersistence(false)
		window.localStorage.clear()
		resetWorkspaceStore()
		vi.useRealTimers()
	})

	it('mirrors default-page snapshots to localStorage', () => {
		configureTableSnapshotPersistence(true)
		putTableSnapshot(snapshot())
		vi.advanceTimersByTime(600)

		const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
		expect(stored).toHaveLength(1)
		expect(stored[0].tableId).toBe('users')
	})

	it('does not mirror filtered or paged snapshots', () => {
		configureTableSnapshotPersistence(true)
		putTableSnapshot(snapshot({ tableId: 'paged', offset: 50 }))
		putTableSnapshot(
			snapshot({
				tableId: 'sorted',
				sort: { column: 'id', direction: 'asc' } as TableSnapshot['sort']
			})
		)
		vi.advanceTimersByTime(600)

		const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
		expect(stored).toEqual([])
	})

	it('hydrates persisted snapshots back into the store', () => {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify([snapshot()]))
		configureTableSnapshotPersistence(true)

		const restored = readTableSnapshot('conn-1', 'users')
		expect(restored?.rows).toEqual([{ id: 1 }])
	})

	it('caps the mirror at 20 entries, newest first', () => {
		configureTableSnapshotPersistence(true)
		for (let i = 0; i < 25; i++) {
			putTableSnapshot(snapshot({ tableId: `table-${i}`, fetchedAt: i }))
		}
		vi.advanceTimersByTime(600)

		const stored: TableSnapshot[] = JSON.parse(
			window.localStorage.getItem(STORAGE_KEY) ?? '[]'
		)
		expect(stored).toHaveLength(20)
		expect(stored[0].tableId).toBe('table-24')
		expect(stored.map((s) => s.tableId)).not.toContain('table-0')
	})

	it('disabling clears the stored data and stops mirroring', () => {
		configureTableSnapshotPersistence(true)
		putTableSnapshot(snapshot())
		vi.advanceTimersByTime(600)
		expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()

		configureTableSnapshotPersistence(false)
		expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()

		putTableSnapshot(snapshot({ tableId: 'after-disable' }))
		vi.advanceTimersByTime(600)
		expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
	})

	it('ignores malformed stored data', () => {
		window.localStorage.setItem(STORAGE_KEY, '{not json')
		configureTableSnapshotPersistence(true)
		expect(readTableSnapshot('conn-1', 'users')).toBeUndefined()
	})
})
