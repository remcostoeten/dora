import {
	Activity,
	Clock,
	Cpu,
	HardDrive,
	Network,
	Server,
	Layers,
	RefreshCw
} from 'lucide-react'
import type { DockerContainer } from '../types'
import { useContainerStats } from '../api/queries/use-container-stats'
import { cn } from '@/shared/utils/cn'

type Props = {
	container: DockerContainer
}

function formatUptime(createdAt: number): string {
	const now = Date.now()
	const diffMs = now - createdAt

	if (diffMs < 0) return 'just now'

	const seconds = Math.floor(diffMs / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)
	const days = Math.floor(hours / 24)

	if (days > 0) return `${days}d ${hours % 24}h`
	if (hours > 0) return `${hours}h ${minutes % 60}m`
	if (minutes > 0) return `${minutes}m`
	return `${seconds}s`
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B'
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

type StatPillProps = {
	icon: React.ReactNode
	label: string
	value: string
	valueClassName?: string
	subValue?: string
}

function StatPill({ icon, label, value, valueClassName, subValue }: StatPillProps) {
	return (
		<div className='flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-2.5 py-2'>
			<div className='flex items-center gap-1.5 text-muted-foreground'>
				{icon}
				<span className='text-[10px] font-medium uppercase tracking-wide'>{label}</span>
			</div>
			<span className={cn('text-xs font-mono font-medium truncate', valueClassName)}>
				{value}
			</span>
			{subValue && (
				<span className='text-[10px] text-muted-foreground truncate'>{subValue}</span>
			)}
		</div>
	)
}

type MiniBarProps = {
	percent: number
	colorClass?: string
}

function MiniBar({ percent, colorClass = 'bg-primary' }: MiniBarProps) {
	const clamped = Math.min(100, Math.max(0, percent))
	return (
		<div className='h-1 w-full rounded-full bg-border overflow-hidden mt-0.5'>
			<div
				className={cn('h-full rounded-full transition-all', colorClass)}
				style={{ width: `${clamped}%` }}
			/>
		</div>
	)
}

export function ContainerMetrics({ container }: Props) {
	const isRunning = container.state === 'running'
	const { data: stats, isFetching } = useContainerStats(container.id, {
		enabled: isRunning
	})

	const primaryPort = container.ports.find((p) => p.containerPort === 5432)
	const allPorts = container.ports
		.map((p) => `${p.hostPort}→${p.containerPort}`)
		.join(', ')

	const imageDisplay =
		container.imageTag && container.imageTag !== 'latest'
			? `${container.image.split('/').pop()}:${container.imageTag}`
			: container.image.split('/').pop() || container.image

	const cpuWarn = (stats?.cpuPercent ?? 0) > 80
	const memWarn = (stats?.memoryPercent ?? 0) > 80

	return (
		<div className='space-y-2.5'>
			<div className='flex items-center justify-between'>
				<h4 className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
					Metrics
				</h4>
				{isRunning && isFetching && (
					<RefreshCw className='h-3 w-3 text-muted-foreground/50 animate-spin' />
				)}
			</div>

			<div className='grid grid-cols-2 gap-1.5'>
				<StatPill
					icon={<Clock className='h-3 w-3' />}
					label='Uptime'
					value={isRunning ? formatUptime(container.createdAt) : '—'}
					valueClassName={!isRunning ? 'text-muted-foreground' : undefined}
				/>

				<StatPill
					icon={<Server className='h-3 w-3' />}
					label='State'
					value={container.state}
					valueClassName={
						container.state === 'running'
							? 'text-emerald-500'
							: container.state === 'exited' || container.state === 'dead'
								? 'text-destructive'
								: 'text-yellow-500'
					}
				/>

				{isRunning && stats ? (
					<>
						<div className='flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-2.5 py-2'>
							<div className='flex items-center gap-1.5 text-muted-foreground'>
								<Cpu className='h-3 w-3' />
								<span className='text-[10px] font-medium uppercase tracking-wide'>
									CPU
								</span>
							</div>
							<span
								className={cn(
									'text-xs font-mono font-medium',
									cpuWarn ? 'text-orange-500' : undefined
								)}
							>
								{stats.cpuPercent.toFixed(1)}%
							</span>
							<MiniBar
								percent={stats.cpuPercent}
								colorClass={cpuWarn ? 'bg-orange-500' : 'bg-primary'}
							/>
						</div>

						<div className='flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-2.5 py-2'>
							<div className='flex items-center gap-1.5 text-muted-foreground'>
								<Activity className='h-3 w-3' />
								<span className='text-[10px] font-medium uppercase tracking-wide'>
									Memory
								</span>
							</div>
							<span
								className={cn(
									'text-xs font-mono font-medium',
									memWarn ? 'text-orange-500' : undefined
								)}
							>
								{formatBytes(stats.memoryUsageBytes)}
							</span>
							<MiniBar
								percent={stats.memoryPercent}
								colorClass={memWarn ? 'bg-orange-500' : 'bg-primary'}
							/>
						</div>

						{stats.pids > 0 && (
							<StatPill
								icon={<HardDrive className='h-3 w-3' />}
								label='PIDs'
								value={String(stats.pids)}
							/>
						)}
					</>
				) : isRunning ? (
					<div className='col-span-2 flex items-center justify-center py-3 text-xs text-muted-foreground'>
						Loading stats…
					</div>
				) : null}

				{container.ports.length > 0 && (
					<StatPill
						icon={<Network className='h-3 w-3' />}
						label={primaryPort ? 'Port' : 'Ports'}
						value={
							primaryPort
								? String(primaryPort.hostPort)
								: String(container.ports[0].hostPort)
						}
						subValue={container.ports.length > 1 ? allPorts : undefined}
					/>
				)}

				<StatPill
					icon={<Layers className='h-3 w-3' />}
					label='Image'
					value={imageDisplay ?? container.image}
				/>
			</div>

			{container.volumes.length > 0 && (
				<div className='flex items-start gap-1.5 text-[10px] text-muted-foreground'>
					<HardDrive className='h-3 w-3 mt-0.5 shrink-0' />
					<span className='truncate'>
						{container.volumes[0].isEphemeral ? 'Ephemeral' : 'Persistent'} storage
						{container.volumes.length > 1 ? ` (${container.volumes.length} volumes)` : ''}
					</span>
				</div>
			)}
		</div>
	)
}
