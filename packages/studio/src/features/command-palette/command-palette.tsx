import {
	BookOpen,
	Container,
	CornerDownLeft,
	Database,
	FolderTree,
	History,
	Keyboard,
	PanelLeft,
	Plus,
	Search,
	Server,
	Settings,
	SquarePen,
	Table2,
	TerminalSquare,
	Trash2,
	type LucideIcon
} from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useAdapter } from '@studio/core/data-provider'
import type { Connection } from '@studio/features/connections/types'
import {
	dispatchDockerPaletteCommand,
	dispatchSqlConsolePaletteCommand
} from '@studio/features/command-palette/events'
import {
	useContainers,
	useDockerAvailability
} from '@studio/features/docker-manager/api/queries/use-containers'
import type { DockerContainer } from '@studio/features/docker-manager/types'
import { useQueryHistory } from '@studio/features/sql-console/stores/query-history-store'
import type { SqlSnippet, TableInfo } from '@studio/features/sql-console/types'
import { cn } from '@studio/shared/utils/cn'
import { getCommandFrecency, recordCommandUse } from './command-frecency'
import {
	COMMAND_BANGS,
	getCommandPaletteGroups,
	type CommandPaletteItem
} from './command-palette-model'
import { formatShortcut } from './format-shortcut'
import { triggerNativeFeedback } from './native-feedback'
import { dialogContentMotion, overlayFadeMotion } from './overlay-motion'
import { useIsMobile } from './use-mobile'

export type { CommandPaletteItem } from './command-palette-model'

type NavigationTarget = 'database-studio' | 'sql-console' | 'docker' | 'settings'

