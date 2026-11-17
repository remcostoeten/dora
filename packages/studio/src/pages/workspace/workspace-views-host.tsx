import { lazy, memo, Suspense, useCallback, useRef, useState } from 'react'
import { WindowControls } from '@studio/components/window-controls'
import { useSettings } from '@studio/core/settings'
import { useEffectiveShortcuts } from '@studio/core/shortcuts'
import {
	closeOtherTabs,
	closeTab,
	closeTabsToLeft,
	closeTabsToRight,
	openSettingsView,
	openTab,
	reorderTab,
	selectActiveTableId,
	selectConnectionList,
	setActiveConnection,
	setActiveNav,
	setActiveTab,
	togglePinTab,
	useActiveConnectionId,
	useActiveNavId,
	useActiveTab,
	useActiveTabId,
	useConnection,
	useConnectionList,
	useOpenConnectionIds,
	useVisibleTabs,
	useWorkspaceSelector
} from '@studio/core/workspace-store'
import { WorkspaceView, WorkspaceViews } from '@studio/core/workspace-views'
import { useStableHandlers } from '@studio/features/database-studio/hooks/use-stable-handlers'
import { isDataFileSessionConnection } from '@studio/features/connections/source-caps'
import type { Connection } from '@studio/features/connections/types'
import { ConnectionTabBar } from '@studio/features/connection-tab-bar'
import {
	getContainerConnectionDetails,
	isKeyValueContainer
} from '@studio/features/docker-manager/utilities/container-connection'
import { KvLoadingShell } from '@studio/features/kv-studio/kv-loading-shell'
import { openContainerInKvStudio } from '@studio/features/kv-studio/kv-launch'
import { SettingsView } from '@studio/features/settings/settings-view'
import { TabBar } from '@studio/features/tab-bar'
import { ErrorBoundary } from '@studio/shared/ui/error-boundary'
import { toast } from '@studio/shared/ui/use-toast'
import { ViewLoadingShell } from '@studio/shared/ui/view-loading-shell'
import { WorkspaceStartScreenWithTabs } from './start-screen'
import type { ConnectionActions } from './use-connection-actions'

const DatabaseStudio = lazy(function () {
	return import('@studio/features/database-studio/database-studio').then(function (m) {
		return { default: m.DatabaseStudio }
	})
})
const DockerView = lazy(function () {
	return import('@studio/features/docker-manager').then(function (m) {
		return { default: m.DockerView }
	})
})
const SqlConsole = lazy(function () {
	return import('@studio/features/sql-console/sql-console').then(function (m) {
		return { default: m.SqlConsole }
	})
})
const SchemaVisualizer = lazy(function () {
	return import('@studio/features/schema-visualizer').then(function (m) {
		return { default: m.SchemaVisualizer }
	})
})
const OrmCockpitPanel = lazy(function () {
	return import('@studio/features/orm-cockpit/components/orm-cockpit-panel').then(function (m) {
		return { default: m.OrmCockpitPanel }
	})
})
const KvWorkspace = lazy(function () {
	return import('@studio/features/kv-studio/kv-workspace').then(function (m) {
		return { default: m.KvWorkspace }
	})
})
const PosthogAnalytics = lazy(function () {
	return import('@studio/features/posthog-analytics').then(function (m) {
		return { default: m.PosthogAnalytics }
	})
})

type Props = {
	actions: ConnectionActions
	isLoading: boolean
	isTauri: boolean
}

type ViewProps = {
	actions: ConnectionActions
}

function useIsActiveView(viewId: string): boolean {
	return useWorkspaceSelector(function (state) {
		return state.uiChrome.activeNavId === viewId
	})
}

function useActiveTableIdWhileShown(viewId: string): string {
	const lastSeenRef = useRef<string | null>(null)
	return useWorkspaceSelector(function (state) {
		if (lastSeenRef.current !== null && state.uiChrome.activeNavId !== viewId) {
			return lastSeenRef.current
		}
		lastSeenRef.current = selectActiveTableId(state) ?? ''
		return lastSeenRef.current
	})
}

