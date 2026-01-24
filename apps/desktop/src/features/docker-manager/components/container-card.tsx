import { formatDistanceToNow } from 'date-fns'
import { Clock, ExternalLink } from 'lucide-react'
import type { DockerContainer } from '../types'
import { StatusBadge } from './status-badge'

type Props = {
	container: DockerContainer
	isSelected: boolean
	onSelect: (id: string) => void
}

export function ContainerCard({ container, isSelected, onSelect }: Props) {
	const primaryPort = container.ports[0]
	const createdTimeAgo = formatDistanceToNow(new Date(container.createdAt), { addSuffix: true })

	function handleClick() {
		onSelect(container.id)
	}

	function handleKeyDown(event: React.KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			onSelect(container.id)
		}
	}

	return (
		<div
			role='button'
			aria-pressed={isSelected}
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			className={`
        group relative p-3 rounded-lg border transition-all cursor-pointer
        ${
			isSelected
				? 'border-emerald-500/50 bg-emerald-500/5'
				: 'border-border/50 hover:border-border hover:bg-accent/50'
		}
      `}
		>
			<div className='flex items-start justify-between gap-2'>
				<div className='flex-1 min-w-0'>
					<div className='flex items-center gap-2'>
						<h3 className='font-medium text-sm truncate'>{container.name}</h3>
						{container.origin === 'external' && (
							<span className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'>
								<ExternalLink className='h-2.5 w-2.5' />
								external
							</span>
						)}
					</div>

					<div className='mt-1 flex items-center gap-2 text-xs text-muted-foreground'>
						<span>
							{container.image}:{container.imageTag}
						</span>
						{primaryPort && (
							<>
								<span>•</span>
								<span>:{primaryPort.hostPort}</span>
							</>
						)}
					</div>
				</div>

				<StatusBadge state={container.state} health={container.health} size='sm' />
			</div>

			<div className='mt-2 flex items-center gap-1 text-[11px] text-muted-foreground/70'>
				<Clock className='h-3 w-3' />
				<span>{createdTimeAgo}</span>
			</div>
		</div>
	)
}
