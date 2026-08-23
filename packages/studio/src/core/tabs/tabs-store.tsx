import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
	activeTabIdOf,
	closeConnection,
	closeOtherTabs,
	closeTab,
	closeTabsForConnection,
	closeTabsToLeft,
	closeTabsToRight,
	hydrateTabSession,
	openConnection,
	openTab,
	replaceTabsSlice,
	reorderTab,
	setActiveConnection,
	setActiveTab,
	tabsForConnection,
	togglePinTab,
	useWorkspaceSelector,
	workspaceStore,
	type HydrateSessionArgs,
	type Tab,
	type TabsSlice
} from '@studio/core/workspace-store'
import { readSession, writeSession } from './session-persistence'

export type { Tab }

type TabsContextValue = {
	// All tabs across every open connection (flat). Most consumers want the tabs
	// scoped to the active connection — use `visibleTabs` for that.
	tabs: Tab[]
	// Tabs belonging to the active connection only (issue #96). The table TabBar
	// renders these so each connection keeps its own isolated tab group.
	visibleTabs: Tab[]
	activeTabId: string | null
	// The connection whose tab group is currently shown. Empty string means none.
	activeConnectionId: string
	// Connections the user has open (one connection tab each, in open order).
	openConnectionIds: string[]
	openTab: (args: Omit<Tab, 'id'>) => void
	closeTab: (id: string) => void
	closeOtherTabs: (id: string) => void
	closeTabsToLeft: (id: string) => void
	closeTabsToRight: (id: string) => void
	setActiveTab: (id: string) => void
	togglePinTab: (id: string) => void
	reorderTab: (fromId: string, toId: string) => void
	closeTabsForConnection: (connectionId: string) => void
	hydrateSession: (args: HydrateSessionArgs) => void
	// Multi-connection (issue #96).
	setActiveConnection: (connectionId: string) => void
	openConnection: (connectionId: string) => void
	closeConnection: (connectionId: string) => void
}

/**
 * Hydrate synchronously from the persisted session so restored tabs render on
 * the very first paint — cold start is never blocked. Tabs whose connection no
 * longer exists, and unpinned tabs when "restore on launch" is off, are pruned
 * later via `hydrateTabSession` once that data is available (see Index.tsx).
 */
function loadPersistedTabsSlice(): TabsSlice {
	const session = readSession()
	return {
		tabs: session.tabs,
		activeConnectionId: session.activeConnectionId,
		openConnectionIds: session.openConnectionIds,
		activeTabByConnection: session.activeTabByConnection
	}
}

/**
 * Tabs live in the workspace store; this provider only owns the two things that
 * are inherently lifecycle-bound — seeding the slice from the persisted session
 * on mount, and writing it back whenever it moves.
 */
export function TabsProvider({ children }: { children: ReactNode }) {
	useState(function seedFromSessionOnce() {
		replaceTabsSlice(loadPersistedTabsSlice())
		return null
	})

	useEffect(function persistTabsOnChange() {
		let previous = workspaceStore.getState().tabs
		return workspaceStore.subscribe(function () {
			const slice = workspaceStore.getState().tabs
			if (slice === previous) return
			previous = slice
			writeSession({
				tabs: slice.tabs,
				activeConnectionId: slice.activeConnectionId,
				openConnectionIds: slice.openConnectionIds,
				activeTabByConnection: slice.activeTabByConnection
			})
		})
	}, [])

	return <>{children}</>
}

/**
 * Whole-slice view of the tabs state. Prefer the narrow selectors in
 * `@studio/core/workspace-store` (`useVisibleTabs`, `useActiveTabId`, …) and the
 * standalone action functions: a component that only opens tabs should not
 * re-render when an unrelated tab closes.
 */
export function useTabs(): TabsContextValue {
	const slice = useWorkspaceSelector(function (state) {
		return state.tabs
	})

	return useMemo(
		function () {
			return {
				tabs: slice.tabs,
				visibleTabs: tabsForConnection(slice.tabs, slice.activeConnectionId),
				activeTabId: activeTabIdOf(slice),
				activeConnectionId: slice.activeConnectionId,
				openConnectionIds: slice.openConnectionIds,
				openTab,
				closeTab,
				closeOtherTabs,
				closeTabsToLeft,
				closeTabsToRight,
				setActiveTab,
				togglePinTab,
				reorderTab,
				closeTabsForConnection,
				hydrateSession: hydrateTabSession,
				setActiveConnection,
				openConnection,
				closeConnection
			}
		},
		[slice]
	)
}
