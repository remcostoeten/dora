import {
	ChevronsUpDown,
	Plus,
	Settings,
	Database,
	Eye,
	HardDriveDownload,
	Pencil,
	Trash2,
	AlertCircle,
	Search
} from 'lucide-react'
import {
	memo,
	useCallback,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent,
	type MouseEvent
} from 'react'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger
} from '@studio/shared/ui/context-menu'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@studio/shared/ui/dropdown-menu'
import { cn } from '@studio/shared/utils/cn'
import { Input } from '@studio/shared/ui/input'
import { Connection } from '../types'
import { DatabaseTypeIcon } from './database-type-icon'
import { SourceBadges } from './source-badges'
import { DataFileHealthIndicator } from './data-file-health-indicator'
import { describeConnectionSource } from '../resolve-source'
import { getSourceCaps } from '../source-caps'
import {
	isDataFileConnection,
	resolveDataFileConnectionSummary,
	resolveDataFileHealth,
	type DataFileHealth
} from '../data-file-health'
import { useDataFileEntriesCatalog } from '../hooks/use-data-file-entries-catalog'
import {
	resolveConnectionLocationLabel,
	resolveConnectionSearchText,
	resolveProviderLabel
} from '../source-labels'
import { EmptyState } from '@studio/shared/ui/empty-state'
import {
	ProjectIllustration,
	SearchIllustration
} from '@studio/shared/ui/empty-state-illustrations'

const KEEP_OPEN_AFTER_DELETE_MS = 600

const QUICK_DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
	month: 'short',
	day: 'numeric',
	year: 'numeric'
})

function normalizeTimestamp(value: number | null | undefined): number | null {
	if (!value) return null
	return value < 1_000_000_000_000 ? value * 1000 : value
}

function formatQuickDate(value: number | null | undefined): string {
	const normalized = normalizeTimestamp(value)
	if (!normalized) return 'Never'
	const date = new Date(normalized)
	if (Number.isNaN(date.getTime())) return 'Unknown'
	return QUICK_DATE_FORMAT.format(date)
}

function revealRowInList(row: HTMLElement) {
	const list = row.parentElement
	if (!list) return
	const listRect = list.getBoundingClientRect()
	const rowRect = row.getBoundingClientRect()
	if (rowRect.top < listRect.top) {
		list.scrollTop -= listRect.top - rowRect.top
	} else if (rowRect.bottom > listRect.bottom) {
		list.scrollTop += rowRect.bottom - listRect.bottom
	}
}

function stopEscapeFromReachingGlobalShortcuts(event: globalThis.KeyboardEvent) {
	event.stopPropagation()
}

function keepTypingOutOfMenuTypeahead(event: KeyboardEvent) {
	if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
	event.stopPropagation()
}

type Props = {
	connections: Connection[]
	activeConnectionId?: string
	onConnectionSelect: (id: string) => void
	onAddConnection: () => void
	onManageConnections: () => void
	onViewConnection?: (id: string) => void
	onEditConnection?: (id: string) => void
	onDumpConnection?: (id: string) => void
	onDeleteConnection?: (id: string) => void
}

type RowProps = {
	connection: Connection
	isActive: boolean
	rowSummary: string | null
	rowHealth: DataFileHealth | null
	onSelect: (id: string) => void
	onArmContextMenu: (id: string) => void
	onRegister: (id: string, node: HTMLDivElement | null) => void
	onEditConnection?: (id: string) => void
	onConfirmDelete?: (id: string) => void
}

