import {
	AlertCircle,
	CheckCircle2,
	CircleDot,
	Loader2,
	PauseCircle,
	Square
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ContainerHealth, ContainerState } from '../types'
import { cn } from '@/shared/utils/cn'

type Props = {
	state: ContainerState
	health: ContainerHealth
	size?: 'sm' | 'md'
}

export function StatusBadge({ state, health, size = 'md' }: Props) {
	const { colorClass, label, Icon, iconClassName } = getStatusInfo(state, health)
	const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
	const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

	return (
		<div
			role='status'
			aria-live='polite'
			aria-label={label}
			className='inline-flex items-center gap-1.5'
		>
			<span
				className={cn(
					'inline-flex h-5 w-5 items-center justify-center rounded-full border bg-background',
					colorClass
				)}
			>
				<Icon className={cn(iconSize, iconClassName)} aria-hidden='true' />
			</span>
			<span className={cn(textSize, 'text-muted-foreground capitalize')}>{label}</span>
		</div>
	)
}

function getStatusInfo(
	state: ContainerState,
	health: ContainerHealth
): {
	colorClass: string
	label: string
	Icon: LucideIcon
	iconClassName?: string
} {
	if (state === 'running') {
		switch (health) {
			case 'healthy':
				return {
					colorClass: 'border-emerald-500/30 text-emerald-500',
					label: 'healthy',
					Icon: CheckCircle2
				}
			case 'starting':
				return {
					colorClass: 'border-amber-500/30 text-amber-500',
					label: 'starting',
					Icon: Loader2,
					iconClassName: 'animate-spin'
				}
			case 'unhealthy':
				return {
					colorClass: 'border-destructive/30 text-destructive',
					label: 'unhealthy',
					Icon: AlertCircle
				}
			default:
				return {
					colorClass: 'border-emerald-500/30 text-emerald-500',
					label: 'running',
					Icon: CircleDot
				}
		}
	}

	if (state === 'paused') {
		return {
			colorClass: 'border-amber-500/30 text-amber-500',
			label: 'paused',
			Icon: PauseCircle
		}
	}

	if (state === 'created') {
		return {
			colorClass: 'border-sky-500/30 text-sky-500',
			label: 'created',
			Icon: Square
		}
	}

	return {
		colorClass: 'border-zinc-500/40 text-zinc-400',
		label: state,
		Icon: CircleDot
	}
}
