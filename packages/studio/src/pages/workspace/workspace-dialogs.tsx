import { lazy, Suspense, useCallback } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import {
	setActiveNav,
	setCommandPaletteOpen,
	setConnectionDialogDroppedPaths,
	setConnectionDialogOpen,
	openTab,
	useActiveNavId,
	useConnection,
	useConnectionList,
	useActiveConnectionId,
	useActiveTab,
	useWorkspaceSelector
} from '@studio/core/workspace-store'
import type { ConnectionActions } from './use-connection-actions'

const ConnectionDialog = lazy(function () {
	return import('@studio/features/connections/components/connection-dialog').then(function (m) {
		return { default: m.ConnectionDialog }
	})
})

const CommandPalette = lazy(function () {
	return import('@studio/features/command-palette').then(function (m) {
		return { default: m.CommandPalette }
	})
})

type Props = {
	actions: ConnectionActions
}

/**
 * Both dialogs are store-driven and mounted next to the shell rather than
 * inside it, so opening one renders the dialog and nothing else — not the grid,
 * not the editor.
 */
export function WorkspaceDialogs({ actions }: Props) {
	return (
		<>
			<ConnectionDialogHost actions={actions} />
			<CommandPaletteHost actions={actions} />
		</>
	)
}

function ConnectionDialogHost({ actions }: Props) {
	const isTauri = useIsTauri()
	const dialog = useWorkspaceSelector(function (state) {
		return state.uiChrome.connectionDialog
	})
	const editingConnection = useConnection(dialog.editingConnectionId ?? '')

	const handleOpenChange = useCallback(function (open: boolean) {
		setConnectionDialogOpen(open)
	}, [])

	const handleDroppedPathsHandled = useCallback(function () {
		setConnectionDialogDroppedPaths(null)
	}, [])

	const handleOpenDataFiles = useCallback(
		async function (paths?: string[]) {
			setConnectionDialogOpen(false)
			if (paths && paths.length > 0) {
				await actions.handleOpenDataFiles(paths)
				return
			}
			await actions.handlePickDataFiles()
		},
		[actions]
	)

	// The dialog (and its framer-motion dependency) is a lazy chunk; mount it the
	// first time it opens and keep it mounted so its exit animation still plays.
	if (!dialog.everOpened) return null

	return (
		<Suspense fallback={null}>
			<ConnectionDialog
				open={dialog.open}
				onOpenChange={handleOpenChange}
				onSave={actions.handleDialogSave}
				droppedFilePaths={dialog.droppedPaths}
				externalDropActive={dialog.dragActive}
				onDroppedFilePathsHandled={handleDroppedPathsHandled}
				onOpenDataFiles={isTauri ? handleOpenDataFiles : undefined}
				resolveDatabaseType={actions.resolveDatabaseType}
				initialValues={editingConnection}
			/>
		</Suspense>
	)
}

function CommandPaletteHost({ actions }: Props) {
	const palette = useWorkspaceSelector(function (state) {
		return state.uiChrome.commandPalette
	})
	const activeNavId = useActiveNavId()
	const connections = useConnectionList()
	const activeConnectionId = useActiveConnectionId()
	const activeTab = useActiveTab()

	const handleSelectTable = useCallback(
		function (tableId: string, tableName: string) {
			if (!activeConnectionId) return
			openTab({ connectionId: activeConnectionId, tableId, tableName, label: tableName })
		},
		[activeConnectionId]
	)

	if (!palette.everOpened) return null

	const paletteNavId =
		activeNavId === 'docker' || activeNavId === 'sql-console' || activeNavId === 'settings'
			? activeNavId
			: 'database-studio'

	return (
		<Suspense fallback={null}>
			<CommandPalette
				open={palette.open}
				onOpenChange={setCommandPaletteOpen}
				activeNavId={paletteNavId}
				onNavigate={setActiveNav}
				connections={connections}
				activeConnectionId={activeConnectionId}
				selectedTableId={activeTab?.tableId ?? ''}
				onSelectConnection={actions.handleConnectionSelect}
				onCreateConnection={actions.handleOpenNewConnection}
				onEditConnection={actions.handleEditConnection}
				onDeleteConnection={actions.handleDeleteConnection}
				onSelectTable={handleSelectTable}
			/>
		</Suspense>
	)
}
