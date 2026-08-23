import type { Connection } from '@studio/features/connections/types'
import { activeTabIdOf, tabsForConnection } from './slices/tabs'
import { shallowArrayEqual, useWorkspaceSelector } from './use-workspace'
import { tableSnapshotKey, type Tab, type TableSnapshot, type WorkspaceState } from './types'

export function selectConnectionList(state: WorkspaceState): Connection[] {
	return state.connections.ids
		.map((id) => state.connections.byId[id])
		.filter(function isPresent(connection): connection is Connection {
			return Boolean(connection)
		})
}

export function selectConnection(
	state: WorkspaceState,
	connectionId: string
): Connection | undefined {
	return state.connections.byId[connectionId]
}

export function selectActiveConnectionId(state: WorkspaceState): string {
	return state.tabs.activeConnectionId
}

export function selectActiveTabId(state: WorkspaceState): string | null {
	return activeTabIdOf(state.tabs)
}

export function selectActiveTab(state: WorkspaceState): Tab | null {
	const activeTabId = activeTabIdOf(state.tabs)
	if (!activeTabId) return null
	return state.tabs.tabs.find((tab) => tab.id === activeTabId) ?? null
}

export function selectVisibleTabs(state: WorkspaceState): Tab[] {
	return tabsForConnection(state.tabs.tabs, state.tabs.activeConnectionId)
}

export function selectTableSnapshot(
	state: WorkspaceState,
	connectionId: string,
	tableId: string
): TableSnapshot | undefined {
	return state.tableSnapshots.byKey[tableSnapshotKey(connectionId, tableId)]
}

export function useConnectionList(): Connection[] {
	return useWorkspaceSelector(selectConnectionList, shallowArrayEqual)
}

export function useConnection(connectionId: string): Connection | undefined {
	return useWorkspaceSelector(function (state) {
		return selectConnection(state, connectionId)
	})
}

export function useConnectionsStatus() {
	return useWorkspaceSelector(function (state) {
		return state.connections.status
	})
}

export function useActiveConnectionId(): string {
	return useWorkspaceSelector(selectActiveConnectionId)
}

export function useOpenConnectionIds(): string[] {
	return useWorkspaceSelector(function (state) {
		return state.tabs.openConnectionIds
	}, shallowArrayEqual)
}

export function useVisibleTabs(): Tab[] {
	return useWorkspaceSelector(selectVisibleTabs, shallowArrayEqual)
}

export function useActiveTabId(): string | null {
	return useWorkspaceSelector(selectActiveTabId)
}

export function useActiveTab(): Tab | null {
	return useWorkspaceSelector(selectActiveTab)
}

export function useActiveNavId(): string {
	return useWorkspaceSelector(function (state) {
		return state.uiChrome.activeNavId
	})
}
