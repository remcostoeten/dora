import {
	Clock,
	Trash2,
	CheckCircle,
	XCircle,
	Pin,
	PinOff,
	Layers,
	Download,
	X,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { cn } from '@/shared/utils/cn'
import { useQueryHistory, type QueryHistoryItem } from '../stores/query-history-store'

type Props = {
	onSelectQuery: (query: string) => void
	currentConnectionId?: string
	getConnectionName?: (id: string) => string
}

export function QueryHistoryPanel({ onSelectQuery, currentConnectionId, getConnectionName }: Props) {
	const { history, clearHistory, removeFromHistory, pinItem, unpinItem } = useQueryHistory()
	const [search, setSearch] = useState('')
	const [groupByConnection, setGroupByConnection] = useState(false)
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

	function formatTimestamp(timestamp: number): string {
		const date = new Date(timestamp)
		const now = new Date()
		const diffMs = now.getTime() - date.getTime()
		const diffMins = Math.floor(diffMs / 60000)
		const diffHours = Math.floor(diffMs / 3600000)
		const diffDays = Math.floor(diffMs / 86400000)

		if (diffMins < 1) return 'Just now'
		if (diffMins < 60) return `${diffMins}m ago`
		if (diffHours < 24) return `${diffHours}h ago`
		if (diffDays < 7) return `${diffDays}d ago`
		return date.toLocaleDateString()
	}

	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`
		return `${(ms / 1000).toFixed(2)}s`
	}

	function truncateQuery(query: string, maxLength = 80): string {
		const singleLine = query.replace(/\s+/g, ' ').trim()
		if (singleLine.length <= maxLength) return singleLine
		return singleLine.substring(0, maxLength) + '...'
	}

	function connectionLabel(id: string | null): string {
		if (!id) return 'Unknown'
		if (getConnectionName) return getConnectionName(id)
		return id.slice(0, 8)
	}

	function toggleGroup(key: string) {
		setCollapsedGroups(function (prev) {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	function handleExport() {
		const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = 'query-history.json'
		a.click()
		URL.revokeObjectURL(url)
	}

	const filtered = useMemo(function () {
		const q = search.toLowerCase()
		if (!q) return history
		return history.filter(function (item) {
			return (
				item.query.toLowerCase().includes(q) ||
				(item.error && item.error.toLowerCase().includes(q))
			)
		})
	}, [history, search])

	const visibleItems = useMemo(function () {
		if (!currentConnectionId) return filtered
		return filtered.filter(function (item) {
			return item.connectionId === currentConnectionId || item.pinned
		})
	}, [filtered, currentConnectionId])

	const pinnedItems = useMemo(
		() => visibleItems.filter((i) => i.pinned),
		[visibleItems]
	)
	const unpinnedItems = useMemo(
		() => visibleItems.filter((i) => !i.pinned),
		[visibleItems]
	)

	const groups = useMemo(function () {
		if (!groupByConnection) return null
		const map = new Map<string, QueryHistoryItem[]>()
		unpinnedItems.forEach(function (item) {
			const key = item.connectionId ?? '__unknown__'
			if (!map.has(key)) map.set(key, [])
			map.get(key)!.push(item)
		})
		return map
	}, [groupByConnection, unpinnedItems])

	function renderItem(item: QueryHistoryItem) {
		return (
			<div
				key={item.id}
				className='group flex flex-col px-3 py-2 border-b border-sidebar-border/50 hover:bg-sidebar-accent/50 cursor-pointer transition-colors'
				onClick={function () { onSelectQuery(item.query) }}
			>
				<div className='flex items-start gap-2'>
					{item.success ? (
						<CheckCircle className='h-3 w-3 text-green-500 mt-0.5 shrink-0' />
					) : (
						<XCircle className='h-3 w-3 text-red-500 mt-0.5 shrink-0' />
					)}
					<span className='text-xs font-mono text-sidebar-foreground flex-1 break-all'>
						{truncateQuery(item.query)}
					</span>
					<div className='flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
						<Button
							variant='ghost'
							size='sm'
							className='h-5 w-5 p-0'
							title={item.pinned ? 'Unpin' : 'Pin'}
							onClick={function (e) {
								e.stopPropagation()
								item.pinned ? unpinItem(item.id) : pinItem(item.id)
							}}
						>
							{item.pinned ? (
								<PinOff className='h-3 w-3 text-primary' />
							) : (
								<Pin className='h-3 w-3 text-muted-foreground hover:text-primary' />
							)}
						</Button>
						<Button
							variant='ghost'
							size='sm'
							className='h-5 w-5 p-0'
							onClick={function (e) {
								e.stopPropagation()
								removeFromHistory(item.id)
							}}
						>
							<Trash2 className='h-3 w-3 text-muted-foreground hover:text-destructive' />
						</Button>
					</div>
				</div>
				<div className='flex items-center gap-2 mt-1 ml-5'>
					<span className='text-[10px] text-muted-foreground'>
						{formatTimestamp(item.timestamp)}
					</span>
					<span className='text-[10px] text-muted-foreground'>•</span>
					<span className='text-[10px] text-muted-foreground'>
						{formatDuration(item.executionTimeMs)}
					</span>
					{item.rowCount !== undefined && (
						<>
							<span className='text-[10px] text-muted-foreground'>•</span>
							<span className='text-[10px] text-muted-foreground'>
								{item.rowCount} rows
							</span>
						</>
					)}
				</div>
			</div>
		)
	}

	return (
		<div className='flex flex-col h-full bg-sidebar border-r border-sidebar-border'>
			{/* Header */}
			<div className='flex items-center justify-between px-3 py-2 border-b border-sidebar-border'>
				<div className='flex items-center gap-2'>
					<Clock className='h-4 w-4 text-muted-foreground' />
					<span className='text-xs font-medium'>History</span>
					{search && (
						<span className='text-[10px] text-muted-foreground'>
							{visibleItems.length} / {history.length}
						</span>
					)}
				</div>
				<div className='flex items-center gap-0.5'>
					<Button
						variant='ghost'
						size='icon'
						className={cn(
							'h-6 w-6',
							groupByConnection && 'text-primary bg-sidebar-accent'
						)}
						title='Group by connection'
						onClick={function () { setGroupByConnection((v) => !v) }}
					>
						<Layers className='h-3.5 w-3.5' />
					</Button>
					<Button
						variant='ghost'
						size='icon'
						className='h-6 w-6'
						title='Export history'
						onClick={handleExport}
						disabled={history.length === 0}
					>
						<Download className='h-3.5 w-3.5' />
					</Button>
					{visibleItems.length > 0 && (
						<Button
							variant='ghost'
							size='sm'
							onClick={clearHistory}
							className='h-6 px-2 text-xs text-muted-foreground hover:text-destructive'
						>
							Clear
						</Button>
					)}
				</div>
			</div>

			{/* Search */}
			<div className='px-2 py-1.5 border-b border-sidebar-border'>
				<div className='relative'>
					<Input
						placeholder='Search history...'
						value={search}
						onChange={function (e) { setSearch(e.target.value) }}
						className='h-6 text-xs pr-6'
					/>
					{search && (
						<button
							className='absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
							onClick={function () { setSearch('') }}
						>
							<X className='h-3 w-3' />
						</button>
					)}
				</div>
			</div>

			<ScrollArea className='flex-1'>
				{visibleItems.length === 0 ? (
					<div className='flex flex-col items-center justify-center h-32 text-muted-foreground'>
						<Clock className='h-8 w-8 mb-2 opacity-50' />
						<span className='text-xs'>
							{search ? 'No matches' : 'No query history'}
						</span>
					</div>
				) : (
					<div className='flex flex-col'>
						{/* Pinned section */}
						{pinnedItems.length > 0 && (
							<>
								<div className='px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-sidebar-accent/30 border-b border-sidebar-border'>
									Pinned
								</div>
								{pinnedItems.map(renderItem)}
							</>
						)}

						{/* Unpinned — flat or grouped */}
						{!groupByConnection ? (
							unpinnedItems.map(renderItem)
						) : (
							groups && Array.from(groups.entries()).map(function ([key, items]) {
								const label = connectionLabel(key === '__unknown__' ? null : key)
								const collapsed = collapsedGroups.has(key)
								return (
									<div key={key}>
										<button
											className='w-full flex items-center justify-between px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-sidebar-accent/20 border-b border-sidebar-border hover:bg-sidebar-accent/40 transition-colors'
											onClick={function () { toggleGroup(key) }}
										>
											<span>{label}</span>
											<span>{collapsed ? '▸' : '▾'} {items.length}</span>
										</button>
										{!collapsed && items.map(renderItem)}
									</div>
								)
							})
						)}
					</div>
				)}
			</ScrollArea>
		</div>
	)
}