const ConnectionMenuRow = memo(function ConnectionMenuRow({
	connection,
	isActive,
	rowSummary,
	rowHealth,
	onSelect,
	onArmContextMenu,
	onRegister,
	onEditConnection,
	onConfirmDelete
}: RowProps) {
	const lastConnected = formatQuickDate(connection.lastConnectedAt)

	return (
		<div
			ref={(node) => onRegister(connection.id, node)}
			role='menuitem'
			tabIndex={0}
			data-connection-id={connection.id}
			aria-current={isActive ? 'true' : undefined}
			aria-label={`${connection.name}, ${resolveProviderLabel(describeConnectionSource(connection))}, last connected ${lastConnected}`}
			onContextMenu={() => onArmContextMenu(connection.id)}
			onPointerDown={(event) => {
				if (event.pointerType !== 'mouse') onArmContextMenu(connection.id)
			}}
			onClick={() => onSelect(connection.id)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault()
					onSelect(connection.id)
				}
			}}
			className={cn(
				'group/row gap-2.5 p-2 cursor-pointer overflow-hidden',
				'flex items-center outline-hidden',
				'transition-[background-color,color] duration-150 ease-[var(--ease-out)]',
				'focus:bg-sidebar-accent data-[highlighted]:bg-sidebar-accent',
				isActive && 'bg-sidebar-accent/40'
			)}
		>
			<div
				className={cn(
					'flex h-7 w-7 items-center justify-center rounded-md border shrink-0',
					'transition-[border-color,background-color] duration-150 ease-[var(--ease-out)]',
					connection.status === 'error'
						? 'border-destructive/40 bg-destructive/5'
						: isActive
							? 'border-primary/30 bg-primary/5'
							: 'border-border bg-background'
				)}
			>
				{connection.status === 'error' ? (
					<AlertCircle className='h-3.5 w-3.5 text-destructive' />
				) : (
					<DatabaseTypeIcon
						type={connection.type}
						className='h-3.5 w-3.5 text-muted-foreground'
					/>
				)}
			</div>
			<div className='flex-1 min-w-0'>
				<div
					className={cn(
						'truncate text-sm',
						isActive ? 'font-medium text-foreground' : 'text-foreground/90'
					)}
				>
					{connection.name}
				</div>
				<div className='truncate text-[10px] text-muted-foreground/80'>
					{rowSummary ??
						`${resolveConnectionLocationLabel(connection)} • ${lastConnected}`}
				</div>
				<div className='mt-1 flex flex-wrap items-center gap-1'>
					<SourceBadges connection={connection} compact showReadonly={false} />
					{rowHealth && <DataFileHealthIndicator health={rowHealth} compact />}
				</div>
			</div>
			<div className='relative ml-auto flex items-center'>
				<div className='flex items-center'>
					{onEditConnection && (
						<button
							data-connection-action
							type='button'
							className={cn(
								'flex h-6 w-6 items-center justify-center rounded-sm',
								'text-muted-foreground',
								'opacity-0 -translate-x-1 pointer-events-none',
								'group-hover/row:opacity-100 group-hover/row:translate-x-0 group-hover/row:pointer-events-auto',
								'group-data-[highlighted]/row:opacity-100 group-data-[highlighted]/row:translate-x-0 group-data-[highlighted]/row:pointer-events-auto',
								'transition-[opacity,transform,color] duration-150 ease-[var(--ease-out)]',
								'hover:text-foreground hover:bg-background/60',
								'focus-visible:opacity-100 focus-visible:translate-x-0 focus-visible:pointer-events-auto focus-visible:text-foreground focus-visible:bg-focus-strong'
							)}
							onPointerDown={(event) => {
								event.preventDefault()
								event.stopPropagation()
							}}
							onClick={(event) => {
								event.preventDefault()
								event.stopPropagation()
								onEditConnection(connection.id)
							}}
							title={`Edit ${connection.name}`}
							aria-label={`Edit ${connection.name}`}
						>
							<Pencil className='h-3 w-3' />
						</button>
					)}
					{onConfirmDelete && (
						<button
							data-connection-action
							type='button'
							className={cn(
								'flex h-6 w-6 items-center justify-center rounded-sm',
								'text-muted-foreground',
								'opacity-0 -translate-x-1 pointer-events-none',
								'group-hover/row:opacity-100 group-hover/row:translate-x-0 group-hover/row:pointer-events-auto',
								'group-data-[highlighted]/row:opacity-100 group-data-[highlighted]/row:translate-x-0 group-data-[highlighted]/row:pointer-events-auto',
								'transition-[opacity,transform,color] duration-150 ease-[var(--ease-out)]',
								'hover:text-destructive hover:bg-background/60',
								'focus-visible:opacity-100 focus-visible:translate-x-0 focus-visible:pointer-events-auto focus-visible:text-destructive focus-visible:bg-destructive/20'
							)}
							onPointerDown={(event) => {
								event.preventDefault()
								event.stopPropagation()
							}}
							onClick={(event) => {
								event.preventDefault()
								event.stopPropagation()
								onConfirmDelete(connection.id)
							}}
							title={`Delete ${connection.name}`}
							aria-label={`Delete ${connection.name}`}
						>
							<Trash2 className='h-3 w-3' />
						</button>
					)}
				</div>
			</div>
		</div>
	)
})

