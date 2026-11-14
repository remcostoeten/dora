import { memo, useCallback, type ReactNode } from 'react'
import { LiveMonitorProvider } from '@studio/core/live-monitor'
import { useSettings } from '@studio/core/settings'
import {
	openTab,
	readWorkspace,
	selectActiveTab,
	setActiveNav,
	toggleDatabasePanel,
	useActiveConnectionId,
	useActiveNavId,
	useConnectionList,
	useWorkspaceSelector
} from '@studio/core/workspace-store'
import { NavigationSidebar, SidebarProvider } from '@studio/features/app-sidebar'
import { OnboardingTour } from '@studio/features/onboarding'
import { DatabaseSidebar } from '@studio/features/sidebar/database-sidebar'
import { clearAutoSelectFirstTable, shouldAutoSelectFirstTable } from './auto-select'
import { AiAssistantPanelHost, AiAssistantToggle } from './ai-assistant-host'
import { useConnectionActions, type ConnectionActions } from './use-connection-actions'
import { useWorkspaceShortcuts } from './use-workspace-shortcuts'
import { useWorkspaceStartup } from './use-workspace-startup'
import { WorkspaceDialogs } from './workspace-dialogs'
import { WorkspaceUrlSync } from './workspace-url-sync'
import { WorkspaceViewsHost } from './workspace-views-host'

/** Views that render the database panel alongside them. */
const VIEWS_WITH_DATABASE_PANEL = new Set(['sql-console', 'database-studio', 'schema-visualizer'])

const UrlSync = memo(WorkspaceUrlSync)
const ViewsHost = memo(WorkspaceViewsHost)
const Dialogs = memo(WorkspaceDialogs)
const AiAssistantPanel = memo(AiAssistantPanelHost)
const Onboarding = memo(OnboardingTour)
const Sidebar = memo(DatabaseSidebar)

const AI_ASSISTANT_TOGGLE = <AiAssistantToggle />

type ActionsProps = {
	actions: ConnectionActions
}

export function WorkspaceShell() {
	const actions = useConnectionActions()
	const { isLoading, isTauri } = useWorkspaceStartup({
		onFileDrop: actions.processImmediateFileDrop
	})
	const { settings } = useSettings()
	const showsAi = !settings.hideAi

	return (
		<WorkspaceLiveMonitor>
			<UrlSync isLoading={isLoading} />
			<WorkspaceShortcuts actions={actions} />
			<SidebarProvider>
				<div className='flex flex-col h-full w-full bg-background overflow-hidden'>
					<div className='flex flex-1 overflow-hidden'>
						<WorkspaceNavigationSidebar
							aiAssistantToggle={showsAi ? AI_ASSISTANT_TOGGLE : undefined}
						/>
						<WorkspaceDatabaseSidebar actions={actions} />

						<main className='relative flex h-full min-w-0 flex-1 flex-col overflow-hidden px-0'>
							<ViewsHost actions={actions} isLoading={isLoading} isTauri={isTauri} />
						</main>

						{showsAi && <AiAssistantPanel />}

						<Dialogs actions={actions} />

						<Onboarding />

						{/* Keeps `main` from being the last child: WebKit restyles the previous last child's subtree when a sibling mounts after it. */}
						<span hidden />
					</div>
				</div>
			</SidebarProvider>
		</WorkspaceLiveMonitor>
	)
}

function WorkspaceLiveMonitor({ children }: { children: ReactNode }) {
	const activeConnectionId = useActiveConnectionId()
	return (
		<LiveMonitorProvider activeConnectionId={activeConnectionId || undefined}>
			{children}
		</LiveMonitorProvider>
	)
}

const WorkspaceShortcuts = memo(function WorkspaceShortcuts({ actions }: ActionsProps) {
	useWorkspaceShortcuts({ actions })
	return null
})

const WorkspaceNavigationSidebar = memo(function WorkspaceNavigationSidebar({
	aiAssistantToggle
}: {
	aiAssistantToggle?: ReactNode
}) {
	const activeNavId = useActiveNavId()
	const isPosthogConnection = useWorkspaceSelector(function (state) {
		return state.connections.byId[state.tabs.activeConnectionId]?.type === 'posthog'
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
			aiAssistantToggle={aiAssistantToggle}
			databasePanelToggle={
				showsDatabasePanel
					? { isOpen: isDatabasePanelOpen, onToggle: toggleDatabasePanel }
					: undefined
			}
		/>
	)
})

function openTableInActiveConnection(tableId: string, tableName: string) {
	const connectionId = readWorkspace().tabs.activeConnectionId
	if (!connectionId) return
	openTab({ connectionId, tableId, tableName, label: tableName })
}

const WorkspaceDatabaseSidebar = memo(function WorkspaceDatabaseSidebar({ actions }: ActionsProps) {
	const isVisible = useWorkspaceSelector(function (state) {
		return (
			VIEWS_WITH_DATABASE_PANEL.has(state.uiChrome.activeNavId) &&
			state.uiChrome.isDatabasePanelOpen
		)
	})
	const activeConnectionId = useActiveConnectionId()
	const connections = useConnectionList()
	const selectedTableId = useWorkspaceSelector(function (state) {
		return selectActiveTab(state)?.tableId ?? ''
	})

	const handleManageConnections = useCallback(
		function () {
			const connectionId = readWorkspace().tabs.activeConnectionId
			if (connectionId) actions.handleEditConnection(connectionId)
		},
		[actions]
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
			<Sidebar
				onNavSelect={setActiveNav}
				onTableSelect={openTableInActiveConnection}
				selectedTableId={selectedTableId}
				autoSelectFirstTable={shouldAutoSelectFirstTable()}
				onAutoSelectComplete={clearAutoSelectFirstTable}
				connections={connections}
				activeConnectionId={activeConnectionId}
				onConnectionSelect={actions.handleConnectionSelect}
				onAddConnection={actions.handleOpenNewConnection}
				onManageConnections={handleManageConnections}
				onViewConnection={actions.handleEditConnection}
				onEditConnection={actions.handleEditConnection}
				onDumpConnection={actions.handleDumpConnection}
				onDeleteConnection={actions.handleDeleteConnection}
			/>
		</div>
	)
})
