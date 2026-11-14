import { useMemo, useRef } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { useConnectionMutations } from '@studio/core/data-provider/hooks'
import { useSettings, type SettingsState } from '@studio/core/settings'
import {
	closeConnection,
	closeTabsForConnection,
	openConnectionDialog,
	readWorkspace,
	setActiveConnection,
	setConnectionDialogOpen
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
import { toast } from '@studio/shared/ui/use-toast'
import { mapConnectionError } from '@studio/shared/utils/error-messages'
import { requestAutoSelectFirstTable } from './auto-select'

export type ConnectionActions = ReturnType<typeof createConnectionActions>

type Mutations = ReturnType<typeof useConnectionMutations>

type Latest = {
	isTauri: boolean
	startupConnectionMode: SettingsState['startupConnectionMode']
	mutations: Mutations
}

type DumpTarget = { kind: 'file'; extension: string; label: string } | { kind: 'directory' }

/**
 * Where a dump of this engine lands: a single re-importable file, or — for
 * DuckDB, whose `EXPORT DATABASE` writes schema and Parquet/CSV side by side —
 * a folder.
 */
function resolveDumpTarget(connection: Connection): DumpTarget {
	switch (connection.type) {
		case 'duckdb':
			return { kind: 'directory' }
		case 'sqlite':
			return { kind: 'file', extension: 'sqlite', label: 'SQLite database' }
		default:
			return { kind: 'file', extension: 'sql', label: 'SQL dump' }
	}
}

function sanitizeFileName(name: string): string {
	const cleaned = name.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')
	return cleaned || 'dump'
}

/**
 * @name useConnectionActions
 * @description Returns the connection handlers as one object whose identity
 * never changes. The handlers read the store, the settings and the mutations
 * when they are called, so the hook subscribes to nothing that moves on a
 * connection or view switch and never invalidates a memoized child.
 *
 * @example
 * const actions = useConnectionActions()
 * actions.handleConnectionSelect(connectionId)
 */
export function useConnectionActions(): ConnectionActions {
	const isTauri = useIsTauri()
	const { settings } = useSettings()
	const mutations = useConnectionMutations()
	const latest = useRef<Latest>({
		isTauri,
		startupConnectionMode: settings.startupConnectionMode,
		mutations
	})
	latest.current = { isTauri, startupConnectionMode: settings.startupConnectionMode, mutations }

	return useMemo(function () {
		return createConnectionActions(function readLatest() {
			return latest.current
		})
	}, [])
}

function createConnectionActions(readLatest: () => Latest) {
	function findConnection(connectionId: string): Connection | undefined {
		return readWorkspace().connections.byId[connectionId]
	}

	async function probeDatabaseFileKind(path: string): Promise<DatabaseFileKind> {
		if (!readLatest().isTauri) return 'unknown'
		const result = await commands.probeDatabaseFile(path)
		return result.status === 'ok' ? result.data : 'unknown'
	}

	function resolveDatabaseType(path: string) {
		return resolveDatabaseTypeForPath(path, probeDatabaseFileKind)
	}

	async function handleAddConnection(
		connection: Omit<Connection, 'id' | 'status' | 'createdAt'>
	) {
		try {
			const dbInfo = frontendToBackendDatabaseInfo(connection as Connection)
			const newConnection = await readLatest().mutations.addConnection.mutateAsync({
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
	}

	async function handleUpdateConnection(
		editingConnectionId: string,
		connection: Omit<Connection, 'id' | 'status' | 'createdAt'>
	) {
		try {
			const dbInfo = frontendToBackendDatabaseInfo(connection as Connection)
			await readLatest().mutations.updateConnection.mutateAsync({
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
	}

	async function handleDialogSave(connectionData: Omit<Connection, 'id' | 'createdAt'>) {
		const editingConnectionId = readWorkspace().uiChrome.connectionDialog.editingConnectionId
		if (editingConnectionId) {
			await handleUpdateConnection(editingConnectionId, connectionData)
		} else {
			await handleAddConnection(connectionData)
		}
	}

	async function handleDeleteConnection(connectionId: string) {
		const connection = findConnection(connectionId)
		if (!connection) return
		try {
			await readLatest().mutations.removeConnection.mutateAsync(connection.id)
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
	}

	async function handleDumpConnection(connectionId: string) {
		const connection = findConnection(connectionId)
		if (!connection) return

		if (!readLatest().isTauri) {
			toast({
				title: 'Dump unavailable',
				description: 'Dumping a database requires the desktop app.',
				variant: 'destructive'
			})
			return
		}

		const target = resolveDumpTarget(connection)
		const { open, save } = await import('@tauri-apps/plugin-dialog')
		const outputPath =
			target.kind === 'directory'
				? await open({ directory: true, title: `Dump ${connection.name} into folder` })
				: await save({
						title: `Dump ${connection.name}`,
						defaultPath: `${sanitizeFileName(connection.name)}.${target.extension}`,
						filters: [{ name: target.label, extensions: [target.extension] }]
					})
		if (!outputPath || typeof outputPath !== 'string') return

		toast({
			title: 'Dumping database',
			description: `Writing ${connection.name} to ${outputPath}…`
		})

		try {
			const result = await commands.dumpDatabase(connectionId, outputPath)
			if (result.status !== 'ok') throw new Error(result.error.detail)

			const sizeKb = (result.data.size_bytes / 1024).toFixed(1)
			const rows = result.data.rows_dumped > 0 ? `, ${result.data.rows_dumped} rows` : ''
			toast({
				title: 'Dump complete',
				description: `${result.data.tables_dumped} tables${rows} (${sizeKb} KB) → ${result.data.file_path}`,
				variant: 'success'
			})
		} catch (error) {
			toast({
				title: 'Dump failed',
				description: error instanceof Error ? error.message : 'Unknown error',
				variant: 'destructive'
			})
		}
	}

	function handleConnectionSelect(connectionId: string) {
		setActiveConnection(connectionId)
		if (readLatest().startupConnectionMode === 'auto') requestAutoSelectFirstTable()
	}

	/**
	 * Close a connection tab (issue #96): disconnect its backend session and drop
	 * its tab group. The store picks the nearest remaining connection as active,
	 * or the empty state when none remain. The connection itself is NOT deleted —
	 * it stays in the saved connection list and can be reopened.
	 */
	function handleCloseConnection(connectionId: string) {
		closeConnection(connectionId)
		closeTabsForConnection(connectionId)
		readLatest().mutations.disconnectFromDatabase.mutate(connectionId)
	}

	function handleCloseOtherConnections(connectionId: string) {
		readWorkspace()
			.tabs.openConnectionIds.filter(function (id) {
				return id !== connectionId
			})
			.forEach(handleCloseConnection)
		setActiveConnection(connectionId)
	}

	function handleCloseConnectionsToLeft(connectionId: string) {
		const openConnectionIds = readWorkspace().tabs.openConnectionIds
		const connectionIndex = openConnectionIds.indexOf(connectionId)
		if (connectionIndex <= 0) return
		openConnectionIds.slice(0, connectionIndex).forEach(handleCloseConnection)
		setActiveConnection(connectionId)
	}

	function handleCloseConnectionsToRight(connectionId: string) {
		const openConnectionIds = readWorkspace().tabs.openConnectionIds
		const connectionIndex = openConnectionIds.indexOf(connectionId)
		if (connectionIndex < 0 || connectionIndex >= openConnectionIds.length - 1) return
		openConnectionIds.slice(connectionIndex + 1).forEach(handleCloseConnection)
		setActiveConnection(connectionId)
	}

	function handleEditConnection(connectionId: string) {
		openConnectionDialog(connectionId)
	}

	function handleOpenNewConnection() {
		openConnectionDialog(null)
	}

	async function handleOpenDataFiles(paths: string[]) {
		const dataFiles = classifyDroppedPaths(paths).dataFiles
		if (dataFiles.length === 0) return
		await handleAddConnection(buildConnectionFromDataFiles(dataFiles))
	}

	async function handlePickDataFiles() {
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
	}

	async function processImmediateFileDrop(paths: string[]) {
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
	}

	return {
		handleAddConnection,
		handleCloseConnection,
		handleCloseConnectionsToLeft,
		handleCloseConnectionsToRight,
		handleCloseOtherConnections,
		handleConnectionSelect,
		handleDeleteConnection,
		handleDialogSave,
		handleDumpConnection,
		handleEditConnection,
		handleOpenDataFiles,
		handleOpenNewConnection,
		handlePickDataFiles,
		processImmediateFileDrop,
		resolveDatabaseType
	}
}