type ContextItemsProps = {
	connection: Connection
	onViewConnection?: (id: string) => void
	onEditConnection?: (id: string) => void
	onDumpConnection?: (id: string) => void
	onConfirmDelete?: (id: string) => void
	onCloseMenus: () => void
}

function ConnectionContextItems({
	connection,
	onViewConnection,
	onEditConnection,
	onDumpConnection,
	onConfirmDelete,
	onCloseMenus
}: ContextItemsProps) {
	return (
		<>
			{onViewConnection && (
				<ContextMenuItem
					onSelect={() => {
						onViewConnection(connection.id)
						onCloseMenus()
					}}
				>
					<Eye />
					View Details
				</ContextMenuItem>
			)}
			{onEditConnection && (
				<ContextMenuItem
					onSelect={() => {
						onEditConnection(connection.id)
						onCloseMenus()
					}}
				>
					<Pencil />
					Edit Connection
				</ContextMenuItem>
			)}
			{onDumpConnection && (
				<ContextMenuItem
					disabled={connection.status !== 'connected'}
					onSelect={() => {
						onDumpConnection(connection.id)
						onCloseMenus()
					}}
				>
					<HardDriveDownload />
					Dump to File
				</ContextMenuItem>
			)}
			{onConfirmDelete && (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem
						onSelect={() => onConfirmDelete(connection.id)}
						variant='destructive'
					>
						<Trash2 />
						Delete Connection
					</ContextMenuItem>
				</>
			)}
		</>
	)
}

