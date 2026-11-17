import {
	ArrowRight,
	Check,
	Cloud,
	FlaskConical,
	Info,
	KeyRound,
	Lock,
	Monitor,
	RefreshCw,
	Zap,
	type LucideIcon
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { ModelIdInput } from '@studio/features/ai-assistant/components/model-id-input'
import { buildMockAiStatus, buildMockProviderModels } from '@studio/features/ai-assistant/mock-ai'
import {
	DEFAULT_OLLAMA_ENDPOINT,
	KEYLESS_PROVIDERS,
	publishAiSelection
} from '@studio/features/ai-assistant/ai-selection-store'
import { commands, type AiModelOption, type AiServiceConfig } from '@studio/lib/bindings'
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
import { Spinner } from '@studio/shared/ui/spinner'
import { cn } from '@studio/shared/utils/cn'
import { RadioGrid, SettingCard, SettingGroup, SettingRow } from '../components/setting-primitives'
import type { SettingsSectionId } from '../sections'

type ProviderKind = 'cloud' | 'local' | 'demo'

type ProviderOption = {
	id: string
	label: string
	shortLabel: string
	defaultModel: string
	kind: ProviderKind
}

type TestState = {
	status: 'idle' | 'testing' | 'ok' | 'error'
	message: string
}

type Props = {
	onNavigate: (section: SettingsSectionId) => void
}

const CUSTOM_MODEL_VALUE = '__custom__'

const PROVIDER_OPTIONS: ProviderOption[] = [
	{
		id: 'groq',
		label: 'Groq',
		shortLabel: 'Groq',
		defaultModel: 'llama-3.3-70b-versatile',
		kind: 'cloud'
	},
	{ id: 'openai', label: 'OpenAI', shortLabel: 'OpenAI', defaultModel: 'gpt-5.5', kind: 'cloud' },
	{
		id: 'anthropic',
		label: 'Anthropic',
		shortLabel: 'Anthropic',
		defaultModel: 'claude-sonnet-4-6',
		kind: 'cloud'
	},
	{
		id: 'gemini',
		label: 'Gemini',
		shortLabel: 'Gemini',
		defaultModel: 'gemini-2.5-flash',
		kind: 'cloud'
	},
	{
		id: 'deepseek',
		label: 'DeepSeek',
		shortLabel: 'DeepSeek',
		defaultModel: 'deepseek-chat',
		kind: 'cloud'
	},
	{
		id: 'kimi',
		label: 'Kimi (Moonshot)',
		shortLabel: 'Kimi',
		defaultModel: 'kimi-latest',
		kind: 'cloud'
	},
	{
		id: 'glm',
		label: 'GLM (Z.ai)',
		shortLabel: 'GLM',
		defaultModel: 'glm-5.3-flash',
		kind: 'cloud'
	},
	{
		id: 'qwen',
		label: 'Qwen (DashScope)',
		shortLabel: 'Qwen',
		defaultModel: 'qwen-plus',
		kind: 'cloud'
	},
	{
		id: 'openrouter',
		label: 'OpenRouter',
		shortLabel: 'OpenRouter',
		defaultModel: 'openrouter/auto',
		kind: 'cloud'
	},
	{
		id: 'ollama',
		label: 'Ollama (local)',
		shortLabel: 'Ollama',
		defaultModel: 'llama3.2',
		kind: 'local'
	},
	{
		id: 'mock',
		label: 'Mock (web demo)',
		shortLabel: 'Mock',
		defaultModel: 'demo-assistant',
		kind: 'demo'
	}
]

const KIND_META: Record<ProviderKind, { icon: LucideIcon; badge: string; hint: string }> = {
	cloud: {
		icon: Cloud,
		badge: 'Cloud',
		hint: 'Cloud provider. Requests are sent to the provider and need an API key. Add one under AI Keys.'
	},
	local: {
		icon: Monitor,
		badge: 'Local',
		hint: 'Runs on this machine. No API key needed. Manage the runtime and installed models under Local models.'
	},
	demo: {
		icon: FlaskConical,
		badge: 'Demo',
		hint: 'Canned responses for the browser demo. Nothing leaves your machine.'
	}
}

const TIER_ORDER = ['flagship', 'balanced', 'fast', 'installed', 'available', 'other']

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
	ollama_endpoint: DEFAULT_OLLAMA_ENDPOINT
}

