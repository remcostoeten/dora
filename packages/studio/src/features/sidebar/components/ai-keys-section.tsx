import { Check, Loader2, Plus, RefreshCw, Trash2, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { buildMockProviderModels } from '@studio/features/ai-assistant/mock-ai'
import { commands, type AiApiKeyRecord, type AiModelOption } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'
import { SidebarSection } from './sidebar-panel'

type KeyProvider = 'groq' | 'openai' | 'anthropic'

type ProviderConfig = {
	id: KeyProvider
	label: string
	envVar: string
	placeholder: string
	hint: string
	defaultModel: string
}

const PROVIDERS: ProviderConfig[] = [
	{
		id: 'groq',
		label: 'Groq',
		envVar: 'GROQ_API_KEY',
		placeholder: 'gsk_...',
		hint: 'Fast hosted models via Groq.',
		defaultModel: 'llama-3.3-70b-versatile'
	},
	{
		id: 'openai',
		label: 'OpenAI',
		envVar: 'OPENAI_API_KEY',
		placeholder: 'sk-...',
		hint: 'GPT-5.5, GPT-5.4, and other OpenAI chat models.',
		defaultModel: 'gpt-5.5'
	},
	{
		id: 'anthropic',
		label: 'Anthropic',
		envVar: 'ANTHROPIC_API_KEY',
		placeholder: 'sk-ant-...',
		hint: 'Claude Opus, Sonnet, Haiku, and other Anthropic models.',
		defaultModel: 'claude-sonnet-4-6'
	}
]

const TIER_ORDER = ['flagship', 'balanced', 'fast', 'other'] as const

const TIER_LABELS: Record<string, string> = {
	flagship: 'Flagship',
	balanced: 'Balanced',
	fast: 'Fast',
	other: 'Other'
}

const CUSTOM_MODEL_VALUE = '__custom__'

type TestState = { id: number; ok?: boolean; message?: string; testing: boolean }

function formatStatus(rec: AiApiKeyRecord): string {
	if (!rec.last_status) return 'untested'
	const ts = rec.last_tested ? new Date(rec.last_tested * 1000).toLocaleString() : ''
	return `${rec.last_status}${ts ? ' · ' + ts : ''}`
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

export function AiKeysSection() {
	const isTauri = useIsTauri()
	const [provider, setProvider] = useState<KeyProvider>('groq')
	const [keys, setKeys] = useState<AiApiKeyRecord[]>([])
	const [loading, setLoading] = useState(false)
	const [showAdd, setShowAdd] = useState(false)
	const [label, setLabel] = useState('')
	const [apiKey, setApiKey] = useState('')
	const [modelOptions, setModelOptions] = useState<AiModelOption[]>([])
	const [loadingModels, setLoadingModels] = useState(false)
	const [testModel, setTestModel] = useState('llama-3.3-70b-versatile')
	const [customTestModel, setCustomTestModel] = useState('')
	const [testPrompt, setTestPrompt] = useState('')
	const [testNew, setTestNew] = useState<{ ok?: boolean; message?: string; testing: boolean }>({
		testing: false
	})
	const [tests, setTests] = useState<Record<number, TestState>>({})

	const activeProvider = PROVIDERS.find(function (entry) {
		return entry.id === provider
	})!

	const groupedModels = useMemo(function () {
		return groupModels(modelOptions)
	}, [modelOptions])

	const knownModelIds = useMemo(function () {
		return new Set(modelOptions.map(function (option) {
			return option.id
		}))
	}, [modelOptions])

	const usingCustomTestModel = !knownModelIds.has(testModel)
	const testModelSelectValue = usingCustomTestModel ? CUSTOM_MODEL_VALUE : testModel

	const resolvedTestModel = usingCustomTestModel ? customTestModel.trim() : testModel.trim()

	const loadModels = useCallback(
		async function loadModels(nextProvider: KeyProvider, preferredModel?: string) {
			setLoadingModels(true)
			try {
				if (!isTauri) {
					const options = buildMockProviderModels(nextProvider)
					setModelOptions(options)
					const fallback =
						preferredModel && options.some(function (option) {
							return option.id === preferredModel
						})
							? preferredModel
							: (PROVIDERS.find(function (entry) {
									return entry.id === nextProvider
								})?.defaultModel ?? options[0]?.id ?? '')
					setTestModel(fallback)
					setCustomTestModel('')
					return
				}

				const [configResult, modelsResult] = await Promise.all([
					commands.aiGetConfig(),
					commands.aiListProviderModels(nextProvider)
				])

				let fallback = PROVIDERS.find(function (entry) {
					return entry.id === nextProvider
				})?.defaultModel

				if (configResult.status === 'ok' && configResult.data.provider === nextProvider) {
					fallback = configResult.data.model
				}

				if (preferredModel) {
					fallback = preferredModel
				}

				if (modelsResult.status === 'ok') {
					setModelOptions(modelsResult.data)
					const match = modelsResult.data.some(function (option) {
						return option.id === fallback
					})
					setTestModel(match ? fallback! : modelsResult.data[0]?.id ?? fallback ?? '')
					setCustomTestModel('')
				}
			} finally {
				setLoadingModels(false)
			}
		},
		[isTauri]
	)

	const load = useCallback(async function load() {
		setLoading(true)
		try {
			const res = await commands.aiKeysList(provider)
			if (res.status === 'ok') setKeys(res.data)
		} finally {
			setLoading(false)
		}
	}, [provider])

	useEffect(
		function loadOnMount() {
			setShowAdd(false)
			setApiKey('')
			setLabel('')
			setTestNew({ testing: false })
			void loadModels(provider)
			void load()
		},
		[load, loadModels, provider]
	)

	function testArgs() {
		return {
			model: resolvedTestModel || null,
			prompt: testPrompt.trim() || null
		}
	}

	async function handleTestRaw() {
		if (!apiKey.trim()) return
		setTestNew({ testing: true })
		const args = testArgs()
		const res = await commands.aiKeysTestRaw(provider, apiKey.trim(), args.model, args.prompt)
		if (res.status === 'ok') {
			setTestNew({ testing: false, ok: res.data.ok, message: res.data.message })
		} else {
			setTestNew({ testing: false, ok: false, message: 'Failed to test' })
		}
	}

	async function handleAdd() {
		if (!apiKey.trim()) return
		const res = await commands.aiKeysAdd(provider, label.trim() || 'unnamed', apiKey.trim())
		if (res.status === 'ok') {
			setApiKey('')
			setLabel('')
			setTestNew({ testing: false })
			setShowAdd(false)
			await load()
		}
	}

	async function handleDelete(id: number) {
		const res = await commands.aiKeysDelete(id)
		if (res.status === 'ok') await load()
	}

	async function handleTest(id: number) {
		setTests(function (prev) {
			return { ...prev, [id]: { id, testing: true } }
		})
		const args = testArgs()
		const res = await commands.aiKeysTest(id, args.model, args.prompt)
		if (res.status === 'ok') {
			setTests(function (prev) {
				return {
					...prev,
					[id]: { id, testing: false, ok: res.data.ok, message: res.data.message }
				}
			})
			await load()
		} else {
			setTests(function (prev) {
				return { ...prev, [id]: { id, testing: false, ok: false, message: 'Test failed' } }
			})
		}
	}

	async function handleToggleActive(id: number, next: boolean) {
		const res = await commands.aiKeysSetActive(id, next)
		if (res.status === 'ok') await load()
	}

	return (
		<SidebarSection title='AI Keys'>
			<div className='space-y-2'>
				<div className='flex flex-wrap gap-1'>
					{PROVIDERS.map(function (entry) {
						return (
							<button
								key={entry.id}
								type='button'
								onClick={function () {
									setProvider(entry.id)
								}}
								className={cn(
									'rounded border px-2 py-1 text-[10px]',
									provider === entry.id
										? 'border-primary bg-primary/10 text-primary'
										: 'border-sidebar-border text-muted-foreground hover:bg-sidebar-accent/40'
								)}
							>
								{entry.label}
							</button>
						)
					})}
				</div>

				<div className='text-xs text-muted-foreground leading-tight'>
					{activeProvider.hint} Keys are encrypted with AES-256-GCM. Environment variables like{' '}
					<code className='font-mono'>{activeProvider.envVar}</code> are merged automatically.
				</div>

				<div className='space-y-2 rounded-sm border border-sidebar-border bg-background p-2'>
					<div className='flex items-center justify-between gap-2'>
						<span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
							Test settings
						</span>
						<button
							type='button'
							disabled={!isTauri || loadingModels}
							onClick={function () {
								void loadModels(provider, testModel)
							}}
							className='inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
						>
							<RefreshCw
								className={cn('h-3 w-3', loadingModels ? 'animate-spin' : undefined)}
							/>
							Refresh models
						</button>
					</div>

					<label className='block space-y-1'>
						<span className='text-[10px] text-muted-foreground'>Model to test against</span>
						<select
							value={testModelSelectValue}
							disabled={!isTauri || loadingModels}
							onChange={function (event) {
								const value = event.target.value
								if (value === CUSTOM_MODEL_VALUE) {
									setCustomTestModel(testModel)
									setTestModel('')
									return
								}
								setTestModel(value)
								setCustomTestModel('')
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
					</label>

					{usingCustomTestModel || testModelSelectValue === CUSTOM_MODEL_VALUE ? (
						<Input
							value={customTestModel}
							disabled={!isTauri}
							onChange={function (event) {
								setCustomTestModel(event.target.value)
							}}
							placeholder='Model id for this test'
							className='h-8 font-mono text-xs'
						/>
					) : null}

					<label className='block space-y-1'>
						<span className='text-[10px] text-muted-foreground'>
							Test prompt <span className='normal-case'>(optional)</span>
						</span>
						<Input
							value={testPrompt}
							disabled={!isTauri}
							onChange={function (event) {
								setTestPrompt(event.target.value)
							}}
							placeholder='Leave empty for a quick ping test'
							className='h-8 text-xs'
						/>
					</label>
				</div>

				{loading && (
					<div className='flex items-center gap-2 text-xs text-muted-foreground'>
						<Loader2 className='h-3 w-3 animate-spin' /> Loading…
					</div>
				)}

				{keys.length === 0 && !loading && (
					<div className='text-xs text-muted-foreground italic'>
						No saved keys for {activeProvider.label}. Add one below or set{' '}
						<code className='font-mono'>{activeProvider.envVar}</code>.
					</div>
				)}

				{keys.map(function (key) {
					const test = tests[key.id]
					return (
						<div
							key={key.id}
							className='flex items-center gap-2 rounded-sm border border-sidebar-border bg-background px-2 py-1.5'
						>
							<button
								type='button'
								onClick={function () {
									void handleToggleActive(key.id, !key.is_active)
								}}
								className={cn(
									'h-2 w-2 rounded-full flex-shrink-0',
									key.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30'
								)}
								title={key.is_active ? 'Active — click to disable' : 'Disabled — click to enable'}
							/>
							<div className='min-w-0 flex-1'>
								<div className='text-xs font-medium text-sidebar-foreground truncate'>
									{key.label}
								</div>
								<div className='text-[10px] text-muted-foreground truncate'>
									{test && !test.testing
										? `${test.ok ? '✓' : '✗'} ${test.message}`
										: formatStatus(key)}
								</div>
							</div>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 px-2 text-[10px]'
								onClick={function () {
									void handleTest(key.id)
								}}
								disabled={test?.testing || !resolvedTestModel}
								title='Test key with the model and prompt above'
							>
								{test?.testing ? (
									<Loader2 className='h-3 w-3 animate-spin' />
								) : (
									<Zap className='h-3 w-3' />
								)}
							</Button>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 px-2 text-[10px] text-destructive hover:text-destructive'
								onClick={function () {
									void handleDelete(key.id)
								}}
							>
								<Trash2 className='h-3 w-3' />
							</Button>
						</div>
					)
				})}

				{!showAdd ? (
					<Button
						variant='outline'
						size='sm'
						className='h-7 w-full text-xs'
						onClick={function () {
							setShowAdd(true)
						}}
					>
						<Plus className='h-3 w-3 mr-1' /> Add {activeProvider.label} key
					</Button>
				) : (
					<div className='space-y-2 rounded-sm border border-sidebar-border bg-background p-2'>
						<Input
							value={label}
							onChange={function (event) {
								setLabel(event.target.value)
							}}
							placeholder='Label (e.g. personal)'
							className='h-7 text-xs'
						/>
						<Input
							value={apiKey}
							onChange={function (event) {
								setApiKey(event.target.value)
							}}
							placeholder={activeProvider.placeholder}
							type='password'
							className='h-7 font-mono text-xs'
						/>
						{testNew.message && (
							<div
								className={cn(
									'text-[10px] font-mono',
									testNew.ok ? 'text-emerald-500' : 'text-destructive'
								)}
							>
								{testNew.ok ? '✓' : '✗'} {testNew.message}
							</div>
						)}
						<div className='flex items-center gap-1'>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 px-2 text-[10px]'
								onClick={function () {
									void handleTestRaw()
								}}
								disabled={testNew.testing || !apiKey.trim() || !resolvedTestModel}
							>
								{testNew.testing ? <Loader2 className='h-3 w-3 animate-spin' /> : 'Test'}
							</Button>
							<Button
								variant='default'
								size='sm'
								className='h-6 px-2 text-[10px] ml-auto'
								onClick={function () {
									void handleAdd()
								}}
								disabled={!apiKey.trim()}
							>
								<Check className='h-3 w-3 mr-1' /> Save
							</Button>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 px-2 text-[10px]'
								onClick={function () {
									setShowAdd(false)
									setApiKey('')
									setLabel('')
									setTestNew({ testing: false })
								}}
							>
								<X className='h-3 w-3' />
							</Button>
						</div>
					</div>
				)}
			</div>
		</SidebarSection>
	)
}
