import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink, LogOut, PlugZap, RefreshCw, Search } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { open } from '@tauri-apps/plugin-shell'
import type { CloudflareAccount, CloudflareD1Database } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { Label } from '@studio/shared/ui/label'
import { toast } from '@studio/shared/ui/notifier'
import { cn } from '@studio/shared/utils/cn'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import type { Connection } from '../../connections/types'
import {
	disconnectCloudflare,
	getCloudflareAccount,
	isCloudflareConnected,
	listCloudflareAccounts,
	saveCloudflareToken
} from './cloudflare-api'
import { useCloudflareDatabases } from './use-cloudflare-databases'
import { useIsTauri } from '@studio/core/data-provider'
import { DesktopOnlyNotice } from '@studio/core/platform'

type Props = {
	onComplete: (connection: Omit<Connection, 'id' | 'createdAt'>) => void
}

const TOKENS_URL = 'https://dash.cloudflare.com/profile/api-tokens'

export function CloudflareConnectFlow({ onComplete }: Props) {
	const isTauri = useIsTauri()

	if (!isTauri) {
		return (
			<DesktopOnlyNotice
				title='Cloudflare D1 lives in the desktop app'
				description='Encrypted token storage and D1 discovery need the native app. Download Dora to connect your Cloudflare D1 databases.'
			/>
		)
	}

	return <CloudflareConnectFlowInner onComplete={onComplete} />
}

