import {
	ChevronsUpDown,
	Plus,
	Settings,
	Database,
	Eye,
	Pencil,
	Trash2,
	AlertCircle,
	Search
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
import { Connection, DatabaseType } from '../types'
import { DatabaseTypeIcon } from './database-type-icon'

function formatDatabaseType(type: DatabaseType | undefined): string {
	if (!type) return 'Database'
	switch (type.toLowerCase()) {
		case 'postgres':
		case 'postgresql':
			return 'PostgreSQL'
		case 'sqlite':
			return 'SQLite'
		case 'libsql':
		case 'turso':
			return 'Turso'
		case 'mysql':
			return 'MySQL'
		default:
			return type.charAt(0).toUpperCase() + type.slice(1)
	}
}

function normalizeTimestamp(value: number | null | undefined): number | null {
	if (!value) return null
	return value < 1_000_000_000_000 ? value * 1000 : value
}

function formatQuickDate(value: number | null | undefined): string {
	const normalized = normalizeTimestamp(value)
	if (!normalized) return 'Never'
	const date = new Date(normalized)
	if (Number.isNaN(date.getTime())) return 'Unknown'
	return date.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	})
}

type Props = {
	connections: Connection[]
	activeConnectionId?: string
	onConnectionSelect: (id: string) => void
	onAddConnection: () => void
	onManageConnections: () => void
	onViewConnection?: (id: string) => void
	onEditConnection?: (id: string) => void
	onDeleteConnection?: (id: string) => void
}

