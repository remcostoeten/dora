import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { commands, type AiServiceConfig } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'
import { buildMockAiStatus } from './mock-ai'

const PROVIDER_OPTIONS = [
	{ id: 'groq', label: 'Groq', defaultModel: 'llama-3.3-70b-versatile' },
	{ id: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o-mini' },
	{ id: 'anthropic', label: 'Anthropic', defaultModel: 'claude-3-5-haiku-20241022' },
	{ id: 'gemini', label: 'Gemini', defaultModel: 'gemini-2.0-flash' },
	{ id: 'ollama', label: 'Ollama (local)', defaultModel: 'llama3.2' },
	{ id: 'mock', label: 'Mock (web demo)', defaultModel: 'demo-assistant' }
] as const

const DEFAULT_CONFIG: AiServiceConfig = {
	provider: 'groq',
	model: 'llama-3.3-70b-versatile',
	ollama_endpoint: 'http://127.0.0.1:11434'
}

export function AiProviderSection() {
	const isTauri = useIsTauri()
	const [config, setConfig] = useState<AiServiceConfig>(DEFAULT_CONFIG)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState<string | null>(null)

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
				return
			}

			const result = await commands.aiGetConfig()
			if (result.status === 'ok') {
				setConfig(result.data)
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
	}

	const activeOption = PROVIDER_OPTIONS.find(function (entry) {
		return entry.id === config.provider
	})

	return (
		<div className='space-y-3'>
				<p className='text-xs leading-tight text-muted-foreground'>
					Choose which model provider powers the assistant and ⌘K SQL generation.
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

						<label className='block space-y-1'>
							<span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
								Model
							</span>
							<Input
								value={config.model}
								disabled={!isTauri || config.provider === 'mock'}
								onChange={function (event) {
									setConfig(function (current) {
										return { ...current, model: event.target.value }
									})
								}}
								placeholder={activeOption?.defaultModel ?? 'model id'}
								className='h-8 font-mono text-xs'
							/>
						</label>

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
								disabled={!isTauri || saving}
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
