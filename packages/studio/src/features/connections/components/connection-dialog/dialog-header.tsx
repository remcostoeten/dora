import { memo } from 'react'
import { Check, Plug } from 'lucide-react'
import { DialogDescription, DialogTitle } from '@studio/shared/ui/dialog'
import { cn } from '@studio/shared/utils/cn'
import { getSource } from './sources'
import { SourceMark } from './source-mark'
import { useDialog, useDialogStore } from './store-context'

const STEPS = [
	{ id: 'source', label: 'Source' },
	{ id: 'details', label: 'Details' }
] as const

export const ConnectionDialogHeader = memo(function ConnectionDialogHeader() {
	const original = useDialog((state) => state.original)

	if (original) {
		return (
			<header className='flex items-center gap-4 border-b border-border/70 py-4 pl-6 pr-14'>
				<div className='flex min-w-0 items-center gap-3'>
					<Plug className='h-[18px] w-[18px] flex-none text-muted-foreground' />
					<div className='min-w-0'>
						<DialogTitle className='text-base font-semibold tracking-tight'>
							Edit connection
						</DialogTitle>
						<DialogDescription className='mt-px truncate text-xs text-muted-foreground'>
							{original.name}
						</DialogDescription>
					</div>
				</div>
				<span className='ml-auto inline-flex h-6 items-center gap-1.5 border border-border/70 pl-0.5 pr-2 text-xs'>
					<SourceMark id={original.type} size='sm' />
					{getSource(original.type).name}
				</span>
			</header>
		)
	}

	return (
		<header className='flex min-h-[68px] items-center gap-4 border-b border-border/70 py-4 pl-6 pr-14'>
			<div className='flex min-w-0 items-center gap-3'>
				<Plug className='h-[18px] w-[18px] flex-none text-muted-foreground' />
				<div className='min-w-0'>
					<DialogTitle className='text-base font-semibold tracking-tight'>
						New connection
					</DialogTitle>
					<DialogDescription className='mt-px text-xs text-muted-foreground'>
						Paste a URL, drop a file, or pick what you connect to.
					</DialogDescription>
				</div>
			</div>
			<Steps />
		</header>
	)
})

const Steps = memo(function Steps() {
	const store = useDialogStore()
	const step = useDialog((state) => state.step)
	const current = STEPS.findIndex((item) => item.id === step)

	return (
		<ol className='ml-auto flex gap-0.5' aria-label='Progress'>
			{STEPS.map((item, index) => {
				const done = index < current
				const body = (
					<>
						<span
							className={cn(
								'grid h-4 w-4 place-items-center border border-border/70 font-mono text-[11px] font-medium',
								index === current &&
									'border-foreground bg-foreground text-background',
								done &&
									'border-emerald-500/45 text-emerald-600 dark:text-emerald-400'
							)}
						>
							{done ? <Check className='h-[11px] w-[11px]' /> : index + 1}
						</span>
						<span className='max-sm:hidden'>{item.label}</span>
					</>
				)
				const base = cn(
					'flex h-7 items-center gap-[7px] px-2.5 text-xs text-muted-foreground',
					index === current && 'bg-accent text-foreground',
					done && 'text-foreground/85'
				)
				return (
					<li key={item.id}>
						{done ? (
							<button
								type='button'
								title='Back to sources (Alt+←)'
								onClick={() => store.getState().back()}
								className={cn(
									base,
									'transition-colors duration-150 hover:bg-focus hover:text-foreground focus-visible:bg-focus-strong'
								)}
							>
								{body}
							</button>
						) : (
							<span
								aria-current={index === current ? 'step' : undefined}
								className={base}
							>
								{body}
							</span>
						)}
					</li>
				)
			})}
		</ol>
	)
})
