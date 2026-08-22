import type { Connection } from '@studio/features/connections/types'
import type {
	ColumnDefinition,
	FilterConjunction,
	FilterDescriptor,
	FilterGroup,
	SortDescriptor
} from '@studio/features/database-studio/types'
import type { SettingsSectionId } from '@studio/features/sidebar/components/settings-panel'
import type { DatabaseSchema, SavedQuery, SnippetFolder } from '@studio/lib/bindings'

/**
 * How far a slice has got in acquiring its data. `ready` means the slice holds
 * a real answer — an empty list included — so a consumer can tell "nothing yet"
 * from "nothing at all" without a second flag.
 */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type Tab = {
	id: string
	connectionId: string
	tableId: string
	tableName: string
	label: string
	pinned?: boolean
}

export type ConnectionsSlice = {
	ids: string[]
	byId: Record<string, Connection>
	status: LoadStatus
	error: string | null
}

export type SchemaEntry = {
	schema: DatabaseSchema
	fetchedAt: number
	/** Bumped by DDL so schema-derived views know to recompute (Track 5). */
	version: number
}

export type SchemasSlice = {
	byConnectionId: Record<string, SchemaEntry>
}

export type TabsSlice = {
	/**
	 * Flat list of every tab across all open connections. Per-connection
	 * grouping is derived by filtering on `Tab.connectionId` (issue #96) —
	 * keeping the list flat preserves drag-reorder (#105) and session
	 * persistence (#98) unchanged.
	 */
	tabs: Tab[]
	/** The connection whose tab group is visible. '' means none selected yet. */
	activeConnectionId: string
	/** Open connections in the order their connection tabs appear. */
	openConnectionIds: string[]
	/**
	 * Per-connection active tab id, so switching connections restores the tab
	 * the user last had focused there. Keyed by connectionId.
	 */
	activeTabByConnection: Record<string, string>
}

/**
 * The last known contents of one table for one connection: enough to paint the
 * grid without an IPC round-trip when the user navigates back to it.
 */
export type TableSnapshot = {
	connectionId: string
	tableId: string
	columns: ColumnDefinition[]
	rows: Record<string, unknown>[]
	totalCount: number
	visibleColumns: string[]
	offset: number
	limit: number
	sort?: SortDescriptor
	filters?: FilterDescriptor[]
	conjunction?: FilterConjunction
	filterGroup?: FilterGroup
	fetchedAt: number
}

export type TableSnapshotsSlice = {
	/** Keyed by {@link tableSnapshotKey}. */
	byKey: Record<string, TableSnapshot>
}

export type SavedQueriesSlice = {
	ids: number[]
	byId: Record<number, SavedQuery>
	status: LoadStatus
}

export type SnippetsSlice = {
	folders: SnippetFolder[]
	status: LoadStatus
}

export type ConnectionDialogState = {
	open: boolean
	/**
	 * The dialog is a lazy chunk: once opened it stays mounted so its exit
	 * animation still plays on close.
	 */
	everOpened: boolean
	editingConnectionId: string | null
	droppedPaths: string[] | null
	dragActive: boolean
}

export type CommandPaletteState = {
	open: boolean
	everOpened: boolean
}

export type SettingsViewState = {
	initialSection: SettingsSectionId | null
	highlightSection: SettingsSectionId | null
}

export type UiChromeSlice = {
	activeNavId: string
	isDatabasePanelOpen: boolean
	connectionDialog: ConnectionDialogState
	commandPalette: CommandPaletteState
	settingsView: SettingsViewState
}

export type WorkspaceState = {
	connections: ConnectionsSlice
	schemas: SchemasSlice
	tabs: TabsSlice
	tableSnapshots: TableSnapshotsSlice
	savedQueries: SavedQueriesSlice
	snippets: SnippetsSlice
	uiChrome: UiChromeSlice
}

export function tableSnapshotKey(connectionId: string, tableId: string): string {
	return `${connectionId}::${tableId}`
}
