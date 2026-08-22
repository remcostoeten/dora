import type { Connection } from '@studio/features/connections/types'
import { act, render } from '@testing-library/react'

import { beforeEach, describe, expect, it } from 'vitest'
import {
	openTab,
	setActiveNav,
	setCommandPaletteOpen,
	setConnections,
	setActiveTab
} from './actions'
import { resetWorkspaceStore, workspaceStore } from './store'
import { useActiveTabId, useConnectionList, useVisibleTabs } from './selectors'
import { useWorkspaceSelector } from './use-workspace'
import type { TableSnapshot } from './types'

/**
 * The store half of the contract's render-invariant table
 * (`docs/performance-contract.md`). Playwright asserts the DOM-level
 * invariants — no view remount, no shell commit on a keystroke; these assert
 * the property that makes them achievable: a consumer commits only when the
 * data it actually selected moved.
 */

function connection(id: string, name = id): Connection {
	return { id, name, type: 'sqlite', status: 'idle', createdAt: 0 } as Connection
}

function snapshot(connectionId: string, tableId: string): TableSnapshot {
	return {
		connectionId,
		tableId,
		columns: [],
		rows: [],
		totalCount: 0,
		visibleColumns: [],
		offset: 0,
		limit: 50,
		fetchedAt: 0
	}
}

type Probe = { renders: number }

function probe(): Probe {
	return { renders: 0 }
}

function countRender(target: Probe): void {
	target.renders += 1
}

describe('workspace store render invariants', () => {
	beforeEach(() => {
		resetWorkspaceStore()
	})

	it('does not re-render a connections consumer when tabs change', () => {
		const connectionsProbe = probe()

		function ConnectionsConsumer() {
			useConnectionList()
			countRender(connectionsProbe)
			return null
		}

		render(<ConnectionsConsumer />)
		const baseline = connectionsProbe.renders

		act(() => {
			openTab({ connectionId: 'a', tableId: 'users', tableName: 'users', label: 'users' })
		})

		expect(connectionsProbe.renders).toBe(baseline)
	})

	it('does not re-render a tabs consumer when connections load', () => {
		const tabsProbe = probe()

		function TabsConsumer() {
			useVisibleTabs()
			countRender(tabsProbe)
			return null
		}

		render(<TabsConsumer />)
		const baseline = tabsProbe.renders

		act(() => {
			setConnections([connection('a'), connection('b')])
		})

		expect(tabsProbe.renders).toBe(baseline)
	})

	it('does not re-render the shell chrome when a table snapshot lands', () => {
		const navProbe = probe()

		function NavConsumer() {
			useWorkspaceSelector(function (state) {
				return state.uiChrome.activeNavId
			})
			countRender(navProbe)
			return null
		}

		render(<NavConsumer />)
		const baseline = navProbe.renders

		act(() => {
			workspaceStore.dispatch({
				type: 'tableSnapshots/put',
				snapshot: snapshot('a', 'public.users')
			})
		})

		expect(navProbe.renders).toBe(baseline)
	})

	it('does not re-render a tab-list consumer when only the active tab changes', () => {
		act(() => {
			openTab({ connectionId: 'a', tableId: 'users', tableName: 'users', label: 'users' })
			openTab({ connectionId: 'a', tableId: 'posts', tableName: 'posts', label: 'posts' })
		})
		const firstTabId = workspaceStore.getState().tabs.tabs[0].id

		const listProbe = probe()
		const activeProbe = probe()

		function TabList() {
			useVisibleTabs()
			countRender(listProbe)
			return null
		}

		function ActiveTab() {
			useActiveTabId()
			countRender(activeProbe)
			return null
		}

		render(
			<>
				<TabList />
				<ActiveTab />
			</>
		)
		const listBaseline = listProbe.renders
		const activeBaseline = activeProbe.renders

		act(() => {
			setActiveTab(firstTabId)
		})

		expect(listProbe.renders).toBe(listBaseline)
		expect(activeProbe.renders).toBe(activeBaseline + 1)
	})

	it('does not re-render data consumers when a dialog opens', () => {
		const dataProbe = probe()

		function DataConsumer() {
			useConnectionList()
			useVisibleTabs()
			countRender(dataProbe)
			return null
		}

		render(<DataConsumer />)
		const baseline = dataProbe.renders

		act(() => {
			setCommandPaletteOpen(true)
		})

		expect(dataProbe.renders).toBe(baseline)
	})

	it('does not re-render when a write leaves the selected value unchanged', () => {
		const navProbe = probe()

		function NavConsumer() {
			useWorkspaceSelector(function (state) {
				return state.uiChrome.activeNavId
			})
			countRender(navProbe)
			return null
		}

		render(<NavConsumer />)
		const baseline = navProbe.renders

		act(() => {
			setActiveNav('database-studio')
		})

		expect(navProbe.renders).toBe(baseline)
	})

	it('re-renders a connection-name consumer only when that connection changes', () => {
		act(() => {
			setConnections([connection('a', 'Alpha'), connection('b', 'Beta')])
		})

		const nameProbe = probe()

		function ConnectionName() {
			useWorkspaceSelector(function (state) {
				return state.connections.byId.a?.name
			})
			countRender(nameProbe)
			return null
		}

		render(<ConnectionName />)
		const baseline = nameProbe.renders

		act(() => {
			setConnections([connection('a', 'Alpha'), connection('b', 'Renamed')])
		})
		expect(nameProbe.renders).toBe(baseline)

		act(() => {
			setConnections([connection('a', 'Renamed'), connection('b', 'Renamed')])
		})
		expect(nameProbe.renders).toBe(baseline + 1)
	})
})
