import { Badge } from '@studio/shared/ui/badge'
import { cn } from '@studio/shared/utils/cn'
import {
	dataFileHealthLabel,
	type DataFileHealth,
} from '@studio/features/connections/data-file-health'

type Props = {
	health: DataFileHealth
	className?: string
	compact?: boolean
}

function healthDotClass(health: DataFileHealth): string {
	switch (health) {
		case 'active':
			return 'bg-emerald-500'
		case 'connected-with-issues':
			return 'bg-amber-500'
		case 'unavailable':
			return 'bg-destructive'
	}
}

function healthBadgeClass(health: DataFileHealth): string {
	switch (health) {
		case 'active':
			return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
		case 'connected-with-issues':
			return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
		case 'unavailable':
			return 'border-destructive/30 bg-destructive/10 text-destructive'
	}
}

export function DataFileHealthIndicator({ health, className, compact = false }: Props) {
	const label = dataFileHealthLabel(health)

	return (
		<Badge
			variant='outline'
			role='status'
			aria-label={`Connection health: ${label}`}
			className={cn(
				'gap-1.5 font-normal',
				healthBadgeClass(health),
				compact && 'rounded-sm px-1.5 py-0 text-[10px] leading-4 h-4',
				className
			)}
		>
			<span
				aria-hidden
				className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', healthDotClass(health))}
			/>
			<span>{label}</span>
		</Badge>
	)
}
