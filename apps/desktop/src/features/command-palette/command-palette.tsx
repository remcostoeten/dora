import {
	ArrowLeft,
	ArrowRight,
	Blocks,
	Container,
	Database,
	FolderTree,
	History,
	Keyboard,
	PanelLeft,
	Plus,
	Search,
	TerminalSquare,
	Trash2,
	Pencil,
	Table2,
	Play,
	Square,
	RotateCw,
	Copy,
	Code2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAdapter } from '@/core/data-provider'
import type { Connection } from '@/features/connections/types'
import {
	dispatchDockerPaletteCommand,
	dispatchSqlConsolePaletteCommand
} from '@/features/command-palette/events'
import {
	useContainers,
	useDockerAvailability
} from '@/features/docker-manager/api/queries/use-containers'
import type { DockerContainer } from '@/features/docker-manager/types'
import { useQueryHistory } from '@/features/sql-console/stores/query-history-store'
import type { SqlSnippet, TableInfo } from '@/features/sql-console/types'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { getTableRefId, getTableSqlIdentifier } from '@/shared/utils/table-ref'
import { cn } from '@/shared/utils/cn'

type NavigationTarget = 'database-studio' | 'sql-console' | 'docker'

type CommandPaletteProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	activeNavId: string
	onNavigate: (view: NavigationTarget) => void
	connections: Connection[]
	activeConnectionId: string
	selectedTableId: string
	onSelectConnection: (connectionId: string) => Promise<void> | void
	onCreateConnection: () => void
	onEditConnection: (connectionId: string) => void
	onDeleteConnection: (connectionId: string) => void
	onSelectTable: (tableId: string, tableName: string) => void
}

type PaletteRoute =
	| { kind: 'root' }
	| { kind: 'navigation' }
	| { kind: 'connections' }
	| { kind: 'connection'; connectionId: string }
	| { kind: 'tables' }
	| { kind: 'table'; tableId: string }
	| { kind: 'snippets' }
	| { kind: 'snippet'; snippetId: string }
	| { kind: 'history' }
	| { kind: 'history-entry'; historyId: string }
	| { kind: 'docker' }
	| { kind: 'container'; containerId: string }

type PaletteItem = {
	id: string
	title: string
	subtitle?: string
	group: string
	icon: ReactNode
	keywords?: string[]
	accessory?: string
	details?: string[]
	onSelect?: () => Promise<void> | void
	onOpenDetail?: () => void
	closeOnSelect?: boolean
	disabled?: boolean
}

type PalettePage = {
	title: string
	subtitle: string
	placeholder: string
	emptyTitle: string
	emptyDescription: string
	items: PaletteItem[]
}

const ROOT_ROUTE: PaletteRoute = { kind: 'root' }

function inferSnippetMode(query: string): 'sql' | 'drizzle' {
	const normalized = query.toLowerCase()
	if (
		normalized.includes('db.select') ||
		normalized.includes('db.insert') ||
		normalized.includes('db.update') ||
		normalized.includes('db.delete') ||
		normalized.includes('.from(')
	) {
		return 'drizzle'
	}

	return 'sql'
}

function normalizeSearch(value: string) {
	return value.trim().toLowerCase()
}

function getSearchScore(item: PaletteItem, query: string) {
	if (!query) return 0

	const haystacks = [
		item.title,
		item.subtitle || '',
		item.group,
		...(item.keywords || []),
		...(item.details || [])
	].map(function (value) {
		return value.toLowerCase()
	})

	let bestScore: number | null = null

	for (const haystack of haystacks) {
		if (!haystack) continue

		if (haystack === query) {
			bestScore = bestScore === null ? 0 : Math.min(bestScore, 0)
			continue
		}

		if (haystack.startsWith(query)) {
			bestScore = bestScore === null ? 1 : Math.min(bestScore, 1)
			continue
		}

		const containsIndex = haystack.indexOf(query)
		if (containsIndex >= 0) {
			bestScore = bestScore === null ? 10 + containsIndex : Math.min(bestScore, 10 + containsIndex)
			continue
		}

		let qIndex = 0
		let gaps = 0
		for (let index = 0; index < haystack.length && qIndex < query.length; index += 1) {
			if (haystack[index] === query[qIndex]) {
				qIndex += 1
			} else if (qIndex > 0) {
				gaps += 1
			}
		}

		if (qIndex === query.length) {
			bestScore = bestScore === null ? 100 + gaps : Math.min(bestScore, 100 + gaps)
		}
	}

	return bestScore
}

function formatConnectionTarget(connection: Connection) {
	if (connection.type === 'sqlite' || connection.type === 'libsql') {
		return connection.database || connection.url || connection.type
	}

	const host = connection.host || 'localhost'
	const port = connection.port ? `:${connection.port}` : ''
	const database = connection.database ? `/${connection.database}` : ''
	return `${host}${port}${database}`
}

function formatRelativeTime(timestamp: number) {
	const diffMs = Date.now() - timestamp
	const diffMinutes = Math.floor(diffMs / 60000)

	if (diffMinutes < 1) return 'Just now'
	if (diffMinutes < 60) return `${diffMinutes}m ago`

	const diffHours = Math.floor(diffMinutes / 60)
	if (diffHours < 24) return `${diffHours}h ago`

	const diffDays = Math.floor(diffHours / 24)
	if (diffDays < 7) return `${diffDays}d ago`

	return new Date(timestamp).toLocaleDateString()
}

async function copyToClipboard(value: string) {
	await navigator.clipboard.writeText(value)
}