const ENDPOINT_PATTERN = /^https?:\/\/[^\s/]+/

const IDLE_TEST: TestState = { status: 'idle', message: '' }

function findProvider(id: string) {
	return PROVIDER_OPTIONS.find((option) => option.id === id) ?? PROVIDER_OPTIONS[0]
}

function groupModels(options: AiModelOption[]) {
	const groups = new Map<string, AiModelOption[]>()
	for (const option of options) {
		const tier = option.tier || 'other'
		groups.set(tier, [...(groups.get(tier) ?? []), option])
	}
	return TIER_ORDER.filter((tier) => groups.has(tier)).map((tier) => ({
		tier,
		label: TIER_LABELS[tier] ?? tier,
		models: groups.get(tier) ?? []
	}))
}

function isDirty(config: AiServiceConfig, saved: AiServiceConfig) {
	return (
		config.provider !== saved.provider ||
		config.model.trim() !== saved.model.trim() ||
		(config.provider === 'ollama' &&
			config.ollama_endpoint.trim() !== saved.ollama_endpoint.trim())
	)
}

function KeyBadge({ kind, hasKey }: { kind: ProviderKind; hasKey: boolean }) {
	if (kind !== 'cloud') {
		return <span className='text-[11px] text-muted-foreground'>No key needed</span>
	}
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1.5 text-[11px]',
				hasKey ? 'text-foreground' : 'text-muted-foreground'
			)}
		>
			<span
				className={cn(
					'h-1.5 w-1.5 rounded-full border-[1.5px] border-muted-foreground',
					hasKey && 'border-foreground bg-foreground'
				)}
			/>
			{hasKey ? 'Key set' : 'No key'}
		</span>
	)
}

