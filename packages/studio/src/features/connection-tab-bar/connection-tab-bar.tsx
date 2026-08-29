import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Eye, Pencil, Plus, X, Trash2 } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import type { Connection } from '@studio/features/connections/types'
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger
} from '@studio/shared/ui/context-menu'

// Connection tab bar (issue #96). Renders one tab per open connection above the
// table TabBar so the user can keep several databases open at once and switch
// between their isolated tab groups. A status dot mirrors the connection's live
// state; the trailing + opens the existing connection dialog.

type Props = {
	// Connections the user has open, in display order.
	connections: Connection[]
	activeConnectionId: string
	onSelect: (connectionId: string) => void
	onClose: (connectionId: string) => void
	onViewConnection?: (connectionId: string) => void
	onEditConnection?: (connectionId: string) => void
	onCloseOtherConnections?: (connectionId: string) => void
	onCloseConnectionsToLeft?: (connectionId: string) => void
	onCloseConnectionsToRight?: (connectionId: string) => void
	onAddConnection: () => void
	rightSlot?: ReactNode
}

function statusColor(status: Connection['status']): string {
	switch (status) {
		case 'connected':
			return 'bg-green-500'
		case 'error':
			return 'bg-red-500'
		case 'idle':
		default:
			// No definitive state yet — treat as connecting/idle.
			return 'bg-amber-500'
	}
}

function statusLabel(status: Connection['status']): string {
	switch (status) {
		case 'connected':
			return 'Connected'
		case 'error':
			return 'Connection error'
		default:
			return 'Connecting'
	}
}

function connectionDetail(connection: Connection): string | null {
	const firstFile = connection.fileSources?.[0]
	if (firstFile) return firstFile.split('/').pop() ?? firstFile
	return connection.database || connection.host || null
}

// When several open connections share a name ("Neon DB", "Neon DB"), the tab
// alone can't tell them apart. Prefer a detail that actually differs between
// them (database, host, file); fall back to a positional #n.
function disambiguateName(connection: Connection, connections: Connection[]): string | null {
	const sameName = connections.filter((item) => item.name === connection.name)
	if (sameName.length < 2) return null
	const detail = connectionDetail(connection)
	const detailIsUnique =
		detail != null &&
		sameName.every((item) => item.id === connection.id || connectionDetail(item) !== detail)
	if (detail && detailIsUnique) return detail
	return `#${sameName.findIndex((item) => item.id === connection.id) + 1}`
}

function StatusDot({ status }: { status: Connection['status'] }) {
	const prevStatusRef = useRef(status)
	const [flash, setFlash] = useState<'success' | 'error' | null>(null)

	useEffect(
		function flashOnTransition() {
			if (prevStatusRef.current === status) return
			prevStatusRef.current = status
			if (status === 'connected') setFlash('success')
			else if (status === 'error') setFlash('error')
			else setFlash(null)
		},
		[status]
	)

	return (
		<span
			aria-hidden='true'
			onAnimationEnd={function clearFlash() {
				setFlash(null)
			}}
			className={cn(
				'h-2 w-2 shrink-0 rounded-full transition-colors duration-300 ease-[var(--ease-out)]',
				statusColor(status),
				flash === 'success' && 'connection-status-success',
				flash === 'error' && 'connection-status-error'
			)}
		/>
	)
}

