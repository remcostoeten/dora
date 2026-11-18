import { AlertCircle, ArrowDownToLine, Check } from 'lucide-react'
import { useEffect, useState } from 'react'

import { isTauriRuntime } from '@studio/core/platform'
import { Button } from '@studio/shared/ui/button'
import { Spinner } from '@studio/shared/ui/spinner'
import { Switch } from '@studio/shared/ui/switch'
import { cn } from '@studio/shared/utils/cn'

import { ReleaseNotes } from './release-notes'
import { UpdateDot } from './update-dot'
import { formatBytes, formatLastChecked } from './update-policy'
import { useDownloadFraction, useUpdateIndicatorMode } from './use-update-indicator'
import { useUpdaterStore } from './updater-store'

function useMinuteClock(): number {
	const [now, setNow] = useState(Date.now)
	useEffect(function tickEveryMinute() {
		const timer = setInterval(() => setNow(Date.now()), 60_000)
		return () => clearInterval(timer)
	}, [])
	return now
}

export function UpdateSection() {
	const store = useUpdaterStore()
	const mode = useUpdateIndicatorMode()
	const fraction = useDownloadFraction()
	const now = useMinuteClock()
	const { status, available, progress, error, errorSource, lastCheckedAt } = store

	if (!isTauriRuntime()) {
		return (
			<div className='text-xs leading-tight text-muted-foreground'>
				Automatic updates are available in the desktop app.
			</div>
		)
	}

	const checkedLine = `Last checked ${formatLastChecked(lastCheckedAt, now)}`
	const isBusy = status === 'checking' || status === 'downloading' || status === 'installed'
	const isError = status === 'error'
	const hasUpdate = status === 'available' && available !== null

	const headline = (() => {
		if (status === 'checking') return 'Checking for updates'
		if (status === 'downloading') return `Downloading version ${available?.version}`
		if (status === 'installed') return `Version ${available?.version} is installed`
		if (isError && errorSource === 'download')
			return `The download of ${available?.version} failed`
		if (isError) return 'Could not check for updates'
		if (hasUpdate) return `Version ${available.version} is available`
		return lastCheckedAt === null ? 'Update status unknown' : 'Dora is up to date'
	})()

	const subline = (() => {
		if (status === 'downloading') return 'Dora restarts when the download finishes.'
		if (status === 'installed') return 'Restarting Dora.'
		if (isError && errorSource === 'download') {
			return 'Nothing was installed. The current version keeps running.'
		}
		if (hasUpdate && mode === 'snoozed')
			return `${checkedLine} · Reminder paused until tomorrow`
		return checkedLine
	})()

	const checkLabel =
		status === 'checking'
			? 'Checking'
			: isError && errorSource === 'check'
				? 'Try again'
				: 'Check for updates'

	return (
		<div className='space-y-4'>
			<div className='flex items-center gap-3'>
				<div
					className={cn(
						'relative grid h-[34px] w-[34px] shrink-0 place-items-center rounded-md bg-secondary text-foreground',
						isError && 'text-destructive-foreground'
					)}
				>
					{isBusy && status !== 'downloading' ? (
						<Spinner className='h-4 w-4' />
					) : isError ? (
						<AlertCircle className='h-[17px] w-[17px]' />
					) : hasUpdate || status === 'downloading' ? (
						<ArrowDownToLine className='h-[17px] w-[17px]' />
					) : (
						<Check className='h-[17px] w-[17px]' />
					)}
					{mode === 'available' || mode === 'snoozed' ? (
						<UpdateDot
							variant={mode === 'available' ? 'new' : 'snoozed'}
							className='absolute -right-0.5 -top-0.5'
						/>
					) : null}
				</div>
				<div className='min-w-0 flex-1'>
					<div className='text-sm font-medium text-foreground'>{headline}</div>
					<div className='mt-0.5 text-xs leading-tight text-muted-foreground'>
						{subline}
					</div>
				</div>
				<Button
					size='sm'
					variant='outline'
					onClick={() => void store.check()}
					disabled={isBusy}
				>
					{checkLabel}
				</Button>
			</div>

			{hasUpdate || status === 'downloading' || (isError && errorSource === 'download') ? (
				<div className='space-y-3 border-t border-border pt-3.5'>
					{available ? (
						<div className='flex items-baseline gap-2.5'>
							<span className='font-mono text-[13px] font-semibold'>
								{available.version}
							</span>
							<span className='text-[11.5px] text-muted-foreground'>
								{available.date
									? `Released ${new Date(available.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
									: null}
								{progress?.contentLength
									? ` · ${formatBytes(progress.contentLength)}`
									: ''}
							</span>
						</div>
					) : null}

					{hasUpdate ? <ReleaseNotes notes={available.notes} /> : null}

					{status === 'downloading' || (isError && errorSource === 'download') ? (
						<div>
							<div className='h-[5px] overflow-hidden rounded-full bg-muted'>
								<div
									className={cn(
										'h-full origin-left rounded-full transition-transform duration-200 ease-out',
										isError ? 'bg-destructive-foreground' : 'bg-warning'
									)}
									style={{ transform: `scaleX(${fraction})` }}
								/>
							</div>
							<div className='mt-1.5 flex justify-between font-mono text-[11px] text-muted-foreground'>
								<span>
									{progress?.contentLength
										? `${formatBytes(progress.downloaded)} of ${formatBytes(progress.contentLength)}`
										: formatBytes(progress?.downloaded ?? 0)}
								</span>
								<span className='text-foreground'>
									{progress?.contentLength
										? `${Math.round(fraction * 100)}%`
										: ''}
								</span>
							</div>
						</div>
					) : null}

					{isError && error ? (
						<div className='break-words rounded-md bg-muted/45 px-2 py-1.5 font-mono text-[11px] text-secondary-foreground'>
							{error}
						</div>
					) : null}

					<div className='flex flex-wrap items-center gap-1.5'>
						{hasUpdate || (isError && errorSource === 'download') ? (
							<Button size='sm' onClick={() => void store.install()}>
								{isError ? 'Retry download' : 'Install & restart'}
							</Button>
						) : null}
						{hasUpdate && mode === 'available' ? (
							<Button size='sm' variant='outline' onClick={store.snoozeUpdate}>
								Later
							</Button>
						) : null}
						{hasUpdate && mode === 'snoozed' ? (
							<>
								<Button size='sm' variant='outline' onClick={store.clearSnooze}>
									Stop snoozing
								</Button>
								<span className='text-[11.5px] text-muted-foreground'>
									The indicator stays, without the dot.
								</span>
							</>
						) : null}
					</div>
				</div>
			) : null}

			{isError && errorSource === 'check' && error ? (
				<div className='break-words rounded-md bg-muted/45 px-2 py-1.5 font-mono text-[11px] text-secondary-foreground'>
					{error}
				</div>
			) : null}

			<div className='flex items-center gap-4 border-t border-border pt-3.5'>
				<div className='min-w-0 flex-1'>
					<div className='text-[13px] text-foreground'>Check automatically</div>
					<div className='mt-px text-xs leading-snug text-muted-foreground'>
						{store.autoCheck
							? 'At launch and every 6 hours while Dora is open.'
							: 'Automatic checks are off. Dora only checks when you ask.'}
					</div>
				</div>
				<Switch
					checked={store.autoCheck}
					onCheckedChange={store.setAutoCheck}
					aria-label='Check for updates automatically'
				/>
			</div>
		</div>
	)
}
