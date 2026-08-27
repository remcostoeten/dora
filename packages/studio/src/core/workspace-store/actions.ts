import type { Connection } from '@studio/features/connections/types'
import type { SettingsSectionId } from '@studio/features/sidebar/components/settings-panel'
import type { DatabaseSchema, SavedQuery, SnippetFolder } from '@studio/lib/bindings'
import type { HydrateSessionArgs } from './slices/tabs'
import { workspaceStore } from './store'
import {
	tableSnapshotKey,
	type SchemaEntry,
	type Tab,
	type TableSnapshot,
	type TabsSlice
} from './types'

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

export function setSchema(connectionId: string, schema: DatabaseSchema, fetchedAt = 0): void {
	workspaceStore.dispatch({ type: 'schemas/set', connectionId, schema, fetchedAt })
}

/**
 * The last schema this session (or the bootstrap payload) saw for a
 * connection, read synchronously. Bootstrap entries carry `fetchedAt: 0`, so
 * consumers can seed instantly while still treating the data as stale.
 */
export function readSchemaEntry(connectionId: string | undefined): SchemaEntry | undefined {
	if (!connectionId) return undefined
	return workspaceStore.getState().schemas.byConnectionId[connectionId]
}

export function invalidateSchema(connectionId: string): void {
	workspaceStore.dispatch({ type: 'schemas/invalidate', connectionId })
}

export function clearSchema(connectionId: string): void {
	workspaceStore.dispatch({ type: 'schemas/clear', connectionId })
}

export function setSavedQueries(savedQueries: SavedQuery[], snippets: SavedQuery[] = []): void {
	workspaceStore.dispatch({
		type: 'savedQueries/set',
		savedQueries: [...savedQueries, ...snippets]
	})
}

export function setSnippetFolders(folders: SnippetFolder[]): void {
	workspaceStore.dispatch({ type: 'snippets/setFolders', folders })
}

export function putTableSnapshot(snapshot: TableSnapshot): void {
	workspaceStore.dispatch({ type: 'tableSnapshots/put', snapshot })
}

export function patchTableSnapshotRows(
	connectionId: string,
	tableId: string,
	rows: Record<string, unknown>[]
): void {
	workspaceStore.dispatch({ type: 'tableSnapshots/patchRows', connectionId, tableId, rows })
}

export function dropTableSnapshot(connectionId: string, tableId: string): void {
	workspaceStore.dispatch({ type: 'tableSnapshots/drop', connectionId, tableId })
}

export function dropTableSnapshotsForConnection(connectionId: string): void {
	workspaceStore.dispatch({ type: 'tableSnapshots/dropForConnection', connectionId })
}

export function clearTableSnapshots(): void {
	workspaceStore.dispatch({ type: 'tableSnapshots/clear' })
}

/**
 * The last known contents of a table, read synchronously. This is the call that
 * makes a cached table switch paint in the same frame instead of after an IPC
 * round-trip.
 */
export function readTableSnapshot(
	connectionId: string | undefined,
	tableId: string | null
): TableSnapshot | undefined {
	if (!connectionId || !tableId) return undefined
	return workspaceStore.getState().tableSnapshots.byKey[tableSnapshotKey(connectionId, tableId)]
}
