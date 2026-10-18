import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
	AlertTriangle,
	Box,
	ChevronRight,
	Clock3,
	Database,
	FolderTree,
	KeyRound,
	Loader2,
	Play,
	RefreshCw,
	Search,
	Terminal,
	Trash2,
	X
} from 'lucide-react'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from '@studio/shared/ui/alert-dialog'
import { Badge } from '@studio/shared/ui/badge'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { Skeleton } from '@studio/shared/ui/skeleton'
import { cn } from '@studio/shared/utils/cn'
import { commandName, formatTtl, groupKeysByNamespace, isDestructiveCommand } from './kv-utils'
import type { KvAdapter, KvCommandResult, KvKeySummary, KvValue } from './types'
import { ValueEditor } from './value-editor'

type Props = {
	adapter: KvAdapter
	connectionName?: string
	pageSize?: number
	initialPattern?: string
}

type ConfirmState = { kind: 'delete'; key: string } | { kind: 'command'; command: string } | null

const typeBadgeClass: Record<KvKeySummary['type'], string> = {
	string: 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300',
	hash: 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300',
	list: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
	set: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
	zset: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300'
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export function KvStudio({
	adapter,
	connectionName = 'Redis',
	pageSize = 100,
	initialPattern = '*'
}: Props) {
	const [keys, setKeys] = useState<KvKeySummary[]>([])
	const [cursor, setCursor] = useState('0')
	const [pattern, setPattern] = useState(initialPattern)
	const [appliedPattern, setAppliedPattern] = useState(initialPattern)
	const [selectedKey, setSelectedKey] = useState<string | null>(null)
	const [selectedValue, setSelectedValue] = useState<KvValue | null>(null)
	const [isScanning, setIsScanning] = useState(true)
	const [isLoadingValue, setIsLoadingValue] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [valueLimit, setValueLimit] = useState(200)
	const [error, setError] = useState<string | null>(null)
	const [command, setCommand] = useState('')
	const [history, setHistory] = useState<KvCommandResult[]>([])
	const [isExecuting, setIsExecuting] = useState(false)
	const [showConsole, setShowConsole] = useState(true)
	const [confirm, setConfirm] = useState<ConfirmState>(null)
	const [confirmationText, setConfirmationText] = useState('')
	const [ttlDraft, setTtlDraft] = useState('')

	const selectedSummary = keys.find((key) => key.name === selectedKey) ?? null
	const groups = useMemo(() => groupKeysByNamespace(keys), [keys])

	const scan = useCallback(
		async function scan(reset: boolean, nextPattern = appliedPattern) {
			setIsScanning(true)
			setError(null)
			try {
				const page = await adapter.scan({
					cursor: reset ? '0' : cursor,
					pattern: nextPattern || '*',
					count: pageSize
				})
				setCursor(page.cursor)
				setKeys(function (current) {
					if (reset) return page.keys
					const known = new Set(current.map((key) => key.name))
					return [...current, ...page.keys.filter((key) => !known.has(key.name))]
				})
			} catch (scanError) {
				setError(errorMessage(scanError))
			} finally {
				setIsScanning(false)
			}
		},
		[adapter, appliedPattern, cursor, pageSize]
	)

	useEffect(
		function initialScan() {
			void scan(true)
			// The initial adapter request intentionally runs once for each adapter instance.
		},
		[adapter]
	)

	useEffect(
		function loadSelectedValue() {
			if (!selectedKey) {
				setSelectedValue(null)
				return
			}
			let active = true
			setIsLoadingValue(true)
			setError(null)
			adapter
				.getValue(selectedKey, { limit: valueLimit })
				.then(function (value) {
					if (active) setSelectedValue(value)
				})
				.catch(function (loadError) {
					if (active) setError(errorMessage(loadError))
				})
				.finally(function () {
					if (active) setIsLoadingValue(false)
				})
			return function () {
				active = false
			}
		},
		[adapter, selectedKey, valueLimit]
	)

	useEffect(
		function updateTtlDraft() {
			setTtlDraft(
				selectedSummary?.ttlMs === null || !selectedSummary
					? ''
					: String(selectedSummary.ttlMs)
			)
		},
		[selectedKey, selectedSummary?.ttlMs]
	)

	function applyPattern(event: FormEvent) {
		event.preventDefault()
		const nextPattern = pattern.trim() || '*'
		setAppliedPattern(nextPattern)
		setSelectedKey(null)
		void scan(true, nextPattern)
	}

	async function saveValue(value: KvValue) {
		if (!selectedKey) return
		setIsSaving(true)
		setError(null)
		try {
			await adapter.setValue(selectedKey, value)
			setSelectedValue(value)
		} catch (saveError) {
			setError(errorMessage(saveError))
		} finally {
			setIsSaving(false)
		}
	}

	async function saveTtl(clear = false) {
		if (!selectedKey) return
		const parsedTtl = Number(ttlDraft)
		if (!clear && (!Number.isFinite(parsedTtl) || parsedTtl <= 0)) {
			setError('TTL must be a positive number of milliseconds.')
			return
		}
		const nextTtl = clear ? null : parsedTtl
		try {
			await adapter.setTtl(selectedKey, nextTtl)
			setKeys((current) =>
				current.map((key) => (key.name === selectedKey ? { ...key, ttlMs: nextTtl } : key))
			)
		} catch (ttlError) {
			setError(errorMessage(ttlError))
		}
	}

	async function deleteSelectedKey() {
		if (confirm?.kind !== 'delete') return
		try {
			await adapter.deleteKey(confirm.key)
			setKeys((current) => current.filter((key) => key.name !== confirm.key))
			setSelectedKey(null)
			setConfirm(null)
		} catch (deleteError) {
			setError(errorMessage(deleteError))
		}
	}

	async function execute(rawCommand: string, confirmation?: string) {
		setIsExecuting(true)
		setError(null)
		try {
			const startedAt = performance.now()
			const result = await adapter.execute(rawCommand, confirmation)
			setHistory((current) =>
				[
					{
						...result,
						command: rawCommand,
						durationMs: result.durationMs ?? performance.now() - startedAt,
						executedAt: result.executedAt ?? Date.now()
					},
					...current
				].slice(0, 50)
			)
			setCommand('')
		} catch (commandError) {
			setError(errorMessage(commandError))
		} finally {
			setIsExecuting(false)
			setConfirm(null)
			setConfirmationText('')
		}
	}

	function submitCommand(event: FormEvent) {
		event.preventDefault()
		const rawCommand = command.trim()
		if (!rawCommand) return
		if (isDestructiveCommand(rawCommand)) {
			setConfirm({ kind: 'command', command: rawCommand })
			setConfirmationText('')
			return
		}
		void execute(rawCommand)
	}

	return (
		<div className='flex h-full min-h-[32rem] flex-col overflow-hidden bg-background text-foreground'>
			<header className='flex h-12 shrink-0 items-center justify-between border-b px-4'>
				<div className='flex min-w-0 items-center gap-2.5'>
					<div className='grid size-7 place-items-center rounded-md bg-[#d82c20]/10 text-[#d82c20]'>
						<Database className='size-4' />
					</div>
					<div className='min-w-0'>
						<div className='truncate text-sm font-medium'>{connectionName}</div>
						<div className='flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground'>
							<span className='size-1.5 rounded-full bg-emerald-500' /> Key-value
							studio
						</div>
					</div>
				</div>
				<div className='flex items-center gap-1'>
					<Badge variant='outline' className='font-mono text-[10px]'>
						{keys.length} scanned
					</Badge>
					<Button
						aria-label='Refresh keys'
						variant='ghost'
						size='icon'
						disabled={isScanning}
						onClick={() => void scan(true)}
					>
						<RefreshCw className={cn(isScanning && 'animate-spin')} />
					</Button>
				</div>
			</header>

			{error && (
				<div className='flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive'>
					<AlertTriangle className='size-3.5' />
					<span className='flex-1'>{error}</span>
					<Button
						aria-label='Dismiss error'
						variant='ghost'
						size='icon-sm'
						onClick={() => setError(null)}
					>
						<X />
					</Button>
				</div>
			)}

			<div className='grid min-h-0 flex-1 grid-cols-[minmax(15rem,21rem)_minmax(0,1fr)]'>
				<aside className='flex min-h-0 flex-col border-r bg-muted/15'>
					<form className='border-b p-3' onSubmit={applyPattern}>
						<div className='relative'>
							<Search className='absolute left-2.5 top-2 size-3.5 text-muted-foreground' />
							<Input
								aria-label='Key pattern'
								className='pl-8 pr-14 font-mono text-xs'
								placeholder='user:*'
								value={pattern}
								onChange={(event) => setPattern(event.target.value)}
							/>
							<button
								type='submit'
								className='absolute right-1 top-1 rounded px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground hover:bg-accent hover:text-foreground'
							>
								Scan
							</button>
						</div>
						<p className='mt-1.5 px-1 text-[10px] text-muted-foreground'>
							Glob pattern · cursor {cursor}
						</p>
					</form>

					<div className='min-h-0 flex-1 overflow-auto py-2'>
						{isScanning && keys.length === 0 ? (
							<div className='space-y-2 px-3'>
								{[1, 2, 3, 4, 5].map((item) => (
									<Skeleton key={item} className='h-9 w-full' />
								))}
							</div>
						) : keys.length === 0 ? (
							<div className='grid h-full place-items-center px-6 text-center'>
								<div>
									<KeyRound className='mx-auto mb-3 size-6 text-muted-foreground/60' />
									<p className='text-sm font-medium'>No matching keys</p>
									<p className='mt-1 text-xs text-muted-foreground'>
										Try a broader pattern such as{' '}
										<code className='font-mono'>*</code>.
									</p>
								</div>
							</div>
						) : (
							groups.map(function (group) {
								return (
									<section key={group.name || '__root'} className='mb-2'>
										<div
											className='flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'
											style={{ paddingLeft: `${12 + group.depth * 8}px` }}
										>
											<FolderTree className='size-3' />
											<span className='truncate'>{group.label}</span>
											<span className='ml-auto font-mono'>
												{group.keys.length}
											</span>
										</div>
										{group.keys.map(function (key) {
											const parts = key.name.split(':')
											const leaf = parts[parts.length - 1] || key.name
											return (
												<button
													key={key.name}
													type='button'
													onClick={() => {
														setValueLimit(200)
														setSelectedKey(key.name)
													}}
													className={cn(
														'group flex w-full items-center gap-2 border-l-2 border-transparent px-3 py-2 text-left hover:bg-accent/60',
														selectedKey === key.name &&
															'border-l-[#d82c20] bg-accent'
													)}
												>
													<ChevronRight
														className={cn(
															'size-3 shrink-0 text-muted-foreground transition-transform',
															selectedKey === key.name &&
																'translate-x-0.5 text-foreground'
														)}
													/>
													<span
														className='min-w-0 flex-1 truncate font-mono text-xs'
														title={key.name}
													>
														{leaf}
													</span>
													<span className='font-mono text-[9px] text-muted-foreground'>
														{formatTtl(key.ttlMs)}
													</span>
													<span
														className={cn(
															'rounded border px-1 py-0.5 font-mono text-[9px]',
															typeBadgeClass[key.type]
														)}
													>
														{key.type}
													</span>
												</button>
											)
										})}
									</section>
								)
							})
						)}
					</div>

					<div className='border-t p-2'>
						<Button
							variant='outline'
							size='sm'
							className='w-full'
							disabled={cursor === '0' || isScanning}
							onClick={() => void scan(false)}
						>
							{isScanning ? <Loader2 className='animate-spin' /> : <RefreshCw />}{' '}
							{cursor === '0' ? 'End of keyspace' : 'Load next page'}
						</Button>
					</div>
				</aside>

				<main className='flex min-h-0 min-w-0 flex-col'>
					<div className='min-h-0 flex-1 overflow-auto'>
						{!selectedKey ? (
							<div className='grid h-full place-items-center px-8 text-center'>
								<div className='max-w-sm'>
									<Box className='mx-auto mb-4 size-8 text-muted-foreground/50' />
									<h2 className='text-base font-semibold'>Inspect a key</h2>
									<p className='mt-1 text-sm text-muted-foreground'>
										Choose a key from the namespace rail to inspect its value,
										change its TTL, or edit its contents.
									</p>
								</div>
							</div>
						) : (
							<div className='flex min-h-full flex-col p-5'>
								<div className='mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-4'>
									<div className='min-w-0'>
										<div className='mb-1 flex items-center gap-2'>
											<KeyRound className='size-4 text-[#d82c20]' />
											<span
												className={cn(
													'rounded border px-1.5 py-0.5 font-mono text-[10px]',
													selectedSummary &&
														typeBadgeClass[selectedSummary.type]
												)}
											>
												{selectedSummary?.type}
											</span>
										</div>
										<h1 className='break-all font-mono text-lg font-medium'>
											{selectedKey}
										</h1>
									</div>
									<div className='flex items-center gap-2'>
										<div className='flex items-center rounded-md border bg-muted/20 p-0.5'>
											<Clock3 className='mx-2 size-3.5 text-muted-foreground' />
											<Input
												aria-label='TTL in milliseconds'
												className='h-7 w-28 border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0'
												placeholder='persistent'
												value={ttlDraft}
												onChange={(event) =>
													setTtlDraft(event.target.value)
												}
											/>
											<Button
												variant='ghost'
												size='sm'
												onClick={() => void saveTtl(false)}
											>
												Set TTL
											</Button>
											<Button
												variant='ghost'
												size='sm'
												onClick={() => void saveTtl(true)}
											>
												Persist
											</Button>
										</div>
										<Button
											aria-label='Delete key'
											variant='outline'
											size='icon'
											className='text-destructive hover:bg-destructive/10 hover:text-destructive'
											onClick={() =>
												setConfirm({ kind: 'delete', key: selectedKey })
											}
										>
											<Trash2 />
										</Button>
									</div>
								</div>
								{isLoadingValue ? (
									<div className='space-y-3'>
										<Skeleton className='h-8 w-40' />
										<Skeleton className='h-56 w-full' />
									</div>
								) : selectedValue ? (
									<ValueEditor
										value={selectedValue}
										isSaving={isSaving}
										onSave={(value) => void saveValue(value)}
										onLoadMore={() => setValueLimit((limit) => limit * 2)}
									/>
								) : null}
							</div>
						)}
					</div>

					<section
						className={cn(
							'shrink-0 border-t bg-muted/10 transition-[height]',
							showConsole ? 'h-52' : 'h-11'
						)}
					>
						<div className='flex h-11 items-center gap-2 border-b px-3'>
							<Terminal className='size-4 text-muted-foreground' />
							<span className='text-xs font-medium'>Command bar</span>
							<span className='text-[10px] text-muted-foreground'>
								Raw RESP commands
							</span>
							<Button
								variant='ghost'
								size='sm'
								className='ml-auto'
								onClick={() => setShowConsole(!showConsole)}
							>
								{showConsole ? 'Hide' : 'Show'}
							</Button>
						</div>
						{showConsole && (
							<div className='grid h-[calc(100%-2.75rem)] grid-cols-[minmax(17rem,2fr)_minmax(14rem,1fr)]'>
								<form
									className='flex flex-col border-r p-3'
									onSubmit={submitCommand}
								>
									<div className='flex items-center gap-2'>
										<span className='font-mono text-sm font-bold text-[#d82c20]'>
											&gt;
										</span>
										<Input
											autoComplete='off'
											aria-label='Redis command'
											className='font-mono text-xs'
											placeholder='GET user:42'
											value={command}
											onChange={(event) => setCommand(event.target.value)}
										/>
										<Button type='submit' size='icon' disabled={isExecuting}>
											{isExecuting ? (
												<Loader2 className='animate-spin' />
											) : (
												<Play />
											)}
										</Button>
									</div>
									<p className='mt-2 pl-5 text-[10px] text-muted-foreground'>
										FLUSHDB and FLUSHALL require typed confirmation.
									</p>
								</form>
								<div className='overflow-auto p-2'>
									{history.length === 0 ? (
										<div className='grid h-full place-items-center text-xs text-muted-foreground'>
											Responses appear here
										</div>
									) : (
										history.map(function (item, index) {
											return (
												<button
													key={`${item.executedAt}-${index}`}
													type='button'
													className='mb-1 block w-full rounded border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-background'
													onClick={() => setCommand(item.command)}
												>
													<div className='flex items-center gap-2'>
														<span className='font-mono text-[10px] font-semibold text-[#d82c20]'>
															{commandName(item.command)}
														</span>
														<span className='ml-auto font-mono text-[9px] text-muted-foreground'>
															{item.durationMs?.toFixed(1)}ms
														</span>
													</div>
													<pre className='mt-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px]'>
														{typeof item.value === 'string'
															? item.value
															: JSON.stringify(item.value, null, 2)}
													</pre>
												</button>
											)
										})
									)}
								</div>
							</div>
						)}
					</section>
				</main>
			</div>

			<AlertDialog
				open={confirm !== null}
				onOpenChange={(open) => {
					if (!open) {
						setConfirm(null)
						setConfirmationText('')
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirm?.kind === 'delete'
								? 'Delete this key?'
								: 'Run a destructive command?'}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{confirm?.kind === 'delete' ? (
								<>
									This permanently deletes{' '}
									<code className='font-mono text-foreground'>{confirm.key}</code>
									. This action cannot be undone.
								</>
							) : (
								<>
									The command{' '}
									<code className='font-mono text-foreground'>
										{confirm?.command}
									</code>{' '}
									can permanently remove data. Type{' '}
									<strong className='text-foreground'>
										{confirm && commandName(confirm.command)}
									</strong>{' '}
									to continue.
								</>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{confirm?.kind === 'command' && (
						<Input
							autoFocus
							aria-label='Confirmation text'
							placeholder={commandName(confirm.command)}
							value={confirmationText}
							onChange={(event) =>
								setConfirmationText(event.target.value.toUpperCase())
							}
						/>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
							disabled={
								confirm?.kind === 'command' &&
								confirmationText !== commandName(confirm.command)
							}
							onClick={(event) => {
								event.preventDefault()
								if (confirm?.kind === 'delete') void deleteSelectedKey()
								else if (confirm?.kind === 'command')
									void execute(confirm.command, confirmationText)
							}}
						>
							{confirm?.kind === 'delete' ? 'Delete key' : 'Run command'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
