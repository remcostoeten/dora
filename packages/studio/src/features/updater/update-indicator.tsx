import { AlertCircle, ArrowDownToLine, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@studio/shared/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@studio/shared/ui/tooltip'
import { cn } from '@studio/shared/utils/cn'
import { UpdateCard } from './update-card'
import { UpdateDot } from './update-dot'
import { useDownloadFraction, useUpdateIndicatorMode } from './use-update-indicator'
import { useUpdaterStore } from './updater-store'

const RING_RADIUS = 9.25
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

function ProgressRing({ fraction }: { fraction: number }) {
	return (
		<svg
			viewBox='0 0 24 24'
			className='h-5 w-5'
			fill='none'
			strokeWidth={1.5}
			aria-hidden='true'
		>
			<circle cx='12' cy='12' r={RING_RADIUS} className='stroke-muted' />
			<circle
				cx='12'
				cy='12'
				r={RING_RADIUS}
				className='stroke-warning'
				strokeLinecap='round'
				strokeDasharray={RING_LENGTH}
				strokeDashoffset={RING_LENGTH * (1 - fraction)}
				transform='rotate(-90 12 12)'
			/>
			<path
				d='M12 8v7M9.25 12.5 12 15.25l2.75-2.75'
				stroke='currentColor'
				strokeLinecap='round'
				strokeLinejoin='round'
			/>
		</svg>
	)
}

export function UpdateIndicator() {
	const mode = useUpdateIndicatorMode()
	const version = useUpdaterStore((state) => state.available?.version)
	const fraction = useDownloadFraction()
	const [open, setOpen] = useState(false)

	useEffect(
		function closeWhenRestarting() {
			if (mode === 'installed' || mode === 'hidden') setOpen(false)
		},
		[mode]
	)

	if (mode === 'hidden') return null

	const label = {
		available: `Update available: Dora ${version}`,
		snoozed: `Dora ${version} available, reminder paused`,
		downloading: `Downloading Dora ${version}`,
		installed: 'Update installed, restarting',
		error: 'Update download failed'
	}[mode]

	return (
		<Popover open={open && mode !== 'installed'} onOpenChange={setOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<button
							type='button'
							role='menuitem'
							aria-label={label}
							aria-haspopup='dialog'
							data-update-indicator={mode}
							className={cn(
								'relative flex h-10 w-10 items-center justify-center rounded-md transition-[background-color,color,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.96]',
								'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:bg-focus',
								'aria-expanded:bg-sidebar-primary aria-expanded:text-sidebar-accent-foreground',
								mode === 'snoozed' && 'text-sidebar-foreground-muted'
							)}
						>
							{mode === 'downloading' ? (
								<ProgressRing fraction={fraction} />
							) : mode === 'installed' ? (
								<Check className='h-5 w-5' aria-hidden='true' />
							) : mode === 'error' ? (
								<AlertCircle className='h-5 w-5' aria-hidden='true' />
							) : (
								<ArrowDownToLine className='h-5 w-5' aria-hidden='true' />
							)}
							{mode === 'available' || mode === 'snoozed' || mode === 'error' ? (
								<UpdateDot
									key={mode}
									variant={
										mode === 'available'
											? 'new'
											: mode === 'snoozed'
												? 'snoozed'
												: 'error'
									}
									cue
									className='absolute right-1.5 top-1.5'
								/>
							) : null}
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				{open ? null : <TooltipContent side='right'>{label}</TooltipContent>}
			</Tooltip>
			<PopoverContent
				side='right'
				align='end'
				sideOffset={10}
				className='w-[332px] p-3.5'
				onOpenAutoFocus={(event) => {
					if (mode !== 'available' && mode !== 'snoozed') event.preventDefault()
				}}
			>
				<UpdateCard snoozed={mode === 'snoozed'} onClose={() => setOpen(false)} />
			</PopoverContent>
		</Popover>
	)
}
