import { cn } from '@studio/shared/utils/cn'

type Props = {
	variant: 'new' | 'snoozed' | 'error'
	cue?: boolean
	className?: string
}

export function UpdateDot({ variant, cue = false, className }: Props) {
	return (
		<span
			aria-hidden='true'
			className={cn(
				'relative inline-block h-[7px] w-[7px] shrink-0 rounded-full',
				variant === 'new' && 'bg-warning',
				variant === 'error' && 'bg-destructive-foreground',
				variant === 'snoozed' && 'border-[1.5px] border-muted-foreground bg-transparent',
				className
			)}
		>
			{cue && variant !== 'snoozed' ? (
				<span
					className={cn(
						'update-cue-ring absolute inset-0 rounded-full',
						variant === 'error' ? 'bg-destructive-foreground' : 'bg-warning'
					)}
				/>
			) : null}
		</span>
	)
}
