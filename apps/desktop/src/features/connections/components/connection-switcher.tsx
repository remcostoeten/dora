import {
	ChevronsUpDown,
	Plus,
	Settings,
	Database,
	Check,
	MoreHorizontal,
	Eye,
	Pencil,
	Trash2,
	AlertCircle,
	Search
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/shared/ui/button'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger
} from '@/shared/ui/context-menu'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/utils/cn'
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

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='ghost'
					size='lg'
					className='w-full justify-between px-3 py-6 hover:bg-sidebar-accent text-sidebar-foreground group'
				>
					<div className='flex items-center gap-3 text-left'>
						<div
							className={cn(
								'flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0',
								status === 'error'
									? 'bg-destructive/10 text-destructive'
									: 'bg-primary/10 text-primary group-hover:bg-primary/20'
							)}
						>
							{status === 'error' ? (
								<AlertCircle className='h-4 w-4' />
							) : activeConnection ? (
								<DatabaseTypeIcon
									type={activeConnection.type}
									className='h-4 w-4'
								/>
							) : (
								<Database className='h-4 w-4' />
							)}
						</div>
						<div className='grid flex-1 text-left text-sm leading-tight'>
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
					</div>
					<ChevronsUpDown className='ml-auto h-4 w-4 shrink-0 opacity-50 text-muted-foreground group-hover:text-foreground transition-colors' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className='w-[240px] min-w-[240px]'
				align='start'
				side='bottom'
				sideOffset={4}
			>
				<DropdownMenuLabel className='sticky top-0 z-10 bg-popover text-xs text-muted-foreground uppercase tracking-wider font-medium'>
					Databases
				</DropdownMenuLabel>

				<div className='px-2 pb-2 space-y-2 border-b border-border/60'>
					<div className='text-[11px] text-muted-foreground'>
						{connections.length} saved connection{connections.length === 1 ? '' : 's'}
						{searchQuery.trim() &&
							` • ${filteredConnections.length} match${filteredConnections.length === 1 ? '' : 'es'}`}
					</div>
					<div className='relative'>
						<Search className='pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
						<Input
							value={searchQuery}
							onChange={function (e) {
								setSearchQuery(e.target.value)
							}}
							placeholder='Search connections...'
							className='h-8 pl-8 text-xs'
						/>
					</div>
				</div>

				<div className='max-h-[360px] overflow-y-auto pr-1'>
					{filteredConnections.length > 0 ? (
						filteredConnections.map((connection) => (
						<ContextMenu key={connection.id}>
							<ContextMenuTrigger asChild>
								<DropdownMenuItem
									onClick={function () {
										onConnectionSelect(connection.id)
									}}
									className='gap-2 p-2 cursor-pointer group'
								>
									<div className='flex items-center gap-2 w-full'>
										<div
											className={cn(
												'flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background',
												connection.status === 'error' &&
													'border-destructive/50 bg-destructive/5'
											)}
										>
											{connection.status === 'error' ? (
												<AlertCircle className='h-3 w-3 text-destructive' />
											) : (
												<DatabaseTypeIcon
													type={connection.type}
													className='h-3 w-3 text-muted-foreground'
												/>
											)}
										</div>
										<div className='flex-1 min-w-0'>
											<div className='truncate text-sm'>{connection.name}</div>
											<div className='truncate text-[10px] text-muted-foreground'>
												Created {formatQuickDate(connection.createdAt)}
											</div>
											<div className='truncate text-[10px] text-muted-foreground'>
												Last used {formatQuickDate(connection.lastConnectedAt)}
											</div>
										</div>
										<div className='ml-auto flex items-center gap-1'>
											{connection.id === activeConnectionId && (
												<Check className='h-4 w-4 text-primary' />
											)}
											{onEditConnection && (
												<Button
													variant='ghost'
													size='icon'
													className='h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-foreground'
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
													<Pencil className='h-3.5 w-3.5' />
												</Button>
											)}
											{onDeleteConnection && (
												<Button
													variant='ghost'
													size='icon'
													className='h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-destructive'
													onPointerDown={function (e) {
														e.preventDefault()
														e.stopPropagation()
													}}
													onClick={function (e) {
														e.preventDefault()
														e.stopPropagation()
														onDeleteConnection(connection.id)
													}}
													title={`Delete ${connection.name}`}
													aria-label={`Delete ${connection.name}`}
												>
													<Trash2 className='h-3.5 w-3.5' />
												</Button>
											)}
											<MoreHorizontal className='h-3.5 w-3.5 text-muted-foreground/60 opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none' />
										</div>
									</div>
								</DropdownMenuItem>
							</ContextMenuTrigger>
								<ContextMenuContent className='w-48'>
								<ContextMenuItem
									onSelect={() => onViewConnection?.(connection.id)}
									className='gap-2 cursor-pointer'
								>
									<Eye className='h-4 w-4' />
									View Details
								</ContextMenuItem>
								<ContextMenuItem
									onSelect={() => onEditConnection?.(connection.id)}
									className='gap-2 cursor-pointer'
								>
									<Pencil className='h-4 w-4' />
									Edit Connection
								</ContextMenuItem>
								<ContextMenuSeparator />
									<ContextMenuItem
										onSelect={(event) => {
											event.preventDefault()
											onDeleteConnection?.(connection.id)
										}}
										className='gap-2 text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer'
									>
										<Trash2 className='h-4 w-4' />
										Delete Connection
									</ContextMenuItem>
								</ContextMenuContent>
							</ContextMenu>
						))
					) : (
						<div className='px-2 py-3 text-xs text-center text-muted-foreground border border-dashed rounded-md m-1'>
							{connections.length > 0 ? 'No matching connections' : 'No connections found'}
						</div>
					)}
				</div>
				{filteredConnections.length > 6 && (
					<div className='px-2 pb-2 text-[10px] text-muted-foreground'>
						Scroll to view more connections
					</div>
				)}

				<DropdownMenuSeparator />

				<DropdownMenuItem onClick={onAddConnection} className='gap-2 p-2'>
					<div className='flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background'>
						<Plus className='h-3 w-3 text-muted-foreground' />
					</div>
					<div className='font-medium text-muted-foreground'>Add connection</div>
				</DropdownMenuItem>

				<DropdownMenuItem onClick={onManageConnections} className='gap-2 p-2'>
					<div className='flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background'>
						<Settings className='h-3 w-3 text-muted-foreground' />
					</div>
					<div className='font-medium text-muted-foreground'>Manage connections</div>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
