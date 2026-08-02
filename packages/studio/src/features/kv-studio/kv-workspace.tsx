import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, KeyRound, Loader2, Plus, Server, Trash2 } from 'lucide-react'
import { commands } from '@studio/lib/bindings'
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
import { Input } from '@studio/shared/ui/input'
import { Label } from '@studio/shared/ui/label'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import { cn } from '@studio/shared/utils/cn'
import { KvStudio } from './kv-studio'
import { createTauriKvAdapter } from './tauri-adapter'

type KvConnection = {
	id: string
	name: string
	config: { url: string }
	connected: boolean
	last_connected_at: number | null
	favorite: boolean
	color: string | null
	sort_order: number
}

type Props = {
	windowControls?: ReactNode
}

function commandError(error: unknown): string {
	return formatBackendError(error)
}

export function KvWorkspace({ windowControls }: Props) {
	const isTauri = useIsTauri()
	const [connections, setConnections] = useState<KvConnection[]>([])
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isConnecting, setIsConnecting] = useState(false)
	const [dialogOpen, setDialogOpen] = useState(false)
	const [name, setName] = useState('Local Redis')
	const [url, setUrl] = useState('redis://127.0.0.1:6379/0')
	const [error, setError] = useState<string | null>(null)

	const loadConnections = useCallback(
		async function () {
			if (!isTauri) {
				setIsLoading(false)
				return
			}
			const result = await commands.kvGetConnections()
			if (result.status === 'error') {
				setError(commandError(result.error))
				setIsLoading(false)
				return
			}
			setConnections(result.data)
			setSelectedId(function (current) {
				return current && result.data.some((connection) => connection.id === current)
					? current
					: (result.data[0]?.id ?? null)
			})
			setIsLoading(false)
		},
		[isTauri]
	)

	useEffect(
		function loadSavedConnections() {
			void loadConnections()
		},
		[loadConnections]
	)

	const selected = connections.find((connection) => connection.id === selectedId) ?? null
	const adapter = useMemo(
		function () {
			return selected?.connected ? createTauriKvAdapter(selected.id) : null
		},
		[selected?.connected, selected?.id]
	)

	async function connect(connection: KvConnection) {
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
		const result = await commands.kvAddConnection(name, { url })
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
		setIsConnecting(false)
	}

	async function removeConnection(connection: KvConnection) {
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
				<Button variant='outline' size='sm' onClick={() => setDialogOpen(true)}>
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
				) : !isTauri ? (
					<div className='grid h-full place-items-center px-6 text-center text-sm text-muted-foreground'>
						Redis / Valkey connections are available in the Dora desktop app.
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
							<Button className='mt-4' onClick={() => setDialogOpen(true)}>
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
								{selected.config.url.replace(/:\/\/[^@/]+@/, '://••••@')}
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
								Dora supports standard Redis URLs locally and over TLS in the cloud.
								Credentials are encrypted at rest.
							</DialogDescription>
						</DialogHeader>
						<div className='grid gap-4 py-5'>
							<div className='grid gap-1.5'>
								<Label htmlFor='kv-name'>Name</Label>
								<Input
									id='kv-name'
									value={name}
									onChange={(event) => setName(event.target.value)}
									required
								/>
							</div>
							<div className='grid gap-1.5'>
								<Label htmlFor='kv-url'>Connection URL</Label>
								<Input
									id='kv-url'
									className='font-mono'
									value={url}
									onChange={(event) => setUrl(event.target.value)}
									placeholder='rediss://default:password@example.com:6379/0'
									required
								/>
							</div>
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
