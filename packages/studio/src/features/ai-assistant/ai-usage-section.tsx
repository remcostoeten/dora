import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { buildMockAiUsageSummary } from '@studio/features/ai-assistant/mock-ai'
import { commands, type AiUsageSummary } from '@studio/lib/bindings'
import { cn } from '@studio/shared/utils/cn'

const SOURCE_LABELS: Record<string, string> = {
	chat: 'Assistant',
	sql_gen: '⌘K SQL',
	key_test: 'Key test',
	complete: 'Completion'
}

function formatTokens(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
	if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
	return String(value)
}

function formatCost(value: number): string {
	if (value <= 0) return '$0.00'
	if (value < 0.01) return '< $0.01'
	return `$${value.toFixed(2)}`
}

function formatProvider(provider: string): string {
	switch (provider) {
		case 'openai':
			return 'OpenAI'
		case 'anthropic':
			return 'Anthropic'
		case 'groq':
			return 'Groq'
		case 'gemini':
			return 'Gemini'
		case 'ollama':
			return 'Ollama'
		default:
			return provider
	}
}

function formatTimestamp(unixSeconds: number): string {
	return new Date(unixSeconds * 1000).toLocaleString()
}

export function AiUsageSection() {
	const isTauri = useIsTauri()
	const [summary, setSummary] = useState<AiUsageSummary | null>(null)
	const [loading, setLoading] = useState(true)

	const load = useCallback(async function load() {
		setLoading(true)
		try {
			if (!isTauri) {
				setSummary(buildMockAiUsageSummary())
				return
			}

			const result = await commands.aiGetUsageSummary(25)
			if (result.status === 'ok') {
				setSummary(result.data)
			}
		} finally {
			setLoading(false)
		}
	}, [isTauri])

	useEffect(
		function loadOnMount() {
			void load()
		},
		[load]
	)

	if (loading) {
		return (
			<div className='flex items-center gap-2 text-xs text-muted-foreground'>
				<Loader2 className='h-3 w-3 animate-spin' />
				Loading usage…
			</div>
		)
	}

	if (!summary || (summary.total_requests === 0 && isTauri)) {
		return (
			<div className='space-y-2 text-xs text-muted-foreground'>
				<p>No AI usage recorded yet. Chat, ⌘K SQL, and key tests will appear here.</p>
			</div>
		)
	}

	if (!summary) {
		return null
	}

	return (
		<div className='space-y-3'>
			<p className='text-xs leading-tight text-muted-foreground'>
				Estimated costs use published list prices where available. Streaming requests estimate
				tokens from prompt and response size when providers do not return usage metadata.
			</p>

			<div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
				<UsageStat label='Requests' value={String(summary.total_requests)} />
				<UsageStat label='Total tokens' value={formatTokens(summary.total_tokens)} />
				<UsageStat
					label='Input / output'
					value={`${formatTokens(summary.input_tokens)} / ${formatTokens(summary.output_tokens)}`}
				/>
				<UsageStat label='Est. cost' value={formatCost(summary.estimated_cost_usd)} />
			</div>

			{summary.providers.length > 0 ? (
				<div className='overflow-hidden rounded-sm border border-sidebar-border'>
					<div className='grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-sidebar-border bg-sidebar-accent/20 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground'>
						<span>Provider</span>
						<span className='text-right'>Requests</span>
						<span className='text-right'>Tokens</span>
						<span className='text-right'>Est. cost</span>
					</div>
					{summary.providers.map(function (entry) {
						return (
							<div
								key={entry.provider}
								className='grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-sidebar-border px-2 py-1.5 text-xs last:border-b-0'
							>
								<span className='font-medium'>{formatProvider(entry.provider)}</span>
								<span className='text-right tabular-nums text-muted-foreground'>
									{entry.request_count}
								</span>
								<span className='text-right tabular-nums text-muted-foreground'>
									{formatTokens(entry.total_tokens)}
								</span>
								<span className='text-right tabular-nums'>{formatCost(entry.estimated_cost_usd)}</span>
							</div>
						)
					})}
				</div>
			) : null}

			{summary.recent.length > 0 ? (
				<div className='space-y-1'>
					<div className='text-[10px] uppercase tracking-wide text-muted-foreground'>
						Recent activity
					</div>
					<div className='overflow-hidden rounded-sm border border-sidebar-border'>
						{summary.recent.map(function (entry) {
							const sourceLabel = SOURCE_LABELS[entry.source] ?? entry.source
							return (
								<div
									key={entry.id}
									className='border-b border-sidebar-border px-2 py-1.5 text-xs last:border-b-0'
								>
									<div className='flex items-center justify-between gap-2'>
										<div className='min-w-0 truncate font-medium'>
											{formatProvider(entry.provider)} · {entry.model}
										</div>
										<div className='shrink-0 tabular-nums text-muted-foreground'>
											{entry.estimated_cost_usd != null
												? formatCost(entry.estimated_cost_usd)
												: '—'}
										</div>
									</div>
									<div className='mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground'>
										<span>{sourceLabel}</span>
										<span>·</span>
										<span>
											{entry.total_tokens != null
												? `${formatTokens(entry.total_tokens)} tokens`
												: 'unknown tokens'}
											{entry.estimated ? ' (est.)' : ''}
										</span>
										<span>·</span>
										<span>{formatTimestamp(entry.created_at)}</span>
									</div>
								</div>
							)
						})}
					</div>
				</div>
			) : null}
		</div>
	)
}

function UsageStat({ label, value }: { label: string; value: string }) {
	return (
		<div className='rounded-sm border border-sidebar-border bg-background px-2 py-1.5'>
			<div className='text-[10px] uppercase tracking-wide text-muted-foreground'>{label}</div>
			<div className={cn('mt-0.5 text-sm font-medium tabular-nums')}>{value}</div>
		</div>
	)
}
