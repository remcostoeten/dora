import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, Loader2, LogOut, PlugZap, RefreshCw, Search } from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import type { XataAccount, XataDatabase } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { Label } from '@studio/shared/ui/label'
import { toast } from '@studio/shared/ui/notifier'
import { cn } from '@studio/shared/utils/cn'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import type { Connection } from '../../connections/types'
import {
	buildXataConnectionString,
	disconnectXata,
	getXataAccount,
	isXataConnected,
	saveXataToken
} from './xata-api'
import { useXataDatabases } from './use-xata-databases'
import { useIsTauri } from '@studio/core/data-provider'
import { DesktopOnlyNotice } from '@studio/core/platform'

type Props = {
	onComplete: (connection: Omit<Connection, 'id' | 'createdAt'>) => void
}

const TOKENS_URL = 'https://app.xata.io/settings'

export function XataConnectFlow({ onComplete }: Props) {
	const isTauri = useIsTauri()

	if (!isTauri) {
		return (
			<DesktopOnlyNotice
				title='Xata lives in the desktop app'
				description='Encrypted key storage and database discovery need the native app. Download Dora to connect your Xata Postgres databases.'
			/>
		)
	}

	return <XataConnectFlowInner onComplete={onComplete} />
}

function databaseKey(database: XataDatabase) {
	return `${database.workspaceId}/${database.databaseName}`
}