export function WorkspaceViewsHost({ actions, isLoading, isTauri }: Props) {
	const activeNavId = useActiveNavId()
	const hasConnections = useWorkspaceSelector(function (state) {
		return selectConnectionList(state).length > 0
	})
	const hasNoConnections = !hasConnections && !isLoading

	// Every action is always present, so the first object of stable proxies is valid for good.
	const [stableActions] = useState(useStableHandlers(actions))

	return (
		<Suspense
			fallback={
				activeNavId === 'kv-studio' ? (
					<KvLoadingShell />
				) : (
					<ViewLoadingShell
						view={
							activeNavId === 'sql-console' ||
							activeNavId === 'schema-visualizer' ||
							activeNavId === 'docker' ||
							activeNavId === 'orm-cockpit'
								? activeNavId
								: 'database-studio'
						}
					/>
				)
			}
		>
			<WorkspaceViews activeViewId={activeNavId}>
				<WorkspaceView id='database-studio'>
					{hasNoConnections ? (
						<StartScreenHost actions={stableActions} isTauri={isTauri} />
					) : (
						<DatabaseStudioHost actions={stableActions} />
					)}
				</WorkspaceView>

				<WorkspaceView id='sql-console'>
					{hasNoConnections ? (
						<StartScreenHost actions={stableActions} isTauri={isTauri} />
					) : (
						<SqlConsoleHost actions={stableActions} />
					)}
				</WorkspaceView>

				<WorkspaceView id='kv-studio'>
					<KvWorkspaceHost />
				</WorkspaceView>

				<WorkspaceView id='analytics'>
					<AnalyticsHost />
				</WorkspaceView>

				<WorkspaceView id='schema-visualizer'>
					<SchemaVisualizerHost />
				</WorkspaceView>

				<WorkspaceView id='settings'>
					<ErrorBoundary feature='Settings'>
						<WorkspaceSettingsView />
					</ErrorBoundary>
				</WorkspaceView>

				<WorkspaceView id='orm-cockpit'>
					<OrmCockpitHost />
				</WorkspaceView>

				<WorkspaceView id='docker'>
					<DockerHost actions={stableActions} isTauri={isTauri} />
				</WorkspaceView>
			</WorkspaceViews>
		</Suspense>
	)
}

const StartScreenHost = memo(function StartScreenHost({
	actions,
	isTauri
}: ViewProps & { isTauri: boolean }) {
	const shortcuts = useEffectiveShortcuts()
	return (
		<WorkspaceStartScreenWithTabs
			shortcut={shortcuts.newConnection.combo}
			canDropFiles={isTauri}
			onAddConnection={actions.handleOpenNewConnection}
		/>
	)
})

function openStartupSettings() {
	openSettingsView(null, 'startup')
}

const DatabaseStudioHost = memo(function DatabaseStudioHost({ actions }: ViewProps) {
	const isActive = useIsActiveView('database-studio')
	const activeConnectionId = useActiveConnectionId()
	const activeTab = useActiveTab()
	const { settings, persistSetting } = useSettings()

	const handleRowSelectionChange = useCallback(
		function (pk: string | number | null) {
			persistSetting('lastRowPK', pk)
		},
		[persistSetting]
	)

	const handleEditConnection = useCallback(
		function () {
			actions.handleEditConnection(activeConnectionId)
		},
		[actions, activeConnectionId]
	)

	return (
		<div className='flex flex-col flex-1 min-h-0'>
			<WorkspaceConnectionTabBar actions={actions} />
			<WorkspaceTabBar />
			<ErrorBoundary feature='Database Studio'>
				<DatabaseStudio
					isActive={isActive}
					tableId={activeTab?.tableId ?? ''}
					tableName={activeTab?.tableName ?? ''}
					initialRowPK={settings.lastRowPK}
					onRowSelectionChange={handleRowSelectionChange}
					activeConnectionId={activeConnectionId}
					onConnectionSelect={setActiveConnection}
					onAddConnection={actions.handleOpenNewConnection}
					onEditConnection={activeConnectionId ? handleEditConnection : undefined}
					onOpenSettings={openStartupSettings}
				/>
			</ErrorBoundary>
		</div>
	)
})

