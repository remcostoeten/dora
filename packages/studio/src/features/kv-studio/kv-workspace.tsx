import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, KeyRound, Loader2, Plus, Server, Trash2 } from 'lucide-react'
import { commands, type KvConnectionInfo } from '@studio/lib/bindings'
import { useIsTauri } from '@studio/core/data-provider'
import { Button } from '@studio/shared/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '@studio/shared/ui/dialog'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import { cn } from '@studio/shared/utils/cn'
import { KvConnectionFields } from './kv-connection-fields'
import {
	describeKvTarget,
	EMPTY_KV_FORM,
	type KvConnectionForm,
	toKvConnectionConfig
} from './kv-connection-form'
import { KvStudio } from './kv-studio'
import { takeRequestedKvConnection } from './kv-launch'
import { createTauriKvAdapter } from './tauri-adapter'

type Props = {
	isActive?: boolean
	windowControls?: ReactNode
}

function commandError(error: unknown): string {
	return formatBackendError(error)
}

function KvDesktopOnly({ windowControls }: Props) {
	return (
		<div className='flex h-full min-h-0 flex-col bg-background'>
			<div className='flex h-11 shrink-0 items-center gap-2 border-b px-3'>
				<div className='flex items-center gap-2 text-sm font-medium'>
					<KeyRound className='size-4 text-[#d82c20]' /> Redis / Valkey
				</div>
				<div className='ml-auto'>{windowControls}</div>
			</div>
			<div className='grid min-h-0 flex-1 place-items-center px-6 text-center'>
				<div className='max-w-sm'>
					<div className='mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-[#d82c20]/10 text-[#d82c20]'>
						<Server />
					</div>
					<h2 className='font-medium'>Available in the desktop app</h2>
					<p className='mt-1 text-sm text-muted-foreground'>
						Redis and Valkey connections open TCP sockets, which a browser cannot do.
						Open Dora on your desktop to browse and edit keys.
					</p>
				</div>
			</div>
		</div>
	)
}

