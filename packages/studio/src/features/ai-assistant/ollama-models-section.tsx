import { Channel } from '@tauri-apps/api/core'
import { Check, Download, ExternalLink, Play, RefreshCw, Trash2 } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { DEFAULT_OLLAMA_ENDPOINT, useAiSelection } from './ai-selection-store'

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

type Runtime = 'checking' | 'running' | 'starting' | 'stopped' | 'missing'

const START_POLL_ATTEMPTS = 25
const START_POLL_INTERVAL_MS = 600

const RUNTIME_BADGES: Record<Runtime, { label: string; className: string }> = {
	checking: { label: 'Checking…', className: 'bg-muted text-muted-foreground' },
	running: { label: 'Running', className: 'bg-emerald-500/10 text-emerald-500' },
	starting: { label: 'Starting…', className: 'bg-sky-500/10 text-sky-500' },
	stopped: { label: 'Not running', className: 'bg-amber-500/10 text-amber-500' },
	missing: { label: 'Not installed', className: 'bg-muted text-muted-foreground' }
}

function newRequestId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms)
	})
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
	const selection = useAiSelection()
	const endpoint = selection.ollamaEndpoint || DEFAULT_OLLAMA_ENDPOINT
	const [status, setStatus] = useState<OllamaStatus | null>(null)
	const [catalog, setCatalog] = useState<OllamaCatalogEntry[]>([])
	const [customModel, setCustomModel] = useState('')
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [pullState, setPullState] = useState<PullState | null>(null)
	const [installState, setInstallState] = useState<InstallState | null>(null)
	const [starting, setStarting] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const mountedRef = useRef(true)
	const abortRef = useRef<{ cancelled: boolean; requestId: string | null }>({
		cancelled: false,
		requestId: null
	})
	const installAbortRef = useRef<{ cancelled: boolean; requestId: string | null }>({
		cancelled: false,
		requestId: null
	})

	useEffect(function trackMounted() {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])

	const refresh = useCallback(
		async function refresh(silent?: boolean) {
			if (silent) {
				setRefreshing(true)
			} else {
				setLoading(true)
			}
			try {
				if (!isTauri) {
					setStatus(buildMockOllamaStatus())
					setCatalog(buildMockOllamaCatalog())
					return
				}

				const [statusResult, catalogResult] = await Promise.all([
					commands.aiGetOllamaStatus(),
					commands.aiListOllamaCatalog()
				])

				if (!mountedRef.current) return
				if (statusResult.status === 'ok') {
					setStatus(statusResult.data)
				}
				if (catalogResult.status === 'ok') {
					setCatalog(catalogResult.data)
				}
			} finally {
				if (mountedRef.current) {
					setRefreshing(false)
					setLoading(false)
				}
			}
		},
		[isTauri]
	)

	useEffect(
		function loadOnMount() {
			void refresh()
		},
		[refresh]
	)

	async function useModel(model: string) {
		if (!isTauri) {
			setMessage(`Selected ${model} in the web demo.`)
			return
		}

		const result = await commands.aiSetConfig({
			provider: 'ollama',
			model,
			ollama_endpoint: endpoint
		})

		if (result.status === 'ok') {
			setMessage(`The assistant now uses ${model}`)
		} else {
			setMessage(result.error?.detail ?? `Failed to switch to ${model}`)
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
			setMessage(`Removed ${model}`)
			await refresh(true)
		} else {
			setMessage(result.error?.detail ?? `Failed to remove ${model}`)
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
						void refresh(true)
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
							event.version ? `Ollama ${event.version} installed` : 'Ollama installed'
						)
						void refresh(true)
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

	async function waitForRunning(): Promise<OllamaStatus | null> {
		for (let attempt = 0; attempt < START_POLL_ATTEMPTS; attempt += 1) {
			await delay(START_POLL_INTERVAL_MS)
			if (!mountedRef.current) return null
			const result = await commands.aiGetOllamaStatus()
			if (result.status === 'ok') {
				setStatus(result.data)
				if (result.data.running) return result.data
			}
		}
		return null
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
			if (result.status !== 'ok') {
				setMessage(result.error?.detail ?? 'Failed to start Ollama')
				return
			}

			setStatus(result.data)
			const ready = result.data.running ? result.data : await waitForRunning()
			if (!mountedRef.current) return

			if (ready) {
				setMessage('Ollama is running')
				await refresh(true)
				return
			}

			setMessage(
				`Ollama did not come online at ${endpoint}. Check that the port is free, or start it yourself with "ollama serve".`
			)
		} finally {
			if (mountedRef.current) setStarting(false)
		}
	}

	const runtime: Runtime = useMemo(
		function resolveRuntime() {
			if (loading) return 'checking'
			if (status?.running) return 'running'
			if (starting) return 'starting'
			if (status?.binary_ready) return 'stopped'
			return 'missing'
		},
		[loading, starting, status]
	)

	const busy = Boolean(pullState || installState)
	const canInstall = isTauri && runtime === 'missing' && !busy
	const canStartManaged = isTauri && runtime === 'stopped' && !busy
	const canPull = !isTauri || Boolean(status?.running)

	const installed = catalog.filter(function (entry) {
		return entry.installed
	})
	const available = catalog.filter(function (entry) {
		return !entry.installed
	})
	const badge = RUNTIME_BADGES[runtime]

	function renderEntry(entry: OllamaCatalogEntry) {
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
						<div className='text-[10px] leading-tight text-muted-foreground'>
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
									onClick={() => {
										void useModel(entry.name)
									}}
									title={`Point the assistant at ${entry.name}`}
								>
									<Check className='mr-1 h-3 w-3' />
									Use
								</Button>
								<Button
									variant='ghost'
									size='sm'
									className='h-6 px-2 text-[10px] text-destructive hover:text-destructive'
									onClick={() => {
										void deleteModel(entry.name)
									}}
									disabled={busy}
									title={`Delete ${entry.name} from this machine`}
								>
									<Trash2 className='h-3 w-3' />
								</Button>
							</>
						) : (
							<Button
								variant='outline'
								size='sm'
								className='h-6 px-2 text-[10px]'
								onClick={() => {
									void pullModel(entry.name)
								}}
								disabled={busy || !canPull}
								title={
									canPull
										? `Download ${entry.name}`
										: 'Start Ollama before downloading models'
								}
							>
								<Download className='mr-1 h-3 w-3' />
								Pull
							</Button>
						)}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className='space-y-3'>
			<div className='flex flex-wrap items-center gap-2 text-xs'>
				<span className={cn('rounded px-1.5 py-0.5 text-[10px]', badge.className)}>
					{badge.label}
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
				<span className='font-mono text-[10px] text-muted-foreground/70'>{endpoint}</span>
				<button
					type='button'
					disabled={loading || refreshing || starting}
					onClick={() => {
						void refresh(true)
					}}
					className='ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
					title='Re-check Ollama and installed models'
				>
					<RefreshCw className={cn('h-3 w-3', refreshing ? 'animate-spin' : undefined)} />
					Refresh
				</button>
			</div>

			{canInstall ? (
				<div className='rounded border border-primary/30 bg-primary/5 p-2'>
					<p className='mb-2 text-xs text-muted-foreground'>
						Ollama is not installed yet. Dora can download and set it up locally without
						admin rights, or you can install it from{' '}
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
					</p>
					<Button
						size='sm'
						className='h-8 text-xs'
						onClick={() => {
							void installOllama()
						}}
					>
						<Download className='mr-1 h-3 w-3' />
						Install Ollama
					</Button>
				</div>
			) : null}

			{canStartManaged || starting ? (
				<div className='rounded border border-sidebar-border bg-background p-2'>
					<p className='mb-2 text-xs text-muted-foreground'>
						{starting
							? 'Starting the Ollama server — this can take a few seconds.'
							: 'Ollama is installed but not running. Start it to pull models and use the assistant.'}
					</p>
					<Button
						size='sm'
						className='h-8 text-xs'
						disabled={starting}
						onClick={() => {
							void startManagedOllama()
						}}
					>
						{starting ? (
							<Spinner className='mr-1 h-3 w-3' />
						) : (
							<Play className='mr-1 h-3 w-3' />
						)}
						{starting ? 'Starting Ollama…' : 'Start Ollama'}
					</Button>
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
						<Button
							variant='ghost'
							size='sm'
							className='h-6 px-2 text-[10px]'
							onClick={cancelPull}
						>
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
					<Spinner className='h-3 w-3' />
					Checking Ollama…
				</div>
			) : (
				<div className='space-y-3'>
					{installed.length > 0 ? (
						<div className='space-y-1.5'>
							<div className='text-[10px] uppercase tracking-wide text-muted-foreground'>
								Installed
							</div>
							{installed.map(renderEntry)}
						</div>
					) : null}

					{available.length > 0 ? (
						<div className='space-y-1.5'>
							<div className='text-[10px] uppercase tracking-wide text-muted-foreground'>
								{installed.length > 0 ? 'Available to pull' : 'Recommended models'}
							</div>
							{!canPull ? (
								<p className='text-[10px] text-muted-foreground'>
									Downloads are unavailable until Ollama is running.
								</p>
							) : null}
							{available.map(renderEntry)}
						</div>
					) : null}

					<div className='flex gap-2'>
						<Input
							value={customModel}
							onChange={(event) => {
								setCustomModel(event.target.value)
							}}
							placeholder='Any other tag from ollama.com (e.g. mistral:7b)'
							className='h-8 font-mono text-xs'
						/>
						<Button
							size='sm'
							className='h-8 shrink-0 text-xs'
							onClick={() => {
								void pullModel(customModel)
							}}
							disabled={!customModel.trim() || busy || !canPull}
						>
							Pull
						</Button>
					</div>
				</div>
			)}

			{message ? <div className='text-[10px] text-muted-foreground'>{message}</div> : null}

			{!isTauri ? (
				<p className='text-[10px] text-muted-foreground/70'>
					Install and pull progress are simulated in the browser demo.
				</p>
			) : null}
		</div>
	)
}