export function ConnectionSwitcher({
	connections,
	activeConnectionId,
	onConnectionSelect,
	onAddConnection,
	onManageConnections,
	onViewConnection,
	onEditConnection,
	onDeleteConnection
}: Props) {
	const [searchQuery, setSearchQuery] = useState('')
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const [contextMenuConnectionId, setContextMenuConnectionId] = useState<string | null>(null)
	const keepOpenAfterDeleteRef = useRef(false)
	const connectionRowRefs = useRef(new Map<string, HTMLDivElement>())
	const prefersReducedMotion = useReducedMotion()
	const activeConnection = connections.find((c) => c.id === activeConnectionId)
	const status = activeConnection?.status || 'idle'

	const filteredConnections = useMemo(
		function getFilteredConnections() {
			const query = searchQuery.trim().toLowerCase()
			if (!query) return connections
			return connections.filter(function (connection) {
				return (
					connection.name.toLowerCase().includes(query) ||
					formatDatabaseType(connection.type).toLowerCase().includes(query) ||
					(connection.host || 'local').toLowerCase().includes(query)
				)
			})
		},
		[connections, searchQuery]
	)

	useEffect(
		function focusActiveConnectionOnOpen() {
			if (!dropdownOpen) return

			const frame = window.requestAnimationFrame(function () {
				const activeIndex = filteredConnections.findIndex(function (connection) {
					return connection.id === activeConnectionId
				})
				focusConnectionRow(activeIndex >= 0 ? activeIndex : 0)
			})

			return function () {
				window.cancelAnimationFrame(frame)
			}
		},
		[activeConnectionId, dropdownOpen, filteredConnections]
	)

	function confirmDelete(id: string) {
		keepOpenAfterDeleteRef.current = true
		onDeleteConnection?.(id)
		setDropdownOpen(true)
	}

	function closeMenus() {
		setContextMenuConnectionId(null)
		setDropdownOpen(false)
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
				focusedIndex === -1
					? 0
					: Math.min(focusedIndex + 1, filteredConnections.length - 1)
			focusConnectionRow(nextIndex)
			return
		}

		if (e.key === 'ArrowUp') {
			e.preventDefault()
			const nextIndex =
				focusedIndex === -1
					? filteredConnections.length - 1
					: Math.max(focusedIndex - 1, 0)
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

	return (
		<>
		<DropdownMenu
			open={dropdownOpen}
			onOpenChange={function handleMenuOpenChange(open) {
				if (!open && contextMenuConnectionId) return
				if (!open && keepOpenAfterDeleteRef.current) {
					keepOpenAfterDeleteRef.current = false
					setDropdownOpen(true)
					return
				}
				setDropdownOpen(open)
			}}
		>
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
						'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40'
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
						<span className='truncate text-xs text-muted-foreground'>
							{activeConnection
								? status === 'error'
									? 'Connection failed'
									: `${formatDatabaseType(activeConnection.type)} • ${activeConnection.host || 'Local'}`
								: 'No connection'}
						</span>
					</div>
					<ChevronsUpDown
						className={cn(
							'ml-auto h-4 w-4 shrink-0 text-muted-foreground',
							'transition-[color,transform] duration-200 ease-[var(--ease-out)]',
							'group-hover/trigger:text-foreground',
							'group-data-[state=open]/trigger:text-foreground group-data-[state=open]/trigger:rotate-180'
						)}
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className='w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] p-1'
				align='start'
				side='bottom'
				sideOffset={6}
				onInteractOutside={function handleDropdownInteractOutside(e) {
					if (contextMenuConnectionId) {
						e.preventDefault()
					}
				}}
				onKeyDown={handleConnectionListKeyDown}
				style={{
					transitionTimingFunction: 'var(--ease-out)'
				}}
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
							placeholder='Search connections...'
							className='h-7 pl-7 text-xs'
						/>
					</div>
				</div>

				<div className='max-h-[320px] overflow-y-auto px-1'>
					{filteredConnections.length > 0 ? (
						<AnimatePresence initial={false} mode='popLayout'>
							{filteredConnections.map(function renderConnection(connection) {
								const isActive = connection.id === activeConnectionId
								return (
									<motion.div
										key={connection.id}
										layout={!prefersReducedMotion}
										initial={false}
										exit={
											prefersReducedMotion
												? { opacity: 0 }
												: { opacity: 0, height: 0, scale: 0.98 }
										}
										transition={{
											duration: prefersReducedMotion ? 0.08 : 0.18,
											ease: [0.16, 1, 0.3, 1]
										}}
									>
									<ContextMenu modal={false}>
									<DropdownMenuItem
										asChild
										onSelect={function handleMenuItemSelect(e) {
											const target = e.target
											if (
												target instanceof HTMLElement &&
												target.closest('[data-connection-action]')
											) {
												e.preventDefault()
											}
										}}
									>
										<ContextMenuTrigger asChild>
											<div
												ref={function setConnectionRowRef(node) {
													if (node) {
														connectionRowRefs.current.set(connection.id, node)
													} else {
														connectionRowRefs.current.delete(connection.id)
													}
												}}
												role='menuitem'
												tabIndex={0}
												data-connection-id={connection.id}
												aria-current={isActive ? 'true' : undefined}
												aria-label={`${connection.name}, ${formatDatabaseType(connection.type)}, last connected ${formatQuickDate(connection.lastConnectedAt)}`}
												onContextMenuCapture={function handleConnectionContextMenu() {
													setContextMenuConnectionId(connection.id)
													setDropdownOpen(true)
												}}
												onClick={function handleConnectionClick() {
													onConnectionSelect(connection.id)
												}}
												onKeyDown={function handleRowKeyDown(e) {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault()
														onConnectionSelect(connection.id)
													}
												}}
												className={cn(
													'group/row relative gap-2.5 p-2 cursor-pointer overflow-hidden',
													'flex items-center outline-hidden',
													'transition-[background-color,color] duration-150 ease-[var(--ease-out)]',
													'focus:bg-sidebar-accent data-[highlighted]:bg-sidebar-accent',
													isActive && 'bg-sidebar-accent/40'
												)}
											>
											<span
												aria-hidden
												className={cn(
													'pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full',
													'origin-left transition-[transform,background-color] duration-200 ease-[var(--ease-out)]',
													isActive
														? 'scale-x-100 bg-primary'
														: 'scale-x-0 bg-primary'
												)}
											/>
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
														isActive
															? 'font-medium text-foreground'
															: 'text-foreground/90'
													)}
												>
													{connection.name}
												</div>
												<div className='truncate text-[10px] text-muted-foreground/80'>
													{`${formatDatabaseType(connection.type)} • ${formatQuickDate(connection.lastConnectedAt)}`}
												</div>
											</div>
											<div className='relative ml-auto flex items-center'>
												<div
													className='flex items-center animate-in fade-in-0'
													style={{
														animationDuration: '160ms',
														animationTimingFunction: 'var(--ease-out)'
													}}
												>
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
																'focus-visible:outline-hidden focus-visible:opacity-100 focus-visible:translate-x-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/40'
															)}
															onPointerDown={function (e) {
																e.preventDefault()
																e.stopPropagation()
															}}
															onClick={function (e) {
																e.preventDefault()
																e.stopPropagation()
																onEditConnection(connection.id)
															}}
															title={`Edit ${connection.name}`}
															aria-label={`Edit ${connection.name}`}
														>
															<Pencil className='h-3 w-3' />
														</button>
													)}
													{onDeleteConnection && (
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
																'focus-visible:outline-hidden focus-visible:opacity-100 focus-visible:translate-x-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-destructive/40'
															)}
															onPointerDown={function (e) {
																keepOpenAfterDeleteRef.current = true
																e.preventDefault()
																e.stopPropagation()
															}}
															onClick={function (e) {
																e.preventDefault()
																e.stopPropagation()
																confirmDelete(connection.id)
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
										</ContextMenuTrigger>
									</DropdownMenuItem>
									<ContextMenuContent
										className='w-48'
										onEscapeKeyDown={function handleContextEscape() {
											setContextMenuConnectionId(null)
										}}
										onPointerDownOutside={function handleContextPointerOutside() {
											setContextMenuConnectionId(null)
										}}
									>
										{onViewConnection && (
										<ContextMenuItem
											onSelect={function viewConnection() {
												onViewConnection(connection.id)
												closeMenus()
											}}
										>
											<Eye />
											View Details
										</ContextMenuItem>
									)}
									{onEditConnection && (
										<ContextMenuItem
											onSelect={function editConnection() {
												onEditConnection(connection.id)
												closeMenus()
											}}
										>
											<Pencil />
											Edit Connection
										</ContextMenuItem>
									)}
									{onDeleteConnection && (
										<>
											<ContextMenuSeparator />
											<ContextMenuItem
												onSelect={function deleteConnection() {
													confirmDelete(connection.id)
													setContextMenuConnectionId(null)
												}}
												variant='destructive'
											>
												<Trash2 />
												Delete Connection
											</ContextMenuItem>
										</>
									)}
									</ContextMenuContent>
									</ContextMenu>
									</motion.div>
								)
							})}
						</AnimatePresence>
					) : (
						<div className='px-2 py-6 text-xs text-center text-muted-foreground'>
							{connections.length > 0
								? 'No matching connections'
								: 'No connections found'}
						</div>
					)}
				</div>

				<DropdownMenuSeparator />

				<DropdownMenuItem
					onClick={onAddConnection}
					className='gap-2.5 p-2 transition-[background-color,color] duration-150 ease-[var(--ease-out)]'
				>
					<div className='flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background'>
						<Plus className='h-3.5 w-3.5 text-muted-foreground' />
					</div>
					<span className='text-sm text-muted-foreground'>Add connection</span>
				</DropdownMenuItem>

				<DropdownMenuItem
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

		</>
	)
}
