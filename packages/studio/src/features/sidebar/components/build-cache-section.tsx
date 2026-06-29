import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import { CheckSquare, ExternalLink, RefreshCw, Square, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@studio/shared/ui/button'
import { Spinner } from '@studio/shared/ui/spinner'
import { SidebarSection } from './sidebar-panel'

type BuildCacheEntry = {
	name: string
	path: string
	bytes: number
	removable: boolean
}

type BuildCacheStats = {
	target_path: string
	exists: boolean
	total_bytes: number
	entries: BuildCacheEntry[]
}

type BuildCacheCleanResult = {
	removed_bytes: number
	removed_entries: string[]
	stats: BuildCacheStats
}

function isTauriRuntime(): boolean {
	return (
		typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
	)
}

function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	let value = bytes
	let unitIndex = 0
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024
		unitIndex += 1
	}
	const precision = value >= 10 || unitIndex === 0 ? 0 : 1
	return `${value.toFixed(precision)} ${units[unitIndex]}`
}

async function getBuildCacheStats(): Promise<BuildCacheStats> {
	if (!isTauriRuntime()) {
		return {
			target_path: '/demo/src-tauri/target',
			exists: true,
			total_bytes: 0,
			entries: []
		}
	}
	return invoke<BuildCacheStats>('get_build_cache_stats')
}

async function cleanBuildCache(entries: string[]): Promise<BuildCacheCleanResult> {
	return invoke<BuildCacheCleanResult>('clean_build_cache', {
		request: { entries }
	})
}

