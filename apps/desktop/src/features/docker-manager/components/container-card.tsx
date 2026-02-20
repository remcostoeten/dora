import { formatDistanceToNow } from 'date-fns'
import { Clock, ExternalLink, Play, Square, RotateCcw, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { DockerContainer } from '../types'
import { StatusBadge } from './status-badge'
import { cn } from '@/shared/utils/cn'

type Props = {
	container: DockerContainer
	isSelected: boolean
	onSelect: (id: string) => void
	onStart?: (id: string) => void
	onStop?: (id: string) => void
	onRestart?: (id: string) => void
	isActionPending?: boolean
}

export function ContainerCard({
	container,
	isSelected,
	onSelect,
	onStart,
	onStop,
	onRestart,
	isActionPending = false
}: Props) {
	const primaryPort = container.ports[0]
	const createdTimeAgo = formatDistanceToNow(new Date(container.createdAt), { addSuffix: true })
	const isRunning = container.state === 'running'
	const [copied, setCopied] = useState(false)

	function handleClick() {
		onSelect(container.id)
	}

	function handleKeyDown(event: React.KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			onSelect(container.id)
		}
	}

	function handleQuickAction(e: React.MouseEvent, action: () => void) {
		e.stopPropagation()
		action()
	}

	async function handleCopyPort(e: React.MouseEvent) {
		e.stopPropagation()
		const port = primaryPort?.hostPort ?? 5432
		try {
			await navigator.clipboard.writeText(`localhost:${port}`)
			setCopied(true)
			setTimeout(function () {
				setCopied(false)
			}, 1500)
		} catch {
			// ignore
		}
	}

	return (
		<div
			role='option'
			aria-selected={isSelected}
			aria-label={`${container.name} (${container.state})`}
			tabIndex={0}
			data-container-card='true'
			data-container-id={container.id}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			className={cn(
				'group relative p-3 rounded-lg border transition-all cursor-pointer',
				'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				isSelected
					? 'border-emerald-500/50 bg-emerald-500/5'
					: 'border-border/50 hover:border-border hover:bg-accent/50'
			)}
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

			<div className='mt-2 flex items-center justify-between'>
				<div className='flex items-center gap-1 text-[11px] text-muted-foreground/70'>
					<Clock className='h-3 w-3' />
					<span>{createdTimeAgo}</span>
				</div>

				<div className='flex items-center gap-0.5 translate-x-2 opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100'>
					{isRunning ? (
						<QuickActionButton
							title='Stop'
							disabled={isActionPending}
							onClick={function (e) {
								if (onStop) handleQuickAction(e, function () { onStop(container.id) })
							}}
						>
							<Square className='h-3 w-3' />
						</QuickActionButton>
					) : (
						<QuickActionButton
							title='Start'
							disabled={isActionPending}
							className='text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10'
							onClick={function (e) {
								if (onStart) handleQuickAction(e, function () { onStart(container.id) })
							}}
						>
							<Play className='h-3 w-3' />
						</QuickActionButton>
					)}

					<QuickActionButton
						title='Restart'
						disabled={isActionPending || !isRunning}
						onClick={function (e) {
							if (onRestart) handleQuickAction(e, function () { onRestart(container.id) })
						}}
					>
						<RotateCcw className='h-3 w-3' />
					</QuickActionButton>

					<QuickActionButton
						title='Copy host:port'
						onClick={handleCopyPort}
					>
						{copied ? (
							<Check className='h-3 w-3 text-emerald-500' />
						) : (
							<Copy className='h-3 w-3' />
						)}
					</QuickActionButton>
				</div>
			</div>
		</div>
	)
}

function QuickActionButton({
	children,
	title,
	disabled,
	className,
	onClick
}: {
	children: React.ReactNode
	title: string
	disabled?: boolean
	className?: string
	onClick: (e: React.MouseEvent) => void
}) {
	return (
		<button
			type='button'
			aria-label={title}
			title={title}
			disabled={disabled}
			onClick={onClick}
			className={cn(
				'inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground transition-colors',
				'hover:text-foreground hover:bg-muted',
				'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
				'disabled:opacity-30 disabled:pointer-events-none',
				className
			)}
		>
			{children}
		</button>
	)
}
