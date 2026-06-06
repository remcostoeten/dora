import { Loader2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { commands, type AiModelOption, type AiServiceConfig } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'
import { buildMockAiStatus, buildMockProviderModels } from './mock-ai'

const CUSTOM_MODEL_VALUE = '__custom__'

const PROVIDER_OPTIONS = [
	{ id: 'groq', label: 'Groq', defaultModel: 'llama-3.3-70b-versatile' },
	{ id: 'openai', label: 'OpenAI', defaultModel: 'gpt-5.5' },
	{ id: 'anthropic', label: 'Anthropic', defaultModel: 'claude-sonnet-4-6' },
	{ id: 'gemini', label: 'Gemini', defaultModel: 'gemini-2.5-flash' },
	{ id: 'ollama', label: 'Ollama (local)', defaultModel: 'llama3.2' },
	{ id: 'mock', label: 'Mock (web demo)', defaultModel: 'demo-assistant' }
] as const

const TIER_ORDER = ['flagship', 'balanced', 'fast', 'installed', 'available', 'other'] as const

const TIER_LABELS: Record<string, string> = {
	flagship: 'Flagship',
	balanced: 'Balanced',
	fast: 'Fast',
	installed: 'Installed',
	available: 'Available to pull',
	other: 'Other'
}

const DEFAULT_CONFIG: AiServiceConfig = {
	provider: 'groq',
	model: 'llama-3.3-70b-versatile',
	ollama_endpoint: 'http://127.0.0.1:11434'
}

function groupModels(options: AiModelOption[]) {
	const groups = new Map<string, AiModelOption[]>()

	for (const option of options) {
		const tier = option.tier || 'other'
		const bucket = groups.get(tier)
		if (bucket) {
			bucket.push(option)
		} else {
			groups.set(tier, [option])
		}
	}

	return TIER_ORDER.filter(function (tier) {
		return groups.has(tier)
	}).map(function (tier) {
		return {
			tier,
			label: TIER_LABELS[tier] ?? tier,
			models: groups.get(tier) ?? []
		}
	})
}

export function AiProviderSection() {
	const isTauri = useIsTauri()
	const [config, setConfig] = useState<AiServiceConfig>(DEFAULT_CONFIG)
	const [modelOptions, setModelOptions] = useState<AiModelOption[]>([])
	const [loading, setLoading] = useState(true)
	const [loadingModels, setLoadingModels] = useState(false)
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

	const groupedModels = useMemo(function () {
		return groupModels(modelOptions)
	}, [modelOptions])

	const knownModelIds = useMemo(function () {
		return new Set(modelOptions.map(function (option) {
			return option.id
		}))
	}, [modelOptions])

	const usingCustomModel =
		config.provider !== 'mock' && !knownModelIds.has(config.model)

	const selectValue = usingCustomModel ? CUSTOM_MODEL_VALUE : config.model

	const loadModels = useCallback(
		async function loadModels(provider: string) {
			setLoadingModels(true)
			try {
				if (!isTauri) {
					setModelOptions(buildMockProviderModels(provider))
					return
				}

				const result = await commands.aiListProviderModels(provider)
				if (result.status === 'ok') {
					setModelOptions(result.data)
				}
			} finally {
				setLoadingModels(false)
			}
		},
		[isTauri]
	)

	const load = useCallback(async function load() {
		setLoading(true)
		setMessage(null)
		try {
			if (!isTauri) {
				const mock = buildMockAiStatus()
				setConfig({
					provider: mock.active_provider,
					model: mock.active_model,
					ollama_endpoint: DEFAULT_CONFIG.ollama_endpoint
				})
				setModelOptions(buildMockProviderModels(mock.active_provider))
				return
			}

			const result = await commands.aiGetConfig()
			if (result.status === 'ok') {
				setConfig(result.data)
				await loadModels(result.data.provider)
			}
		} finally {
			setLoading(false)
		}
	}, [isTauri, loadModels])

	useEffect(
		function loadOnMount() {
			void load()
		},
		[load]
	)

	async function handleSave() {
		if (!isTauri) {
			setMessage('Provider settings are simulated in the web demo.')
			return
		}

		setSaving(true)
		setMessage(null)
		try {
			const result = await commands.aiSetConfig(config)
			if (result.status === 'ok') {
				setMessage('Saved')
				await load()
			} else {
				setMessage(result.error?.detail ?? 'Failed to save AI settings')
			}
		} finally {
			setSaving(false)
		}
	}

	function updateProvider(provider: string) {
		const option = PROVIDER_OPTIONS.find(function (entry) {
			return entry.id === provider
		})
		setConfig(function (current) {
			return {
				...current,
				provider,
				model: option?.defaultModel ?? current.model
			}
		})
		void loadModels(provider)
	}

	async function refreshModels() {
		await loadModels(config.provider)
	}

	return (
		<div className='space-y-3'>
			<p className='text-xs leading-tight text-muted-foreground'>
				Choose which model provider powers the assistant and ⌘K SQL generation. Flagship
				models are listed first; lighter options stay available for lower cost or latency.
				{!isTauri ? ' The browser demo always uses mock responses.' : null}
			</p>

			{loading ? (
				<div className='flex items-center gap-2 text-xs text-muted-foreground'>
					<Loader2 className='h-3 w-3 animate-spin' />
					Loading…
				</div>
			) : (
				<>
					<label className='block space-y-1'>
						<span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
							Provider
						</span>
						<select
							value={config.provider}
							disabled={!isTauri}
							onChange={function (event) {
								updateProvider(event.target.value)
							}}
							className='h-8 w-full rounded-md border border-sidebar-border bg-background px-2 text-xs'
						>
							{PROVIDER_OPTIONS.map(function (option) {
								return (
									<option key={option.id} value={option.id}>
										{option.label}
									</option>
								)
							})}
						</select>
					</label>

					<div className='space-y-1'>
						<div className='flex items-center justify-between gap-2'>
							<span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
								Model
							</span>
							{config.provider !== 'mock' ? (
								<button
									type='button'
									disabled={!isTauri || loadingModels}
									onClick={function () {
										void refreshModels()
									}}
									className='inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
									title='Refresh model list from provider'
								>
									<RefreshCw
										className={cn('h-3 w-3', loadingModels ? 'animate-spin' : undefined)}
									/>
									Refresh
								</button>
							) : null}
						</div>

						{config.provider === 'mock' ? (
							<Input
								value={config.model}
								disabled
								className='h-8 font-mono text-xs'
							/>
						) : (
							<>
								<select
									value={selectValue}
									disabled={!isTauri || loadingModels}
									onChange={function (event) {
										const value = event.target.value
										if (value === CUSTOM_MODEL_VALUE) {
											setConfig(function (current) {
												return { ...current, model: '' }
											})
											return
										}
										setConfig(function (current) {
											return { ...current, model: value }
										})
									}}
									className='h-8 w-full rounded-md border border-sidebar-border bg-background px-2 text-xs'
								>
									{groupedModels.map(function (group) {
										return (
											<optgroup key={group.tier} label={group.label}>
												{group.models.map(function (option) {
													return (
														<option key={option.id} value={option.id}>
															{option.label}
														</option>
													)
												})}
											</optgroup>
										)
									})}
									<option value={CUSTOM_MODEL_VALUE}>Custom model ID…</option>
								</select>

								{usingCustomModel || selectValue === CUSTOM_MODEL_VALUE ? (
									<Input
										value={config.model}
										disabled={!isTauri}
										onChange={function (event) {
											setConfig(function (current) {
												return { ...current, model: event.target.value }
											})
										}}
										placeholder='e.g. gpt-5.5-pro or claude-opus-4-8'
										className='h-8 font-mono text-xs'
									/>
								) : null}
							</>
						)}
					</div>

					{config.provider === 'ollama' && (
						<label className='block space-y-1'>
							<span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
								Ollama endpoint
							</span>
							<Input
								value={config.ollama_endpoint}
								disabled={!isTauri}
								onChange={function (event) {
									setConfig(function (current) {
										return { ...current, ollama_endpoint: event.target.value }
									})
								}}
								placeholder='http://127.0.0.1:11434'
								className='h-8 font-mono text-xs'
							/>
						</label>
					)}

					<div className='flex items-center gap-2'>
						<Button
							size='sm'
							className='h-7 text-xs'
							onClick={handleSave}
							disabled={!isTauri || saving || !config.model.trim()}
						>
							{saving ? <Loader2 className='h-3 w-3 animate-spin' /> : 'Save provider'}
						</Button>
						{message ? (
							<span
								className={cn(
									'text-[10px]',
									message === 'Saved' ? 'text-emerald-500' : 'text-muted-foreground'
								)}
							>
								{message}
							</span>
						) : null}
					</div>
				</>
			)}
		</div>
	)
}
