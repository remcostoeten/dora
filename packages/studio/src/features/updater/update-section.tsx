import { useEffect } from 'react'

import { isTauriRuntime } from '@studio/core/platform'
import { Button } from '@studio/shared/ui/button'

import { useAppUpdater } from './use-app-updater'

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	const units = ['KB', 'MB', 'GB']
	let value = bytes / 1024
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit += 1
	}
	return `${value.toFixed(1)} ${units[unit]}`
}

export function UpdateSection() {
	const { status, available, progress, error, check, install } = useAppUpdater()
	const isDesktop = isTauriRuntime()

	// Check once on mount so an available update surfaces without user action.
	useEffect(
		function () {
			if (isDesktop) {
				void check()
			}
		},
		[isDesktop, check]
	)

	if (!isDesktop) {
		return (
			<div className='text-xs leading-tight text-muted-foreground'>
				Automatic updates are available in the desktop app.
			</div>
		)
	}

	const isBusy = status === 'checking' || status === 'downloading'
	const percent =
		progress && progress.contentLength
			? Math.min(100, Math.round((progress.downloaded / progress.contentLength) * 100))
			: null

	return (
		<div className='space-y-3'>
			<div className='flex items-start justify-between gap-4'>
				<div className='flex-1'>
					<div className='text-sm text-sidebar-foreground'>App updates</div>
					<div className='text-xs leading-tight text-muted-foreground'>
						{status === 'checking' && 'Checking for updates…'}
						{status === 'up-to-date' && "You're on the latest version."}
						{status === 'available' &&
							available &&
							`Version ${available.version} is available (you have ${available.currentVersion}).`}
						{status === 'downloading' &&
							(percent !== null
								? `Downloading update… ${percent}%`
								: progress
									? `Downloading update… ${formatBytes(progress.downloaded)}`
									: 'Downloading update…')}
						{status === 'installed' && 'Update installed — restarting…'}
						{status === 'error' && (error ?? 'Something went wrong.')}
						{status === 'idle' && 'Check whether a newer version is available.'}
					</div>
				</div>
				<div className='flex flex-shrink-0 gap-2 pt-0.5'>
					{status === 'available' ? (
						<Button size='sm' onClick={install} disabled={isBusy}>
							Install &amp; restart
						</Button>
					) : (
						<Button size='sm' variant='outline' onClick={check} disabled={isBusy}>
							{status === 'checking' ? 'Checking…' : 'Check for updates'}
						</Button>
					)}
				</div>
			</div>

			{percent !== null && status === 'downloading' ? (
				<div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
					<div
						className='h-full rounded-full bg-primary transition-[width]'
						style={{ width: `${percent}%` }}
					/>
				</div>
			) : null}

			{status === 'available' && available?.notes ? (
				<div className='max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-2 text-xs leading-relaxed text-muted-foreground'>
					{available.notes}
				</div>
			) : null}
		</div>
	)
}
