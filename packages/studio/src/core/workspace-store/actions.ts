import type { Connection } from '@studio/features/connections/types'
import type { SettingsSectionId } from '@studio/features/sidebar/components/settings-panel'
import type { HydrateSessionArgs } from './slices/tabs'
import { workspaceStore } from './store'
import type { Tab, TabsSlice } from './types'

/**
 * Module-level action functions rather than hook-returned closures: every one
 * of these is referentially stable for the life of the app, so passing them as
 * props never invalidates a memoized child.
 */

export function setConnections(connections: Connection[]): void {
	workspaceStore.dispatch({ type: 'connections/set', connections })
}

export function upsertConnection(connection: Connection): void {
	workspaceStore.dispatch({ type: 'connections/upsert', connection })
}

export function removeConnectionFromStore(connectionId: string): void {
	workspaceStore.dispatch({ type: 'connections/remove', connectionId })
}

export function setConnectionsLoading(): void {
	workspaceStore.dispatch({ type: 'connections/status', status: 'loading' })
}

export function setConnectionsError(error: string): void {
	workspaceStore.dispatch({ type: 'connections/status', status: 'error', error })
}

export function openTab(args: Omit<Tab, 'id'>): void {
	workspaceStore.dispatch({ type: 'tabs/open', args })
}

export function closeTab(id: string): void {
	workspaceStore.dispatch({ type: 'tabs/close', id })
}

export function closeOtherTabs(id: string): void {
	workspaceStore.dispatch({ type: 'tabs/closeOthers', id })
}

export function closeTabsToLeft(id: string): void {
	workspaceStore.dispatch({ type: 'tabs/closeToLeft', id })
}

export function closeTabsToRight(id: string): void {
	workspaceStore.dispatch({ type: 'tabs/closeToRight', id })
}

export function setActiveTab(id: string): void {
	workspaceStore.dispatch({ type: 'tabs/setActive', id })
}

export function togglePinTab(id: string): void {
	workspaceStore.dispatch({ type: 'tabs/togglePin', id })
}

export function reorderTab(fromId: string, toId: string): void {
	workspaceStore.dispatch({ type: 'tabs/move', fromId, toId })
}

export function closeTabsForConnection(connectionId: string): void {
	workspaceStore.dispatch({ type: 'tabs/closeForConnection', connectionId })
}

export function hydrateTabSession(args: HydrateSessionArgs): void {
	workspaceStore.dispatch({ type: 'tabs/hydrateSession', args })
}

export function replaceTabsSlice(state: TabsSlice): void {
	workspaceStore.dispatch({ type: 'tabs/replace', state })
}

export function setActiveConnection(connectionId: string): void {
	workspaceStore.dispatch({ type: 'tabs/setActiveConnection', connectionId })
}

export function openConnection(connectionId: string): void {
	workspaceStore.dispatch({ type: 'tabs/openConnection', connectionId })
}

export function closeConnection(connectionId: string): void {
	workspaceStore.dispatch({ type: 'tabs/closeConnection', connectionId })
}

export function setActiveNav(navId: string): void {
	workspaceStore.dispatch({ type: 'uiChrome/setActiveNav', navId })
}

export function toggleDatabasePanel(): void {
	workspaceStore.dispatch({ type: 'uiChrome/toggleDatabasePanel' })
}

export function setDatabasePanelOpen(open: boolean): void {
	workspaceStore.dispatch({ type: 'uiChrome/setDatabasePanelOpen', open })
}

export function openConnectionDialog(editingConnectionId?: string | null): void {
	workspaceStore.dispatch({ type: 'uiChrome/openConnectionDialog', editingConnectionId })
}

export function setConnectionDialogOpen(open: boolean): void {
	workspaceStore.dispatch({ type: 'uiChrome/setConnectionDialogOpen', open })
}

export function setConnectionDialogDroppedPaths(paths: string[] | null): void {
	workspaceStore.dispatch({ type: 'uiChrome/setConnectionDialogDroppedPaths', paths })
}

export function setConnectionDialogDragActive(active: boolean): void {
	workspaceStore.dispatch({ type: 'uiChrome/setConnectionDialogDragActive', active })
}

export function setCommandPaletteOpen(open: boolean): void {
	workspaceStore.dispatch({ type: 'uiChrome/setCommandPaletteOpen', open })
}

export function toggleCommandPalette(): void {
	workspaceStore.dispatch({ type: 'uiChrome/toggleCommandPalette' })
}

export function openSettingsView(
	section?: SettingsSectionId | null,
	highlight?: SettingsSectionId | null
): void {
	workspaceStore.dispatch({ type: 'uiChrome/openSettings', section, highlight })
}