export function ConnectionTabBar({
	connections,
	activeConnectionId,
	onSelect,
	onClose,
	onViewConnection,
	onEditConnection,
	onCloseOtherConnections,
	onCloseConnectionsToLeft,
	onCloseConnectionsToRight,
	onAddConnection,
	rightSlot
}: Props) {
	return (
		<div
			className='flex items-center h-8 border-b border-border bg-sidebar shrink-0 select-none'
			data-tauri-drag-region='true'
		>
			<div className='flex h-full min-w-0 flex-1 items-center overflow-x-auto scrollbar-none'>
				{connections.map((connection) => {
					const isActive = connection.id === activeConnectionId
					const connectionIndex = connections.findIndex(
						(item) => item.id === connection.id
					)
					const hasClosableLeftConnections = connectionIndex > 0
					const hasClosableRightConnections =
						connectionIndex >= 0 && connectionIndex < connections.length - 1
					const hasClosableOtherConnections = connections.some(
						(item) => item.id !== connection.id
					)
					const nameHint = disambiguateName(connection, connections)
					const fullLabel = nameHint
						? `${connection.name} (${nameHint})`
						: connection.name
					return (
						<ContextMenu key={connection.id}>
							<ContextMenuTrigger asChild>
								<div
									className={cn(
										'relative flex items-center h-full shrink-0 border-r border-border transition-colors',
										isActive
											? 'bg-background text-foreground'
											: 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
									)}
									data-tauri-drag-region='false'
								>
									<button
										onClick={() => onSelect(connection.id)}
										className='flex items-center gap-1.5 h-full px-2 pl-3 text-xs font-medium'
										data-tauri-drag-region='false'
										title={`${fullLabel} — ${statusLabel(connection.status)}`}
										aria-current={isActive ? 'page' : undefined}
										aria-label={`${fullLabel}, ${statusLabel(connection.status)}`}
									>
										<StatusDot status={connection.status} />
										<span className='max-w-[140px] truncate'>
											{connection.name}
										</span>
										{nameHint ? (
											<span className='max-w-[90px] truncate font-normal text-muted-foreground'>
												{nameHint}
											</span>
										) : null}
									</button>
									<button
										aria-label={`Close ${connection.name}`}
										onClick={(e) => {
											e.stopPropagation()
											onClose(connection.id)
										}}
										onAuxClick={(e) => {
											if (e.button === 1) {
												e.preventDefault()
												onClose(connection.id)
											}
										}}
										className='h-full px-1 pr-2 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground'
										data-tauri-drag-region='false'
									>
										<X className='h-3 w-3' />
									</button>
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent className='w-52'>
								{onViewConnection ? (
									<ContextMenuItem
										onClick={() => onViewConnection(connection.id)}
									>
										<Eye className='h-4 w-4' />
										View connection
									</ContextMenuItem>
								) : null}
								{onEditConnection ? (
									<ContextMenuItem
										onClick={() => onEditConnection(connection.id)}
									>
										<Pencil className='h-4 w-4' />
										Edit connection
									</ContextMenuItem>
								) : null}
								{onViewConnection || onEditConnection ? (
									<ContextMenuSeparator />
								) : null}
								<ContextMenuItem
									onClick={() => onClose(connection.id)}
									variant='destructive'
								>
									<Trash2 className='h-4 w-4' />
									Close connection
								</ContextMenuItem>
								<ContextMenuItem
									onClick={() => onCloseOtherConnections?.(connection.id)}
									disabled={
										!onCloseOtherConnections || !hasClosableOtherConnections
									}
								>
									Close other connections
								</ContextMenuItem>
								<ContextMenuItem
									onClick={() => onCloseConnectionsToLeft?.(connection.id)}
									disabled={
										!onCloseConnectionsToLeft || !hasClosableLeftConnections
									}
								>
									Close connections to left
								</ContextMenuItem>
								<ContextMenuItem
									onClick={() => onCloseConnectionsToRight?.(connection.id)}
									disabled={
										!onCloseConnectionsToRight || !hasClosableRightConnections
									}
								>
									Close connections to right
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					)
				})}
				<button
					aria-label='Add connection'
					onClick={onAddConnection}
					className='flex items-center justify-center h-full px-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
					data-tauri-drag-region='false'
					title='Add connection'
				>
					<Plus className='h-3.5 w-3.5' />
				</button>
			</div>
			{rightSlot ? (
				<div
					className='flex h-full shrink-0 items-center border-l border-border px-1'
					data-tauri-drag-region='false'
				>
					{rightSlot}
				</div>
			) : null}
		</div>
	)
}
