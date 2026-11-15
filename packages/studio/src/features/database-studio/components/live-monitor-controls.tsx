import { memo } from 'react'
import {
	clearLiveMonitorEvents,
	markLiveMonitorRead,
	setLiveMonitorConfig,
	useLiveMonitorSelector
} from '@studio/core/live-monitor'
import { cn } from '@studio/shared/utils/cn'
import { ChangeFeed } from './change-feed'
import { LiveMonitorPopover } from './live-monitor-popover'

export const LiveMonitorControl = memo(function LiveMonitorControl() {
	const config = useLiveMonitorSelector((state) => state.config)
	return <LiveMonitorPopover config={config} onConfigChange={setLiveMonitorConfig} />
})

export const LiveChangeFeed = memo(function LiveChangeFeed() {
	const events = useLiveMonitorSelector((state) => state.recentEvents)
	const unreadCount = useLiveMonitorSelector((state) => state.unreadCount)
	return (
		<ChangeFeed
			events={events}
			unreadCount={unreadCount}
			onClear={clearLiveMonitorEvents}
			onMarkRead={markLiveMonitorRead}
		/>
	)
})

export const LiveMonitorStatus = memo(function LiveMonitorStatus() {
	const config = useLiveMonitorSelector((state) => state.config)
	const monitorError = useLiveMonitorSelector((state) => state.monitorError)
	const unreadCount = useLiveMonitorSelector((state) => state.unreadCount)
	const lastPolledAt = useLiveMonitorSelector((state) => state.recentEvents[0]?.timestamp ?? null)

	return (
		<>
			<div className='h-3 w-px bg-sidebar-border' />
			<div className='flex items-center gap-1.5'>
				<span
					className={cn(
						'h-1.5 w-1.5 rounded-full',
						config.enabled
							? unreadCount > 0
								? 'bg-amber-400'
								: 'bg-emerald-400'
							: 'bg-muted-foreground/40'
					)}
				/>
				{config.enabled ? (
					monitorError ? (
						<span className='text-red-400' title={monitorError}>
							Live error
						</span>
					) : (
						<span>
							Live · {(config.intervalMs || 5000) / 1000}s
							{lastPolledAt && (
								<span className='ml-1 opacity-60'>
									· {new Date(lastPolledAt).toLocaleTimeString()}
								</span>
							)}
						</span>
					)
				) : (
					<span>Monitor off</span>
				)}
			</div>
		</>
	)
})
