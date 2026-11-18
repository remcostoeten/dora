import { useEffect, useState, type ReactNode } from 'react'
import { commands, type PerfReport, type PerfSample, type PerfSummary } from '@studio/lib/bindings'
import {
	SettingCard,
	SettingGroup,
	SettingRow
} from '@studio/features/settings/components/setting-primitives'
import '@studio/features/settings/settings.css'

const METRICS = [
	{
		id: 'connection_open',
		label: 'Connection open',
		help: 'Opening a connection until it is ready to use'
	},
	{
		id: 'schema_introspection',
		label: 'Schema introspection',
		help: 'Reading tables and columns from the server. Cached schemas are not recorded.'
	},
	{
		id: 'query_first_rows',
		label: 'First rows',
		help: 'Starting a query until the first page of rows is available'
	},
	{
		id: 'query_total',
		label: 'Query total',
		help: 'Starting a query until the statement has finished'
	},
	{
		id: 'query_cancel',
		label: 'Query cancel',
		help: 'A cancel request until the statement is marked cancelled'
	}
] as const

const RECENT_LIMIT = 8

function labelOf(metric: string) {
	return METRICS.find((entry) => entry.id === metric)?.label ?? metric
}

function formatMs(value: number) {
	return value.toFixed(2)
}

function formatMemory(bytes: number | null) {
	return bytes === null ? 'Unavailable' : (bytes / 1048576).toFixed(1) + ' MiB'
}

function formatAge(timestampMs: number) {
	const seconds = Math.max(0, Math.round((Date.now() - timestampMs) / 1000))
	if (seconds < 60) return seconds + 's ago'
	const minutes = Math.round(seconds / 60)
	return minutes < 60 ? minutes + 'm ago' : Math.round(minutes / 60) + 'h ago'
}

function describeSample(sample: PerfSample) {
	const parts = [sample.engine, sample.connection_id?.slice(0, 8), formatAge(sample.timestamp_ms)]
	return parts.filter(Boolean).join(' · ')
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className='min-w-[52px]'>
			<div className='settings-eyebrow mb-1'>{label}</div>
			<div className='font-mono text-[12px] tabular-nums text-foreground'>{value}</div>
		</div>
	)
}

function SummaryStats({ summary }: { summary: PerfSummary }) {
	return (
		<div className='flex items-end gap-5 text-right'>
			<Stat label='Count' value={String(summary.count)} />
			<Stat label='p50' value={formatMs(summary.p50)} />
			<Stat label='p95' value={formatMs(summary.p95)} />
			<Stat label='Max' value={formatMs(summary.max)} />
		</div>
	)
}

type Props = {
	windowControls?: ReactNode
}

export function PerformanceView({ windowControls }: Props) {
	const [report, setReport] = useState<PerfReport | null>(null)
	const [message, setMessage] = useState('')
	const [busy, setBusy] = useState(true)

	useEffect(() => {
		let active = true
		commands
			.getPerfReport()
			.then((value) => {
				if (active) setReport(value)
			})
			.catch((error) => {
				if (active) setMessage(String(error))
			})
			.finally(() => {
				if (active) setBusy(false)
			})
		return () => {
			active = false
		}
	}, [])

	async function refresh(clear: boolean) {
		setBusy(true)
		setMessage('')
		try {
			if (clear) await commands.clearPerfSamples()
			setReport(await commands.getPerfReport())
		} catch (error) {
			setMessage(String(error))
		} finally {
			setBusy(false)
		}
	}

	async function copyReport() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(report, null, 2))
			setMessage('Copied report.')
		} catch (error) {
			setMessage(String(error))
		}
	}

	const recent = report ? report.samples.slice(-RECENT_LIMIT).reverse() : []
	const hasSamples = report !== null && report.samples.length > 0
	const summaries = report?.summary ?? {}

	return (
		<div className='settings-view flex h-full min-h-0 flex-col overflow-hidden bg-background'>
			<header className='settings-topbar' data-tauri-drag-region='true'>
				<span className='text-xs font-medium text-foreground'>Performance</span>
				{windowControls ? (
					<div className='ml-auto shrink-0' data-tauri-drag-region='false'>
						{windowControls}
					</div>
				) : null}
			</header>
			<div className='settings-body @container min-h-0 flex-1 overflow-y-auto'>
				<div className='w-full max-w-[860px] px-8 pb-28 pt-5'>
					<h2 className='text-[15px] font-semibold tracking-tight text-foreground'>
						Performance
					</h2>
					<p className='mt-0.5 text-xs text-muted-foreground'>
						Timings recorded by the backend and the memory Dora uses.
					</p>
					<SettingGroup label='Memory'>
						<SettingCard>
							<SettingRow
								focusId='performance-memory'
								label='Process tree memory'
								help='Dora together with its webview and helper processes'
							>
								<span className='font-mono text-[12px] tabular-nums text-foreground'>
									{report ? formatMemory(report.process_rss_bytes) : '...'}
								</span>
							</SettingRow>
						</SettingCard>
					</SettingGroup>

					<SettingGroup
						label='Timings'
						help='Milliseconds, over the latest 500 samples'
						action={
							<div className='flex gap-2'>
								<button
									type='button'
									className='settings-button'
									disabled={busy}
									onClick={() => refresh(false)}
								>
									Refresh
								</button>
								<button
									type='button'
									className='settings-button'
									disabled={busy || !hasSamples}
									onClick={() => refresh(true)}
								>
									Clear
								</button>
								<button
									type='button'
									className='settings-button'
									disabled={busy || !report}
									onClick={copyReport}
								>
									Copy JSON
								</button>
							</div>
						}
					>
						<SettingCard>
							{hasSamples ? (
								METRICS.map((metric) => {
									const summary = summaries[metric.id]
									return (
										<SettingRow
											key={metric.id}
											focusId={'performance-' + metric.id}
											label={metric.label}
											help={metric.help}
										>
											{summary ? (
												<SummaryStats summary={summary} />
											) : (
												<span className='text-[11.5px] text-muted-foreground'>
													No samples
												</span>
											)}
										</SettingRow>
									)
								})
							) : (
								<SettingRow
									focusId='performance-empty'
									label='No samples recorded'
									help='Open a connection and run a query, then refresh.'
								/>
							)}
						</SettingCard>
					</SettingGroup>

					{recent.length > 0 ? (
						<SettingGroup label='Recent samples'>
							<SettingCard>
								{recent.map((sample, index) => (
									<SettingRow
										key={sample.timestamp_ms + '-' + index}
										focusId={'performance-recent-' + index}
										label={labelOf(sample.metric)}
										help={describeSample(sample)}
									>
										<span className='font-mono text-[12px] tabular-nums text-foreground'>
											{formatMs(sample.duration_ms)} ms
										</span>
									</SettingRow>
								))}
							</SettingCard>
						</SettingGroup>
					) : null}

					<p
						role='status'
						className='mt-3 min-h-4 px-0.5 text-[11.5px] text-muted-foreground'
					>
						{message}
					</p>
				</div>
			</div>
		</div>
	)
}