function XataConnectFlowInner({ onComplete }: Props) {
	const [isConnected, setIsConnected] = useState(false)
	const [account, setAccount] = useState<XataAccount | null>(null)
	const [tokenInput, setTokenInput] = useState('')
	const [isAuthorizing, setIsAuthorizing] = useState(false)
	const [authError, setAuthError] = useState<string | null>(null)
	const [query, setQuery] = useState('')
	const [selected, setSelected] = useState<XataDatabase | null>(null)
	const [isBuilding, setIsBuilding] = useState(false)
	const [tokenUrlCopied, setTokenUrlCopied] = useState(false)
	const tokenUrlCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const { databases, isLoading, error, refresh, reset } = useXataDatabases(isConnected)

	// Hydrate from a key stored in a previous session so a returning user lands
	// straight on the database picker.
	useEffect(function hydrateConnectionState() {
		let cancelled = false
		void isXataConnected().then(function (connected) {
			if (!cancelled) setIsConnected(connected)
		})
		return function () {
			cancelled = true
		}
	}, [])

	useEffect(function clearCopyTimeoutOnUnmount() {
		return function () {
			if (tokenUrlCopyTimeoutRef.current) {
				clearTimeout(tokenUrlCopyTimeoutRef.current)
			}
		}
	}, [])

	// Resolve which account the stored key belongs to, so the user can confirm
	// they're connected as the right one before picking a database.
	useEffect(
		function loadAccount() {
			if (!isConnected) {
				setAccount(null)
				return
			}
			let cancelled = false
			void getXataAccount()
				.then(function (resolved) {
					if (!cancelled) setAccount(resolved)
				})
				.catch(function () {
					if (!cancelled) setAccount(null)
				})
			return function () {
				cancelled = true
			}
		},
		[isConnected]
	)

	const accountLabel = useMemo(
		function deriveAccountLabel() {
			if (!account) return null
			const label = account.fullname?.trim() || account.email?.trim()
			return label || null
		},
		[account]
	)

	const filteredDatabases = useMemo(
		function filterDatabases() {
			const normalizedQuery = query.trim().toLowerCase()
			if (!normalizedQuery) return databases
			return databases.filter(function (database) {
				return (
					database.databaseName.toLowerCase().includes(normalizedQuery) ||
					database.workspaceName.toLowerCase().includes(normalizedQuery) ||
					database.region.toLowerCase().includes(normalizedQuery)
				)
			})
		},
		[databases, query]
	)

	// The selected database can't be connected over Postgres unless Xata reports
	// it as `postgresEnabled`.
	const selectedUnreachable = !!selected && !selected.postgresEnabled

	async function handleConnect() {
		const token = tokenInput.trim()
		if (!token) return
		setIsAuthorizing(true)
		setAuthError(null)
		try {
			await saveXataToken(token)
			setTokenInput('')
			setIsConnected(true)
			await refresh()
		} catch (error) {
			setAuthError(formatBackendError(error))
		} finally {
			setIsAuthorizing(false)
		}
	}

	async function handleDisconnect() {
		try {
			await disconnectXata()
			setIsConnected(false)
			setSelected(null)
			setQuery('')
			setTokenInput('')
			reset()
			toast('Xata disconnected', {
				description: 'Stored Xata credentials were removed.'
			})
		} catch (error) {
			setAuthError(formatBackendError(error))
		}
	}

	async function handleGenerateToken() {
		try {
			await open(TOKENS_URL)
		} catch (error) {
			toast.error('Could not open Xata', {
				description: 'Use Copy URL here and open it in your browser.'
			})
			console.error('Failed to open Xata settings page:', error)
		}
	}

	async function handleCopyTokenUrl() {
		try {
			await navigator.clipboard.writeText(TOKENS_URL)
			setTokenUrlCopied(true)
			if (tokenUrlCopyTimeoutRef.current) {
				clearTimeout(tokenUrlCopyTimeoutRef.current)
			}
			tokenUrlCopyTimeoutRef.current = setTimeout(function resetCopiedState() {
				setTokenUrlCopied(false)
			}, 1600)
		} catch (error) {
			toast.error('Could not copy URL', {
				description: TOKENS_URL
			})
			console.error('Failed to copy Xata settings URL:', error)
		}
	}

	async function handleCreateConnection() {
		if (!selected) return
		if (selectedUnreachable) {
			setAuthError(
				'This database isn’t reachable over Postgres. Enable the Postgres endpoint for it in the Xata dashboard, then Refresh.'
			)
			return
		}
		setIsBuilding(true)
		setAuthError(null)
		try {
			// The connection string is minted on-device — the API key stays in the
			// backend and is embedded as the Postgres password there. Branch defaults
			// to `main` (passed as null).
			const url = await buildXataConnectionString(
				selected.workspaceId,
				selected.region,
				selected.databaseName,
				null
			)
			onComplete({
				name: selected.databaseName || selected.workspaceName,
				type: 'postgres',
				url,
				ssl: true,
				status: 'idle'
			})
		} catch (error) {
			setAuthError(formatBackendError(error))
		} finally {
			setIsBuilding(false)
		}
	}

	return (
		<div className='min-h-0 space-y-4 border border-border/60 bg-card/35 p-4 shadow-sm'>
			<div className='flex items-start justify-between gap-3'>
				<div>
					<Label className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
						Xata
					</Label>
					{isConnected ? (
						<p className='mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/75'>
							<Check className='h-3.5 w-3.5 shrink-0 text-emerald-500' />
							{accountLabel ? (
								<span>
									Connected as{' '}
									<span className='font-medium text-foreground'>{accountLabel}</span>
								</span>
							) : (
								<span>Connected</span>
							)}
						</p>
					) : (
						<p className='mt-1 text-xs text-muted-foreground/75'>
							Add an API key to pick a database — Dora mints its Postgres connection
							string for you.
						</p>
					)}
				</div>
				{isConnected ? (
					<Button
						type='button'
						variant='outline'
						onClick={handleDisconnect}
						className='gap-2 border-border/70'
						title='Remove this Xata account connection so you can connect a different one'
					>
						<LogOut className='h-3.5 w-3.5' />
						Disconnect
					</Button>
				) : null}
			</div>

			{authError ? (
				<p className='border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300'>
					{authError}
				</p>
			) : null}

			{!isConnected ? (
				<div className='space-y-2'>
					<div className='flex flex-wrap items-center justify-between gap-2'>
						<Label htmlFor='xata-token' className='text-xs text-muted-foreground'>
							API key
						</Label>
						<div className='flex flex-wrap items-center justify-end gap-x-2 gap-y-1'>
							<button
								type='button'
								onClick={function () {
									void handleGenerateToken()
								}}
								className='inline-flex items-center gap-1 text-xs text-muted-foreground transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-foreground active:scale-[0.97]'
							>
								Generate one
								<ExternalLink className='h-3 w-3' />
							</button>
							<span className='h-3 w-px bg-border/70' aria-hidden />
							<button
								type='button'
								onClick={function () {
									void handleCopyTokenUrl()
								}}
								className='inline-flex items-center gap-1 text-xs text-muted-foreground transition-[color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-foreground active:scale-[0.97]'
							>
								{tokenUrlCopied ? (
									<Check className='h-3 w-3 text-emerald-500' />
								) : (
									<Copy className='h-3 w-3' />
								)}
								<span
									aria-live='polite'
									className='min-w-[8.75rem] transition-[opacity,filter] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]'
								>
									{tokenUrlCopied ? 'Copied' : "Doesn't work? Copy URL here"}
								</span>
							</button>
						</div>
					</div>
					<div className='flex gap-2'>
						<Input
							id='xata-token'
							type='password'
							value={tokenInput}
							onChange={function (event) {
								setTokenInput(event.target.value)
							}}
							onKeyDown={function (event) {
								if (event.key === 'Enter') {
									event.preventDefault()
									void handleConnect()
								}
							}}
							placeholder='Xata API key'
							autoComplete='off'
							className='h-9 bg-background/70'
						/>
						<Button
							type='button'
							onClick={handleConnect}
							disabled={isAuthorizing || !tokenInput.trim()}
							className='shrink-0 gap-2'
						>
							{isAuthorizing ? (
								<Loader2 className='h-3.5 w-3.5 animate-spin' />
							) : (
								<PlugZap className='h-3.5 w-3.5' />
							)}
							Connect
						</Button>
					</div>
					<p className='text-xs text-muted-foreground/70'>
						The key is validated, then encrypted and stored on this device only.
					</p>
				</div>
			) : (
				<div className='min-h-0 space-y-4'>
					<div className='flex items-center gap-2'>
						<div className='relative flex-1'>
							<Search className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
							<Input
								value={query}
								onChange={function (event) {
									setQuery(event.target.value)
								}}
								placeholder='Search Xata databases'
								className='h-9 bg-background/70 pl-9'
							/>
						</div>
						<Button
							type='button'
							variant='outline'
							onClick={function () {
								void refresh()
							}}
							disabled={isLoading}
							className='h-9 shrink-0 gap-1.5 border-border/70 px-3'
							title='Re-fetch databases from Xata'
						>
							<RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
							Refresh
						</Button>
					</div>

					<div className='max-h-[min(18rem,36vh)] space-y-2 overflow-y-auto pr-1'>
						{isLoading ? (
							<div className='flex items-center gap-2 py-3 text-sm text-muted-foreground'>
								<Loader2 className='h-3.5 w-3.5 animate-spin' />
								Loading databases
							</div>
						) : null}
						{error ? (
							<p className='border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300'>
								{error}
							</p>
						) : null}
						{!isLoading && !error && filteredDatabases.length === 0 ? (
							<p className='px-1 py-3 text-xs text-muted-foreground'>
								{databases.length === 0
									? 'No Xata databases found for this account. Create one in the Xata dashboard, then Refresh.'
									: 'No databases match your search.'}
							</p>
						) : null}
						{filteredDatabases.map(function (database) {
							const isSelected =
								selected?.workspaceId === database.workspaceId &&
								selected?.databaseName === database.databaseName
							return (
								<button
									key={databaseKey(database)}
									type='button'
									onClick={function () {
										setSelected(database)
										setAuthError(null)
									}}
									className={cn(
										'flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors',
										isSelected
											? 'border-emerald-500/45 bg-emerald-500/10'
											: 'border-border/60 bg-background/45 hover:border-border hover:bg-card/65'
									)}
								>
									<span className='min-w-0 flex-1'>
										<span className='block truncate text-sm font-medium text-foreground'>
											{database.databaseName}
										</span>
										<span className='block truncate text-xs text-muted-foreground'>
											{database.workspaceName} · {database.region}
											{database.postgresEnabled ? '' : ' · Postgres disabled'}
										</span>
									</span>
									{isSelected ? <Check className='h-4 w-4 text-emerald-500' /> : null}
								</button>
							)
						})}
					</div>

					{selected ? (
						<div
							data-xata-action-bar
							className='sticky bottom-0 z-10 -mx-4 -mb-4 space-y-3 border-t border-border/60 bg-card/95 px-4 py-3 shadow-[0_-18px_32px_-28px_hsl(var(--foreground)/0.45)] backdrop-blur'
						>
							{selectedUnreachable ? (
								<p className='text-[11px] text-muted-foreground/70'>
									Xata reports this database as not reachable over Postgres. Enable its
									Postgres endpoint in the dashboard, then Refresh.
								</p>
							) : null}
							<Button
								type='button'
								onClick={handleCreateConnection}
								disabled={isBuilding || selectedUnreachable}
								className='gap-2'
							>
								{isBuilding ? (
									<Loader2 className='h-3.5 w-3.5 animate-spin' />
								) : (
									<PlugZap className='h-3.5 w-3.5' />
								)}
								Create Xata Connection
							</Button>
						</div>
					) : null}
				</div>
			)}
		</div>
	)
}