function CloudflareConnectFlowInner({ onComplete }: Props) {
	const [isConnected, setIsConnected] = useState(false)
	// The token the user pasted this session. D1 queries run over the REST API and
	// need this token on every call, so it's carried onto the connection's
	// `authToken`. It is empty when the user returns in a later session (the
	// stored token isn't exposed to JS); completing then asks them to reconnect.
	const [token, setToken] = useState('')
	const [accounts, setAccounts] = useState<CloudflareAccount[]>([])
	const [accountsLoading, setAccountsLoading] = useState(false)
	const [selectedAccount, setSelectedAccount] = useState<CloudflareAccount | null>(null)
	const [tokenInput, setTokenInput] = useState('')
	const [isAuthorizing, setIsAuthorizing] = useState(false)
	const [authError, setAuthError] = useState<string | null>(null)
	const [query, setQuery] = useState('')
	const [selected, setSelected] = useState<CloudflareD1Database | null>(null)
	const [tokenUrlCopied, setTokenUrlCopied] = useState(false)
	const tokenUrlCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const { databases, isLoading, error, refresh, reset } = useCloudflareDatabases(
		selectedAccount?.id ?? null
	)

	// Hydrate from a token stored in a previous session so a returning user lands
	// on the account picker instead of the paste step.
	useEffect(function hydrateConnectionState() {
		let cancelled = false
		void isCloudflareConnected().then(function (connected) {
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

	// Load the accounts the token can see once connected (also feeds the
	// "Connected as …" label).
	useEffect(
		function loadAccounts() {
			if (!isConnected) {
				setAccounts([])
				return
			}
			let cancelled = false
			setAccountsLoading(true)
			void listCloudflareAccounts()
				.then(function (resolved) {
					if (cancelled) return
					setAccounts(resolved)
					// Auto-select when there's exactly one account.
					if (resolved.length === 1) setSelectedAccount(resolved[0])
				})
				.catch(function (error) {
					if (!cancelled) setAuthError(formatBackendError(error))
				})
				.finally(function () {
					if (!cancelled) setAccountsLoading(false)
				})
			return function () {
				cancelled = true
			}
		},
		[isConnected]
	)

	const accountLabel = useMemo(
		function deriveAccountLabel() {
			const account = selectedAccount ?? accounts[0]
			if (!account) return null
			return account.name?.trim() || account.id
		},
		[selectedAccount, accounts]
	)

	const filteredDatabases = useMemo(
		function filterDatabases() {
			const normalizedQuery = query.trim().toLowerCase()
			if (!normalizedQuery) return databases
			return databases.filter(function (database) {
				return (
					database.name.toLowerCase().includes(normalizedQuery) ||
					database.uuid.toLowerCase().includes(normalizedQuery)
				)
			})
		},
		[databases, query]
	)

	async function handleConnect() {
		const pasted = tokenInput.trim()
		if (!pasted) return
		setIsAuthorizing(true)
		setAuthError(null)
		try {
			await saveCloudflareToken(pasted)
			setToken(pasted)
			setTokenInput('')
			setIsConnected(true)
		} catch (error) {
			setAuthError(formatBackendError(error))
		} finally {
			setIsAuthorizing(false)
		}
	}

	async function handleDisconnect() {
		try {
			await disconnectCloudflare()
			setIsConnected(false)
			setToken('')
			setAccounts([])
			setSelectedAccount(null)
			setSelected(null)
			setQuery('')
			setTokenInput('')
			reset()
			toast('Cloudflare disconnected', {
				description: 'Stored Cloudflare credentials were removed.'
			})
		} catch (error) {
			setAuthError(formatBackendError(error))
		}
	}

	async function handleRefreshAccounts() {
		setAccountsLoading(true)
		setAuthError(null)
		try {
			setAccounts(await getCloudflareAccount())
		} catch (error) {
			setAuthError(formatBackendError(error))
		} finally {
			setAccountsLoading(false)
		}
	}

	async function handleGenerateToken() {
		try {
			await open(TOKENS_URL)
		} catch (error) {
			toast.error('Could not open Cloudflare', {
				description: 'Use Copy URL here and open it in your browser.'
			})
			console.error('Failed to open Cloudflare API tokens page:', error)
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
			toast.error('Could not copy URL', { description: TOKENS_URL })
			console.error('Failed to copy Cloudflare API tokens URL:', error)
		}
	}

	function handleCreateConnection() {
		if (!selected || !selectedAccount) return
		if (!token) {
			setAuthError(
				'Reconnect your Cloudflare token to create this connection (the stored token is not exposed to the UI).'
			)
			return
		}
		onComplete({
			name: selected.name || selected.uuid,
			type: 'd1',
			url: `d1://${selectedAccount.id}/${selected.uuid}`,
			authToken: token,
			status: 'idle'
		})
	}

	return (
		<div className='min-h-0 space-y-4 border border-border/60 bg-card/35 p-4 shadow-sm'>
			<div className='flex items-start justify-between gap-3'>
				<div>
					<Label className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
						Cloudflare D1
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
							Add an API token to pick an account, then a D1 database.
						</p>
					)}
				</div>
				{isConnected ? (
					<Button
						type='button'
						variant='outline'
						onClick={handleDisconnect}
						className='gap-2 border-border/70'
						title='Remove this Cloudflare connection so you can connect a different one'
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
						<Label htmlFor='cloudflare-token' className='text-xs text-muted-foreground'>
							API token
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
							id='cloudflare-token'
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
							placeholder='Cloudflare API token'
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
								<Spinner className='h-3.5 w-3.5' />
							) : (
								<PlugZap className='h-3.5 w-3.5' />
							)}
							Connect
						</Button>
					</div>
					<p className='text-xs text-muted-foreground/70'>
						Use a token with the <span className='font-medium'>D1 - Edit</span>{' '}
						permission. It is validated, then encrypted and stored on this device only.
					</p>
				</div>
			) : !selectedAccount ? (
				<div className='min-h-0 space-y-3'>
					<div className='flex items-center justify-between gap-2'>
						<Label className='text-xs text-muted-foreground'>Pick an account</Label>
						<Button
							type='button'
							variant='outline'
							onClick={function () {
								void handleRefreshAccounts()
							}}
							disabled={accountsLoading}
							className='h-8 shrink-0 gap-1.5 border-border/70 px-3'
							title='Re-fetch accounts from Cloudflare'
						>
							<RefreshCw className={cn('h-3.5 w-3.5', accountsLoading && 'animate-spin')} />
							Refresh
						</Button>
					</div>
					<div className='max-h-[min(18rem,36vh)] space-y-2 overflow-y-auto pr-1'>
						{accountsLoading ? (
							<div className='flex items-center gap-2 py-3 text-sm text-muted-foreground'>
								<Spinner className='h-3.5 w-3.5' />
								Loading accounts
							</div>
						) : null}
						{!accountsLoading && accounts.length === 0 ? (
							<p className='px-1 py-3 text-xs text-muted-foreground'>
								No Cloudflare accounts visible to this token.
							</p>
						) : null}
						{accounts.map(function (account) {
							return (
								<button
									key={account.id}
									type='button'
									onClick={function () {
										setSelectedAccount(account)
										setAuthError(null)
									}}
									className='flex w-full items-center gap-3 border border-border/60 bg-background/45 px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-card/65'
								>
									<span className='min-w-0 flex-1'>
										<span className='block truncate text-sm font-medium text-foreground'>
											{account.name || account.id}
										</span>
										<span className='block truncate text-xs text-muted-foreground'>
											{account.id}
										</span>
									</span>
								</button>
							)
						})}
					</div>
				</div>
			) : (
				<div className='min-h-0 space-y-4'>
					<div className='flex items-center gap-2'>
						{accounts.length > 1 ? (
							<Button
								type='button'
								variant='outline'
								onClick={function () {
									setSelectedAccount(null)
									setSelected(null)
									setQuery('')
								}}
								className='h-9 shrink-0 gap-1.5 border-border/70 px-3'
								title='Pick a different account'
							>
								<ArrowLeft className='h-3.5 w-3.5' />
								Accounts
							</Button>
						) : null}
						<div className='relative flex-1'>
							<Search className='pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
							<Input
								value={query}
								onChange={function (event) {
									setQuery(event.target.value)
								}}
								placeholder='Search D1 databases'
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
							title='Re-fetch D1 databases from Cloudflare'
						>
							<RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
							Refresh
						</Button>
					</div>

					<div className='max-h-[min(18rem,36vh)] space-y-2 overflow-y-auto pr-1'>
						{isLoading ? (
							<div className='flex items-center gap-2 py-3 text-sm text-muted-foreground'>
								<Spinner className='h-3.5 w-3.5' />
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
									? 'No D1 databases in this account. Create one in the Cloudflare dashboard, then Refresh.'
									: 'No databases match your search.'}
							</p>
						) : null}
						{filteredDatabases.map(function (database) {
							const isSelected = selected?.uuid === database.uuid
							return (
								<button
									key={database.uuid}
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
											{database.name}
										</span>
										<span className='block truncate text-xs text-muted-foreground'>
											{database.uuid}
										</span>
									</span>
									{isSelected ? <Check className='h-4 w-4 text-emerald-500' /> : null}
								</button>
							)
						})}
					</div>

					{selected ? (
						<div className='sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-border/60 bg-card/95 px-4 py-3 shadow-[0_-18px_32px_-28px_hsl(var(--foreground)/0.45)] backdrop-blur'>
							<Button type='button' onClick={handleCreateConnection} className='gap-2'>
								<PlugZap className='h-3.5 w-3.5' />
								Create D1 Connection
							</Button>
						</div>
					) : null}
				</div>
			)}
		</div>
	)
}
