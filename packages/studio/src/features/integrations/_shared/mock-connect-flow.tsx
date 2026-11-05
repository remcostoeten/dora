import { useState } from 'react'
import { Check, PlugZap, Sparkles } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { Button } from '@studio/shared/ui/button'
import { Label } from '@studio/shared/ui/label'
import { cn } from '@studio/shared/utils/cn'
import type { Connection } from '../../connections/types'
import type { MockProviderConfig, MockProviderProject } from './mock-provider-data'

type Props = {
	config: MockProviderConfig
	onComplete: (connection: Omit<Connection, 'id' | 'createdAt'>) => void
}

const ACCENT_DOT: Record<MockProviderConfig['accent'], string> = {
	emerald: 'bg-emerald-500',
	sky: 'bg-sky-500',
	violet: 'bg-violet-500',
	amber: 'bg-amber-500',
	pink: 'bg-pink-500',
	orange: 'bg-orange-500'
}

const ACCENT_SELECTED: Record<MockProviderConfig['accent'], string> = {
	emerald: 'border-emerald-500/45 bg-emerald-500/10',
	sky: 'border-sky-500/45 bg-sky-500/10',
	violet: 'border-violet-500/45 bg-violet-500/10',
	amber: 'border-amber-500/45 bg-amber-500/10',
	pink: 'border-pink-500/45 bg-pink-500/10',
	orange: 'border-orange-500/45 bg-orange-500/10'
}

export function MockProviderConnectFlow({ config, onComplete }: Props) {
	const [isConnecting, setIsConnecting] = useState(false)
	const [isConnected, setIsConnected] = useState(false)
	const [selected, setSelected] = useState<MockProviderProject | null>(null)

	function handleConnect() {
		setIsConnecting(true)
		window.setTimeout(() => {
			setIsConnecting(false)
			setIsConnected(true)
		}, 650)
	}

	function handleCreate() {
		if (!selected) return
		onComplete(config.buildConnection(selected))
	}

	return (
		<div className='space-y-4 border border-border/60 bg-card/35 p-4 shadow-sm'>
			<div className='flex items-start justify-between gap-3'>
				<div>
					<Label className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
						{config.label}
					</Label>
					<p className='mt-1 text-xs text-muted-foreground/75'>{config.blurb}</p>
				</div>
				<span className='inline-flex shrink-0 items-center gap-1.5 border border-border/60 bg-background/45 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground'>
					<Sparkles className='h-3 w-3' />
					Demo
				</span>
			</div>

			{!isConnected ? (
				<Button
					type='button'
					onClick={handleConnect}
					disabled={isConnecting}
					className='w-full gap-2'
				>
					{isConnecting ? (
						<Spinner className='h-3.5 w-3.5' />
					) : (
						<PlugZap className='h-3.5 w-3.5' />
					)}
					{isConnecting ? 'Connecting…' : config.connectLabel}
				</Button>
			) : (
				<div className='space-y-4'>
					<p className='flex items-center gap-1.5 text-xs text-muted-foreground/75'>
						<Check className='h-3.5 w-3.5 shrink-0 text-emerald-500' />
						Connected — pick a {config.itemNoun} to preview.
					</p>

					<div className='max-h-44 space-y-2 overflow-y-auto pr-1'>
						{config.projects.map((project) => {
							const isSelected = selected === project
							return (
								<button
									key={`${project.id}:${project.name}`}
									type='button'
									onClick={() => setSelected(project)}
									className={cn(
										'flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors',
										isSelected
											? ACCENT_SELECTED[config.accent]
											: 'border-border/60 bg-background/45 hover:border-border hover:bg-card/65'
									)}
								>
									<span
										className={cn(
											'h-2 w-2 shrink-0 rounded-full',
											ACCENT_DOT[config.accent]
										)}
									/>
									<span className='min-w-0 flex-1'>
										<span className='block truncate text-sm font-medium text-foreground'>
											{project.name}
										</span>
										<span className='block truncate text-xs text-muted-foreground'>
											{project.region}
											{project.detail ? ` · ${project.detail}` : ''}
										</span>
									</span>
									{isSelected ? (
										<Check className='h-4 w-4 text-emerald-500' />
									) : null}
								</button>
							)
						})}
					</div>

					<Button
						type='button'
						onClick={handleCreate}
						disabled={!selected}
						className='self-start gap-2'
					>
						<PlugZap className='h-3.5 w-3.5' />
						Preview {config.label} {config.itemNoun}
					</Button>
				</div>
			)}
		</div>
	)
}
