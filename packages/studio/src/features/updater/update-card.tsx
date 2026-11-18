import { X } from 'lucide-react'
import { openSettingsView } from '@studio/core/workspace-store'
import { Button } from '@studio/shared/ui/button'
import { ReleaseNotes } from './release-notes'
import { UpdateDot } from './update-dot'
import { formatBytes } from './update-policy'
import { useDownloadFraction } from './use-update-indicator'
import { useUpdaterStore } from './updater-store'

type Props = {
	snoozed: boolean
	onClose: () => void
}

function formatDate(iso: string | undefined): string | null {
	if (!iso) return null
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return null
	return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function CardHeader({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
	return (
		<div className='flex items-center gap-2 text-[11.5px] text-muted-foreground'>
			{children}
			<button
				type='button'
				aria-label='Close'
				onClick={onClose}
				className='-my-1 -mr-1 ml-auto grid h-6 w-6 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-focus'
			>
				<X className='h-3.5 w-3.5' />
			</button>
		</div>
	)
}

function openUpdateSettings(onClose: () => void) {
	onClose()
	openSettingsView('updates', 'updates')
}

export function UpdateCard({ snoozed, onClose }: Props) {
	const status = useUpdaterStore((state) => state.status)
	const available = useUpdaterStore((state) => state.available)
	const progress = useUpdaterStore((state) => state.progress)
	const error = useUpdaterStore((state) => state.error)
	const install = useUpdaterStore((state) => state.install)
	const snoozeUpdate = useUpdaterStore((state) => state.snoozeUpdate)
	const fraction = useDownloadFraction()

	if (status === 'downloading' && available) {
		const percent = Math.round(fraction * 100)
		return (
			<div>
				<CardHeader onClose={onClose}>
					<span>Downloading update</span>
				</CardHeader>
				<div className='mt-2 text-[15px] font-semibold'>
					Dora <span className='font-mono text-sm'>{available.version}</span>
				</div>
				<div className='mt-3.5 h-[5px] overflow-hidden rounded-full bg-muted'>
					<div
						className='h-full origin-left rounded-full bg-warning transition-transform duration-200 ease-out'
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
						{progress?.contentLength ? `${percent}%` : ''}
					</span>
				</div>
				<p className='mt-2.5 border-t border-border pt-2.5 text-[11.5px] leading-snug text-muted-foreground'>
					You can keep working. Dora restarts when the download finishes.
				</p>
			</div>
		)
	}

	if (status === 'error' && available) {
		return (
			<div>
				<CardHeader onClose={onClose}>
					<UpdateDot variant='error' />
					<span>Update not installed</span>
				</CardHeader>
				<div className='mt-2 text-[15px] font-semibold'>Download failed</div>
				<p className='mt-2 text-[12.5px] leading-snug text-secondary-foreground'>
					Nothing was installed and{' '}
					<span className='font-mono text-[11.5px]'>{available.currentVersion}</span>{' '}
					keeps running.
				</p>
				{error ? (
					<div className='mt-2.5 break-words rounded-md bg-muted/45 px-2 py-1.5 font-mono text-[11px] text-secondary-foreground'>
						{error}
					</div>
				) : null}
				<div className='mt-3.5 flex items-center gap-1.5'>
					<Button size='sm' onClick={() => void install()}>
						Retry download
					</Button>
					<Button
						size='sm'
						variant='outline'
						onClick={() => {
							snoozeUpdate()
							onClose()
						}}
					>
						Later
					</Button>
				</div>
			</div>
		)
	}

	if (!available) return null

	const released = formatDate(available.date)

	return (
		<div>
			<CardHeader onClose={onClose}>
				<UpdateDot variant={snoozed ? 'snoozed' : 'new'} />
				<span>{snoozed ? 'Update available, reminder paused' : 'Update available'}</span>
			</CardHeader>
			<div className='mt-2 text-[15px] font-semibold'>
				Dora <span className='font-mono text-sm'>{available.version}</span>
			</div>
			<div className='mt-0.5 text-[11.5px] text-muted-foreground'>
				You have{' '}
				<span className='font-mono text-[11px] text-secondary-foreground'>
					{available.currentVersion}
				</span>
				{released ? ` · Released ${released}` : null}
			</div>
			<div className='mt-3'>
				<ReleaseNotes notes={available.notes} />
			</div>
			<div className='mt-3.5 flex items-center gap-1.5'>
				<Button size='sm' onClick={() => void install()} autoFocus>
					Install &amp; restart
				</Button>
				<Button
					size='sm'
					variant='outline'
					onClick={() => {
						if (!snoozed) snoozeUpdate()
						onClose()
					}}
				>
					{snoozed ? 'Not now' : 'Later'}
				</Button>
				<Button
					size='sm'
					variant='ghost'
					className='ml-auto text-muted-foreground'
					onClick={() => openUpdateSettings(onClose)}
				>
					Update settings
				</Button>
			</div>
			<p className='mt-2.5 border-t border-border pt-2.5 text-[11.5px] leading-snug text-muted-foreground'>
				{snoozed
					? 'You chose Later. Dora reminds you again tomorrow.'
					: 'Dora restarts when the download finishes. Open tabs are restored.'}
			</p>
		</div>
	)
}