export const ConnectionSwitcher = memo(function ConnectionSwitcher({
	connections,
	activeConnectionId,
	onConnectionSelect,
	onAddConnection,
	onManageConnections,
	onViewConnection,
	onEditConnection,
	onDumpConnection,
	onDeleteConnection
}: Props) {
	const [searchQuery, setSearchQuery] = useState('')
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const [contextMenuConnectionId, setContextMenuConnectionId] = useState<string | null>(null)
	const keepOpenUntilRef = useRef(0)
	const connectionRowRefs = useRef(new Map<string, HTMLDivElement>())
	const armedConnectionIdRef = useRef<string | null>(null)
	const focusOnMountIdRef = useRef<string | null>(null)
	const handlersRef = useRef({ onConnectionSelect, onDeleteConnection })
	handlersRef.current = { onConnectionSelect, onDeleteConnection }

	const activeConnection = connections.find((c) => c.id === activeConnectionId)
	const status = activeConnection?.status || 'idle'
	const catalogEnabled =
		dropdownOpen || (activeConnection != null && isDataFileConnection(activeConnection))
	const dataFileEntriesCatalog = useDataFileEntriesCatalog(connections, catalogEnabled)
	const activeDataFileEntries = activeConnection
		? dataFileEntriesCatalog.get(activeConnection.id)
		: undefined
	const activeDataFileHealth =
		activeConnection && isDataFileConnection(activeConnection)
			? resolveDataFileHealth({
					entries: activeDataFileEntries,
					connectionStatus: activeConnection.status
				})
			: null

	const filteredConnections = useMemo(
		function getFilteredConnections() {
			const query = searchQuery.trim().toLowerCase()
			if (!query) return connections
			return connections.filter(function (connection) {
				const entries = dataFileEntriesCatalog.get(connection.id)
				return resolveConnectionSearchText(
					connection,
					getSourceCaps(connection),
					entries
				).includes(query)
			})
		},
		[connections, searchQuery, dataFileEntriesCatalog]
	)

	const contextMenuConnection = contextMenuConnectionId
		? connections.find((connection) => connection.id === contextMenuConnectionId)
		: undefined

	const closeMenus = useCallback(function closeMenus() {
		setDropdownOpen(false)
		setSearchQuery('')
		setContextMenuConnectionId(null)
	}, [])

	const selectConnection = useCallback(
		function selectConnection(id: string) {
			handlersRef.current.onConnectionSelect(id)
			closeMenus()
		},
		[closeMenus]
	)

	const confirmDelete = useCallback(function confirmDelete(id: string) {
		keepOpenUntilRef.current = Date.now() + KEEP_OPEN_AFTER_DELETE_MS
		handlersRef.current.onDeleteConnection?.(id)
		setDropdownOpen(true)
	}, [])

	const armContextMenu = useCallback(function armContextMenu(id: string) {
		armedConnectionIdRef.current = id
	}, [])

	const registerRow = useCallback(function registerRow(id: string, node: HTMLDivElement | null) {
		if (!node) {
			connectionRowRefs.current.delete(id)
			return
		}
		connectionRowRefs.current.set(id, node)
		if (focusOnMountIdRef.current !== id) return
		focusOnMountIdRef.current = null
		node.focus({ preventScroll: true })
		requestAnimationFrame(function () {
			if (node.isConnected) revealRowInList(node)
		})
	}, [])

	function handleMenuOpenChange(open: boolean) {
		if (!open && Date.now() < keepOpenUntilRef.current) {
			setDropdownOpen(true)
			return
		}
		if (!open) {
			closeMenus()
			return
		}
		const hasActiveRow = connections.some((connection) => connection.id === activeConnectionId)
		focusOnMountIdRef.current = hasActiveRow
			? (activeConnectionId ?? null)
			: (connections[0]?.id ?? null)
		setDropdownOpen(true)
	}

	function handleListContextMenu(event: MouseEvent) {
		if (armedConnectionIdRef.current) return
		event.preventDefault()
	}

	function handleContextMenuOpenChange(open: boolean) {
		if (!open) return
		setContextMenuConnectionId(armedConnectionIdRef.current)
		setDropdownOpen(true)
	}

	function focusConnectionRow(index: number) {
		const connection = filteredConnections[index]
		if (!connection) return
		connectionRowRefs.current.get(connection.id)?.focus()
	}

	function getFocusedConnectionIndex() {
		const activeElement = document.activeElement
		if (!(activeElement instanceof HTMLElement)) return -1
		const connectionId = activeElement.dataset.connectionId
		if (!connectionId) return -1
		return filteredConnections.findIndex(function (connection) {
			return connection.id === connectionId
		})
	}

	function handleConnectionListKeyDown(e: KeyboardEvent) {
		if (filteredConnections.length === 0) return

		const activeElement = document.activeElement
		const isSearchInput = activeElement instanceof HTMLInputElement
		const focusedIndex = getFocusedConnectionIndex()

		if (e.key === 'ArrowDown') {
			e.preventDefault()
			const nextIndex =
				focusedIndex === -1 ? 0 : Math.min(focusedIndex + 1, filteredConnections.length - 1)
			focusConnectionRow(nextIndex)
			return
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault()
			const nextIndex =
				focusedIndex === -1 ? filteredConnections.length - 1 : Math.max(focusedIndex - 1, 0)
			focusConnectionRow(nextIndex)
			return
		}

		if (!isSearchInput && e.key === 'Home') {
			e.preventDefault()
			focusConnectionRow(0)
			return
		}

		if (!isSearchInput && e.key === 'End') {
			e.preventDefault()
			focusConnectionRow(filteredConnections.length - 1)
		}
	}

	function handleConnectionListKeyDownCapture(e: KeyboardEvent) {
		if (e.key !== 'Tab') return

		const container = e.currentTarget
		if (!(container instanceof HTMLElement)) return

		const tabStops = Array.from(
			container.querySelectorAll<HTMLElement>(
				'input:not([disabled]), [data-connection-id], [data-connection-footer-action]'
			)
		).filter(function (element) {
			return (
				!element.hasAttribute('disabled') &&
				element.getAttribute('aria-disabled') !== 'true'
			)
		})

		if (tabStops.length === 0) return

		const activeElement = document.activeElement
		const currentIndex =
			activeElement instanceof HTMLElement ? tabStops.indexOf(activeElement) : -1
		const fallbackIndex = e.shiftKey ? tabStops.length - 1 : 0
		const nextIndex =
			currentIndex === -1 ? fallbackIndex : e.shiftKey ? currentIndex - 1 : currentIndex + 1

		if (nextIndex < 0 || nextIndex >= tabStops.length) {
			closeMenus()
			return
		}

		e.preventDefault()
		e.stopPropagation()
		tabStops[nextIndex]?.focus()
	}

	return (
		<DropdownMenu open={dropdownOpen} onOpenChange={handleMenuOpenChange}>
			<DropdownMenuTrigger asChild>
				<button
					type='button'
					aria-label={
						activeConnection
							? `Change database connection. Current connection: ${activeConnection.name}`
							: 'Select database connection'
					}
					aria-haspopup='menu'
					className={cn(
						'group/trigger relative w-full rounded-lg px-2 py-2 text-left',
						'flex items-center gap-3',
						'text-sidebar-foreground',
						'transition-[background-color,color] duration-150 ease-[var(--ease-out)]',
						'hover:bg-sidebar-accent',
						'data-[state=open]:bg-sidebar-accent',
						'focus-visible:bg-focus-strong'
					)}
				>
					<div
						className={cn(
							'flex h-9 w-9 items-center justify-center rounded-md shrink-0',
							'transition-[background-color,color] duration-150 ease-[var(--ease-out)]',
							status === 'error'
								? 'bg-destructive/10 text-destructive'
								: 'bg-primary/10 text-primary group-hover/trigger:bg-primary/15'
						)}
					>
						{status === 'error' ? (
							<AlertCircle className='h-4 w-4' />
						) : activeConnection ? (
							<DatabaseTypeIcon type={activeConnection.type} className='h-4 w-4' />
						) : (
							<Database className='h-4 w-4' />
						)}
					</div>
					<div className='grid flex-1 min-w-0 text-left text-sm leading-tight'>
						<span
							className={cn(
								'truncate font-semibold',
								status === 'error' ? 'text-destructive' : 'text-foreground'
							)}
						>
							{activeConnection?.name || 'Select Database'}
						</span>
						{activeConnection && status !== 'error' ? (
							<span className='mt-1 flex flex-wrap items-center gap-1'>
								<SourceBadges
									connection={activeConnection}
									compact
									showReadonly={false}
								/>
								{activeDataFileHealth && (
									<DataFileHealthIndicator
										health={activeDataFileHealth}
										compact
									/>
								)}
							</span>
						) : (
							<span className='truncate text-xs text-muted-foreground'>
								{activeConnection ? 'Connection failed' : 'No connection'}
							</span>
						)}
					</div>
					<ChevronsUpDown
						className={cn(
							'ml-auto h-4 w-4 shrink-0 text-muted-foreground',
							'transition-[color,transform] duration-100 ease-[var(--ease-out)]',
							'group-hover/trigger:text-foreground',
							'group-data-[state=open]/trigger:text-foreground group-data-[state=open]/trigger:rotate-180'
						)}
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className='w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] p-1 data-[state=open]:animate-none! data-[state=closed]:animate-none!'
				align='start'
				side='bottom'
				sideOffset={6}
				onCloseAutoFocus={function preventCloseFocusRing(e) {
					e.preventDefault()
				}}
				onInteractOutside={function handleDropdownInteractOutside() {
					keepOpenUntilRef.current = 0
				}}
				onEscapeKeyDown={function handleDropdownEscape(event) {
					keepOpenUntilRef.current = 0
					stopEscapeFromReachingGlobalShortcuts(event)
				}}
				onKeyDownCapture={handleConnectionListKeyDownCapture}
				onKeyDown={handleConnectionListKeyDown}
			>
				<div className='px-2 pt-1.5 pb-2 space-y-2'>
					<div className='flex items-center justify-between'>
						<DropdownMenuLabel className='p-0 text-[10px] uppercase tracking-wider font-medium text-muted-foreground'>
							Databases
						</DropdownMenuLabel>
						<span className='text-[10px] tabular-nums text-muted-foreground/70'>
							{searchQuery.trim()
								? `${filteredConnections.length}/${connections.length}`
								: connections.length}
						</span>
					</div>
					<div className='relative'>
						<Search className='pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70' />
						<Input
							value={searchQuery}
							onChange={function handleSearchChange(e) {
								setSearchQuery(e.target.value)
							}}
							onKeyDown={keepTypingOutOfMenuTypeahead}
							placeholder='Search connections...'
							className='h-7 pl-7 text-xs'
						/>
					</div>
				</div>

				<ContextMenu modal={false} onOpenChange={handleContextMenuOpenChange}>
					<ContextMenuTrigger asChild onContextMenu={handleListContextMenu}>
						<div
							className='max-h-[320px] overflow-y-auto px-1'
							onPointerDownCapture={() => {
								armedConnectionIdRef.current = null
							}}
						>
							{filteredConnections.length > 0 ? (
								filteredConnections.map(function renderConnection(connection) {
									const rowEntries = dataFileEntriesCatalog.get(connection.id)
									const rowIsDataFile = isDataFileConnection(connection)
									return (
										<ConnectionMenuRow
											key={connection.id}
											connection={connection}
											isActive={connection.id === activeConnectionId}
											rowSummary={
												rowIsDataFile
													? resolveDataFileConnectionSummary(
															connection,
															rowEntries
														)
													: null
											}
											rowHealth={
												rowIsDataFile
													? resolveDataFileHealth({
															entries: rowEntries,
															connectionStatus: connection.status
														})
													: null
											}
											onSelect={selectConnection}
											onArmContextMenu={armContextMenu}
											onRegister={registerRow}
											onEditConnection={onEditConnection}
											onConfirmDelete={
												onDeleteConnection ? confirmDelete : undefined
											}
										/>
									)
								})
							) : (
								<EmptyState
									size='xs'
									headingLevel='h3'
									illustration={
										connections.length > 0 ? (
											<SearchIllustration />
										) : (
											<ProjectIllustration />
										)
									}
									title={
										connections.length > 0
											? 'No matching connections'
											: 'No connections found'
									}
								/>
							)}
						</div>
					</ContextMenuTrigger>
					<ContextMenuContent
						className='w-48'
						onEscapeKeyDown={stopEscapeFromReachingGlobalShortcuts}
					>
						{contextMenuConnection ? (
							<ConnectionContextItems
								connection={contextMenuConnection}
								onViewConnection={onViewConnection}
								onEditConnection={onEditConnection}
								onDumpConnection={onDumpConnection}
								onConfirmDelete={onDeleteConnection ? confirmDelete : undefined}
								onCloseMenus={closeMenus}
							/>
						) : null}
					</ContextMenuContent>
				</ContextMenu>

				<DropdownMenuSeparator />

				<DropdownMenuItem
					data-connection-footer-action
					onClick={onAddConnection}
					className='gap-2.5 p-2 transition-[background-color,color] duration-150 ease-[var(--ease-out)]'
				>
					<div className='flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background'>
						<Plus className='h-3.5 w-3.5 text-muted-foreground' />
					</div>
					<span className='text-sm text-muted-foreground'>Add connection</span>
				</DropdownMenuItem>

				<DropdownMenuItem
					data-connection-footer-action
					onClick={onManageConnections}
					className='gap-2.5 p-2 transition-[background-color,color] duration-150 ease-[var(--ease-out)]'
				>
					<div className='flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background'>
						<Settings className='h-3.5 w-3.5 text-muted-foreground' />
					</div>
					<span className='text-sm text-muted-foreground'>Manage connections</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
})