const SqlConsoleHost = memo(function SqlConsoleHost({ actions }: ViewProps) {
	const isActive = useIsActiveView('sql-console')
	const activeConnectionId = useActiveConnectionId()
	const connections = useConnectionList()

	const getConnectionName = useCallback(
		function (id: string) {
			return (
				connections.find(function (connection) {
					return connection.id === id
				})?.name ?? id.slice(0, 8)
			)
		},
		[connections]
	)

	return (
		<div className='flex flex-col flex-1 min-h-0'>
			<WorkspaceConnectionTabBar actions={actions} />
			<ErrorBoundary feature='SQL Console'>
				<SqlConsole
					isActive={isActive}
					activeConnectionId={activeConnectionId}
					getConnectionName={getConnectionName}
				/>
			</ErrorBoundary>
		</div>
	)
})

const KvWorkspaceHost = memo(function KvWorkspaceHost() {
	const isActive = useIsActiveView('kv-studio')
	return (
		<ErrorBoundary feature='Redis / Valkey'>
			<KvWorkspace isActive={isActive} windowControls={<WindowControls />} />
		</ErrorBoundary>
	)
})

function backToDataViewer() {
	setActiveNav('database-studio')
}

const AnalyticsHost = memo(function AnalyticsHost() {
	const activeConnectionId = useActiveConnectionId()
	const activeConnection = useConnection(activeConnectionId)
	const isPosthogConnection = activeConnection?.type === 'posthog'

	return (
		<ErrorBoundary feature='Analytics'>
			{isPosthogConnection && activeConnectionId ? (
				<PosthogAnalytics
					connectionId={activeConnectionId}
					connectionName={activeConnection?.name}
					windowControls={<WindowControls />}
				/>
			) : (
				<div className='flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center'>
					<p className='text-sm text-muted-foreground'>
						Analytics is available for PostHog connections.
					</p>
					<button
						onClick={backToDataViewer}
						className='rounded-md border border-border/70 px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-border hover:text-foreground'
					>
						Back to Data Viewer
					</button>
				</div>
			)}
		</ErrorBoundary>
	)
})

const SchemaVisualizerHost = memo(function SchemaVisualizerHost() {
	const activeConnectionId = useActiveConnectionId()
	const selectedTableId = useActiveTableIdWhileShown('schema-visualizer')

	const handleTableSelect = useCallback(
		function (tableId: string, tableName: string) {
			if (!activeConnectionId) return
			openTab({ connectionId: activeConnectionId, tableId, tableName, label: tableName })
		},
		[activeConnectionId]
	)

	const handleOpenTable = useCallback(
		function (tableId: string, tableName: string) {
			handleTableSelect(tableId, tableName)
			setActiveNav('database-studio')
		},
		[handleTableSelect]
	)

	return (
		<ErrorBoundary feature='Schema Visualizer'>
			<SchemaVisualizer
				activeConnectionId={activeConnectionId}
				selectedTableId={selectedTableId}
				onSelectTable={handleTableSelect}
				onOpenTable={handleOpenTable}
				windowControls={<WindowControls />}
			/>
		</ErrorBoundary>
	)
})

function openInSqlConsole(sql: string) {
	setActiveNav('sql-console')
	window.setTimeout(function () {
		window.dispatchEvent(new CustomEvent('dora-open-sql-content', { detail: { sql } }))
	}, 0)
}

const OrmCockpitHost = memo(function OrmCockpitHost() {
	const activeConnectionId = useActiveConnectionId()
	return (
		<ErrorBoundary feature='Schema Diff'>
			<OrmCockpitPanel
				activeConnectionId={activeConnectionId}
				windowControls={<WindowControls />}
				onOpenInSqlConsole={openInSqlConsole}
			/>
		</ErrorBoundary>
	)
})

const DockerHost = memo(function DockerHost({
	actions,
	isTauri
}: ViewProps & { isTauri: boolean }) {
	return (
		<ErrorBoundary feature='Docker Manager'>
			<DockerView
				windowControls={<WindowControls />}
				onOpenInDataViewer={async function (container) {
					if (isKeyValueContainer(container)) {
						if (isTauri) {
							const result = await openContainerInKvStudio(container)
							if (result.status === 'error') {
								toast({
									title: 'Could not open Redis / Valkey',
									description: result.message,
									variant: 'destructive'
								})
								return
							}
						}
						setActiveNav('kv-studio')
						return
					}
					const details = getContainerConnectionDetails(container)
					await actions.handleAddConnection({
						name: container.name,
						type: details.type,
						host: details.host,
						port: details.port,
						user: details.user,
						password: details.password,
						database: details.database
					})
					setActiveNav('database-studio')
				}}
			/>
		</ErrorBoundary>
	)
})