export function KvWorkspace({ isActive = true, windowControls }: Props) {
	const isTauri = useIsTauri()
	const [connections, setConnections] = useState<KvConnectionInfo[]>([])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isConnecting, setIsConnecting] = useState(false)
	const [dialogOpen, setDialogOpen] = useState(false)
	const [form, setForm] = useState<KvConnectionForm>(EMPTY_KV_FORM)
	const [error, setError] = useState<string | null>(null)

	const loadConnections = useCallback(async function () {
		const result = await commands.kvGetConnections()
		if (result.status === 'error') {
			setError(commandError(result.error))
			setIsLoading(false)
			return
		}
		const requestedId = takeRequestedKvConnection()
		setConnections(result.data)
		setSelectedId(function (current) {
			if (requestedId && result.data.some((connection) => connection.id === requestedId)) {
				return requestedId
			}
			return current && result.data.some((connection) => connection.id === current)
				? current
				: (result.data[0]?.id ?? null)
		})
		setIsLoading(false)
	}, [])

	useEffect(
		function loadSavedConnections() {
			if (!isTauri || !isActive) return
			void loadConnections()
		},
		[isTauri, isActive, loadConnections]
	)

	const selected = connections.find((connection) => connection.id === selectedId) ?? null
	const adapter = useMemo(
		function () {
			return selected?.connected ? createTauriKvAdapter(selected.id) : null
		},
		[selected?.connected, selected?.id]
	)

	async function connect(connection: KvConnectionInfo) {
		setIsConnecting(true)
		setError(null)
		const result = await commands.kvConnect(connection.id)
		if (result.status === 'error') {
			setError(commandError(result.error))
		} else {
			setConnections(function (current) {
				return current.map((item) => (item.id === connection.id ? result.data : item))
			})
		}
		setIsConnecting(false)
	}

	async function addConnection(event: FormEvent) {
		event.preventDefault()
		setIsConnecting(true)
		setError(null)
		const result = await commands.kvAddConnection(form.name, toKvConnectionConfig(form))
		if (result.status === 'error') {
			setError(commandError(result.error))
			setIsConnecting(false)
			return
		}
		setConnections(function (current) {
			return [...current, result.data]
		})
		setSelectedId(result.data.id)
		setDialogOpen(false)
		setForm(EMPTY_KV_FORM)
		setIsConnecting(false)
	}

	function openDialog() {
		setError(null)
		setDialogOpen(true)
	}

	function updateForm<K extends keyof KvConnectionForm>(field: K, value: KvConnectionForm[K]) {
		setForm((current) => ({ ...current, [field]: value }))
	}

	async function removeConnection(connection: KvConnectionInfo) {
		if (
			!window.confirm(
				`Remove “${connection.name}”? The Redis database itself is not changed.`
			)
		)
			return
		const result = await commands.kvRemoveConnection(connection.id)
		if (result.status === 'error') {
			setError(commandError(result.error))
			return
		}
		await loadConnections()
	}

	if (!isTauri) return <KvDesktopOnly windowControls={windowControls} />

	return (
		<div className='flex h-full min-h-0 flex-col bg-background'>
			<div className='flex h-11 shrink-0 items-center gap-2 border-b px-3'>
				<div className='flex items-center gap-2 text-sm font-medium'>
					<KeyRound className='size-4 text-[#d82c20]' /> Redis / Valkey
				</div>
				<div className='relative ml-3'>
					<select
						aria-label='Key-value connection'
						className='h-7 min-w-48 appearance-none rounded-md border border-input bg-background px-2 pr-7 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring'
						value={selectedId ?? ''}
						onChange={function (event) {
							setSelectedId(event.target.value || null)
							setError(null)
						}}
					>
						<option value=''>Select a connection</option>
						{connections.map((connection) => (
							<option key={connection.id} value={connection.id}>
								{connection.name}
							</option>
						))}
					</select>
					<ChevronDown className='pointer-events-none absolute right-2 top-1.5 size-3.5 text-muted-foreground' />
				</div>
				<Button variant='outline' size='sm' onClick={openDialog}>
					<Plus /> Add connection
				</Button>
				{selected && (
					<Button
						aria-label='Remove connection'
						variant='ghost'
						size='icon-sm'
						onClick={() => void removeConnection(selected)}
					>
						<Trash2 />
					</Button>
				)}
				<div className='ml-auto'>{windowControls}</div>
			</div>

			{error && (
				<div className='border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive'>
					{error}
				</div>
			)}

			<div className='min-h-0 flex-1'>
				{isLoading ? (
					<div className='grid h-full place-items-center text-sm text-muted-foreground'>
						<Loader2 className='animate-spin' /> Loading connections…
					</div>
				) : !selected ? (
					<div className='grid h-full place-items-center px-6 text-center'>
						<div className='max-w-sm'>
							<div className='mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-[#d82c20]/10 text-[#d82c20]'>
								<Server />
							</div>
							<h2 className='font-medium'>Connect Redis or Valkey</h2>
							<p className='mt-1 text-sm text-muted-foreground'>
								Use a local redis:// URL or a TLS-enabled rediss:// cloud endpoint.
							</p>
							<Button className='mt-4' onClick={openDialog}>
								<Plus /> Add connection
							</Button>
						</div>
					</div>
				) : !adapter ? (
					<div className='grid h-full place-items-center px-6 text-center'>
						<div className='max-w-sm'>
							<div
								className={cn(
									'mx-auto mb-4 size-2 rounded-full',
									isConnecting
										? 'animate-pulse bg-amber-500'
										: 'bg-muted-foreground'
								)}
							/>
							<h2 className='font-medium'>{selected.name}</h2>
							<p className='mt-1 truncate font-mono text-xs text-muted-foreground'>
								{describeKvTarget(selected.config)}
							</p>
							<Button
								className='mt-4'
								disabled={isConnecting}
								onClick={() => void connect(selected)}
							>
								{isConnecting && <Loader2 className='animate-spin' />} Connect
							</Button>
						</div>
					</div>
				) : (
					<KvStudio key={selected.id} adapter={adapter} connectionName={selected.name} />
				)}
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<form onSubmit={addConnection}>
						<DialogHeader>
							<DialogTitle>Add Redis / Valkey connection</DialogTitle>
							<DialogDescription>
								Local servers, hosted Redis over TLS, clusters and private networks
								through an SSH tunnel. Credentials are encrypted at rest.
							</DialogDescription>
						</DialogHeader>
						{error && (
							<p className='mt-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive'>
								{error}
							</p>
						)}
						<div className='grid max-h-[60vh] gap-4 overflow-y-auto py-5'>
							<KvConnectionFields
								form={form}
								onChange={updateForm}
								onError={setError}
							/>
						</div>
						<DialogFooter>
							<Button
								type='button'
								variant='outline'
								onClick={() => setDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type='submit' disabled={isConnecting}>
								{isConnecting && <Loader2 className='animate-spin' />} Connect and
								save
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	)
}
