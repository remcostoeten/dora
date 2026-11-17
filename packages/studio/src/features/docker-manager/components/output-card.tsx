import { useState } from 'react'
import { useContainerLogs } from '../api/queries/use-container-logs'
import { DEFAULT_LOG_TAIL, LOG_TAIL_OPTIONS } from '../constants'
import type { DockerContainer } from '../types'
import { ContainerTerminal } from './container-terminal'
import { LogsViewer } from './logs-viewer'

export type OutputTab = 'logs' | 'shell'

type Props = {
	container: DockerContainer
	tab: OutputTab
	onTabChange: (tab: OutputTab) => void
}

export function OutputCard({ container, tab, onTabChange }: Props) {
	const [tailLines, setTailLines] = useState<number>(DEFAULT_LOG_TAIL)
	const isRunning = container.state === 'running'
	const { data: logs = '', isLoading } = useContainerLogs(container.id, {
		tail: tailLines,
		enabled: tab === 'logs'
	})
	const lineCount = logs ? logs.split('\n').filter(Boolean).length : 0

	return (
		<section className='dk-card' style={{ gridArea: 'out' }} aria-label='Output'>
			<div className='dk-card-h'>
				<div className='dk-seg' role='tablist' aria-label='Output'>
					<button
						type='button'
						role='tab'
						aria-selected={tab === 'logs'}
						onClick={() => onTabChange('logs')}
					>
						Logs
					</button>
					<button
						type='button'
						role='tab'
						aria-selected={tab === 'shell'}
						onClick={() => onTabChange('shell')}
						disabled={!isRunning}
						title={isRunning ? undefined : 'Start the container to open a shell'}
					>
						Shell
					</button>
				</div>
				{tab === 'logs' && (
					<>
						<span className='dk-meta dk-mono'>
							{lineCount} lines{isRunning ? ' · streaming' : ''}
						</span>
						<div className='dk-card-r'>
							<select
								className='dk-tail dk-mono'
								value={tailLines}
								aria-label='Number of log lines to show'
								onChange={(event) => setTailLines(Number(event.target.value))}
							>
								{LOG_TAIL_OPTIONS.map((option) => (
									<option key={option} value={option}>
										last {option}
									</option>
								))}
							</select>
						</div>
					</>
				)}
			</div>
			<div className='dk-out-b'>
				{tab === 'logs' ? (
					<LogsViewer logs={logs} isLoading={isLoading} />
				) : (
					<ContainerTerminal container={container} enabled={tab === 'shell'} />
				)}
			</div>
		</section>
	)
}
