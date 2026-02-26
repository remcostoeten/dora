import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import { useAdapter } from '@/core/data-provider'
import { getAdapterError } from '@/core/data-provider/types'
import { useSettings } from '@/core/settings'
import { NavigationSidebar, SidebarProvider } from '@/features/app-sidebar'
import {
	loadConnections,
	addConnection as addConnectionApi,
	updateConnection as updateConnectionApi,
	removeConnection as removeConnectionApi,
	backendToFrontendConnection
} from '@/features/connections/api'
import { ConnectionDialog } from '@/features/connections/components/connection-dialog'
import { Connection } from '@/features/connections/types'
import { DatabaseStudio } from '@/features/database-studio/database-studio'
import { DockerView } from '@/features/docker-manager'
import { DatabaseSidebar } from '@/features/sidebar/database-sidebar'
import { SqlConsole } from '@/features/sql-console/sql-console'
import { WindowControls } from '@/components/window-controls'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@/shared/ui/alert-dialog'
import { ErrorBoundary } from '@/shared/ui/error-boundary'
import { mapConnectionError } from '@/shared/utils/error-messages'
import { EmptyState } from '@/shared/ui/empty-state'
import { NotImplemented } from '@/shared/ui/not-implemented'
import { Plug } from 'lucide-react'

export default function Index() {
	const [searchParams, setSearchParams] = useSearchParams()
	const [isSidebarOpen, setIsSidebarOpen] = useState(true)
	const [isLoading, setIsLoading] = useState(true)
	const adapter = useAdapter()
	const { settings, updateSetting, updateSettings, isLoading: isSettingsLoading } = useSettings()

	const urlView = searchParams.get('view')
	const urlTable = searchParams.get('table')
	const urlConnection = searchParams.get('connection')

	const [activeNavId, setActiveNavId] = useState<string>(() => {
		return urlView || 'database-studio'
	})

	const [selectedTableId, setSelectedTableId] = useState<string>(() => {
		return urlTable || ''
	})

	const [selectedTableName, setSelectedTableName] = useState('')
	const autoSelectFirstTableRef = useRef(false)
	const connectionInitializedRef = useRef(false)

	const [connections, setConnections] = useState<Connection[]>([])

	const [activeConnectionId, setActiveConnectionId] = useState<string>('')

	const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false)
	const [editingConnection, setEditingConnection] = useState<Connection | undefined>(undefined)

	// Delete confirmation dialog state
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null)
	const startupConnectionMode =
		settings.startupConnectionMode ?? (settings.restoreLastConnection ? 'auto' : 'empty')

	const { toast } = useToast()

	useEffect(() => {
		loadConnectionsFromBackend()
	}, [adapter])

	const isUpdatingUrlRef = useRef(false)

	useEffect(
		function syncUrlParams() {
			if (isUpdatingUrlRef.current) return

			const currentView = searchParams.get('view')
			const currentTable = searchParams.get('table')
			const currentConnection = searchParams.get('connection')

			const viewChanged = activeNavId && currentView !== activeNavId
			const tableChanged = selectedTableId && currentTable !== selectedTableId
			const connectionChanged = activeConnectionId && currentConnection !== activeConnectionId

			if (!viewChanged && !tableChanged && !connectionChanged) return

			const params = new URLSearchParams()

			if (activeNavId) params.set('view', activeNavId)
			if (selectedTableId) params.set('table', selectedTableId)
			if (activeConnectionId) params.set('connection', activeConnectionId)

			isUpdatingUrlRef.current = true
			setSearchParams(params, { replace: true })
			requestAnimationFrame(function () {
				isUpdatingUrlRef.current = false
			})
		},
		[activeNavId, selectedTableId, activeConnectionId, setSearchParams]
	)

	useEffect(() => {
		setSelectedTableName(selectedTableId)
	}, [selectedTableId])

	async function loadConnectionsFromBackend() {
		try {
			setIsLoading(true)
			const result = await adapter.getConnections()
			if (result.ok) {
				setConnections(result.data.map(backendToFrontendConnection))
			} else {
				throw new Error(getAdapterError(result))
			}
		} catch (error) {
			toast({
				title: 'Failed to Load Connections',
				description: mapConnectionError(error instanceof Error ? error : new Error('Unknown error')),
				variant: 'destructive'
			})
		} finally {
			setIsLoading(false)
		}
	}

	useEffect(
		function initializeConnection() {
			if (isSettingsLoading || isLoading) return
			if (connections.length === 0) return
			if (connectionInitializedRef.current) return

			if (urlConnection) {
				setActiveConnectionId(urlConnection)
				autoSelectFirstTableRef.current = true
				connectionInitializedRef.current = true
				return
			}

			if (activeConnectionId) {
				connectionInitializedRef.current = true
				return
			}

			if (startupConnectionMode === 'empty') {
				connectionInitializedRef.current = true
				return
			}

			if (settings.lastConnectionId) {
				const lastConnection = connections.find(function (c) {
					return c.id === settings.lastConnectionId
				})
				if (lastConnection) {
					setActiveConnectionId(lastConnection.id)
					if (settings.lastTableId) {
						setSelectedTableId(settings.lastTableId)
					}
					autoSelectFirstTableRef.current = true
					connectionInitializedRef.current = true
					return
				}
			}

			const isTauriRuntime =
				window.location.protocol === 'tauri:' ||
				'__TAURI__' in window ||
				'__TAURI_INTERNALS__' in window
			const isWebDemo =
				!isTauriRuntime &&
				(import.meta.env.MODE === 'demo' ||
					window.location.hostname.includes('demo') ||
					import.meta.env.VITE_IS_WEB === 'true')

			if (isWebDemo) {
				const demoConn =
					connections.find(function (c) {
						return c.id === 'demo-ecommerce-001'
					}) || connections[0]
				if (demoConn) {
					setActiveConnectionId(demoConn.id)
					autoSelectFirstTableRef.current = true
					connectionInitializedRef.current = true
					return
				}
			}

			const firstConnection = connections[0]
			if (firstConnection) {
				setActiveConnectionId(firstConnection.id)
				autoSelectFirstTableRef.current = true
				connectionInitializedRef.current = true
			}
		},
		[
			isSettingsLoading,
			isLoading,
			connections,
			urlConnection,
			activeConnectionId,
			startupConnectionMode,
			settings.restoreLastConnection,
			settings.lastConnectionId,
			settings.lastTableId
		]
	)

	useEffect(
		function saveLastConnection() {
			if (!activeConnectionId || isSettingsLoading) return

			const updates: Partial<typeof settings> = {}
			let hasUpdates = false

			if (settings.lastConnectionId !== activeConnectionId) {
				updates.lastConnectionId = activeConnectionId
				hasUpdates = true
			}

			if (selectedTableId && settings.lastTableId !== selectedTableId) {
				updates.lastTableId = selectedTableId
				hasUpdates = true
			}

			if (hasUpdates) {
				updateSettings(updates)
			}
		},
		[
			activeConnectionId,
			selectedTableId,
			isSettingsLoading,
			settings.lastConnectionId,
			settings.lastTableId,
			updateSettings
		]
	)

	async function handleAddConnection(newConnectionData: Omit<Connection, 'id' | 'createdAt'>) {
		try {
			// Create a temporary ID for the adapter call if needed, but the adapter should handle it
			// For now, we need to map frontend Connection format to what adapter expects
			// The adapter addConnection expects (name, databaseType, sshConfig)

			// NOTE: This part is tricky because frontend uses `Connection` object but adapter expects expanded args
			// We need to use the `frontendToBackendDatabaseInfo` helper or similar logic
			// But `frontendToBackendDatabaseInfo` is in `api.ts`.
			// Ideally, the adapter should accept a strictly typed object, but `addConnection` signature is:
			// addConnection(name: string, databaseType: DatabaseInfo, sshConfig: JsonValue | null)

			// Let's import the helper to convert type
			// Wait, `adapter.addConnection` is the lower level API.
			// The `Connection` type in `Index.tsx` is `FrontendConnection`.

			// Let's rely on the helper which we should import.
			// BUT `api.ts` is deprecated ideally. We should move that helper to a shared location or `types.ts`.

			// For now, let's keep importing helper from `api.ts` since it's just a pure function
			const { frontendToBackendDatabaseInfo } = await import('@/features/connections/api')

			const dbInfo = frontendToBackendDatabaseInfo(newConnectionData as Connection)
			const result = await adapter.addConnection(newConnectionData.name, dbInfo, null)

			if (result.ok) {
				// Adapter returns connection info, we might need to fetch all again or convert it back
				// Adapter `addConnection` returns `ConnectionInfo` (backend type)
				// We need `backendToFrontendConnection` to update state locally without refetch
				const { backendToFrontendConnection } = await import('@/features/connections/api')
				const newFrontendConn = backendToFrontendConnection(result.data)

				setConnections(function (prev) {
					return [...prev, newFrontendConn]
				})
				setActiveConnectionId(newFrontendConn.id)
				autoSelectFirstTableRef.current = true
				toast({
					title: 'Connection Added',
					description: `Successfully connected to ${newFrontendConn.name}`
				})
			} else {
				throw new Error(getAdapterError(result))
			}
		} catch (error) {
			toast({
				title: 'Failed to Add Connection',
				description: mapConnectionError(error instanceof Error ? error : new Error('Unknown error')),
				variant: 'destructive'
			})
		}
	}

	async function handleUpdateConnection(connectionData: Omit<Connection, 'id' | 'createdAt'>) {
		if (!editingConnection) return

		try {
			const { frontendToBackendDatabaseInfo, backendToFrontendConnection } =
				await import('@/features/connections/api')

			// We need to construct a full connection object to get the DatabaseInfo
			const tempConn = {
				...connectionData,
				id: editingConnection.id,
				createdAt: editingConnection.createdAt
			} as Connection
			const dbInfo = frontendToBackendDatabaseInfo(tempConn)

			const result = await adapter.updateConnection(
				editingConnection.id,
				connectionData.name,
				dbInfo,
				null
			)

			if (result.ok) {
				const updatedConnection = backendToFrontendConnection(result.data)
				setConnections(function (prev) {
					return prev.map(function (c) {
						return c.id === updatedConnection.id ? updatedConnection : c
					})
				})
				toast({
					title: 'Connection Updated',
					description: `Successfully updated ${updatedConnection.name}`
				})
			} else {
				throw new Error(getAdapterError(result))
			}
		} catch (error) {
			toast({
				title: 'Failed to Update Connection',
				description: mapConnectionError(error instanceof Error ? error : new Error('Unknown error')),
				variant: 'destructive'
			})
		}
	}

	async function handleConnectionSelect(connectionId: string) {
		setActiveConnectionId(connectionId)
		// Reset table selection when switching connections
		setSelectedTableId('')
		setSelectedTableName('')
		autoSelectFirstTableRef.current = false
		// No need to reload all connections when selecting one
		// The connection state will be updated by the backend when connecting
	}

	function handleViewConnection(connectionId: string) {
		const connection = connections.find(function (c) {
			return c.id === connectionId
		})
		if (connection) {
			setEditingConnection(connection)
			setIsConnectionDialogOpen(true)
		}
	}

	function handleEditConnection(connectionId: string) {
		const connection = connections.find(function (c) {
			return c.id === connectionId
		})
		if (connection) {
			setEditingConnection(connection)
			setIsConnectionDialogOpen(true)
		}
	}

	function handleDeleteConnection(connectionId: string) {
		const connection = connections.find(function (c) {
			return c.id === connectionId
		})
		if (connection) {
			if (settings.confirmBeforeDelete) {
				setConnectionToDelete(connection)
				setDeleteDialogOpen(true)
			} else {
				performDelete(connection)
			}
		}
	}

	async function confirmDeleteConnection() {
		if (!connectionToDelete) return
		await performDelete(connectionToDelete)
	}

	async function performDelete(connection: Connection) {
		try {
			const result = await adapter.removeConnection(connection.id)

			if (result.ok) {
				setConnections(function (prev) {
					return prev.filter(function (c) {
						return c.id !== connection.id
					})
				})
				if (activeConnectionId === connection.id) {
					setActiveConnectionId('')
					setSelectedTableId('')
					setSelectedTableName('')
					autoSelectFirstTableRef.current = false
				}
				toast({
					title: 'Connection Deleted',
					description: `Successfully deleted ${connection.name}`
				})
			} else {
				throw new Error(getAdapterError(result))
			}
		} catch (error) {
			toast({
				title: 'Failed to Delete Connection',
				description: mapConnectionError(error instanceof Error ? error : new Error('Unknown error')),
				variant: 'destructive'
			})
		} finally {
			setDeleteDialogOpen(false)
			setConnectionToDelete(null)
		}
	}

	function handleOpenNewConnection() {
		setEditingConnection(undefined)
		setIsConnectionDialogOpen(true)
	}

	async function handleDialogSave(connectionData: Omit<Connection, 'id' | 'createdAt'>) {
		if (editingConnection) {
			await handleUpdateConnection(connectionData)
		} else {
			await handleAddConnection(connectionData)
		}
	}

	const handleTableSelect = useCallback((id: string, name: string) => {
		setSelectedTableId(id)
		setSelectedTableName(name)
	}, [])

	const handleAutoSelectComplete = useCallback(() => {
		autoSelectFirstTableRef.current = false
	}, [])

	// Show database panel for sql-console and database-studio views
	const showDatabasePanel = activeNavId === 'sql-console' || activeNavId === 'database-studio'

	return (
		<TooltipProvider>
			<SidebarProvider>
				<div className='flex flex-col h-full w-full bg-background overflow-hidden'>
					<div
						className='flex items-center justify-end h-8 w-full shrink-0 bg-sidebar border-b border-border'
						data-tauri-drag-region='true'
					>
						<WindowControls className='pr-2' />
					</div>
					<div className='flex flex-1 overflow-hidden'>
						<NavigationSidebar activeNavId={activeNavId} onNavSelect={setActiveNavId} />

						{showDatabasePanel && isSidebarOpen && (
							<DatabaseSidebar
								activeNavId={activeNavId}
								onNavSelect={setActiveNavId}
								onTableSelect={handleTableSelect}
								selectedTableId={selectedTableId}
								autoSelectFirstTable={autoSelectFirstTableRef.current}
								onAutoSelectComplete={handleAutoSelectComplete}
								connections={connections}
								activeConnectionId={activeConnectionId}
								onConnectionSelect={handleConnectionSelect}
								onAddConnection={handleOpenNewConnection}
								onManageConnections={function () {
									const activeConn = connections.find(function (c) {
										return c.id === activeConnectionId
									})
									if (activeConn) {
										setEditingConnection(activeConn)
										setIsConnectionDialogOpen(true)
									}
								}}
								onViewConnection={handleViewConnection}
								onEditConnection={handleEditConnection}
								onDeleteConnection={handleDeleteConnection}
							/>
						)}

						<main className='flex-1 flex flex-col h-full overflow-hidden relative px-0 pb-2'>
							{connections.length === 0 && !isLoading && (activeNavId === 'database-studio' || activeNavId === 'sql-console') ? (
								<EmptyState
									icon={<Plug className='h-16 w-16' />}
									title='No Connections'
									description='Add a database connection to start exploring your data.'
									action={{
										label: 'Add Connection',
										onClick: handleOpenNewConnection
									}}
								/>
							) : activeNavId === 'database-studio' ? (
								<ErrorBoundary feature='Database Studio'>
									<DatabaseStudio
										tableId={selectedTableId}
										tableName={selectedTableName}
										isSidebarOpen={isSidebarOpen}
										onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
										initialRowPK={settings.lastRowPK}
										onRowSelectionChange={(pk) => {
											if (pk !== settings.lastRowPK) {
												updateSetting('lastRowPK', pk)
											}
										}}
										activeConnectionId={activeConnectionId}
										onAddConnection={handleOpenNewConnection}
									/>
								</ErrorBoundary>
							) : activeNavId === 'sql-console' ? (
								<ErrorBoundary feature='SQL Console'>
									<SqlConsole
										onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
										activeConnectionId={activeConnectionId}
									/>
								</ErrorBoundary>
							) : activeNavId === 'docker' ? (
								<ErrorBoundary feature='Docker Manager'>
									<DockerView
									onOpenInDataViewer={async function (container) {
										const userEnv = container.env.find(function (e) {
											return e.startsWith('POSTGRES_USER=')
										})
										const passEnv = container.env.find(function (e) {
											return e.startsWith('POSTGRES_PASSWORD=')
										})
										const dbEnv = container.env.find(function (e) {
											return e.startsWith('POSTGRES_DB=')
										})
										const primaryPort = container.ports.find(function (p) {
											return p.containerPort === 5432
										})

										const user = userEnv ? userEnv.split('=')[1] : 'postgres'
										const password = passEnv
											? passEnv.split('=')[1]
											: 'postgres'
										const database = dbEnv ? dbEnv.split('=')[1] : 'postgres'
										const port = primaryPort ? primaryPort.hostPort : 5432

										const connectionData = {
											name: container.name,
											type: 'postgres' as const,
											host: 'localhost',
											port,
											user,
											password,
											database
										}

										await handleAddConnection(connectionData)
										setActiveNavId('database-studio')
									}}
								/>
								</ErrorBoundary>
							) : activeNavId === 'dora' ? (
								<div className='flex-1 flex items-center justify-center'>
									<NotImplemented
										feature='Dora AI Assistant'
										description='Natural language queries, schema explanations, and AI-powered SQL generation. Coming in v1.1.'
									/>
								</div>
							) : (
								<ErrorBoundary feature='SQL Console'>
									<SqlConsole
										onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
										activeConnectionId={activeConnectionId}
									/>
								</ErrorBoundary>
							)}
						</main>

						<ConnectionDialog
							open={isConnectionDialogOpen}
							onOpenChange={(open) => {
								setIsConnectionDialogOpen(open)
								if (!open) setEditingConnection(undefined)
							}}
							onSave={handleDialogSave}
							initialValues={editingConnection}
						/>

						<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete Connection</AlertDialogTitle>
									<AlertDialogDescription>
										Are you sure you want to delete "{connectionToDelete?.name}
										"? This action cannot be undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel onClick={() => setConnectionToDelete(null)}>
										Cancel
									</AlertDialogCancel>
									<AlertDialogAction onClick={confirmDeleteConnection}>
										Delete
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</div>
			</SidebarProvider>
		</TooltipProvider>
	)
}
