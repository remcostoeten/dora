import { Channel } from '@tauri-apps/api/core'
import { Check, Download, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import {
	buildMockOllamaCatalog,
	buildMockOllamaStatus,
	streamMockOllamaPull
} from '@studio/features/ai-assistant/mock-ai'
import {
	commands,
	type OllamaCatalogEntry,
	type OllamaInstallEvent,
	type OllamaPullEvent,
	type OllamaStatus
} from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434'

type PullState = {
	model: string
	message: string
	completed: number
	total: number
	percent: number
	etaSeconds: number | null
}

type InstallState = {
	message: string
	completed: number
	total: number | null
	percent: number
}

function newRequestId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatBytes(bytes: number | null | undefined): string {
	if (!bytes) return ''
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatEta(seconds: number | null): string {
	if (seconds == null) return ''
	if (seconds < 60) return `${seconds}s left`
	const minutes = Math.floor(seconds / 60)
	const remainder = seconds % 60
	return `${minutes}m ${remainder}s left`
}

export function OllamaModelsSection() {
	const isTauri = useIsTauri()
	const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT)
	const [status, setStatus] = useState<OllamaStatus | null>(null)
	const [catalog, setCatalog] = useState<OllamaCatalogEntry[]>([])
	const [customModel, setCustomModel] = useState('')
	const [loading, setLoading] = useState(true)
	const [savingEndpoint, setSavingEndpoint] = useState(false)
	const [pullState, setPullState] = useState<PullState | null>(null)
	const [installState, setInstallState] = useState<InstallState | null>(null)
	const [starting, setStarting] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const abortRef = useRef<{ cancelled: boolean; requestId: string | null }>({
		cancelled: false,
		requestId: null
	})
	const installAbortRef = useRef<{ cancelled: boolean; requestId: string | null }>({
		cancelled: false,
		requestId: null
	})

	const refresh = useCallback(async function refresh() {
		setLoading(true)
		setMessage(null)
		try {
			if (!isTauri) {
				setStatus(buildMockOllamaStatus())
				setCatalog(buildMockOllamaCatalog())
				return
			}

			const configResult = await commands.aiGetConfig()
			if (configResult.status === 'ok') {
				setEndpoint(configResult.data.ollama_endpoint || DEFAULT_ENDPOINT)
			}

			const [statusResult, catalogResult] = await Promise.all([
				commands.aiGetOllamaStatus(),
				commands.aiListOllamaCatalog()
			])

			if (statusResult.status === 'ok') {
				setStatus(statusResult.data)
			}
			if (catalogResult.status === 'ok') {
				setCatalog(catalogResult.data)
			}
		} finally {
			setLoading(false)
		}
	}, [isTauri])

	useEffect(
		function loadOnMount() {
			void refresh()
		},
		[refresh]
	)

	async function saveEndpoint() {
		if (!isTauri) {
			setMessage('Endpoint changes are simulated in the web demo.')
			return
		}

		setSavingEndpoint(true)
		setMessage(null)
		try {
			const configResult = await commands.aiGetConfig()
			if (configResult.status !== 'ok') return

			const result = await commands.aiSetConfig({
				...configResult.data,
				provider: configResult.data.provider || 'ollama',
				ollama_endpoint: endpoint.trim() || DEFAULT_ENDPOINT
			})

			if (result.status === 'ok') {
				setMessage('Endpoint saved')
				await refresh()
			} else {
				setMessage(result.error?.detail ?? 'Failed to save endpoint')
			}
		} finally {
			setSavingEndpoint(false)
		}
	}

	async function useModel(model: string) {
		if (!isTauri) {
			setMessage(`Selected ${model} in the web demo.`)
			return
		}

		const configResult = await commands.aiGetConfig()
		if (configResult.status !== 'ok') return

		const result = await commands.aiSetConfig({
			provider: 'ollama',
			model,
			ollama_endpoint: endpoint.trim() || DEFAULT_ENDPOINT
		})

		if (result.status === 'ok') {
			setMessage(`Using ${model}`)
		}
	}

	async function deleteModel(model: string) {
		if (!isTauri) {
			setCatalog(function (current) {
				return current.map(function (entry) {
					return entry.name === model ? { ...entry, installed: false, size_bytes: null } : entry
				})
			})
			return
		}

		const result = await commands.aiDeleteOllamaModel(model)
		if (result.status === 'ok') {
			await refresh()
		}
	}

	const pullModel = useCallback(
		async function pullModel(model: string) {
			const name = model.trim()
			if (!name || pullState) return

			setMessage(null)
			abortRef.current.cancelled = false
			const requestId = newRequestId()
			abortRef.current.requestId = requestId
			setPullState({
				model: name,
				message: `Starting pull for ${name}…`,
				completed: 0,
				total: 0,
				percent: 0,
				etaSeconds: null
			})

			function handleEvent(event: OllamaPullEvent) {
				switch (event.type) {
					case 'status':
						setPullState(function (current) {
							return current ? { ...current, message: event.message } : current
						})
						break
					case 'progress':
						setPullState(function (current) {
							return current
								? {
										...current,
										completed: event.completed,
										total: event.total,
										percent: event.percent,
										etaSeconds: event.eta_seconds,
										message: 'Downloading…'
									}
								: current
						})
						break
					case 'done':
						setPullState(null)
						setMessage(`Installed ${event.model}`)
						void refresh()
						break
					case 'error':
						setPullState(null)
						setMessage(event.message)
						break
				}
			}

			try {
				if (!isTauri) {
					await streamMockOllamaPull({
						model: name,
						onEvent: handleEvent,
						isCancelled() {
							return abortRef.current.cancelled
						}
					})
					return
				}

				const channel = new Channel<OllamaPullEvent>()
				channel.onmessage = function onmessage(event) {
					if (abortRef.current.cancelled) return
					handleEvent(event)
				}

				const result = await commands.aiPullOllamaModel(requestId, name, channel)
				if (result.status === 'error') {
					setPullState(null)
					setMessage(result.error?.detail ?? 'Pull failed')
				}
			} catch (error) {
				setPullState(null)
				setMessage(error instanceof Error ? error.message : String(error))
			} finally {
				abortRef.current.requestId = null
			}
		},
		[isTauri, pullState, refresh]
	)

	function cancelPull() {
		const id = abortRef.current.requestId
		abortRef.current.cancelled = true
		if (id && isTauri) {
			commands.aiCancelOllamaPull(id).catch(function () {})
		}
		setPullState(null)
	}

	const installOllama = useCallback(
		async function installOllama() {
			if (installState || pullState) return

			setMessage(null)
			installAbortRef.current.cancelled = false
			const requestId = newRequestId()
			installAbortRef.current.requestId = requestId
			setInstallState({
				message: 'Preparing download…',
				completed: 0,
				total: null,
				percent: 0
			})

			function handleEvent(event: OllamaInstallEvent) {
				switch (event.type) {
					case 'status':
						setInstallState(function (current) {
							return current ? { ...current, message: event.message } : current
						})
						break
					case 'progress':
						setInstallState(function (current) {
							return current
								? {
										...current,
										completed: event.completed,
										total: event.total,
										percent: event.percent,
										message: 'Downloading Ollama…'
									}
								: current
						})
						break
					case 'done':
						setInstallState(null)
						setMessage(
							event.version
								? `Ollama ${event.version} installed`
								: 'Ollama installed'
						)
						void refresh()
						break
					case 'error':
						setInstallState(null)
						setMessage(event.message)
						break
				}
			}

			try {
				if (!isTauri) {
					setInstallState({
						message: 'Simulating install…',
						completed: 0,
						total: 1_500_000_000,
						percent: 0
					})
					await streamMockOllamaPull({
						model: 'ollama',
						onEvent: function (event) {
							if (event.type === 'progress') {
								handleEvent({
									type: 'progress',
									completed: event.completed,
									total: event.total,
									percent: event.percent
								})
							} else if (event.type === 'done') {
								handleEvent({
									type: 'done',
									version: 'demo',
									install_path: '/demo/ollama'
								})
							}
						},
						isCancelled() {
							return installAbortRef.current.cancelled
						}
					})
					return
				}

				const channel = new Channel<OllamaInstallEvent>()
				channel.onmessage = function onmessage(event) {
					if (installAbortRef.current.cancelled) return
					handleEvent(event)
				}

				const result = await commands.aiInstallOllama(requestId, channel)
				if (result.status === 'error') {
					setInstallState(null)
					setMessage(result.error?.detail ?? 'Install failed')
				}
			} catch (error) {
				setInstallState(null)
				setMessage(error instanceof Error ? error.message : String(error))
			} finally {
				installAbortRef.current.requestId = null
			}
		},
		[installState, isTauri, pullState, refresh]
	)

	function cancelInstall() {
		const id = installAbortRef.current.requestId
		installAbortRef.current.cancelled = true
		if (id && isTauri) {
			commands.aiCancelOllamaInstall(id).catch(function () {})
		}
		setInstallState(null)
	}

	async function startManagedOllama() {
		if (!isTauri) {
			setMessage('Start is simulated in the web demo.')
			return
		}

		setStarting(true)
		setMessage(null)
		try {
			const result = await commands.aiStartOllama()
			if (result.status === 'ok') {
				setStatus(result.data)
				setMessage('Ollama started')
				await refresh()
			} else {
				setMessage(result.error?.detail ?? 'Failed to start Ollama')
			}
		} finally {
			setStarting(false)
		}
	}

	const canInstall =
		isTauri && !loading && !status?.running && !status?.binary_ready && !installState && !pullState
	const canStartManaged =
		isTauri &&
		!loading &&
		status?.binary_ready &&
		!status.running &&
		!installState &&
		!pullState

	return (
		<div className='space-y-3'>
			<p className='text-xs leading-tight text-muted-foreground'>
				Run models locally with Ollama. Install the runtime from Settings, pull models below,
				then choose Ollama as your provider.
				{!isTauri ? ' Install and pull progress are simulated in the browser demo.' : null}
			</p>

			{canInstall ? (
				<div className='rounded border border-primary/30 bg-primary/5 p-2'>
					<p className='mb-2 text-xs text-muted-foreground'>
						Ollama is not installed yet. Dora can download and set it up locally without
						admin rights.
					</p>
					<Button size='sm' className='h-8 text-xs' onClick={function () { void installOllama() }}>
						<Download className='mr-1 h-3 w-3' />
						Install Ollama
					</Button>
				</div>
			) : null}

			{canStartManaged ? (
				<div className='rounded border border-sidebar-border bg-background p-2'>
					<p className='mb-2 text-xs text-muted-foreground'>
						Ollama is installed but not running.
					</p>
					<Button
						size='sm'
						className='h-8 text-xs'
						disabled={starting}
						onClick={function () {
							void startManagedOllama()
						}}
					>
						{starting ? <Loader2 className='mr-1 h-3 w-3 animate-spin' /> : null}
						Start Ollama
					</Button>
				</div>
			) : null}

			<label className='block space-y-1'>
				<span className='text-[10px] uppercase tracking-wide text-muted-foreground'>
					Ollama endpoint
				</span>
				<div className='flex gap-2'>
					<Input
						value={endpoint}
						onChange={function (event) {
							setEndpoint(event.target.value)
						}}
						placeholder={DEFAULT_ENDPOINT}
						className='h-8 font-mono text-xs'
					/>
					<Button
						size='sm'
						className='h-8 shrink-0 text-xs'
						onClick={function () {
							void saveEndpoint()
						}}
						disabled={savingEndpoint}
					>
						{savingEndpoint ? <Loader2 className='h-3 w-3 animate-spin' /> : 'Save'}
					</Button>
				</div>
			</label>

			<div className='flex items-center gap-2 text-xs'>
				<span
					className={cn(
						'rounded px-1.5 py-0.5 text-[10px]',
						status?.running
							? 'bg-emerald-500/10 text-emerald-500'
							: 'bg-amber-500/10 text-amber-500'
					)}
				>
					{loading ? 'checking…' : status?.running ? 'running' : 'offline'}
				</span>
				{status?.version ? (
					<span className='text-muted-foreground'>v{status.version}</span>
				) : null}
				{status ? (
					<span className='text-muted-foreground'>
						{status.installed_count} model{status.installed_count === 1 ? '' : 's'} installed
						{status.managed ? ' · managed by Dora' : ''}
					</span>
				) : null}
			</div>

			{!loading && status && !status.running && isTauri && !status.binary_ready && !installState ? (
				<div className='rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-500'>
					Ollama is not reachable at {endpoint}. Use Install Ollama above, or install manually
					from{' '}
					<a
						href='https://ollama.com/download'
						target='_blank'
						rel='noreferrer'
						className='inline-flex items-center gap-1 underline'
					>
						ollama.com
						<ExternalLink className='h-3 w-3' />
					</a>
					.
				</div>
			) : null}

			{installState ? (
				<div className='rounded border border-sidebar-border bg-background p-2'>
					<div className='mb-1 flex items-center justify-between gap-2 text-[10px]'>
						<span className='font-medium'>Installing Ollama</span>
						<Button
							variant='ghost'
							size='sm'
							className='h-6 px-2 text-[10px]'
							onClick={cancelInstall}
						>
							Cancel
						</Button>
					</div>
					<div className='mb-1 text-[10px] text-muted-foreground'>{installState.message}</div>
					<div className='h-2 overflow-hidden rounded bg-sidebar-accent'>
						<div
							className='h-full bg-primary transition-all'
							style={{ width: `${Math.min(installState.percent, 100)}%` }}
						/>
					</div>
					<div className='mt-1 text-[10px] text-muted-foreground'>
						{formatBytes(installState.completed)}
						{installState.total ? ` / ${formatBytes(installState.total)}` : ''}
					</div>
				</div>
			) : null}

			{pullState ? (
				<div className='rounded border border-sidebar-border bg-background p-2'>
					<div className='mb-1 flex items-center justify-between gap-2 text-[10px]'>
						<span className='font-medium'>{pullState.model}</span>
						<Button variant='ghost' size='sm' className='h-6 px-2 text-[10px]' onClick={cancelPull}>
							Cancel
						</Button>
					</div>
					<div className='mb-1 text-[10px] text-muted-foreground'>{pullState.message}</div>
					<div className='h-2 overflow-hidden rounded bg-sidebar-accent'>
						<div
							className='h-full bg-primary transition-all'
							style={{ width: `${Math.min(pullState.percent, 100)}%` }}
						/>
					</div>
					<div className='mt-1 flex justify-between text-[10px] text-muted-foreground'>
						<span>
							{formatBytes(pullState.completed)}
							{pullState.total > 0 ? ` / ${formatBytes(pullState.total)}` : ''}
						</span>
						<span>{formatEta(pullState.etaSeconds)}</span>
					</div>
				</div>
			) : null}

			{loading ? (
				<div className='flex items-center gap-2 text-xs text-muted-foreground'>
					<Loader2 className='h-3 w-3 animate-spin' />
					Loading models…
				</div>
			) : (
				<div className='space-y-1.5'>
					{catalog.map(function (entry) {
						return (
							<div
								key={entry.name}
								className='rounded border border-sidebar-border bg-background px-2 py-2'
							>
								<div className='flex items-start justify-between gap-2'>
									<div className='min-w-0'>
										<div className='text-xs font-medium text-sidebar-foreground'>
											{entry.label}
											<span className='ml-1 font-mono text-[10px] text-muted-foreground'>
												{entry.name}
											</span>
										</div>
										<div className='text-[10px] text-muted-foreground leading-tight'>
											{entry.description}
										</div>
										{entry.size_bytes ? (
											<div className='text-[10px] text-muted-foreground'>
												{formatBytes(entry.size_bytes)}
											</div>
										) : null}
									</div>
									<div className='flex shrink-0 items-center gap-1'>
										{entry.installed ? (
											<>
												<Button
													variant='ghost'
													size='sm'
													className='h-6 px-2 text-[10px]'
													onClick={function () {
														void useModel(entry.name)
													}}
												>
													<Check className='h-3 w-3 mr-1' />
													Use
												</Button>
												<Button
													variant='ghost'
													size='sm'
													className='h-6 px-2 text-[10px] text-destructive hover:text-destructive'
													onClick={function () {
														void deleteModel(entry.name)
													}}
													disabled={Boolean(pullState)}
												>
													<Trash2 className='h-3 w-3' />
												</Button>
											</>
										) : (
											<Button
												variant='outline'
												size='sm'
												className='h-6 px-2 text-[10px]'
												onClick={function () {
													void pullModel(entry.name)
												}}
												disabled={Boolean(pullState) || (!status?.running && isTauri)}
											>
												<Download className='h-3 w-3 mr-1' />
												Pull
											</Button>
										)}
									</div>
								</div>
							</div>
						)
					})}
				</div>
			)}

			<div className='flex gap-2'>
				<Input
					value={customModel}
					onChange={function (event) {
						setCustomModel(event.target.value)
					}}
					placeholder='Custom model tag (e.g. mistral:7b)'
					className='h-8 font-mono text-xs'
				/>
				<Button
					size='sm'
					className='h-8 shrink-0 text-xs'
					onClick={function () {
						void pullModel(customModel)
					}}
					disabled={!customModel.trim() || Boolean(pullState) || (!status?.running && isTauri)}
				>
					Pull
				</Button>
			</div>

			{message ? <div className='text-[10px] text-muted-foreground'>{message}</div> : null}
		</div>
	)
}
