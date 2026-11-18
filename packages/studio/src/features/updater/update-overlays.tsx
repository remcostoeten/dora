import { X } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@studio/shared/ui/button'
import { Spinner } from '@studio/shared/ui/spinner'
import { openSettingsView } from '@studio/core/workspace-store'
import { ReleaseNotes } from './release-notes'
import { useUpdaterStore } from './updater-store'

function RestartOverlay() {
	const status = useUpdaterStore((state) => state.status)
	const version = useUpdaterStore((state) => state.available?.version)
	if (status !== 'installed') return null
	return (
		<div className='fixed inset-0 z-[70] grid place-items-center bg-background/85 animate-in fade-in-0 duration-150'>
			<div
				role='status'
				className='w-[300px] rounded-md border border-border bg-popover p-4 shadow-lg'
			>
				<div className='flex items-center gap-2.5 text-[13px] font-medium'>
					<Spinner className='h-3.5 w-3.5' />
					Restarting Dora
				</div>
				<p className='mt-2 text-[12.5px] leading-snug text-secondary-foreground'>
					Version <span className='font-mono text-[11.5px]'>{version}</span> is installed.
					Your open tabs are restored after the restart.
				</p>
			</div>
		</div>
	)
}

function WhatsNewCard() {
	const whatsNew = useUpdaterStore((state) => state.whatsNew)
	const dismiss = useUpdaterStore((state) => state.dismissWhatsNew)

	useEffect(
		function dismissOnEscape() {
			if (!whatsNew) return
			function handleKeyDown(event: KeyboardEvent) {
				if (event.key === 'Escape') dismiss()
			}
			window.addEventListener('keydown', handleKeyDown)
			return () => window.removeEventListener('keydown', handleKeyDown)
		},
		[whatsNew, dismiss]
	)

	if (!whatsNew) return null

	return (
		<div
			role='group'
			aria-label='What changed in this version'
			className='fixed bottom-4 right-4 z-40 w-[320px] rounded-md border border-border bg-popover p-3.5 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 duration-200'
		>
			<div className='flex items-center text-[11.5px] text-muted-foreground'>
				<span>
					Updated to <span className='font-mono'>{whatsNew.version}</span>
				</span>
				<button
					type='button'
					aria-label='Dismiss'
					onClick={dismiss}
					className='-my-1 -mr-1 ml-auto grid h-6 w-6 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-focus'
				>
					<X className='h-3.5 w-3.5' />
				</button>
			</div>
			<div className='mt-2 text-[15px] font-semibold'>What changed</div>
			<div className='mt-3'>
				<ReleaseNotes notes={whatsNew.notes} />
			</div>
			<div className='mt-3.5 flex items-center gap-1.5'>
				<Button
					size='sm'
					variant='outline'
					onClick={() => {
						dismiss()
						openSettingsView('updates', 'updates')
					}}
				>
					Update settings
				</Button>
				<Button size='sm' variant='ghost' onClick={dismiss}>
					Dismiss
				</Button>
			</div>
		</div>
	)
}

export function UpdateOverlays() {
	return (
		<>
			<RestartOverlay />
			<WhatsNewCard />
		</>
	)
}