type Props = {
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

function detectApplePlatform(): boolean {
	if (typeof navigator === 'undefined') return false
	const platform =
		(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
			?.platform ??
		navigator.platform ??
		''
	return /mac|iphone|ipad|ipod/i.test(platform)
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

function formatConnectionTarget(connection: Connection) {
	if (connection.type === 'sqlite' || connection.type === 'libsql') {
		return connection.database || connection.url || connection.type
	}
	const host = connection.host || 'localhost'
	const port = connection.port ? `:${connection.port}` : ''
	const database = connection.database ? `/${connection.database}` : ''
	return `${host}${port}${database}`
}

function getItemIcon(item: CommandPaletteItem): LucideIcon {
	const tokens = [item.id, item.title, item.subtitle, item.group, ...(item.keywords ?? [])]
		.filter(Boolean)
		.join(' ')
		.toLowerCase()

	if (tokens.includes('table') || tokens.includes('schema')) return Table2
	if (tokens.includes('connection') || tokens.includes('database')) return Database
	if (tokens.includes('sql') || tokens.includes('console') || tokens.includes('query'))
		return TerminalSquare
	if (tokens.includes('docker') || tokens.includes('container')) return Container
	if (tokens.includes('settings') || tokens.includes('preferences')) return Settings
	if (tokens.includes('sidebar') || tokens.includes('panel')) return PanelLeft
	if (tokens.includes('history')) return History
	if (tokens.includes('folder') || tokens.includes('snippet')) return FolderTree
	if (tokens.includes('navigate') || tokens.includes('go to') || tokens.includes('dashboard'))
		return BookOpen
	if (tokens.includes('new') || tokens.includes('create') || tokens.includes('add')) return Plus
	if (tokens.includes('delete') || tokens.includes('remove') || tokens.includes('trash'))
		return Trash2
	if (tokens.includes('server')) return Server
	if (tokens.includes('keyboard') || tokens.includes('shortcut')) return Keyboard
	return SquarePen
}

export function CommandPalette(props: Props) {
	return <CommandPaletteState key={props.open ? 'open' : 'closed'} {...props} />
}

function CommandPaletteState({
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
}: Props) {
	const adapter = useAdapter()
	const [query, setQuery] = useState('')
	const [activeIndex, setActiveIndex] = useState(0)
	const [isApple] = useState(detectApplePlatform)
	const isMobile = useIsMobile()
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)
	const listboxId = useId()
	const frecency = getCommandFrecency()

	const { history } = useQueryHistory()
	const { data: dockerStatus } = useDockerAvailability()
	const { data: containers = [] } = useContainers({
		showExternal: true,
		enabled: open && (dockerStatus?.available ?? false)
	})
	const [tables, setTables] = useState<TableInfo[]>([])
	const [snippets, setSnippets] = useState<SqlSnippet[]>([])

	const activeConnection = useMemo(
		() => connections.find((c) => c.id === activeConnectionId) ?? null,
		[connections, activeConnectionId]
	)

	useEffect(() => {
		if (!open) {
			setQuery('')
			setActiveIndex(0)
			setTables([])
			setSnippets([])
			requestAnimationFrame(() => {
				inputRef.current?.focus()
				inputRef.current?.select()
			})
		}
	}, [open])

	useEffect(() => {
		let cancelled = false

		if (!open || !activeConnectionId) {
			setTables([])
			return
		}

		async function loadTables() {
			try {
				await adapter.connectToDatabase(activeConnectionId)
				const result = await adapter.getSchema(activeConnectionId)
				if (cancelled || !result.ok || !result.data.tables) return

				setTables(
					result.data.tables.map((table) => ({
						name: table.name,
						schema: table.schema,
						type: 'table' as const,
						rowCount: table.row_count_estimate ?? 0,
						columns: table.columns.map((col) => ({
							name: col.name,
							type: col.data_type,
							nullable: col.is_nullable,
							primaryKey: col.is_primary_key
						}))
					}))
				)
			} catch {
				if (!cancelled) setTables([])
			}
		}

		loadTables()
		return () => {
			cancelled = true
		}
	}, [adapter, activeConnectionId, open])

	useEffect(() => {
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
					foldersRes.data.forEach((folder) => {
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
					scriptsRes.data.forEach((script) => {
						const folderId = (script as typeof script & { folder_id?: number | null })
							.folder_id
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
			} catch {
				if (!cancelled) setSnippets([])
			}
		}

		loadSnippets()
		return () => {
			cancelled = true
		}
	}, [adapter, activeConnectionId, open])

	const updateQuery = (next: string) => {
		setQuery(next)
		setActiveIndex(0)
	}

	const items = useMemo<CommandPaletteItem[]>(() => {
		const result: CommandPaletteItem[] = []

		// Navigation
		result.push({
			id: 'nav.dashboard',
			title: 'Go to Dashboard',
			group: 'Navigation',
			keywords: ['home', 'database studio'],
			onSelect: () => {
				onOpenChange(false)
				onNavigate('database-studio')
			}
		})
		result.push({
			id: 'nav.sql-console',
			title: 'Go to SQL Console',
			group: 'Navigation',
			keywords: ['editor', 'query', 'sql'],
			shortcut: 'g e',
			onSelect: () => {
				onOpenChange(false)
				onNavigate('sql-console')
			}
		})
		result.push({
			id: 'nav.docker',
			title: 'Go to Docker',
			group: 'Navigation',
			keywords: ['containers', 'docker'],
			shortcut: 'g k',
			onSelect: () => {
				onOpenChange(false)
				onNavigate('docker')
			}
		})
		result.push({
			id: 'nav.settings',
			title: 'Go to Settings',
			group: 'Navigation',
			keywords: ['preferences', 'config'],
			onSelect: () => {
				onOpenChange(false)
				onNavigate('settings')
			}
		})

		// Connections
		result.push({
			id: 'connection.new',
			title: 'New Connection',
			group: 'Connections',
			keywords: ['add', 'create', 'database'],
			onSelect: () => {
				onOpenChange(false)
				onCreateConnection()
			}
		})

		for (const conn of connections) {
			const isActive = conn.id === activeConnectionId
			result.push({
				id: `connection.${conn.id}`,
				title: conn.name || conn.type,
				subtitle: formatConnectionTarget(conn),
				group: 'Connections',
				hint: isActive ? 'Active' : undefined,
				keywords: [conn.name, conn.type, conn.host || '', conn.database || ''],
				onSelect: async () => {
					onOpenChange(false)
					await onSelectConnection(conn.id)
				}
			})
			result.push({
				id: `connection.edit.${conn.id}`,
				title: `Edit: ${conn.name || conn.type}`,
				group: 'Connections',
				keywords: ['edit', 'modify', conn.name],
				searchOnly: true,
				onSelect: () => {
					onOpenChange(false)
					onEditConnection(conn.id)
				}
			})
			result.push({
				id: `connection.delete.${conn.id}`,
				title: `Delete: ${conn.name || conn.type}`,
				group: 'Connections',
				keywords: ['remove', 'trash', conn.name],
				searchOnly: true,
				onSelect: () => {
					onOpenChange(false)
					onDeleteConnection(conn.id)
				}
			})
		}

		// Tables
		if (activeConnection) {
			for (const table of tables) {
				result.push({
					id: `table.${table.name}`,
					title: table.name,
					subtitle: table.schema || activeConnection.database || activeConnection.name,
					group: 'Tables',
					hint: table.rowCount ? `${table.rowCount} rows` : undefined,
					keywords: [table.name, table.schema || '', 'table', 'data'],
					onSelect: () => {
						onOpenChange(false)
						onSelectTable(table.name, table.name)
					}
				})
			}
		}

		// Snippets
		for (const snippet of snippets) {
			result.push({
				id: `snippet.${snippet.id}`,
				title: snippet.name,
				subtitle: snippet.isFolder ? 'Folder' : 'Script',
				group: snippet.isFolder ? 'Snippets' : 'Queries',
				keywords: [
					snippet.name,
					...(snippet.content ? [snippet.content.slice(0, 80)] : [])
				],
				onSelect: () => {
					if (snippet.isFolder) return
					onOpenChange(false)
					onNavigate('sql-console')
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							dispatchSqlConsolePaletteCommand({
								type: 'load-query',
								query: snippet.content
							})
						})
					})
				}
			})
		}

		// Query History
		for (const entry of history) {
			result.push({
				id: `history.${entry.id}`,
				title: entry.query.slice(0, 80) + (entry.query.length > 80 ? '...' : ''),
				subtitle: formatRelativeTime(entry.timestamp),
				group: 'History',
				keywords: [entry.query],
				searchOnly: true,
				onSelect: () => {
					onOpenChange(false)
					onNavigate('sql-console')
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							dispatchSqlConsolePaletteCommand({
								type: 'load-query',
								query: entry.query
							})
						})
					})
				}
			})
		}

		// Docker containers
		if (dockerStatus?.available) {
			result.push({
				id: 'docker.new',
				title: 'Create Container',
				group: 'Docker',
				keywords: ['new', 'create', 'container', 'add'],
				onSelect: () => {
					onOpenChange(false)
					onNavigate('docker')
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							dispatchDockerPaletteCommand({ type: 'open-create' })
						})
					})
				}
			})

			for (const container of containers) {
				result.push({
					id: `container.${container.id}`,
					title: container.name || container.image || container.id,
					subtitle: container.state,
					group: 'Docker',
					hint: container.image,
					keywords: [container.name || '', container.image || '', container.id],
					onSelect: () => {
						onOpenChange(false)
						onNavigate('docker')
						requestAnimationFrame(() => {
							requestAnimationFrame(() => {
								dispatchDockerPaletteCommand({
									type: 'select-container',
									containerId: container.id
								})
							})
						})
					}
				})
			}
		}

		return result
	}, [
		open,
		connections,
		activeConnectionId,
		activeConnection,
		activeNavId,
		onNavigate,
		onCreateConnection,
		onEditConnection,
		onDeleteConnection,
		onSelectConnection,
		onSelectTable,
		onOpenChange,
		tables,
		snippets,
		history,
		containers,
		dockerStatus?.available
	])

	const groups = useMemo(
		() => (open ? getCommandPaletteGroups(items, query, frecency) : []),
		[open, items, query, frecency]
	)
	const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups])

	const boundedActiveIndex =
		activeIndex < flatItems.length ? activeIndex : Math.max(flatItems.length - 1, 0)

	useEffect(() => {
		const activeElement = listRef.current?.querySelector<HTMLElement>(
			`[data-index="${boundedActiveIndex}"]`
		)
		activeElement?.scrollIntoView({ block: 'nearest' })
	}, [boundedActiveIndex])

	function runItem(item: CommandPaletteItem) {
		triggerNativeFeedback('selection')
		recordCommandUse(item.id)
		item.onSelect()
	}

	function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			setActiveIndex(
				flatItems.length > 0 ? Math.min(boundedActiveIndex + 1, flatItems.length - 1) : 0
			)
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			setActiveIndex(Math.max(boundedActiveIndex - 1, 0))
		} else if (event.key === 'Enter') {
			event.preventDefault()
			const activeItem = flatItems[boundedActiveIndex]
			if (activeItem) runItem(activeItem)
		}
	}

	let runningIndex = -1
	const activeItem = flatItems[boundedActiveIndex]

	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay
					className={cn(
						'fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px]',
						overlayFadeMotion
					)}
				/>
				<DialogPrimitive.Content
					onOpenAutoFocus={(event) => {
						event.preventDefault()
						inputRef.current?.focus()
					}}
					className={cn(
						'fixed left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl shadow-black/40 focus:outline-none focus:ring-0',
						isMobile
							? 'bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] max-h-[72dvh]'
							: 'top-[12vh]',
						dialogContentMotion
					)}
				>
					<DialogPrimitive.Title className='sr-only'>
						Command palette
					</DialogPrimitive.Title>
					<DialogPrimitive.Description className='sr-only'>
						Search and execute commands
					</DialogPrimitive.Description>

					<div className='flex items-center gap-2.5 border-b border-border px-3.5 py-3'>
						<Search
							className='h-4 w-4 shrink-0 text-muted-foreground'
							strokeWidth={1.7}
						/>
						<input
							ref={inputRef}
							value={query}
							onChange={(event) => updateQuery(event.target.value)}
							onKeyDown={handleInputKeyDown}
							placeholder='Search actions, tables, snippets...'
							inputMode='search'
							enterKeyHint='go'
							role='combobox'
							aria-expanded={open}
							aria-controls={listboxId}
							aria-autocomplete='list'
							aria-activedescendant={
								activeItem ? `${listboxId}-item-${boundedActiveIndex}` : undefined
							}
							className='min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none focus:outline-none focus-visible:shadow-none focus-visible:outline-none placeholder:text-muted-foreground'
						/>
						{isMobile ? null : (
							<kbd className='rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'>
								Esc
							</kbd>
						)}
					</div>

					<div
						ref={listRef}
						id={listboxId}
						role='listbox'
						className={cn(
							'overflow-y-auto py-1.5',
							isMobile ? 'momentum-scroll max-h-[52dvh]' : 'max-h-[52vh]'
						)}
					>
						{flatItems.length === 0 ? (
							<div className='px-4 py-10 text-center text-[13px] text-muted-foreground'>
								No results for &ldquo;{query}&rdquo;
							</div>
						) : (
							groups.map((group) => (
								<div key={group.group} className='px-1.5 pb-1'>
									<div className='px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70'>
										{group.group}
									</div>
									{group.items.map((item) => {
										runningIndex += 1
										const index = runningIndex
										const isActive = index === boundedActiveIndex
										const Icon = getItemIcon(item)

										return (
											<button
												key={item.id}
												type='button'
												id={`${listboxId}-item-${index}`}
												data-index={index}
												role='option'
												aria-selected={isActive}
												disabled={item.disabled}
												onMouseMove={() => setActiveIndex(index)}
												onClick={() => runItem(item)}
												className={cn(
													'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors',
													item.disabled &&
														'cursor-not-allowed opacity-60',
													isActive
														? 'bg-sidebar-accent text-sidebar-accent-foreground'
														: 'text-sidebar-foreground hover:bg-sidebar-accent/50'
												)}
											>
												<span
													className={cn(
														'shrink-0',
														isActive
															? 'text-foreground'
															: 'text-muted-foreground'
													)}
												>
													{item.emoji ? (
														<span
															className='flex h-5 w-5 items-center justify-center text-[15px] leading-none'
															aria-hidden
														>
															{item.emoji}
														</span>
													) : item.icon ? (
														<span className='flex h-5 w-5 items-center justify-center'>
															{item.icon}
														</span>
													) : (
														<Icon
															className='h-4 w-4'
															strokeWidth={1.7}
														/>
													)}
												</span>
												<span className='truncate'>{item.title}</span>
												{item.subtitle ? (
													<span className='min-w-0 truncate text-[11px] text-muted-foreground'>
														{item.subtitle}
													</span>
												) : null}
												{item.hint && !item.shortcut ? (
													<span className='ml-auto shrink-0 text-[11px] text-muted-foreground'>
														{item.hint}
													</span>
												) : null}
												<span className='ml-auto flex shrink-0 items-center gap-1.5'>
													{!isMobile && item.shortcut ? (
														<kbd className='rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'>
															{formatShortcut(item.shortcut, isApple)}
														</kbd>
													) : null}
													{!isMobile && isActive ? (
														<CornerDownLeft className='h-3.5 w-3.5 text-muted-foreground' />
													) : null}
												</span>
											</button>
										)
									})}
								</div>
							))
						)}
					</div>

					{isMobile ? null : (
						<div className='flex items-center gap-4 border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground'>
							<span className='flex items-center gap-1'>
								<CornerDownLeft className='h-3 w-3 rotate-90' />
								<CornerDownLeft className='h-3 w-3 -rotate-90' />
								navigate
							</span>
							<span className='flex items-center gap-1'>
								<CornerDownLeft className='h-3 w-3' />
								select
							</span>
							<span className='flex items-center gap-1.5'>
								{Object.entries(COMMAND_BANGS).map(([key, bang]) => (
									<span key={key} className='flex items-center gap-1'>
										<kbd className='rounded border border-border bg-muted px-1 text-[10px]'>
											!{key}
										</kbd>
										<span className='hidden sm:inline'>
											{bang.label.toLowerCase()}
										</span>
									</span>
								))}
							</span>
							<span className='ml-auto flex items-center gap-1'>
								<kbd className='rounded border border-border bg-muted px-1 text-[10px]'>
									{formatShortcut('mod+k', isApple)}
								</kbd>
								command palette
							</span>
						</div>
					)}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}
