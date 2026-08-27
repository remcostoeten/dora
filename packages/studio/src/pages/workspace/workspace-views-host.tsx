import { lazy, Suspense, useCallback } from 'react'
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
import type { Connection } from '@studio/features/connections/types'
import { ConnectionTabBar } from '@studio/features/connection-tab-bar'
import { getContainerConnectionDetails } from '@studio/features/docker-manager/utilities/container-connection'
import { SettingsView } from '@studio/features/sidebar/components/settings-panel'
import { TabBar } from '@studio/features/tab-bar'
import { ErrorBoundary } from '@studio/shared/ui/error-boundary'
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

export function WorkspaceViewsHost({ actions, isLoading, isTauri }: Props) {
	const activeNavId = useActiveNavId()
	const connections = useConnectionList()
	const activeConnectionId = useActiveConnectionId()
	const activeConnection = useConnection(activeConnectionId)
	const isPosthogConnection = activeConnection?.type === 'posthog'
	const shortcuts = useEffectiveShortcuts()
	const { settings, persistSetting } = useSettings()
	const activeTab = useActiveTab()
	const selectedTableId = activeTab?.tableId ?? ''
	const selectedTableName = activeTab?.tableName ?? ''

	const handleTableSelect = useCallback(
		function (tableId: string, tableName: string) {
			if (!activeConnectionId) return
			openTab({ connectionId: activeConnectionId, tableId, tableName, label: tableName })
		},
		[activeConnectionId]
	)

	const hasNoConnections = connections.length === 0 && !isLoading

	return (
		<Suspense
			fallback={
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
			}
		>
			<WorkspaceViews activeViewId={activeNavId}>
				<WorkspaceView id='database-studio'>
					{hasNoConnections ? (
						<WorkspaceStartScreenWithTabs
							shortcut={shortcuts.newConnection.combo}
							canDropFiles={isTauri}
							onAddConnection={actions.handleOpenNewConnection}
						/>
					) : (
						<div className='flex flex-col flex-1 min-h-0'>
							<WorkspaceConnectionTabBar actions={actions} />
							<WorkspaceTabBar />
							<ErrorBoundary feature='Database Studio'>
								<DatabaseStudio
									isActive={activeNavId === 'database-studio'}
									tableId={selectedTableId}
									tableName={selectedTableName}
									initialRowPK={settings.lastRowPK}
									onRowSelectionChange={function (pk) {
										persistSetting('lastRowPK', pk)
									}}
									activeConnectionId={activeConnectionId}
									onConnectionSelect={setActiveConnection}
									onAddConnection={actions.handleOpenNewConnection}
									onEditConnection={
										activeConnectionId
											? function () {
													actions.handleEditConnection(activeConnectionId)
												}
											: undefined
									}
									onOpenSettings={function () {
										openSettingsView(null, 'startup')
									}}
								/>
							</ErrorBoundary>
						</div>
					)}
				</WorkspaceView>

				<WorkspaceView id='sql-console'>
					{hasNoConnections ? (
						<WorkspaceStartScreenWithTabs
							shortcut={shortcuts.newConnection.combo}
							canDropFiles={isTauri}
							onAddConnection={actions.handleOpenNewConnection}
						/>
					) : (
						<div className='flex flex-col flex-1 min-h-0'>
							<WorkspaceConnectionTabBar actions={actions} />
							<ErrorBoundary feature='SQL Console'>
								<SqlConsole
									isActive={activeNavId === 'sql-console'}
									activeConnectionId={activeConnectionId}
									getConnectionName={function (id) {
										return (
											connections.find(function (connection) {
												return connection.id === id
											})?.name ?? id.slice(0, 8)
										)
									}}
								/>
							</ErrorBoundary>
						</div>
					)}
				</WorkspaceView>

				<WorkspaceView id='analytics'>
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
									onClick={function () {
										setActiveNav('database-studio')
									}}
									className='rounded-md border border-border/70 px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:border-border hover:text-foreground'
								>
									Back to Data Viewer
								</button>
							</div>
						)}
					</ErrorBoundary>
				</WorkspaceView>

				<WorkspaceView id='schema-visualizer'>
					<ErrorBoundary feature='Schema Visualizer'>
						<SchemaVisualizer
							activeConnectionId={activeConnectionId}
							selectedTableId={selectedTableId}
							onSelectTable={handleTableSelect}
							onOpenTable={function (tableId, tableName) {
								handleTableSelect(tableId, tableName)
								setActiveNav('database-studio')
							}}
							windowControls={<WindowControls />}
						/>
					</ErrorBoundary>
				</WorkspaceView>

				<WorkspaceView id='settings'>
					<ErrorBoundary feature='Settings'>
						<WorkspaceSettingsView />
					</ErrorBoundary>
				</WorkspaceView>

				<WorkspaceView id='orm-cockpit'>
					<ErrorBoundary feature='Schema Diff'>
						<OrmCockpitPanel
							activeConnectionId={activeConnectionId}
							windowControls={<WindowControls />}
							onOpenInSqlConsole={function (sql) {
								setActiveNav('sql-console')
								window.setTimeout(function () {
									window.dispatchEvent(
										new CustomEvent('dora-open-sql-content', {
											detail: { sql }
										})
									)
								}, 0)
							}}
						/>
					</ErrorBoundary>
				</WorkspaceView>

				<WorkspaceView id='docker'>
					<ErrorBoundary feature='Docker Manager'>
						<DockerView
							windowControls={<WindowControls />}
							onOpenInDataViewer={async function (container) {
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
				</WorkspaceView>
			</WorkspaceViews>
		</Suspense>
	)
}

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
function WorkspaceTabBar() {
	const visibleTabs = useVisibleTabs()
	const activeTabId = useActiveTabId()
	const showsConnectionTabBar = useShowsConnectionTabBar()

	const handleTabClick = useCallback(function (tabId: string) {
		setActiveTab(tabId)
	}, [])

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
}

function WorkspaceConnectionTabBar({ actions }: { actions: ConnectionActions }) {
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
}

function useShowsConnectionTabBar(): boolean {
	return useWorkspaceSelector(function (state) {
		const navId = state.uiChrome.activeNavId
		if (navId !== 'database-studio' && navId !== 'sql-console') return false
		return state.tabs.openConnectionIds.length > 0
	})
}
