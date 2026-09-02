import { useCallback } from 'react'
import { LiveMonitorProvider } from '@studio/core/live-monitor'
import { useSettings } from '@studio/core/settings'
import {
	openTab,
	setActiveNav,
	toggleDatabasePanel,
	useActiveConnectionId,
	useActiveNavId,
	useActiveTab,
	useConnectionList,
	useWorkspaceSelector
} from '@studio/core/workspace-store'
import { NavigationSidebar, SidebarProvider } from '@studio/features/app-sidebar'
import { OnboardingTour } from '@studio/features/onboarding'
import { DatabaseSidebar } from '@studio/features/sidebar/database-sidebar'
import { clearAutoSelectFirstTable, shouldAutoSelectFirstTable } from './auto-select'
import { AiAssistantPanelHost, AiAssistantToggle } from './ai-assistant-host'
import { useConnectionActions } from './use-connection-actions'
import { useWorkspaceShortcuts } from './use-workspace-shortcuts'
import { useWorkspaceStartup } from './use-workspace-startup'
import { WorkspaceDialogs } from './workspace-dialogs'
import { WorkspaceUrlSync } from './workspace-url-sync'
import { WorkspaceViewsHost } from './workspace-views-host'

/** Views that render the database panel alongside them. */
const VIEWS_WITH_DATABASE_PANEL = new Set(['sql-console', 'database-studio', 'schema-visualizer'])

export function WorkspaceShell() {
	const actions = useConnectionActions()
	const { isLoading, isTauri } = useWorkspaceStartup({
		onFileDrop: actions.processImmediateFileDrop
	})
	useWorkspaceShortcuts({ actions })

	const activeConnectionId = useActiveConnectionId()
	const { settings } = useSettings()

	return (
		<LiveMonitorProvider activeConnectionId={activeConnectionId || undefined}>
			<WorkspaceUrlSync isLoading={isLoading} />
			<SidebarProvider>
				<div className='flex flex-col h-full w-full bg-background overflow-hidden'>
					<div className='flex flex-1 overflow-hidden'>
						<WorkspaceNavigationSidebar />
						<WorkspaceDatabaseSidebar actions={actions} />

						<main className='flex-1 flex flex-col h-full overflow-hidden relative px-0'>
							<WorkspaceViewsHost
								actions={actions}
								isLoading={isLoading}
								isTauri={isTauri}
							/>
						</main>

						{!settings.hideAi && <AiAssistantPanelHost />}

						<WorkspaceDialogs actions={actions} />

						<OnboardingTour />
						{!settings.hideAi && <AiAssistantToggle />}
					</div>
				</div>
			</SidebarProvider>
		</LiveMonitorProvider>
	)
}

function WorkspaceNavigationSidebar() {
	const activeNavId = useActiveNavId()
	const activeConnectionId = useActiveConnectionId()
	const isPosthogConnection = useWorkspaceSelector(function (state) {
		return state.connections.byId[activeConnectionId]?.type === 'posthog'
	})
	const isDatabasePanelOpen = useWorkspaceSelector(function (state) {
		return state.uiChrome.isDatabasePanelOpen
	})
	const showsDatabasePanel = VIEWS_WITH_DATABASE_PANEL.has(activeNavId)

	return (
		<NavigationSidebar
			activeNavId={activeNavId}
			onNavSelect={setActiveNav}
			analyticsAvailable={isPosthogConnection}
			databasePanelToggle={
				showsDatabasePanel
					? { isOpen: isDatabasePanelOpen, onToggle: toggleDatabasePanel }
					: undefined
			}
		/>
	)
}

function WorkspaceDatabaseSidebar({
	actions
}: {
	actions: ReturnType<typeof useConnectionActions>
}) {
	const activeNavId = useActiveNavId()
	const activeConnectionId = useActiveConnectionId()
	const connections = useConnectionList()
	const activeTab = useActiveTab()
	const isDatabasePanelOpen = useWorkspaceSelector(function (state) {
		return state.uiChrome.isDatabasePanelOpen
	})
	const isVisible = VIEWS_WITH_DATABASE_PANEL.has(activeNavId) && isDatabasePanelOpen

	const handleTableSelect = useCallback(
		function (tableId: string, tableName: string) {
			if (!activeConnectionId) return
			openTab({ connectionId: activeConnectionId, tableId, tableName, label: tableName })
		},
		[activeConnectionId]
	)

	return (
		<div
			ref={(node) => {
				if (node) node.inert = !isVisible
			}}
			className={isVisible ? 'contents' : 'hidden'}
			hidden={!isVisible}
			aria-hidden={!isVisible}
		>
			<DatabaseSidebar
				activeNavId={activeNavId}
				onNavSelect={setActiveNav}
				onTableSelect={handleTableSelect}
				selectedTableId={activeTab?.tableId ?? ''}
				autoSelectFirstTable={shouldAutoSelectFirstTable()}
				onAutoSelectComplete={clearAutoSelectFirstTable}
				connections={connections}
				activeConnectionId={activeConnectionId}
				onConnectionSelect={actions.handleConnectionSelect}
				onAddConnection={actions.handleOpenNewConnection}
				onManageConnections={function () {
					if (activeConnectionId) actions.handleEditConnection(activeConnectionId)
				}}
				onViewConnection={actions.handleEditConnection}
				onEditConnection={actions.handleEditConnection}
				onDeleteConnection={actions.handleDeleteConnection}
			/>
		</div>
	)
}