export function AiProviderScreen({ onNavigate }: Props) {
	const isTauri = useIsTauri()
	const [config, setConfig] = useState<AiServiceConfig>(DEFAULT_CONFIG)
	const [saved, setSaved] = useState<AiServiceConfig>(DEFAULT_CONFIG)
	const [modelOptions, setModelOptions] = useState<AiModelOption[]>([])
	const [keyedProviders, setKeyedProviders] = useState<ReadonlySet<string>>(new Set())
	const [loading, setLoading] = useState(true)
	const [loadingModels, setLoadingModels] = useState(false)
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const [test, setTest] = useState<TestState>(IDLE_TEST)

	const provider = findProvider(config.provider)
	const kind = KIND_META[provider.kind]
	const groupedModels = useMemo(() => groupModels(modelOptions), [modelOptions])
	const knownModelIds = useMemo(
		() => new Set(modelOptions.map((option) => option.id)),
		[modelOptions]
	)
	const usingCustomModel =
		config.provider !== 'mock' && !loadingModels && !knownModelIds.has(config.model)
	const selectValue = usingCustomModel ? CUSTOM_MODEL_VALUE : config.model
	const dirty = isDirty(config, saved)
	const endpointValid = ENDPOINT_PATTERN.test(config.ollama_endpoint.trim())
	const valid = config.model.trim().length > 0 && (config.provider !== 'ollama' || endpointValid)
	const hasKey = keyedProviders.has(config.provider)

	const loadModels = useCallback(
		async (providerId: string) => {
			setLoadingModels(true)
			try {
				if (!isTauri) {
					setModelOptions(buildMockProviderModels(providerId))
					return
				}
				const result = await commands.aiListProviderModels(providerId)
				if (result.status === 'ok') setModelOptions(result.data)
			} finally {
				setLoadingModels(false)
			}
		},
		[isTauri]
	)

	const loadKeys = useCallback(async () => {
		if (!isTauri) return
		const cloud = PROVIDER_OPTIONS.filter((option) => option.kind === 'cloud')
		const lists = await Promise.all(cloud.map((option) => commands.aiKeysList(option.id)))
		const keyed = cloud
			.filter((_, index) => {
				const list = lists[index]
				return list.status === 'ok' && list.data.some((record) => record.is_active)
			})
			.map((option) => option.id)
		setKeyedProviders(new Set(keyed))
	}, [isTauri])

	const load = useCallback(async () => {
		try {
			if (!isTauri) {
				const mock = buildMockAiStatus()
				const next = {
					provider: mock.active_provider,
					model: mock.active_model,
					ollama_endpoint: DEFAULT_OLLAMA_ENDPOINT
				}
				setConfig(next)
				setSaved(next)
				publishAiSelection({
					provider: next.provider,
					ollamaEndpoint: next.ollama_endpoint
				})
				setModelOptions(buildMockProviderModels(next.provider))
				return
			}
			const result = await commands.aiGetConfig()
			if (result.status === 'ok') {
				const next = {
					...result.data,
					ollama_endpoint: result.data.ollama_endpoint || DEFAULT_OLLAMA_ENDPOINT
				}
				setConfig(next)
				setSaved(next)
				publishAiSelection({
					provider: next.provider,
					ollamaEndpoint: next.ollama_endpoint
				})
				await loadModels(next.provider)
			}
		} finally {
			setLoading(false)
		}
	}, [isTauri, loadModels])

	useEffect(() => {
		void load()
		void loadKeys()
	}, [load, loadKeys])

	function selectProvider(providerId: string) {
		if (providerId === config.provider) return
		const option = findProvider(providerId)
		setConfig((current) => ({ ...current, provider: providerId, model: option.defaultModel }))
		setTest(IDLE_TEST)
		setMessage(null)
		publishAiSelection({ provider: providerId })
		void loadModels(providerId)
		if (!isTauri || providerId === 'mock') return
		void commands.aiResolveProviderModel(providerId).then((result) => {
			if (result.status !== 'ok' || !result.data) return
			setConfig((current) =>
				current.provider === providerId ? { ...current, model: result.data } : current
			)
		})
	}

	function selectModel(value: string) {
		setConfig((current) => ({
			...current,
			model: value === CUSTOM_MODEL_VALUE ? '' : value
		}))
	}

	function discard() {
		setConfig(saved)
		setTest(IDLE_TEST)
		setMessage(null)
		publishAiSelection({ provider: saved.provider })
		void loadModels(saved.provider)
	}

	async function save() {
		if (!isTauri) {
			setMessage('Provider settings are simulated in the web demo.')
			return
		}
		setSaving(true)
		setMessage(null)
		try {
			const result = await commands.aiSetConfig({
				...config,
				model: config.model.trim(),
				ollama_endpoint: config.ollama_endpoint.trim()
			})
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

	async function runTest() {
		setTest({ status: 'testing', message: `Sending a test prompt to ${provider.shortLabel}…` })
		const result = await commands.aiKeysTestProvider(
			config.provider,
			config.model.trim() || null,
			null
		)
		if (result.status === 'ok') {
			setTest({ status: result.data.ok ? 'ok' : 'error', message: result.data.message })
			return
		}
		setTest({ status: 'error', message: 'Test failed' })
	}

	if (loading) {
		return (
			<div className='flex items-center gap-2 py-6 text-xs text-muted-foreground'>
				<Spinner className='h-3 w-3' />
				Loading provider settings…
			</div>
		)
	}

	return (
		<>
			<SettingGroup label='Provider' help='Dora sends AI requests to one provider at a time.'>
				<SettingCard>
					<SettingRow
						focusId='ai-provider-provider'
						label='Active provider'
						labelId='ai-provider-label'
						help={isTauri ? undefined : 'The browser demo always uses mock responses.'}
						stacked
					>
						<RadioGrid
							label='Active provider'
							className='grid w-full grid-cols-1 gap-1 @[560px]:grid-cols-2'
						>
							{PROVIDER_OPTIONS.map((option) => {
								const checked = option.id === config.provider
								const Icon = KIND_META[option.kind].icon
								return (
									<button
										key={option.id}
										type='button'
										role='radio'
										aria-checked={checked}
										tabIndex={checked ? 0 : -1}
										disabled={!isTauri}
										onClick={() => selectProvider(option.id)}
										className={cn(
											'grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-[background-color,transform] duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:active:scale-100',
											checked
												? 'bg-accent focus-visible:bg-focus-strong'
												: 'hover:bg-focus focus-visible:bg-focus-strong'
										)}
									>
										<span
											className={cn(
												'grid h-[30px] w-[30px] place-items-center rounded-md transition-colors duration-150',
												checked
													? 'bg-primary text-primary-foreground'
													: 'bg-foreground/[0.06] text-muted-foreground'
											)}
										>
											<Icon className='h-[15px] w-[15px]' />
										</span>
										<span className='min-w-0'>
											<span className='block truncate text-[13px] font-medium text-foreground'>
												{option.label}
											</span>
											<span className='block truncate font-mono text-[11px] text-muted-foreground'>
												{checked
													? config.model || 'custom model'
													: option.defaultModel}
											</span>
										</span>
										<span className='flex flex-col items-end gap-0.5'>
											<span className='rounded bg-foreground/[0.07] px-1.5 py-px text-[10.5px] font-medium text-muted-foreground'>
												{KIND_META[option.kind].badge}
											</span>
											<KeyBadge
												kind={option.kind}
												hasKey={keyedProviders.has(option.id)}
											/>
										</span>
									</button>
								)
							})}
						</RadioGrid>
					</SettingRow>
					<div className='border-t border-border px-4 py-3'>
						<div className='flex items-start gap-2.5 rounded-md bg-foreground/[0.04] px-3 py-2.5 text-xs text-muted-foreground'>
							<Info className='mt-px h-3.5 w-3.5 shrink-0' />
							<span
								className={cn(
									KEYLESS_PROVIDERS.has(config.provider) && 'text-foreground'
								)}
							>
								{kind.hint}
							</span>
						</div>
					</div>
				</SettingCard>
			</SettingGroup>

			<SettingGroup label='Model'>
				<SettingCard>
					<SettingRow
						focusId='ai-provider-model'
						label='Model'
						htmlFor='ai-provider-model-select'
						help={`Remembered per provider. Default for ${provider.shortLabel} is ${provider.defaultModel}.`}
					>
						{config.provider === 'mock' ? (
							<Input
								value={config.model}
								disabled
								className='h-8 w-56 font-mono text-xs'
							/>
						) : (
							<Select
								value={selectValue}
								disabled={!isTauri || loadingModels}
								onValueChange={selectModel}
							>
								<SelectTrigger
									id='ai-provider-model-select'
									className='h-8 w-64 font-mono text-xs'
								>
									<SelectValue placeholder='Select model' />
								</SelectTrigger>
								<SelectContent>
									{groupedModels.map((group) => (
										<SelectGroup key={group.tier}>
											<SelectLabel className='text-[10px] uppercase tracking-wide'>
												{group.label}
											</SelectLabel>
											{group.models.map((option) => (
												<SelectItem
													key={option.id}
													value={option.id}
													className='text-xs'
												>
													{option.label}
												</SelectItem>
											))}
										</SelectGroup>
									))}
									<SelectItem value={CUSTOM_MODEL_VALUE} className='text-xs'>
										Custom model ID…
									</SelectItem>
								</SelectContent>
							</Select>
						)}
						{config.provider !== 'mock' ? (
							<Button
								variant='secondary'
								size='icon'
								disabled={!isTauri || loadingModels}
								onClick={() => void loadModels(config.provider)}
								aria-label='Refresh models'
								title='Refresh model list from provider'
								className='h-8 w-8'
							>
								<RefreshCw
									className={cn('h-3.5 w-3.5', loadingModels && 'animate-spin')}
								/>
							</Button>
						) : null}
					</SettingRow>

					{usingCustomModel ? (
						<SettingRow
							focusId='ai-provider-custom-model'
							label='Custom model ID'
							help={
								config.model.trim()
									? `Any model ID ${provider.shortLabel} accepts.`
									: 'Enter a model ID to save.'
							}
							helpTone={config.model.trim() ? 'default' : 'error'}
						>
							<ModelIdInput
								value={config.model}
								disabled={!isTauri}
								onChange={(value) =>
									setConfig((current) => ({ ...current, model: value }))
								}
								options={modelOptions}
								placeholder='Start typing a model id…'
								className='h-8 w-64 font-mono text-xs'
							/>
						</SettingRow>
					) : null}

					{config.provider === 'ollama' ? (
						<SettingRow
							focusId='ai-provider-endpoint'
							label='Ollama endpoint'
							htmlFor='ai-provider-endpoint-input'
							help={
								endpointValid
									? 'Where Dora reaches the Ollama server. Leave this alone unless Ollama runs on another host or port.'
									: 'Use a full URL, for example http://127.0.0.1:11434'
							}
							helpTone={endpointValid ? 'default' : 'error'}
						>
							<Input
								id='ai-provider-endpoint-input'
								value={config.ollama_endpoint}
								disabled={!isTauri}
								onChange={(event) =>
									setConfig((current) => ({
										...current,
										ollama_endpoint: event.target.value
									}))
								}
								placeholder={DEFAULT_OLLAMA_ENDPOINT}
								spellCheck={false}
								className='h-8 w-64 font-mono text-xs'
							/>
						</SettingRow>
					) : null}
				</SettingCard>
			</SettingGroup>

			<SettingGroup label='Access'>
				<SettingCard>
					<SettingRow
						focusId='ai-provider-key'
						label='API key'
						help={
							provider.kind !== 'cloud'
								? provider.kind === 'local'
									? 'Ollama runs on this machine, so no key is stored.'
									: 'The mock provider never makes network requests.'
								: hasKey
									? `Your ${provider.shortLabel} key is stored encrypted on this machine.`
									: `${provider.shortLabel} needs a key before requests can be sent.`
						}
					>
						{provider.kind === 'cloud' ? (
							<>
								<span
									className={cn(
										'inline-flex items-center gap-1.5 text-[12.5px]',
										hasKey ? 'text-foreground' : 'text-muted-foreground'
									)}
								>
									{hasKey ? (
										<Lock className='h-3.5 w-3.5 text-muted-foreground' />
									) : (
										<KeyRound className='h-3.5 w-3.5' />
									)}
									{hasKey ? 'Set, stored encrypted' : 'No key yet'}
								</span>
								<Button
									variant='ghost'
									size='sm'
									onClick={() => onNavigate('ai-keys')}
									className='h-7 gap-1.5 text-xs'
								>
									{hasKey ? 'Manage in AI Keys' : 'Add in AI Keys'}
									<ArrowRight className='h-3 w-3 text-muted-foreground' />
								</Button>
							</>
						) : (
							<span className='inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground'>
								<Check className='h-3.5 w-3.5' />
								Not needed
							</span>
						)}
					</SettingRow>

					{provider.kind === 'cloud' ? (
						<SettingRow
							focusId='ai-provider-test'
							label='Test connection'
							help={
								test.status === 'idle'
									? 'Sends a one-line prompt with the stored key and checks the reply.'
									: test.message
							}
							helpTone={
								test.status === 'ok'
									? 'ok'
									: test.status === 'error'
										? 'error'
										: 'default'
							}
						>
							<Button
								variant='secondary'
								size='sm'
								disabled={!isTauri || !hasKey || test.status === 'testing'}
								onClick={() => void runTest()}
								className='h-7 gap-1.5 text-xs'
							>
								{test.status === 'testing' ? (
									<Spinner className='h-3 w-3' />
								) : (
									<Zap className='h-3.5 w-3.5' />
								)}
								{test.status === 'testing' ? 'Testing' : 'Test'}
							</Button>
						</SettingRow>
					) : null}
				</SettingCard>
			</SettingGroup>

			<div className='sticky bottom-4 mt-5 flex items-center gap-2.5 rounded-lg border border-border bg-popover py-2 pl-3.5 pr-2 shadow-lg'>
				<div
					role='status'
					className={cn(
						'flex min-w-0 flex-1 items-center gap-2 text-[12.5px]',
						dirty || message === 'Saved' ? 'text-foreground' : 'text-muted-foreground'
					)}
				>
					{dirty ? (
						<span className='h-1.5 w-1.5 shrink-0 rounded-full bg-warning' />
					) : null}
					{!dirty && message === 'Saved' ? (
						<Check className='h-3.5 w-3.5 shrink-0' />
					) : null}
					<span className='truncate'>
						{saving
							? 'Saving…'
							: dirty
								? valid
									? 'Unsaved changes'
									: 'Unsaved changes. Fix the highlighted field to save.'
								: (message ?? 'All changes saved')}
					</span>
				</div>
				<Button
					variant='ghost'
					size='sm'
					disabled={!dirty || saving}
					onClick={discard}
					className='h-7 text-xs text-muted-foreground hover:text-foreground'
				>
					Discard
				</Button>
				<Button
					size='sm'
					disabled={!isTauri || !dirty || !valid || saving}
					onClick={() => void save()}
					className='h-7 text-xs'
				>
					{saving ? <Spinner className='h-3 w-3' /> : 'Save provider'}
				</Button>
			</div>
		</>
	)
}