/**
 * The settings section the user asked for lives in the store, so opening
 * settings from a shortcut or a deep link does not re-render the shell.
 */
function WorkspaceSettingsView() {
	const settingsView = useWorkspaceSelector(function (state) {
		return state.uiChrome.settingsView
	})
	return (
		<SettingsView
			windowControls={<WindowControls />}
			initialSection={settingsView.initialSection ?? undefined}
			highlightSection={settingsView.highlightSection ?? undefined}
		/>
	)
}

/**
 * Issue #96: switching connections no longer tears down the previous
 * connection's tabs — each connection keeps its own isolated tab group. The
 * table TabBar renders only the active connection's tabs, so switching changes
 * which group is shown and naturally preserves each connection's open tabs,
 * active tab, filter and scroll state.
 */
const WorkspaceTabBar = memo(function WorkspaceTabBar() {
	const visibleTabs = useVisibleTabs()
	const activeTabId = useActiveTabId()
	const showsConnectionTabBar = useShowsConnectionTabBar()
	const connections = useConnectionList()
	const activeConnectionId = useActiveConnectionId()

	const handleTabClick = useCallback(function (tabId: string) {
		setActiveTab(tabId)
	}, [])

	// A single-file data-file session auto-opens its one view, whose label is
	// just the connection name again — the row adds nothing the connection tab
	// above doesn't already say. Only skip it when that bar is present, since
	// this bar otherwise carries the drag region and window controls.
	const activeConnection = connections.find(function (connection) {
		return connection.id === activeConnectionId
	})
	if (
		showsConnectionTabBar &&
		visibleTabs.length <= 1 &&
		activeConnection &&
		isDataFileSessionConnection(activeConnection)
	) {
		return null
	}

	return (
		<TabBar
			tabs={visibleTabs}
			activeTabId={activeTabId}
			onTabClick={handleTabClick}
			onTabClose={closeTab}
			onTabPinToggle={togglePinTab}
			onCloseOtherTabs={closeOtherTabs}
			onCloseTabsToLeft={closeTabsToLeft}
			onCloseTabsToRight={closeTabsToRight}
			onTabReorder={reorderTab}
			rightSlot={showsConnectionTabBar ? undefined : <WindowControls />}
		/>
	)
})

const WorkspaceConnectionTabBar = memo(function WorkspaceConnectionTabBar({ actions }: ViewProps) {
	const connections = useConnectionList()
	const openConnectionIds = useOpenConnectionIds()
	const activeConnectionId = useActiveConnectionId()
	const showsConnectionTabBar = useShowsConnectionTabBar()

	if (!showsConnectionTabBar) return null

	// Resolved in the order the connection tabs appear (issue #96). Stale ids —
	// a connection deleted elsewhere — are filtered out.
	const openConnections = openConnectionIds
		.map(function (id) {
			return connections.find(function (connection) {
				return connection.id === id
			})
		})
		.filter(function isPresent(connection): connection is Connection {
			return Boolean(connection)
		})

	return (
		<ConnectionTabBar
			connections={openConnections}
			activeConnectionId={activeConnectionId}
			onSelect={actions.handleConnectionSelect}
			onClose={actions.handleCloseConnection}
			onViewConnection={actions.handleEditConnection}
			onEditConnection={actions.handleEditConnection}
			onCloseOtherConnections={actions.handleCloseOtherConnections}
			onCloseConnectionsToLeft={actions.handleCloseConnectionsToLeft}
			onCloseConnectionsToRight={actions.handleCloseConnectionsToRight}
			onAddConnection={actions.handleOpenNewConnection}
			rightSlot={<WindowControls />}
		/>
	)
})

function useShowsConnectionTabBar(): boolean {
	return useWorkspaceSelector(function (state) {
		const navId = state.uiChrome.activeNavId
		if (navId !== 'database-studio' && navId !== 'sql-console') return false
		return state.tabs.openConnectionIds.length > 0
	})
}