export function BuildCacheSection() {
	const [stats, setStats] = useState<BuildCacheStats | null>(null)
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [loading, setLoading] = useState(false)
	const [cleaning, setCleaning] = useState(false)
	const [confirmClean, setConfirmClean] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const selectedBytes = useMemo(function () {
		if (!stats) return 0
		return stats.entries.reduce(function (total, entry) {
			return selected.has(entry.name) ? total + entry.bytes : total
		}, 0)
	}, [selected, stats])

	const removableEntries = useMemo(function () {
		return stats?.entries.filter((entry) => entry.removable) ?? []
	}, [stats])

	const load = useCallback(async function load() {
		setLoading(true)
		setError(null)
		try {
			const nextStats = await getBuildCacheStats()
			setStats(nextStats)
			setSelected(function (current) {
				const valid = new Set(nextStats.entries.map((entry) => entry.name))
				return new Set(Array.from(current).filter((name) => valid.has(name)))
			})
		} catch (err) {
			setError(String(err))
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(
		function loadOnMount() {
			void load()
		},
		[load]
	)

	function toggleEntry(name: string) {
		setConfirmClean(false)
		setSelected(function (current) {
			const next = new Set(current)
			if (next.has(name)) {
				next.delete(name)
			} else {
				next.add(name)
			}
			return next
		})
	}

	function toggleAll() {
		setConfirmClean(false)
		setSelected(function (current) {
			if (current.size === removableEntries.length) return new Set()
			return new Set(removableEntries.map((entry) => entry.name))
		})
	}

	async function handleClean() {
		const entries = Array.from(selected)
		if (entries.length === 0 || !isTauriRuntime()) return
		if (!confirmClean) {
			setConfirmClean(true)
			return
		}

		setCleaning(true)
		setError(null)
		setMessage(null)
		try {
			const result = await cleanBuildCache(entries)
			setStats(result.stats)
			setSelected(new Set())
			setConfirmClean(false)
			setMessage(`Removed ${formatBytes(result.removed_bytes)}`)
		} catch (err) {
			setError(String(err))
		} finally {
			setCleaning(false)
		}
	}

	async function handleOpenTarget() {
		if (!stats?.target_path || !isTauriRuntime()) return
		try {
			await open(stats.target_path)
		} catch (err) {
			setError(String(err))
		}
	}

	const allSelected = removableEntries.length > 0 && selected.size === removableEntries.length

	return (
		<SidebarSection title='Build cache'>
			<div className='space-y-3'>
				<div className='flex items-center justify-between gap-3'>
					<div>
						<div className='text-sm text-sidebar-foreground'>
							{formatBytes(stats?.total_bytes ?? 0)}
						</div>
						<div className='text-xs text-muted-foreground'>Cargo target data</div>
					</div>
					<div className='flex gap-1'>
						<Button
							variant='ghost'
							size='icon'
							className='h-7 w-7'
							disabled={loading}
							onClick={function () {
								void load()
							}}
							title='Refresh build cache'
						>
							{loading ? <Spinner className='h-3.5 w-3.5' /> : <RefreshCw className='h-3.5 w-3.5' />}
						</Button>
						<Button
							variant='ghost'
							size='icon'
							className='h-7 w-7'
							disabled={!stats?.exists}
							onClick={function () {
								void handleOpenTarget()
							}}
							title='Open target folder'
						>
							<ExternalLink className='h-3.5 w-3.5' />
						</Button>
					</div>
				</div>

				{stats?.target_path ? (
					<div className='rounded-sm bg-sidebar-accent/30 px-2 py-1 font-mono text-xs text-sidebar-foreground break-all'>
						{stats.target_path}
					</div>
				) : null}

				{stats && !stats.exists ? (
					<div className='text-xs text-muted-foreground'>No target directory found.</div>
				) : null}

				{stats && stats.entries.length > 0 ? (
					<div className='space-y-1'>
						<div className='flex items-center justify-between'>
							<div className='text-xs text-muted-foreground'>Entries</div>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 px-2 text-xs'
								onClick={toggleAll}
							>
								{allSelected ? (
									<CheckSquare className='mr-1 h-3 w-3' />
								) : (
									<Square className='mr-1 h-3 w-3' />
								)}
								{allSelected ? 'Clear' : 'All'}
							</Button>
						</div>
						{stats.entries.map(function (entry) {
							const isSelected = selected.has(entry.name)
							return (
								<button
									key={entry.name}
									type='button'
									className='flex w-full items-center gap-2 rounded-sm px-1 py-1 text-left hover:bg-sidebar-accent/30'
									onClick={function () {
										toggleEntry(entry.name)
									}}
								>
									{isSelected ? (
										<CheckSquare className='h-3.5 w-3.5 shrink-0 text-sidebar-foreground' />
									) : (
										<Square className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
									)}
									<div className='min-w-0 flex-1'>
										<div className='truncate text-sm text-sidebar-foreground'>
											{entry.name}
										</div>
										<div className='truncate text-xs text-muted-foreground'>
											{entry.path}
										</div>
									</div>
									<div className='shrink-0 text-xs text-muted-foreground'>
										{formatBytes(entry.bytes)}
									</div>
								</button>
							)
						})}
					</div>
				) : null}

				{message ? <div className='text-xs text-green-500'>{message}</div> : null}
				{error ? <div className='break-all text-xs text-destructive'>{error}</div> : null}

				<div className='border-t border-sidebar-border pt-2'>
					<Button
						variant='ghost'
						size='sm'
						className='h-7 w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive'
						disabled={selected.size === 0 || cleaning || !isTauriRuntime()}
						onClick={function () {
							void handleClean()
						}}
					>
						{cleaning ? (
							<Spinner className='mr-1 h-3 w-3' />
						) : (
							<Trash2 className='mr-1 h-3 w-3' />
						)}
						{confirmClean
							? `Confirm clean ${formatBytes(selectedBytes)}`
							: `Clean selected ${selected.size ? `(${formatBytes(selectedBytes)})` : ''}`}
					</Button>
					{confirmClean && !cleaning ? (
						<Button
							variant='ghost'
							size='sm'
							className='mt-1 h-7 w-full text-xs'
							onClick={function () {
								setConfirmClean(false)
							}}
						>
							Cancel
						</Button>
					) : null}
				</div>
			</div>
		</SidebarSection>
	)
}
