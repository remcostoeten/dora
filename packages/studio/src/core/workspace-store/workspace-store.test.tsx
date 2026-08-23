import type { Connection } from '@studio/features/connections/types'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { openTab, setActiveConnection, setConnections } from './actions'
import { selectTableSnapshot } from './selectors'
import { createWorkspaceStore, readWorkspace, resetWorkspaceStore, workspaceStore } from './store'
import { useWorkspaceSelector } from './use-workspace'
import { tableSnapshotKey, type TableSnapshot } from './types'

function connection(id: string, name = id): Connection {
	return { id, name, type: 'sqlite', status: 'idle', createdAt: 0 } as Connection
}

function snapshot(connectionId: string, tableId: string): TableSnapshot {
	return {
		connectionId,
		tableId,
		columns: [{ name: 'id', type: 'integer', nullable: false, primaryKey: true }],
		rows: [{ id: 1 }],
		totalCount: 1,
		visibleColumns: ['id'],
		offset: 0,
		limit: 50,
		fetchedAt: 0
	}
}

describe('workspace store', () => {
	beforeEach(() => {
		resetWorkspaceStore()
	})

	it('keeps the same state object when an action changes nothing', () => {
		setConnections([connection('a')])
		const before = readWorkspace()
		setConnections([connection('a')])
		expect(readWorkspace()).toBe(before)
	})

	it('reuses connection objects across an identical refetch', () => {
		setConnections([connection('a'), connection('b')])
		const first = readWorkspace().connections.byId.a
		setConnections([connection('a'), connection('b')])
		expect(readWorkspace().connections.byId.a).toBe(first)
	})

	it('leaves untouched slices referentially identical', () => {
		setConnections([connection('a')])
		const tabsBefore = readWorkspace().tabs
		setConnections([connection('a'), connection('b')])
		expect(readWorkspace().tabs).toBe(tabsBefore)
	})

	it('opening a tab opens and activates its connection', () => {
		openTab({ connectionId: 'a', tableId: 'public.users', tableName: 'users', label: 'users' })
		const { tabs } = readWorkspace()
		expect(tabs.openConnectionIds).toEqual(['a'])
		expect(tabs.activeConnectionId).toBe('a')
		expect(tabs.activeTabByConnection.a).toBe(tabs.tabs[0].id)
	})

	it('restores the previously focused tab when switching back to a connection', () => {
		openTab({ connectionId: 'a', tableId: 'public.users', tableName: 'users', label: 'users' })
		const tabInA = readWorkspace().tabs.tabs[0].id
		openTab({ connectionId: 'b', tableId: 'public.posts', tableName: 'posts', label: 'posts' })
		setActiveConnection('a')
		expect(readWorkspace().tabs.activeTabByConnection.a).toBe(tabInA)
	})

	it('reads a cached table snapshot synchronously', () => {
		const entry = snapshot('a', 'public.users')
		workspaceStore.dispatch({ type: 'tableSnapshots/put', snapshot: entry })
		expect(selectTableSnapshot(readWorkspace(), 'a', 'public.users')).toBe(entry)
		expect(readWorkspace().tableSnapshots.byKey[tableSnapshotKey('a', 'public.users')]).toBe(
			entry
		)
	})

	it('drops only the snapshots of the connection that closed', () => {
		workspaceStore.dispatch({ type: 'tableSnapshots/put', snapshot: snapshot('a', 'users') })
		workspaceStore.dispatch({ type: 'tableSnapshots/put', snapshot: snapshot('b', 'users') })
		workspaceStore.dispatch({ type: 'tableSnapshots/dropForConnection', connectionId: 'a' })
		expect(selectTableSnapshot(readWorkspace(), 'a', 'users')).toBeUndefined()
		expect(selectTableSnapshot(readWorkspace(), 'b', 'users')).toBeDefined()
	})

	it('isolates stores created for tests from the app singleton', () => {
		const store = createWorkspaceStore()
		store.dispatch({ type: 'connections/set', connections: [connection('x')] })
		expect(store.getState().connections.ids).toEqual(['x'])
		expect(readWorkspace().connections.ids).toEqual([])
	})

	it('gives a selector hook the current value without an extra render pass', () => {
		setConnections([connection('a', 'Alpha')])
		const { result } = renderHook(() =>
			useWorkspaceSelector(function (state) {
				return state.connections.byId.a?.name
			})
		)
		expect(result.current).toBe('Alpha')

		act(() => {
			setConnections([connection('a', 'Beta')])
		})
		expect(result.current).toBe('Beta')
	})
})
