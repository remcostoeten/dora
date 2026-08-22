import { useCallback } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { useConnectionMutations } from '@studio/core/data-provider/hooks'
import { useSettings } from '@studio/core/settings'
import {
	closeConnection,
	closeTabsForConnection,
	openConnectionDialog,
	readWorkspace,
	setActiveConnection,
	setConnectionDialogOpen,
	useConnectionList,
	useOpenConnectionIds
} from '@studio/core/workspace-store'
import type { Connection } from '@studio/features/connections/types'
import {
	buildConnectionFromDataFiles,
	buildConnectionFromDatabaseFile,
	classifyDroppedPaths,
	resolveDatabaseTypeForPath,
	type DatabaseFileKind
} from '@studio/features/connections/utils/data-files'
import { frontendToBackendDatabaseInfo } from '@studio/features/connections/utils/mapping'
import { commands } from '@studio/lib/bindings'
import { useToast } from '@studio/shared/ui/use-toast'
import { mapConnectionError } from '@studio/shared/utils/error-messages'
import { requestAutoSelectFirstTable } from './auto-select'

export type ConnectionActions = ReturnType<typeof useConnectionActions>

export function useConnectionActions() {
	const { toast } = useToast()
	const isTauri = useIsTauri()
	const { settings } = useSettings()
	const connections = useConnectionList()
	const openConnectionIds = useOpenConnectionIds()
	const { addConnection, updateConnection, removeConnection, disconnectFromDatabase } =
		useConnectionMutations()

	const probeDatabaseFileKind = useCallback(
		async function (path: string): Promise<DatabaseFileKind> {
			if (!isTauri) return 'unknown'
			const result = await commands.probeDatabaseFile(path)
			return result.status === 'ok' ? result.data : 'unknown'
		},
		[isTauri]
	)

	const resolveDatabaseType = useCallback(
		function (path: string) {
			return resolveDatabaseTypeForPath(path, probeDatabaseFileKind)
		},
		[probeDatabaseFileKind]
	)

	const handleAddConnection = useCallback(
		async function (connection: Omit<Connection, 'id' | 'status' | 'createdAt'>) {
			try {
				const dbInfo = frontendToBackendDatabaseInfo(connection as Connection)
				const newConnection = await addConnection.mutateAsync({
					name: connection.name,
					databaseType: dbInfo
				})
				setConnectionDialogOpen(false)
				setActiveConnection(newConnection.id)
				requestAutoSelectFirstTable()
				toast({
					title: 'Connection Added',
					description: `"${connection.name}" has been created and connected.`,
					variant: 'success'
				})
			} catch (error) {
				toast({
					title: 'Failed to Add Connection',
					description: mapConnectionError(
						error instanceof Error ? error : new Error('Unknown error')
					),
					variant: 'destructive'
				})
			}
		},
		[addConnection, toast]
	)

	const handleUpdateConnection = useCallback(
		async function (
			editingConnectionId: string,
			connection: Omit<Connection, 'id' | 'status' | 'createdAt'>
		) {
			try {
				const dbInfo = frontendToBackendDatabaseInfo(connection as Connection)
				await updateConnection.mutateAsync({
					id: editingConnectionId,
					name: connection.name,
					databaseType: dbInfo,
					clearPassword: connection.clearSavedPassword
				})
				setConnectionDialogOpen(false)
				toast({
					title: 'Connection Updated',
					description: `"${connection.name}" has been updated.`,
					variant: 'success'
				})
			} catch (error) {
				toast({
					title: 'Failed to Update Connection',
					description: mapConnectionError(
						error instanceof Error ? error : new Error('Unknown error')
					),
					variant: 'destructive'
				})
			}
		},
		[toast, updateConnection]
	)

	const handleDialogSave = useCallback(
		async function (connectionData: Omit<Connection, 'id' | 'createdAt'>) {
			const editingConnectionId =
				readWorkspace().uiChrome.connectionDialog.editingConnectionId
			if (editingConnectionId) {
				await handleUpdateConnection(editingConnectionId, connectionData)
			} else {
				await handleAddConnection(connectionData)
			}
		},
		[handleAddConnection, handleUpdateConnection]
	)

	const handleDeleteConnection = useCallback(
		async function (connectionId: string) {
			const connection = connections.find(function (candidate) {
				return candidate.id === connectionId
			})
			if (!connection) return
			try {
				await removeConnection.mutateAsync(connection.id)
				// Removing a connection also closes its tab group and clears it as
				// active.
				closeConnection(connection.id)
				closeTabsForConnection(connection.id)
				toast({
					title: 'Connection Deleted',
					description: `"${connection.name}" has been removed.`,
					variant: 'success'
				})
			} catch (error) {
				toast({
					title: 'Failed to Delete Connection',
					description: mapConnectionError(
						error instanceof Error ? error : new Error('Unknown error')
					),
					variant: 'destructive'
				})
			}
		},
		[connections, removeConnection, toast]
	)

	const handleConnectionSelect = useCallback(
		function (connectionId: string) {
			setActiveConnection(connectionId)
			if (settings.startupConnectionMode === 'auto') requestAutoSelectFirstTable()
		},
		[settings.startupConnectionMode]
	)

	/**
	 * Close a connection tab (issue #96): disconnect its backend session and drop
	 * its tab group. The store picks the nearest remaining connection as active,
	 * or the empty state when none remain. The connection itself is NOT deleted —
	 * it stays in the saved connection list and can be reopened.
	 */
	const handleCloseConnection = useCallback(
		function (connectionId: string) {
			closeConnection(connectionId)
			closeTabsForConnection(connectionId)
			disconnectFromDatabase.mutate(connectionId)
		},
		[disconnectFromDatabase]
	)

	const handleCloseOtherConnections = useCallback(
		function (connectionId: string) {
			openConnectionIds
				.filter(function (id) {
					return id !== connectionId
				})
				.forEach(handleCloseConnection)
			setActiveConnection(connectionId)
		},
		[handleCloseConnection, openConnectionIds]
	)

	const handleCloseConnectionsToLeft = useCallback(
		function (connectionId: string) {
			const connectionIndex = openConnectionIds.indexOf(connectionId)
			if (connectionIndex <= 0) return
			openConnectionIds.slice(0, connectionIndex).forEach(handleCloseConnection)
			setActiveConnection(connectionId)
		},
		[handleCloseConnection, openConnectionIds]
	)

	const handleCloseConnectionsToRight = useCallback(
		function (connectionId: string) {
			const connectionIndex = openConnectionIds.indexOf(connectionId)
			if (connectionIndex < 0 || connectionIndex >= openConnectionIds.length - 1) return
			openConnectionIds.slice(connectionIndex + 1).forEach(handleCloseConnection)
			setActiveConnection(connectionId)
		},
		[handleCloseConnection, openConnectionIds]
	)

	const handleEditConnection = useCallback(function (connectionId: string) {
		openConnectionDialog(connectionId)
	}, [])

	const handleOpenNewConnection = useCallback(function () {
		openConnectionDialog(null)
	}, [])

	const handleOpenDataFiles = useCallback(
		async function (paths: string[]) {
			const dataFiles = classifyDroppedPaths(paths).dataFiles
			if (dataFiles.length === 0) return
			await handleAddConnection(buildConnectionFromDataFiles(dataFiles))
		},
		[handleAddConnection]
	)

	const handlePickDataFiles = useCallback(
		async function () {
			try {
				const result = await commands.openDataFiles()
				if (result.status === 'ok' && result.data.length > 0) {
					await handleOpenDataFiles(result.data)
				}
			} catch (error) {
				toast({
					title: 'Failed to open data files',
					description: error instanceof Error ? error.message : String(error),
					variant: 'destructive'
				})
			}
		},
		[handleOpenDataFiles, toast]
	)

	const processImmediateFileDrop = useCallback(
		async function (paths: string[]) {
			const { dataFiles, databaseFiles, unsupported } = classifyDroppedPaths(paths)

			if (unsupported.length > 0) {
				toast({
					title: 'Unsupported file type',
					description: `Could not open: ${unsupported
						.map(function (path) {
							return path.split(/[\\/]/).pop() ?? path
						})
						.join(', ')}`,
					variant: 'destructive'
				})
			}

			if (dataFiles.length > 0) {
				await handleOpenDataFiles(dataFiles)
			}

			for (const path of databaseFiles) {
				const type = await resolveDatabaseType(path)
				await handleAddConnection(buildConnectionFromDatabaseFile(path, type))
			}
		},
		[handleAddConnection, handleOpenDataFiles, resolveDatabaseType, toast]
	)

	return {
		handleAddConnection,
		handleCloseConnection,
		handleCloseConnectionsToLeft,
		handleCloseConnectionsToRight,
		handleCloseOtherConnections,
		handleConnectionSelect,
		handleDeleteConnection,
		handleDialogSave,
		handleEditConnection,
		handleOpenDataFiles,
		handleOpenNewConnection,
		handlePickDataFiles,
		processImmediateFileDrop,
		resolveDatabaseType
	}
}
