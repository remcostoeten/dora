import { Check, Plus, RefreshCw, Trash2, X, Zap } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { buildMockProviderModels } from '@studio/features/ai-assistant/mock-ai'
import { ModelIdInput } from '@studio/features/ai-assistant/components/model-id-input'
import { commands, type AiApiKeyRecord, type AiModelOption } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue
} from '@studio/shared/ui/select'
import { cn } from '@studio/shared/utils/cn'
import { SidebarSection } from './sidebar-panel'

type KeyProvider = 'groq' | 'openai' | 'anthropic' | 'gemini'

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
	},
	{
		id: 'gemini',
		label: 'Gemini',
		envVar: 'GEMINI_API_KEY',
		placeholder: 'AIza...',
		hint: 'Gemini 2.5 Pro, Flash, and other Google models.',
		defaultModel: 'gemini-2.5-flash'
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
	const [settingsTest, setSettingsTest] = useState<{
		ok?: boolean
		message?: string
		testing: boolean
	}>({ testing: false })

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

	const testKey = useMemo(function () {
		return (
			keys.find(function (key) {
				return key.is_active
			}) ?? keys[0]
		)
	}, [keys])

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
			setSettingsTest({ testing: false })
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

	async function handleTest(id: number): Promise<{ ok: boolean; message: string } | null> {
		setTests(function (prev) {
			return { ...prev, [id]: { id, testing: true } }
		})
		const args = testArgs()
		const res = await commands.aiKeysTest(id, args.model, args.prompt)
		if (res.status === 'ok') {
			const result = { ok: res.data.ok, message: res.data.message }
			setTests(function (prev) {
				return {
					...prev,
					[id]: { id, testing: false, ok: result.ok, message: result.message }
				}
			})
			await load()
			return result
		}

		const failure = { ok: false, message: 'Test failed' }
		setTests(function (prev) {
			return { ...prev, [id]: { id, testing: false, ...failure } }
		})
		return failure
	}

	async function handleRunSettingsTest() {
		setSettingsTest({ testing: true })
		if (testKey) {
			const result = await handleTest(testKey.id)
			setSettingsTest({
				testing: false,
				ok: result?.ok,
				message: result?.message
			})
			return
		}

		const args = testArgs()
		const res = await commands.aiKeysTestProvider(provider, args.model, args.prompt)
		const result =
			res.status === 'ok'
				? { ok: res.data.ok, message: res.data.message }
				: { ok: false, message: 'Test failed' }
		setSettingsTest({
			testing: false,
			ok: result.ok,
			message: result.message
		})
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

				<div className='text-[10px] leading-snug text-muted-foreground/80'>
					Groq, OpenAI, Anthropic, and Gemini are cloud providers and need an API key.
					Ollama runs locally — it needs no key and is configured under the AI provider
					settings instead. See{' '}
					<code className='font-mono'>docs/ai-providers.md</code> for per-provider setup.
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
						<p className='text-[10px] leading-snug text-muted-foreground/80'>
							Cloud models your {activeProvider.label} API key can call — nothing is
							installed on your device. Pick any model your account supports.
						</p>
						<Select
							value={testModelSelectValue}
							disabled={!isTauri || loadingModels}
							onValueChange={function (value) {
								if (value === CUSTOM_MODEL_VALUE) {
									setCustomTestModel(testModel)
									setTestModel('')
									return
								}
								setTestModel(value)
								setCustomTestModel('')
							}}
						>
							<SelectTrigger className='h-8 border-sidebar-border bg-sidebar text-xs text-sidebar-foreground'>
								<SelectValue placeholder='Select a model' />
							</SelectTrigger>
							<SelectContent>
								{groupedModels.map(function (group) {
									return (
										<SelectGroup key={group.tier}>
											<SelectLabel className='text-[10px] uppercase tracking-wide'>
												{group.label}
											</SelectLabel>
											{group.models.map(function (option) {
												return (
													<SelectItem
														key={option.id}
														value={option.id}
														className='text-xs'
													>
														{option.label}
													</SelectItem>
												)
											})}
										</SelectGroup>
									)
								})}
								<SelectItem value={CUSTOM_MODEL_VALUE} className='text-xs'>
									Custom model ID…
								</SelectItem>
							</SelectContent>
						</Select>
					</label>

					{usingCustomTestModel || testModelSelectValue === CUSTOM_MODEL_VALUE ? (
						<ModelIdInput
							value={customTestModel}
							disabled={!isTauri}
							onChange={setCustomTestModel}
							options={modelOptions}
							placeholder='Start typing a model id…'
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

					<div className='flex flex-wrap items-center gap-2'>
						<Button
							variant='outline'
							size='sm'
							className='h-7 text-xs'
							onClick={function () {
								void handleRunSettingsTest()
							}}
							disabled={
								!isTauri || !resolvedTestModel || settingsTest.testing
							}
							title={
								testKey
									? `Run test with ${testKey.label} using the model and prompt above`
									: `Run test with configured ${activeProvider.label} environment keys`
							}
						>
							{settingsTest.testing ? (
								<Spinner className='mr-1 h-3 w-3' />
							) : (
								<Zap className='mr-1 h-3 w-3' />
							)}
							Run test
						</Button>
						{testKey ? (
							<span className='text-[10px] text-muted-foreground'>
								Using {testKey.label}
								{testKey.is_active ? '' : ' (first saved key)'}
							</span>
						) : (
							<span className='text-[10px] text-muted-foreground'>
								Using configured provider keys from the environment
							</span>
						)}
					</div>

					{settingsTest.message ? (
						<div
							className={cn(
								'text-[10px] font-mono',
								settingsTest.ok ? 'text-emerald-500' : 'text-destructive'
							)}
						>
							{settingsTest.ok ? '✓' : '✗'} {settingsTest.message}
						</div>
					) : null}
				</div>

				{loading && (
					<div className='flex items-center gap-2 text-xs text-muted-foreground'>
						<Spinner className='h-3 w-3' /> Loading…
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
									// Active = filled dot, inactive = hollow ring. The shape
									// difference (not just colour) keeps the state legible for
									// colour-blind users; aria-label/aria-pressed cover SRs.
									'h-2 w-2 rounded-full flex-shrink-0 border',
									key.is_active
										? 'bg-emerald-500 border-emerald-500'
										: 'bg-transparent border-muted-foreground/50'
								)}
								role='switch'
								aria-pressed={key.is_active}
								aria-label={
									key.is_active
										? `${key.label} provider key active — click to disable`
										: `${key.label} provider key disabled — click to enable`
								}
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
									<Spinner className='h-3 w-3' />
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
								{testNew.testing ? <Spinner className='h-3 w-3' /> : 'Test'}
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