export function CommandPalette({
	open,
	onOpenChange,
	activeNavId,
	onNavigate,
	connections,
	activeConnectionId,
	selectedTableId,
	onSelectConnection,
	onCreateConnection,
	onEditConnection,
	onDeleteConnection,
	onSelectTable
}: CommandPaletteProps) {
	const adapter = useAdapter()
	const inputRef = useRef<HTMLInputElement>(null)
	const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
	const [query, setQuery] = useState('')
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [stack, setStack] = useState<PaletteRoute[]>([ROOT_ROUTE])
	const [tables, setTables] = useState<TableInfo[]>([])
	const [snippets, setSnippets] = useState<SqlSnippet[]>([])

	const { history } = useQueryHistory()
	const { data: dockerStatus } = useDockerAvailability()
	const { data: containers = [] } = useContainers({
		showExternal: true,
		enabled: open && (dockerStatus?.available ?? false)
	})

	const activeConnection = useMemo(
		function () {
			return connections.find(function (connection) {
				return connection.id === activeConnectionId
			}) ?? null
		},
		[connections, activeConnectionId]
	)

	const currentRoute = stack[stack.length - 1] ?? ROOT_ROUTE

	const closePalette = useCallback(
		function () {
			onOpenChange(false)
			setQuery('')
			setSelectedIndex(0)
			setStack([ROOT_ROUTE])
		},
		[onOpenChange]
	)

	const scheduleAfterNavigation = useCallback(function (callback: () => void) {
		requestAnimationFrame(function () {
			requestAnimationFrame(callback)
		})
	}, [])

	useEffect(
		function resetPaletteOnOpen() {
			if (!open) {
				return
			}

			setQuery('')
			setSelectedIndex(0)
			setStack([ROOT_ROUTE])

			requestAnimationFrame(function () {
				inputRef.current?.focus()
				inputRef.current?.select()
			})
		},
		[open]
	)

	useEffect(
		function keepSelectionInBounds() {
			setSelectedIndex(function (currentIndex) {
				if (currentIndex < 0) return 0
				return currentIndex
			})
		},
		[currentRoute, query]
	)

	useEffect(
		function scrollSelectedItemIntoView() {
			const node = itemRefs.current[selectedIndex]
			node?.scrollIntoView({ block: 'nearest' })
		},
		[selectedIndex]
	)

	useEffect(
		function loadTablesForActiveConnection() {
			let cancelled = false

			if (!open || !activeConnectionId) {
				setTables([])
				return
			}

			async function loadTables() {
				try {
					await adapter.connectToDatabase(activeConnectionId)
					const result = await adapter.getSchema(activeConnectionId)
					if (cancelled || !result.ok || !result.data.tables) {
						return
					}

					setTables(
						result.data.tables.map(function (table) {
							return {
								name: table.name,
								schema: table.schema,
								type: 'table',
								rowCount: table.row_count_estimate ?? 0,
								columns: table.columns.map(function (column) {
									return {
										name: column.name,
										type: column.data_type,
										nullable: column.is_nullable,
										primaryKey: column.is_primary_key
									}
								})
							}
						})
					)
				} catch (error) {
					if (!cancelled) {
						console.error('Failed to load tables for command palette:', error)
						setTables([])
					}
				}
			}

			loadTables()

			return function () {
				cancelled = true
			}
		},
		[adapter, activeConnectionId, open]
	)

	useEffect(
		function loadSnippetsForPalette() {
			let cancelled = false

			if (!open) {
				setSnippets([])
				return
			}

			async function loadSnippets() {
				try {
					const [scriptsRes, foldersRes] = await Promise.all([
						adapter.getScripts(activeConnectionId || null),
						adapter.getSnippetFolders()
					])

					if (cancelled) return

					const nextSnippets: SqlSnippet[] = []

					if (foldersRes.ok) {
						foldersRes.data.forEach(function (folder) {
							nextSnippets.push({
								id: `folder-${folder.id}`,
								name: folder.name,
								content: '',
								createdAt: new Date(folder.created_at),
								updatedAt: new Date(folder.updated_at),
								isFolder: true,
								parentId: folder.parent_id ? `folder-${folder.parent_id}` : null
							})
						})
					}

					if (scriptsRes.ok) {
						scriptsRes.data.forEach(function (script) {
							const folderId = (
								script as typeof script & { folder_id?: number | null }
							).folder_id

							nextSnippets.push({
								id: script.id.toString(),
								name: script.name,
								content: script.query_text,
								createdAt: new Date(script.updated_at),
								updatedAt: new Date(script.updated_at),
								isFolder: false,
								parentId: folderId ? `folder-${folderId}` : null
							})
						})
					}

					setSnippets(nextSnippets)
				} catch (error) {
					if (!cancelled) {
						console.error('Failed to load snippets for command palette:', error)
						setSnippets([])
					}
				}
			}

			loadSnippets()

			return function () {
				cancelled = true
			}
		},
		[adapter, activeConnectionId, open]
	)

	const pushRoute = useCallback(function (route: PaletteRoute) {
		setStack(function (currentStack) {
			return [...currentStack, route]
		})
		setQuery('')
		setSelectedIndex(0)
	}, [])

	const popRoute = useCallback(function () {
		setStack(function (currentStack) {
			if (currentStack.length <= 1) return currentStack
			return currentStack.slice(0, -1)
		})
		setQuery('')
		setSelectedIndex(0)
	}, [])

	const runSqlConsoleAction = useCallback(
		function (detail: Parameters<typeof dispatchSqlConsolePaletteCommand>[0]) {
			closePalette()
			onNavigate('sql-console')
			scheduleAfterNavigation(function () {
				dispatchSqlConsolePaletteCommand(detail)
			})
		},
		[closePalette, onNavigate, scheduleAfterNavigation]
	)

	const runDockerAction = useCallback(
		function (detail: Parameters<typeof dispatchDockerPaletteCommand>[0]) {
			closePalette()
			onNavigate('docker')
			scheduleAfterNavigation(function () {
				dispatchDockerPaletteCommand(detail)
			})
		},
		[closePalette, onNavigate, scheduleAfterNavigation]
	)

	const page = useMemo<PalettePage>(
		function () {
			if (currentRoute.kind === 'root') {
				const lastHistoryItem = history[0]
				const selectedTable = tables.find(function (table) {
					return getTableRefId(table) === selectedTableId
				})

				return {
					title: 'Command Center',
					subtitle: 'Keyboard-first actions, routing, and live Dora data.',
					placeholder: 'Search actions, tables, snippets, and containers...',
					emptyTitle: 'No commands match',
					emptyDescription: 'Try a broader search or move into a different section.',
					items: [
						{
							id: 'root-nav',
							title: 'Navigation',
							subtitle: 'Switch between Database Studio, SQL Console, and Docker.',
							group: 'Browse',
							icon: <PanelLeft className='h-4 w-4' />,
							keywords: ['views', 'routes', 'pages'],
							details: ['Jump across Dora surfaces from one keyboard-first entry point.'],
							onOpenDetail: function () {
								pushRoute({ kind: 'navigation' })
							}
						},
						{
							id: 'root-connections',
							title: 'Connections',
							subtitle: `${connections.length} saved database connection${connections.length === 1 ? '' : 's'}.`,
							group: 'Browse',
							icon: <Database className='h-4 w-4' />,
							keywords: ['postgres', 'sqlite', 'libsql', 'mysql'],
							details: ['Select, inspect, edit, or delete existing connections.'],
							onOpenDetail: function () {
								pushRoute({ kind: 'connections' })
							}
						},
						{
							id: 'root-tables',
							title: 'Tables',
							subtitle: activeConnection
								? `Browse ${activeConnection.name} schema and open tables directly.`
								: 'Select a connection first to browse tables.',
							group: 'Browse',
							icon: <Table2 className='h-4 w-4' />,
							keywords: ['schema', 'viewer', 'rows'],
							details: ['Open tables in Database Studio or scaffold a query in SQL Console.'],
							onOpenDetail: function () {
								pushRoute({ kind: 'tables' })
							},
							disabled: !activeConnection
						},
						{
							id: 'root-snippets',
							title: 'Snippets',
							subtitle: 'Jump into saved SQL and Drizzle snippets.',
							group: 'Browse',
							icon: <FolderTree className='h-4 w-4' />,
							keywords: ['saved query', 'scripts', 'folders'],
							details: ['Open saved snippets and route them into the console.'],
							onOpenDetail: function () {
								pushRoute({ kind: 'snippets' })
							}
						},
						{
							id: 'root-history',
							title: 'Query History',
							subtitle: `${history.length} recent query execution${history.length === 1 ? '' : 's'}.`,
							group: 'Browse',
							icon: <History className='h-4 w-4' />,
							keywords: ['recent', 'queries', 'replay'],
							details: ['Replay recent queries directly into the console.'],
							onOpenDetail: function () {
								pushRoute({ kind: 'history' })
							}
						},
						{
							id: 'root-docker',
							title: 'Docker',
							subtitle: `${containers.length} container${containers.length === 1 ? '' : 's'} available to manage.`,
							group: 'Browse',
							icon: <Container className='h-4 w-4' />,
							keywords: ['postgres container', 'terminal', 'seed'],
							details: ['Open containers, start and stop them, or jump into the terminal.'],
							onOpenDetail: function () {
								pushRoute({ kind: 'docker' })
							}
						},
						{
							id: 'root-open-db',
							title: 'Open Database Studio',
							subtitle: 'Jump into the data viewer.',
							group: 'Quick Actions',
							icon: <Blocks className='h-4 w-4' />,
							keywords: ['data viewer', 'studio'],
							details: ['Switch to Database Studio instantly.'],
							onSelect: function () {
								closePalette()
								onNavigate('database-studio')
							}
						},
						{
							id: 'root-open-sql',
							title: 'Open SQL Console',
							subtitle: 'Switch to query mode.',
							group: 'Quick Actions',
							icon: <TerminalSquare className='h-4 w-4' />,
							keywords: ['sql', 'drizzle', 'query'],
							details: ['Open the console without changing the current query.'],
							onSelect: function () {
								closePalette()
								onNavigate('sql-console')
							}
						},
						{
							id: 'root-open-docker',
							title: 'Open Docker Manager',
							subtitle: 'Switch to container controls.',
							group: 'Quick Actions',
							icon: <Container className='h-4 w-4' />,
							keywords: ['docker', 'containers'],
							details: ['Open Dora’s managed PostgreSQL container workspace.'],
							onSelect: function () {
								closePalette()
								onNavigate('docker')
							}
						},
						{
							id: 'root-new-connection',
							title: 'New Connection',
							subtitle: 'Open the connection dialog.',
							group: 'Quick Actions',
							icon: <Plus className='h-4 w-4' />,
							keywords: ['add connection', 'database'],
							details: ['Create a new Postgres, SQLite, or LibSQL connection.'],
							onSelect: function () {
								closePalette()
								onCreateConnection()
							}
						},
						activeConnection
							? {
									id: 'root-active-connection',
									title: activeConnection.name,
									subtitle: `Active connection · ${formatConnectionTarget(activeConnection)}`,
									group: 'Recents',
									icon: <Database className='h-4 w-4' />,
									keywords: [activeConnection.type, 'active'],
									accessory: activeConnection.type.toUpperCase(),
									details: ['Current active connection.', `Type: ${activeConnection.type}`],
									onOpenDetail: function () {
										pushRoute({ kind: 'connection', connectionId: activeConnection.id })
									},
									onSelect: function () {
										closePalette()
										onNavigate('database-studio')
									}
								}
							: null,
						selectedTable
							? {
									id: 'root-active-table',
									title: selectedTable.name,
									subtitle: 'Currently selected table.',
									group: 'Recents',
									icon: <Table2 className='h-4 w-4' />,
									keywords: [selectedTable.schema || '', 'selected table'],
									accessory: selectedTable.schema || 'public',
									details: [
										`Rows: ${selectedTable.rowCount}`,
										`Columns: ${selectedTable.columns?.length || 0}`
									],
									onOpenDetail: function () {
										pushRoute({
											kind: 'table',
											tableId: getTableRefId(selectedTable)
										})
									},
									onSelect: function () {
										closePalette()
										onNavigate('database-studio')
									}
								}
							: null,
						lastHistoryItem
							? {
									id: 'root-last-query',
									title: 'Replay last query',
									subtitle: lastHistoryItem.query.split('\n')[0] || 'Recent query',
									group: 'Recents',
									icon: <History className='h-4 w-4' />,
									keywords: ['recent query', 'replay', lastHistoryItem.query],
									accessory: formatRelativeTime(lastHistoryItem.timestamp),
									details: [
										lastHistoryItem.query,
										lastHistoryItem.success ? 'Last run succeeded.' : 'Last run failed.'
									],
									onOpenDetail: function () {
										pushRoute({
											kind: 'history-entry',
											historyId: lastHistoryItem.id
										})
									},
									onSelect: function () {
										runSqlConsoleAction({
											type: 'load-query',
											query: lastHistoryItem.query,
											mode: inferSnippetMode(lastHistoryItem.query),
											execute: true
										})
									}
								}
							: null
					].filter(Boolean) as PaletteItem[]
				}
			}

			if (currentRoute.kind === 'navigation') {
				return {
					title: 'Navigation',
					subtitle: 'Core Dora surfaces.',
					placeholder: 'Search views...',
					emptyTitle: 'No views found',
					emptyDescription: 'Try searching for studio, console, or docker.',
					items: [
						{
							id: 'nav-database-studio',
							title: 'Database Studio',
							subtitle: 'Browse tables and edit data.',
							group: 'Views',
							icon: <Blocks className='h-4 w-4' />,
							keywords: ['viewer', 'data grid'],
							accessory: activeNavId === 'database-studio' ? 'Active' : undefined,
							details: ['Primary data viewer for browsing and editing rows.'],
							onSelect: function () {
								closePalette()
								onNavigate('database-studio')
							}
						},
						{
							id: 'nav-sql-console',
							title: 'SQL Console',
							subtitle: 'Run SQL and Drizzle queries.',
							group: 'Views',
							icon: <TerminalSquare className='h-4 w-4' />,
							keywords: ['query', 'drizzle', 'editor'],
							accessory: activeNavId === 'sql-console' ? 'Active' : undefined,
							details: ['Custom executable editor for SQL and Drizzle syntax.'],
							onSelect: function () {
								closePalette()
								onNavigate('sql-console')
							}
						},
						{
							id: 'nav-docker',
							title: 'Docker Manager',
							subtitle: 'Run and inspect PostgreSQL containers.',
							group: 'Views',
							icon: <Container className='h-4 w-4' />,
							keywords: ['containers', 'terminal'],
							accessory: activeNavId === 'docker' ? 'Active' : undefined,
							details: ['Local Postgres container lifecycle and terminal controls.'],
							onSelect: function () {
								closePalette()
								onNavigate('docker')
							}
						}
					]
				}
			}

			if (currentRoute.kind === 'connections') {
				return {
					title: 'Connections',
					subtitle: 'Saved database connections.',
					placeholder: 'Search connections...',
					emptyTitle: 'No connections available',
					emptyDescription: 'Create a connection to start exploring data.',
					items: [
						{
							id: 'connections-new',
							title: 'New Connection',
							subtitle: 'Open the connection dialog.',
							group: 'Actions',
							icon: <Plus className='h-4 w-4' />,
							keywords: ['add', 'database'],
							details: ['Create a new connection from the palette.'],
							onSelect: function () {
								closePalette()
								onCreateConnection()
							}
						},
						...connections.map(function (connection) {
							return {
								id: `connection-${connection.id}`,
								title: connection.name,
								subtitle: formatConnectionTarget(connection),
								group: 'Saved Connections',
								icon: <Database className='h-4 w-4' />,
								keywords: [connection.type, connection.database || '', connection.host || ''],
								accessory:
									connection.id === activeConnectionId ? 'Active' : connection.type.toUpperCase(),
								details: [
									`Type: ${connection.type}`,
									`Target: ${formatConnectionTarget(connection)}`
								],
								onSelect: async function () {
									await onSelectConnection(connection.id)
									closePalette()
								},
								onOpenDetail: function () {
									pushRoute({ kind: 'connection', connectionId: connection.id })
								}
							} satisfies PaletteItem
						})
					]
				}
			}

			if (currentRoute.kind === 'connection') {
				const connection = connections.find(function (item) {
					return item.id === currentRoute.connectionId
				})

				if (!connection) {
					return {
						title: 'Connection',
						subtitle: 'Connection not found.',
						placeholder: 'Search actions...',
						emptyTitle: 'Connection missing',
						emptyDescription: 'This connection may have been deleted.',
						items: []
					}
				}

				return {
					title: connection.name,
					subtitle: formatConnectionTarget(connection),
					placeholder: 'Search connection actions...',
					emptyTitle: 'No actions found',
					emptyDescription: 'Try edit, delete, or open a different connection.',
					items: [
						{
							id: `connection-select-${connection.id}`,
							title: 'Select Connection',
							subtitle: 'Make this the active database.',
							group: 'Actions',
							icon: <Play className='h-4 w-4' />,
							keywords: ['activate', 'switch'],
							accessory: connection.id === activeConnectionId ? 'Active' : undefined,
							details: ['Switch Dora to this database connection.'],
							onSelect: async function () {
								await onSelectConnection(connection.id)
								closePalette()
							}
						},
						{
							id: `connection-open-viewer-${connection.id}`,
							title: 'Open In Database Studio',
							subtitle: 'Switch to the data viewer.',
							group: 'Actions',
							icon: <Blocks className='h-4 w-4' />,
							keywords: ['viewer', 'studio'],
							details: ['Activate the connection and open Database Studio.'],
							onSelect: async function () {
								await onSelectConnection(connection.id)
								closePalette()
								onNavigate('database-studio')
							}
						},
						{
							id: `connection-open-sql-${connection.id}`,
							title: 'Open In SQL Console',
							subtitle: 'Switch to query mode for this connection.',
							group: 'Actions',
							icon: <TerminalSquare className='h-4 w-4' />,
							keywords: ['query', 'console'],
							details: ['Activate the connection and open SQL Console.'],
							onSelect: async function () {
								await onSelectConnection(connection.id)
								closePalette()
								onNavigate('sql-console')
							}
						},
						{
							id: `connection-edit-${connection.id}`,
							title: 'Edit Connection',
							subtitle: 'Open the connection dialog for this database.',
							group: 'Manage',
							icon: <Pencil className='h-4 w-4' />,
							keywords: ['settings', 'credentials'],
							details: ['Edit connection metadata and credentials.'],
							onSelect: function () {
								closePalette()
								onEditConnection(connection.id)
							}
						},
						{
							id: `connection-delete-${connection.id}`,
							title: 'Delete Connection',
							subtitle: 'Remove this connection from Dora.',
							group: 'Manage',
							icon: <Trash2 className='h-4 w-4' />,
							keywords: ['remove', 'destructive'],
							details: ['Delete the saved connection. Confirmation follows your safety settings.'],
							onSelect: function () {
								closePalette()
								onDeleteConnection(connection.id)
							}
						}
					]
				}
			}

			if (currentRoute.kind === 'tables') {
				return {
					title: 'Tables',
					subtitle: activeConnection
						? `Schema for ${activeConnection.name}.`
						: 'Select a connection to browse tables.',
					placeholder: 'Search tables...',
					emptyTitle: activeConnection ? 'No tables available' : 'No connection selected',
					emptyDescription: activeConnection
						? 'This connection did not return any tables.'
						: 'Choose an active connection first.',
					items: tables.map(function (table) {
						const tableId = getTableRefId(table)
						return {
							id: `table-${tableId}`,
							title: table.name,
							subtitle: `${table.columns?.length || 0} columns · ${table.rowCount} rows`,
							group: table.schema || 'default',
							icon: <Table2 className='h-4 w-4' />,
							keywords: [table.schema || '', table.name, 'table'],
							accessory: selectedTableId === tableId ? 'Selected' : undefined,
							details: [
								`Schema: ${table.schema || 'default'}`,
								`Columns: ${table.columns?.length || 0}`,
								`Rows: ${table.rowCount}`
							],
							onSelect: function () {
								onSelectTable(tableId, table.name)
								closePalette()
								onNavigate('database-studio')
							},
							onOpenDetail: function () {
								pushRoute({ kind: 'table', tableId })
							}
						} satisfies PaletteItem
					})
				}
			}

			if (currentRoute.kind === 'table') {
				const table = tables.find(function (item) {
					return getTableRefId(item) === currentRoute.tableId
				})

				if (!table) {
					return {
						title: 'Table',
						subtitle: 'Table not found.',
						placeholder: 'Search table actions...',
						emptyTitle: 'Table missing',
						emptyDescription: 'Refresh the schema and try again.',
						items: []
					}
				}

				const sqlIdentifier = getTableSqlIdentifier({
					name: table.name,
					schema: table.schema
				})

				return {
					title: table.name,
					subtitle: `${table.schema || 'default'} schema`,
					placeholder: 'Search table actions...',
					emptyTitle: 'No table actions found',
					emptyDescription: 'Try viewer, query, or copy.',
					items: [
						{
							id: `table-open-viewer-${currentRoute.tableId}`,
							title: 'Open In Database Studio',
							subtitle: 'Jump straight into the table viewer.',
							group: 'Actions',
							icon: <Blocks className='h-4 w-4' />,
							keywords: ['viewer', 'rows'],
							details: ['Open this table in Database Studio.'],
							onSelect: function () {
								onSelectTable(currentRoute.tableId, table.name)
								closePalette()
								onNavigate('database-studio')
							}
						},
						{
							id: `table-open-sql-${currentRoute.tableId}`,
							title: 'Open Select Query',
							subtitle: `SELECT * FROM ${sqlIdentifier} LIMIT 100`,
							group: 'Actions',
							icon: <TerminalSquare className='h-4 w-4' />,
							keywords: ['query', 'sql', 'select'],
							details: ['Seed the SQL Console with a table query.'],
							onSelect: function () {
								runSqlConsoleAction({
									type: 'load-query',
									mode: 'sql',
									query: `SELECT * FROM ${sqlIdentifier} LIMIT 100;`
								})
							}
						},
						{
							id: `table-copy-name-${currentRoute.tableId}`,
							title: 'Copy Table Identifier',
							subtitle: sqlIdentifier,
							group: 'Actions',
							icon: <Copy className='h-4 w-4' />,
							keywords: ['copy', 'table name'],
							details: ['Copy a quoted SQL-safe identifier to the clipboard.'],
							onSelect: async function () {
								await copyToClipboard(sqlIdentifier)
								closePalette()
							}
						}
					]
				}
			}

			if (currentRoute.kind === 'snippets') {
				return {
					title: 'Snippets',
					subtitle: 'Saved scripts and folders.',
					placeholder: 'Search snippets...',
					emptyTitle: 'No snippets available',
					emptyDescription: 'Save a snippet in SQL Console to access it here.',
					items: snippets.map(function (snippet) {
						const snippetMode = inferSnippetMode(snippet.content)
						return {
							id: `snippet-${snippet.id}`,
							title: snippet.name,
							subtitle: snippet.isFolder
								? 'Folder'
								: snippet.content.split('\n')[0] || 'Saved query',
							group: snippet.isFolder ? 'Folders' : 'Saved Queries',
							icon: snippet.isFolder ? (
								<FolderTree className='h-4 w-4' />
							) : (
								<Code2 className='h-4 w-4' />
							),
							keywords: [snippetMode, snippet.content],
							accessory: snippet.isFolder ? 'Folder' : snippetMode.toUpperCase(),
							details: snippet.isFolder
								? ['Snippet folder']
								: [snippet.content, `Updated ${snippet.updatedAt.toLocaleString()}`],
							onSelect: snippet.isFolder
								? undefined
								: function () {
										runSqlConsoleAction({
											type: 'load-query',
											mode: snippetMode,
											query: snippet.content
										})
								  },
							onOpenDetail: function () {
								pushRoute({ kind: 'snippet', snippetId: snippet.id })
							},
							disabled: snippet.isFolder
						} satisfies PaletteItem
					})
				}
			}

			if (currentRoute.kind === 'snippet') {
				const snippet = snippets.find(function (item) {
					return item.id === currentRoute.snippetId
				})

				if (!snippet) {
					return {
						title: 'Snippet',
						subtitle: 'Snippet not found.',
						placeholder: 'Search snippet actions...',
						emptyTitle: 'Snippet missing',
						emptyDescription: 'This snippet may have been deleted.',
						items: []
					}
				}

				if (snippet.isFolder) {
					return {
						title: snippet.name,
						subtitle: 'Folder',
						placeholder: 'Search folder contents...',
						emptyTitle: 'Folders are browse-only for now',
						emptyDescription: 'Open SQL Console to manage snippet folders in detail.',
						items: []
					}
				}

				const snippetMode = inferSnippetMode(snippet.content)

				return {
					title: snippet.name,
					subtitle: snippetMode === 'drizzle' ? 'Drizzle snippet' : 'SQL snippet',
					placeholder: 'Search snippet actions...',
					emptyTitle: 'No snippet actions found',
					emptyDescription: 'Try load, execute, or copy.',
					items: [
						{
							id: `snippet-load-${snippet.id}`,
							title: 'Load Into Console',
							subtitle: 'Open the snippet in the editor.',
							group: 'Actions',
							icon: <Code2 className='h-4 w-4' />,
							keywords: ['open', 'editor'],
							details: [snippet.content],
							onSelect: function () {
								runSqlConsoleAction({
									type: 'load-query',
									mode: snippetMode,
									query: snippet.content
								})
							}
						},
						{
							id: `snippet-run-${snippet.id}`,
							title: 'Execute Snippet',
							subtitle: 'Run it immediately in SQL Console.',
							group: 'Actions',
							icon: <Play className='h-4 w-4' />,
							keywords: ['run', 'execute'],
							details: ['Load and execute this snippet immediately.'],
							onSelect: function () {
								runSqlConsoleAction({
									type: 'load-query',
									mode: snippetMode,
									query: snippet.content,
									execute: true
								})
							}
						},
						{
							id: `snippet-copy-${snippet.id}`,
							title: 'Copy Snippet',
							subtitle: 'Copy the snippet contents to the clipboard.',
							group: 'Actions',
							icon: <Copy className='h-4 w-4' />,
							keywords: ['clipboard'],
							details: ['Copy the full snippet body.'],
							onSelect: async function () {
								await copyToClipboard(snippet.content)
								closePalette()
							}
						}
					]
				}
			}

			if (currentRoute.kind === 'history') {
				return {
					title: 'Query History',
					subtitle: 'Recent console executions.',
					placeholder: 'Search recent queries...',
					emptyTitle: 'History is empty',
					emptyDescription: 'Run a query in SQL Console and it will show up here.',
					items: history.map(function (entry) {
						return {
							id: `history-${entry.id}`,
							title: entry.query.split('\n')[0] || 'Query',
							subtitle: entry.success ? 'Successful execution' : entry.error || 'Failed execution',
							group: entry.success ? 'Successful Queries' : 'Failed Queries',
							icon: <History className='h-4 w-4' />,
							keywords: [entry.query],
							accessory: formatRelativeTime(entry.timestamp),
							details: [entry.query],
							onSelect: function () {
								runSqlConsoleAction({
									type: 'load-query',
									query: entry.query,
									mode: inferSnippetMode(entry.query),
									execute: true
								})
							},
							onOpenDetail: function () {
								pushRoute({ kind: 'history-entry', historyId: entry.id })
							}
						} satisfies PaletteItem
					})
				}
			}

			if (currentRoute.kind === 'history-entry') {
				const entry = history.find(function (item) {
					return item.id === currentRoute.historyId
				})

				if (!entry) {
					return {
						title: 'History Entry',
						subtitle: 'Query not found.',
						placeholder: 'Search history actions...',
						emptyTitle: 'History item missing',
						emptyDescription: 'The item may have been removed from local history.',
						items: []
					}
				}

				return {
					title: 'History Entry',
					subtitle: formatRelativeTime(entry.timestamp),
					placeholder: 'Search history actions...',
					emptyTitle: 'No history actions found',
					emptyDescription: 'Try replay or copy.',
					items: [
						{
							id: `history-run-${entry.id}`,
							title: 'Replay Query',
							subtitle: 'Load and execute again.',
							group: 'Actions',
							icon: <Play className='h-4 w-4' />,
							keywords: ['rerun', 'replay'],
							details: [entry.query],
							onSelect: function () {
								runSqlConsoleAction({
									type: 'load-query',
									query: entry.query,
									mode: inferSnippetMode(entry.query),
									execute: true
								})
							}
						},
						{
							id: `history-load-${entry.id}`,
							title: 'Load Into Console',
							subtitle: 'Inspect before running.',
							group: 'Actions',
							icon: <TerminalSquare className='h-4 w-4' />,
							keywords: ['inspect', 'editor'],
							details: ['Open the query in SQL Console without executing it.'],
							onSelect: function () {
								runSqlConsoleAction({
									type: 'load-query',
									query: entry.query,
									mode: inferSnippetMode(entry.query)
								})
							}
						},
						{
							id: `history-copy-${entry.id}`,
							title: 'Copy Query',
							subtitle: 'Copy the query to the clipboard.',
							group: 'Actions',
							icon: <Copy className='h-4 w-4' />,
							keywords: ['clipboard'],
							details: ['Copy the full query text.'],
							onSelect: async function () {
								await copyToClipboard(entry.query)
								closePalette()
							}
						}
					]
				}
			}

			if (currentRoute.kind === 'docker') {
				return {
					title: 'Docker',
					subtitle: 'Managed PostgreSQL containers.',
					placeholder: 'Search containers and actions...',
					emptyTitle: 'No containers found',
					emptyDescription: dockerStatus?.available
						? 'Create a container to start a local database.'
						: 'Docker is not available on this machine right now.',
					items: [
						{
							id: 'docker-create',
							title: 'New Container',
							subtitle: 'Open the PostgreSQL container wizard.',
							group: 'Actions',
							icon: <Plus className='h-4 w-4' />,
							keywords: ['create', 'postgres'],
							details: ['Create a managed Postgres container from the palette.'],
							onSelect: function () {
								runDockerAction({ type: 'open-create' })
							}
						},
						...containers.map(function (container) {
							return {
								id: `container-${container.id}`,
								title: container.name,
								subtitle: `${container.state} · ${container.image}:${container.imageTag}`,
								group: 'Containers',
								icon: <Container className='h-4 w-4' />,
								keywords: [container.state, container.origin, container.image],
								accessory: container.health,
								details: [
									`State: ${container.state}`,
									`Health: ${container.health}`,
									`Ports: ${
										container.ports
											.map(function (port) {
												return `${port.hostPort}:${port.containerPort}`
											})
											.join(', ') || 'none'
									}`
								],
								onSelect: function () {
									runDockerAction({
										type: 'select-container',
										containerId: container.id
									})
								},
								onOpenDetail: function () {
									pushRoute({ kind: 'container', containerId: container.id })
								}
							} satisfies PaletteItem
						})
					]
				}
			}

			if (currentRoute.kind === 'container') {
				const container = containers.find(function (item) {
					return item.id === currentRoute.containerId
				})

				if (!container) {
					return {
						title: 'Container',
						subtitle: 'Container not found.',
						placeholder: 'Search container actions...',
						emptyTitle: 'Container missing',
						emptyDescription: 'Refresh Docker state and try again.',
						items: []
					}
				}

				const startStopAction =
					container.state === 'running'
						? {
								id: `container-stop-${container.id}`,
								title: 'Stop Container',
								subtitle: 'Stop the running PostgreSQL instance.',
								group: 'Actions',
								icon: <Square className='h-4 w-4' />,
								keywords: ['stop'],
								details: ['Gracefully stop the running container.'],
								onSelect: function () {
									runDockerAction({
										type: 'container-action',
										containerId: container.id,
										action: 'stop'
									})
								}
							}
						: {
								id: `container-start-${container.id}`,
								title: 'Start Container',
								subtitle: 'Start the PostgreSQL instance.',
								group: 'Actions',
								icon: <Play className='h-4 w-4' />,
								keywords: ['start'],
								details: ['Start the selected container.'],
								onSelect: function () {
									runDockerAction({
										type: 'container-action',
										containerId: container.id,
										action: 'start'
									})
								}
							}

				return {
					title: container.name,
					subtitle: `${container.state} · ${container.health}`,
					placeholder: 'Search container actions...',
					emptyTitle: 'No container actions found',
					emptyDescription: 'Try start, restart, terminal, or data viewer.',
					items: [
						startStopAction,
						{
							id: `container-restart-${container.id}`,
							title: 'Restart Container',
							subtitle: 'Restart the PostgreSQL instance.',
							group: 'Actions',
							icon: <RotateCw className='h-4 w-4' />,
							keywords: ['restart'],
							details: ['Restart the selected container.'],
							onSelect: function () {
								runDockerAction({
									type: 'container-action',
									containerId: container.id,
									action: 'restart'
								})
							}
						},
						{
							id: `container-terminal-${container.id}`,
							title: 'Open Terminal',
							subtitle: 'Attach Dora’s terminal panel to the container.',
							group: 'Actions',
							icon: <TerminalSquare className='h-4 w-4' />,
							keywords: ['shell', 'terminal'],
							details: ['Open the embedded terminal for this container.'],
							onSelect: function () {
								runDockerAction({
									type: 'open-terminal',
									containerId: container.id
								})
							}
						},
						{
							id: `container-data-viewer-${container.id}`,
							title: 'Open In Data Viewer',
							subtitle: 'Add the container as a Dora connection.',
							group: 'Actions',
							icon: <Blocks className='h-4 w-4' />,
							keywords: ['connection', 'data viewer'],
							details: ['Promote this container into Database Studio as a connection.'],
							onSelect: function () {
								runDockerAction({
									type: 'open-in-data-viewer',
									containerId: container.id
								})
							}
						}
					]
				}
			}

			return {
				title: 'Command Center',
				subtitle: 'Fallback route.',
				placeholder: 'Search...',
				emptyTitle: 'No items found',
				emptyDescription: 'Try another route.',
				items: []
			}
		},
		[
			activeConnection,
			activeConnectionId,
			activeNavId,
			closePalette,
			connections,
			containers,
			currentRoute,
			dockerStatus?.available,
			history,
			onCreateConnection,
			onDeleteConnection,
			onEditConnection,
			onNavigate,
			onSelectConnection,
			onSelectTable,
			pushRoute,
			runDockerAction,
			runSqlConsoleAction,
			selectedTableId,
			tables,
			snippets
		]
	)

	const visibleItems = useMemo(
		function () {
			const normalizedQuery = normalizeSearch(query)
			return page.items
				.map(function (item) {
					return {
						item,
						score: getSearchScore(item, normalizedQuery)
					}
				})
				.filter(function (entry) {
					return entry.score !== null
				})
				.sort(function (left, right) {
					if (left.score !== right.score) {
						return (left.score || 0) - (right.score || 0)
					}
					return left.item.title.localeCompare(right.item.title)
				})
				.map(function (entry) {
					return entry.item
				})
		},
		[page.items, query]
	)

	useEffect(
		function keepSelectionInsideVisibleItems() {
			setSelectedIndex(function (currentIndex) {
				if (visibleItems.length === 0) {
					return 0
				}

				return Math.min(currentIndex, visibleItems.length - 1)
			})
		},
		[visibleItems]
	)

	const selectedItem = visibleItems[selectedIndex] ?? null

	const executeItem = useCallback(
		async function (item: PaletteItem | null) {
			if (!item || item.disabled) return
			if (item.onSelect) {
				await item.onSelect()
				return
			}
			if (item.onOpenDetail) {
				item.onOpenDetail()
			}
		},
		[]
	)

	function handleContentKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			setSelectedIndex(function (currentIndex) {
				if (visibleItems.length === 0) return 0
				return Math.min(currentIndex + 1, visibleItems.length - 1)
			})
			return
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault()
			setSelectedIndex(function (currentIndex) {
				return Math.max(currentIndex - 1, 0)
			})
			return
		}

		if (event.key === 'ArrowRight' && selectedItem?.onOpenDetail) {
			event.preventDefault()
			selectedItem.onOpenDetail()
			return
		}

		if (
			event.key === 'ArrowLeft' ||
			(event.key === 'Backspace' && query.length === 0 && stack.length > 1)
		) {
			if (stack.length > 1) {
				event.preventDefault()
				popRoute()
			}
			return
		}

		if (event.key === 'Enter') {
			event.preventDefault()
			void executeItem(selectedItem)
		}
	}

	const breadcrumbLabels = stack.map(function (route) {
		switch (route.kind) {
			case 'root':
				return 'Home'
			case 'navigation':
				return 'Navigation'
			case 'connections':
				return 'Connections'
			case 'connection':
				return connections.find(function (connection) {
					return connection.id === route.connectionId
				})?.name || 'Connection'
			case 'tables':
				return 'Tables'
			case 'table':
				return tables.find(function (table) {
					return getTableRefId(table) === route.tableId
				})?.name || 'Table'
			case 'snippets':
				return 'Snippets'
			case 'snippet':
				return snippets.find(function (snippet) {
					return snippet.id === route.snippetId
				})?.name || 'Snippet'
			case 'history':
				return 'History'
			case 'history-entry':
				return 'Replay'
			case 'docker':
				return 'Docker'
			case 'container':
				return containers.find(function (container) {
					return container.id === route.containerId
				})?.name || 'Container'
		}
	})

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className='max-w-5xl border-sidebar-border bg-sidebar/95 p-0 shadow-2xl backdrop-blur-xl'
				onKeyDownCapture={handleContentKeyDown}
			>
				<DialogTitle className='sr-only'>Dora Command Center</DialogTitle>
				<DialogDescription className='sr-only'>
					Raycast-style command palette for Dora actions and live app data.
				</DialogDescription>

				<div className='grid h-[78vh] min-h-[560px] grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] overflow-hidden'>
					<div className='flex min-h-0 flex-col bg-sidebar'>
						<div className='border-b border-sidebar-border px-4 pb-4 pt-3'>
							<div className='mb-3 flex items-center justify-between gap-3'>
								<div className='flex min-w-0 items-center gap-2'>
									<div className='inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500'>
										<Keyboard className='h-4 w-4' />
									</div>
									<div className='min-w-0'>
										<div className='truncate text-sm font-semibold text-sidebar-foreground'>
											Dora Command Center
										</div>
										<div className='truncate text-xs text-muted-foreground'>
											Palette routing across data, queries, containers, and actions.
										</div>
									</div>
								</div>
								<div className='rounded-full border border-sidebar-border bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground'>
									{visibleItems.length} results
								</div>
							</div>

							<div className='mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
								{stack.length > 1 && (
									<button
										type='button'
										onClick={popRoute}
										className='inline-flex h-7 items-center gap-1 rounded-full border border-sidebar-border bg-background/80 px-2.5 text-sidebar-foreground transition-colors hover:bg-accent'
									>
										<ArrowLeft className='h-3.5 w-3.5' />
										Back
									</button>
								)}
								{breadcrumbLabels.map(function (label, index) {
									return (
										<div
											key={`${label}-${index}`}
											className='inline-flex items-center gap-2'
										>
											{index > 0 && <ArrowRight className='h-3 w-3 opacity-50' />}
											<span className='rounded-full border border-sidebar-border bg-background/60 px-2.5 py-1 text-[11px] text-sidebar-foreground'>
												{label}
											</span>
										</div>
									)
								})}
							</div>

							<div className='relative'>
								<Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
								<Input
									ref={inputRef}
									value={query}
									onChange={function (event) {
										setQuery(event.target.value)
										setSelectedIndex(0)
									}}
									placeholder={page.placeholder}
									className='h-12 border-sidebar-border bg-background/80 pl-10 pr-20 text-base shadow-none'
									autoComplete='off'
									name='command_palette_search'
								/>
								<div className='pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-sidebar-border bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground'>
									Esc
								</div>
							</div>
						</div>

						<ScrollArea className='min-h-0 flex-1'>
							<div className='px-2 py-2'>
								{visibleItems.length === 0 ? (
									<div className='flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center'>
										<div className='mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-sidebar-border bg-background/70 text-muted-foreground'>
											<Search className='h-5 w-5' />
										</div>
										<div className='text-sm font-semibold text-sidebar-foreground'>
											{page.emptyTitle}
										</div>
										<div className='mt-1 max-w-sm text-sm text-muted-foreground'>
											{page.emptyDescription}
										</div>
									</div>
								) : (
									visibleItems.map(function (item, index) {
										const showGroupLabel =
											index === 0 || visibleItems[index - 1]?.group !== item.group

										return (
											<div key={item.id}>
												{showGroupLabel && (
													<div className='px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground first:pt-0'>
														{item.group}
													</div>
												)}
												<button
													ref={function (node) {
														itemRefs.current[index] = node
													}}
													type='button'
													onMouseEnter={function () {
														setSelectedIndex(index)
													}}
													onClick={function () {
														void executeItem(item)
													}}
													className={cn(
														'flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors',
														selectedIndex === index
															? 'bg-accent text-accent-foreground'
															: 'hover:bg-accent/60',
														item.disabled && 'cursor-not-allowed opacity-60'
													)}
													disabled={item.disabled}
												>
													<div
														className={cn(
															'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
															selectedIndex === index
																? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
																: 'border-sidebar-border bg-background/70 text-muted-foreground'
														)}
													>
														{item.icon}
													</div>
													<div className='min-w-0 flex-1'>
														<div className='flex items-center gap-2'>
															<div className='truncate text-sm font-medium'>
																{item.title}
															</div>
															{item.accessory && (
																<span className='shrink-0 rounded-full border border-sidebar-border bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
																	{item.accessory}
																</span>
															)}
														</div>
														{item.subtitle && (
															<div className='mt-0.5 line-clamp-2 text-xs text-muted-foreground'>
																{item.subtitle}
															</div>
														)}
													</div>
													<div className='flex shrink-0 items-center gap-1 text-muted-foreground'>
														{item.onOpenDetail && (
															<span className='rounded-md border border-sidebar-border bg-background/70 px-1.5 py-1 text-[10px] font-medium'>
																→
															</span>
														)}
														<span className='rounded-md border border-sidebar-border bg-background/70 px-1.5 py-1 text-[10px] font-medium'>
															↵
														</span>
													</div>
												</button>
											</div>
										)
									})
								)}
							</div>
						</ScrollArea>
					</div>

					<div className='flex min-h-0 flex-col border-l border-sidebar-border bg-background/95'>
						<div className='border-b border-sidebar-border px-5 py-4'>
							<div className='text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
								Preview
							</div>
							<div className='mt-2 text-lg font-semibold text-foreground'>
								{selectedItem?.title || page.title}
							</div>
							<div className='mt-1 text-sm text-muted-foreground'>
								{selectedItem?.subtitle || page.subtitle}
							</div>
						</div>

						<ScrollArea className='min-h-0 flex-1'>
							<div className='space-y-5 px-5 py-5'>
								<div className='rounded-3xl border border-sidebar-border bg-sidebar/60 p-4'>
									<div className='mb-3 flex items-center gap-3'>
										<div className='inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sidebar-border bg-background/80 text-emerald-500'>
											{selectedItem?.icon || <Keyboard className='h-5 w-5' />}
										</div>
										<div>
											<div className='text-sm font-semibold text-foreground'>
												{selectedItem?.group || 'Overview'}
											</div>
											<div className='text-xs text-muted-foreground'>
												{selectedItem ? 'Primary action shown on Enter.' : page.subtitle}
											</div>
										</div>
									</div>
									<div className='space-y-2 text-sm text-muted-foreground'>
										{selectedItem?.details?.length ? (
											selectedItem.details.map(function (detail, index) {
												return (
													<p key={`${detail}-${index}`} className='leading-relaxed'>
														{detail}
													</p>
												)
											})
										) : (
											<p className='leading-relaxed'>{page.emptyDescription}</p>
										)}
									</div>
								</div>

								<div>
									<div className='mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
										Controls
									</div>
									<div className='grid gap-2'>
										<PaletteHint label='Move selection' value='↑ ↓' />
										<PaletteHint label='Run primary action' value='↵ Enter' />
										<PaletteHint
											label='Open sub-route'
											value={selectedItem?.onOpenDetail ? '→ Right' : 'Unavailable'}
										/>
										<PaletteHint
											label='Go back'
											value={stack.length > 1 ? '← Left / ⌫' : 'At root'}
										/>
									</div>
								</div>

								<Separator />

								<div>
									<div className='mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
										Current Context
									</div>
									<div className='space-y-2 text-sm text-muted-foreground'>
										<p>
											View: <span className='font-medium text-foreground'>{activeNavId}</span>
										</p>
										<p>
											Connection:{' '}
											<span className='font-medium text-foreground'>
												{activeConnection?.name || 'None'}
											</span>
										</p>
										<p>
											Table:{' '}
											<span className='font-medium text-foreground'>
												{selectedTableId || 'None'}
											</span>
										</p>
									</div>
								</div>
							</div>
						</ScrollArea>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

function PaletteHint({ label, value }: { label: string; value: string }) {
	return (
		<div className='flex items-center justify-between rounded-2xl border border-sidebar-border bg-sidebar/40 px-3 py-2 text-sm'>
			<span className='text-muted-foreground'>{label}</span>
			<span className='rounded-md border border-sidebar-border bg-background/80 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground'>
				{value}
			</span>
		</div>
	)
}
