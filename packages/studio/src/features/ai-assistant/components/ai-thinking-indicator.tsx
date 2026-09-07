import { cn } from '@studio/shared/utils/cn'

const DOT_DELAYS = ['0ms', '160ms', '320ms'] as const

type Props = {
	label?: string
	className?: string
	compact?: boolean
}

export function AiThinkingIndicator({ label = 'Thinking…', className, compact = false }: Props) {
	return (
		<div
			className={cn('flex items-center gap-2 py-1', className)}
			role='status'
			aria-live='polite'
			aria-label={label}
		>
			<div className='flex items-center gap-1' aria-hidden='true'>
				{DOT_DELAYS.map(function (delay) {
					return (
						<span
							key={delay}
							className={cn(
								'h-1.5 w-1.5 animate-pulse rounded-full bg-primary/70',
								compact && 'h-1 w-1'
							)}
							style={{ animationDelay: delay }}
						/>
					)
				})}
			</div>
			<p className={cn('text-[11px] text-muted-foreground', compact && 'text-[10px]')}>
				{label}
			</p>
		</div>
	)
}
