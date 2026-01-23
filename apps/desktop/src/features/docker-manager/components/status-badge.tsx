import type { ContainerHealth, ContainerState } from "../types";

type Props = {
	state: ContainerState
	health: ContainerHealth
	size?: 'sm' | 'md'
}

export function StatusBadge({ state, health, size = 'md' }: Props) {
	const { color, label } = getStatusInfo(state, health)
	const dotSize = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
	const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

	return (
		<div className='flex items-center gap-1.5'>
			<span className={`${dotSize} rounded-full ${color}`} />
			<span className={`${textSize} text-muted-foreground capitalize`}>{label}</span>
		</div>
	)
}

function getStatusInfo(
	state: ContainerState,
	health: ContainerHealth
): { color: string; label: string } {
	if (state === 'running') {
		switch (health) {
			case 'healthy':
				return { color: 'bg-emerald-500', label: 'healthy' }
			case 'starting':
				return { color: 'bg-yellow-500 animate-pulse', label: 'starting' }
			case 'unhealthy':
				return { color: 'bg-red-500', label: 'unhealthy' }
			default:
				return { color: 'bg-emerald-500', label: 'running' }
		}
	}

	if (state === 'paused') {
		return { color: 'bg-yellow-500', label: 'paused' }
	}

	if (state === 'created') {
		return { color: 'bg-blue-500', label: 'created' }
	}

	return { color: 'bg-zinc-500', label: state }
}
