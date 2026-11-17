import { useActiveNavId } from '@studio/core/workspace-store'
import { useEffect, useState } from 'react'
import type { DockerContainer } from '../types'
import { useContainerStats } from '../api/queries/use-container-stats'
import type { ContainerStats } from '../api/queries/use-container-stats'
import { formatBytes } from '../utilities/container-status'

type Props = {
	container: DockerContainer
}

type History = {
	containerId: string
	samples: ContainerStats[]
}

const MAX_SAMPLES = 48
const WIDTH = 240
const HEIGHT = 40

function buildSparkPaths(values: number[], max: number) {
	if (values.length < 2 || max <= 0) return { line: '', area: '' }
	const step = WIDTH / (MAX_SAMPLES - 1)
	const offset = (MAX_SAMPLES - values.length) * step
	const points = values.map((value, index) => {
		const ratio = Math.min(1, Math.max(0, value / max))
		return [offset + index * step, HEIGHT - 3 - ratio * (HEIGHT - 8)]
	})
	const line = 'M' + points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')
	return { line, area: `${line} L${WIDTH} ${HEIGHT} L${offset.toFixed(1)} ${HEIGHT} Z` }
}

function Sparkline({ values, max }: { values: number[]; max: number }) {
	const { line, area } = buildSparkPaths(values, max)
	return (
		<svg
			className='dk-spark'
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			preserveAspectRatio='none'
			aria-hidden='true'
		>
			<line className='dk-spark-base' x1='0' y1={HEIGHT - 3} x2={WIDTH} y2={HEIGHT - 3} />
			<path className='dk-spark-ar' d={area} />
			<path className='dk-spark-ln' d={line} />
		</svg>
	)
}

export function ResourcesCard({ container }: Props) {
	const isRunning = container.state === 'running'
	const isViewActive = useActiveNavId() === 'docker'
	const { data: stats, isFetching } = useContainerStats(container.id, {
		enabled: isRunning && isViewActive
	})
	const [history, setHistory] = useState<History>({ containerId: container.id, samples: [] })

	useEffect(
		function recordSample() {
			if (!stats) return
			setHistory((previous) => {
				const samples = previous.containerId === container.id ? previous.samples : []
				return {
					containerId: container.id,
					samples: [...samples, stats].slice(-MAX_SAMPLES)
				}
			})
		},
		[stats, container.id]
	)

	const samples = history.containerId === container.id ? history.samples : []
	const live = isRunning && stats ? stats : null
	const cpuValues = samples.map((sample) => sample.cpuPercent)
	const memValues = samples.map((sample) => sample.memoryUsageBytes)
	const cpuMax = Math.max(10, ...cpuValues) * 1.15
	const memLimit = live?.memoryLimitBytes ?? 0
	const memMax = memLimit > 0 ? memLimit : Math.max(1, ...memValues) * 1.4

	let meta = 'not running'
	if (isRunning) meta = live ? 'live' : isFetching ? 'connecting' : 'no live stats'

	return (
		<section className='dk-card' style={{ gridArea: 'res' }} aria-label='Resources'>
			<div className='dk-card-h'>
				<span className='dk-eyebrow'>Resources</span>
				<span className='dk-card-r'>
					<span className='dk-meta dk-mono'>{meta}</span>
				</span>
			</div>
			<div className='dk-card-b dk-met'>
				<div>
					<div className='dk-met-h'>
						<span className='dk-eyebrow'>CPU</span>
						<span className='dk-met-v dk-mono'>
							{live ? `${live.cpuPercent.toFixed(1)}%` : '—'}
						</span>
					</div>
					<Sparkline values={live ? cpuValues : []} max={cpuMax} />
				</div>
				<div>
					<div className='dk-met-h'>
						<span className='dk-eyebrow'>Memory</span>
						<span className='dk-met-l dk-mono'>
							{live && memLimit > 0 ? `of ${formatBytes(memLimit)}` : ''}
						</span>
						<span className='dk-met-v dk-mono'>
							{live ? formatBytes(live.memoryUsageBytes) : '—'}
						</span>
					</div>
					<Sparkline values={live ? memValues : []} max={memMax} />
				</div>
				<div className='dk-mini'>
					<div>
						<div className='dk-k'>PIDs</div>
						<div className='dk-v dk-mono'>{live ? live.pids : '—'}</div>
					</div>
					<div>
						<div className='dk-k'>Mem use</div>
						<div className='dk-v dk-mono'>
							{live ? `${live.memoryPercent.toFixed(1)}%` : '—'}
						</div>
					</div>
					<div>
						<div className='dk-k'>CPU peak</div>
						<div className='dk-v dk-mono'>
							{live ? `${Math.max(live.cpuPercent, ...cpuValues).toFixed(1)}%` : '—'}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
