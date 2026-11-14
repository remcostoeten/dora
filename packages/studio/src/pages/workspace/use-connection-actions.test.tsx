import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DataProvider } from '@studio/core/data-provider'
import { SettingsProvider } from '@studio/core/settings'
import {
	openTab,
	readWorkspace,
	resetWorkspaceStore,
	setActiveConnection,
	setActiveNav,
	setConnections
} from '@studio/core/workspace-store'
import type { Connection } from '@studio/features/connections/types'
import { useConnectionActions, type ConnectionActions } from './use-connection-actions'

function connection(id: string): Connection {
	return { id, name: id, type: 'sqlite', status: 'idle', createdAt: 0 }
}

type Probe = { renders: number; seen: Set<ConnectionActions>; actions: ConnectionActions | null }

function renderProbe() {
	const probe: Probe = { renders: 0, seen: new Set(), actions: null }
	function Consumer() {
		const actions = useConnectionActions()
		probe.renders += 1
		probe.seen.add(actions)
		probe.actions = actions
		return null
	}
	const client = new QueryClient()
	const view = render(
		<QueryClientProvider client={client}>
			<SettingsProvider>
				<DataProvider forceMock>
					<Consumer />
				</DataProvider>
			</SettingsProvider>
		</QueryClientProvider>
	)
	return { probe, view }
}

describe('useConnectionActions', () => {
	beforeEach(() => {
		resetWorkspaceStore()
	})

	it('keeps one identity and does not re-render on connection, view or table changes', async () => {
		const { probe } = renderProbe()
		await waitFor(() => {
			expect(probe.actions).not.toBeNull()
		})
		await act(async () => {
			await Promise.resolve()
		})
		const baseline = probe.renders

		act(() => {
			setConnections([connection('a'), connection('b')])
			setActiveConnection('a')
		})
		act(() => {
			setActiveConnection('b')
			setActiveNav('sql-console')
			openTab({ connectionId: 'b', tableId: 'users', tableName: 'users', label: 'users' })
		})

		expect(probe.renders).toBe(baseline)
		expect(probe.seen.size).toBe(1)
	})

	it('selects a connection synchronously', async () => {
		const { probe } = renderProbe()
		await waitFor(() => {
			expect(probe.actions).not.toBeNull()
		})
		act(() => {
			setConnections([connection('a'), connection('b')])
			setActiveConnection('a')
		})

		act(() => {
			probe.actions?.handleConnectionSelect('b')
			expect(readWorkspace().tabs.activeConnectionId).toBe('b')
		})
	})

	it('reads the open connections when a close handler runs, not when it was created', async () => {
		const { probe } = renderProbe()
		await waitFor(() => {
			expect(probe.actions).not.toBeNull()
		})
		const actions = probe.actions
		act(() => {
			setConnections([connection('a'), connection('b'), connection('c')])
			setActiveConnection('a')
			setActiveConnection('b')
			setActiveConnection('c')
		})
		expect(readWorkspace().tabs.openConnectionIds).toEqual(['a', 'b', 'c'])

		act(() => {
			actions?.handleCloseConnectionsToLeft('c')
		})

		expect(readWorkspace().tabs.openConnectionIds).toEqual(['c'])
		expect(readWorkspace().tabs.activeConnectionId).toBe('c')
	})
})
