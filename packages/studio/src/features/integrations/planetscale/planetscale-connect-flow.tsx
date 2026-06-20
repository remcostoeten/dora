import { useEffect, useMemo, useRef, useState } from 'react'
import {
	Check,
	ChevronLeft,
	Copy,
	ExternalLink,
	GitBranch,
	Loader2,
	LogOut,
	PlugZap,
	RefreshCw,
	Search
} from 'lucide-react'
import { open } from '@tauri-apps/plugin-shell'
import type {
	PlanetscaleBranch,
	PlanetscaleDatabase,
	PlanetscaleOrganization
} from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { Input } from '@studio/shared/ui/input'
import { Label } from '@studio/shared/ui/label'
import { toast } from '@studio/shared/ui/notifier'
import { cn } from '@studio/shared/utils/cn'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import type { Connection } from '../../connections/types'
import {
	createPlanetscalePassword,
	disconnectPlanetscale,
	getPlanetscaleAccount,
	isPlanetscaleConnected,
	listPlanetscaleBranches,
	savePlanetscaleToken
} from './planetscale-api'
import { usePlanetscaleDatabases } from './use-planetscale-databases'
import { useIsTauri } from '@studio/core/data-provider'
import { DesktopOnlyNotice } from '@studio/core/platform'

type Props = {
	onComplete: (connection: Omit<Connection, 'id' | 'createdAt'>) => void
}

const TOKENS_URL = 'https://app.planetscale.com/settings/service-tokens'

// PlanetScale speaks the MySQL wire protocol and requires TLS. The MySQL adapter
// (mysql_async) only enables TLS via `?require_ssl=true` — it rejects the
// Postgres-style `sslmode=require`. So we build the URL with `require_ssl=true`
// here and hand back a `url` rather than discrete fields (which the connection
// mapper would otherwise turn into a broken `sslmode=require` URL).
function buildMysqlUrl(args: {
	host: string
	user: string
	password: string
	database: string
}): string {
	const user = encodeURIComponent(args.user)
	const password = encodeURIComponent(args.password)
	const database = encodeURIComponent(args.database)
	return `mysql://${user}:${password}@${args.host}:3306/${database}?require_ssl=true`
}

export function PlanetscaleConnectFlow({ onComplete }: Props) {
	const isTauri = useIsTauri()

	if (!isTauri) {
		return (
			<DesktopOnlyNotice
				title='PlanetScale lives in the desktop app'
				description='Encrypted token storage, database discovery, and password minting need the native app. Download Dora to connect your PlanetScale databases.'
			/>
		)
	}

	return <PlanetscaleConnectFlowInner onComplete={onComplete} />
}

function PlanetscaleConnectFlowInner({ onComplete }: Props) {
	const [isConnected, setIsConnected] = useState(false)
	const [organization, setOrganization] = useState<PlanetscaleOrganization | null>(null)
	const [tokenInput, setTokenInput] = useState('')
	const [isAuthorizing, setIsAuthorizing] = useState(false)
	const [authError, setAuthError] = useState<string | null>(null)
	const [query, setQuery] = useState('')
	const [selectedDatabase, setSelectedDatabase] = useState<PlanetscaleDatabase | null>(null)
	const [branches, setBranches] = useState<PlanetscaleBranch[]>([])
	const [isLoadingBranches, setIsLoadingBranches] = useState(false)
	const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
	const [isBuilding, setIsBuilding] = useState(false)
	const [tokenUrlCopied, setTokenUrlCopied] = useState(false)
	const tokenUrlCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const organizationName = organization?.name ?? null
	const { databases, isLoading, error, refresh, reset } = usePlanetscaleDatabases(
		isConnected,
		organizationName
	)

	// Hydrate from a token stored in a previous session so a returning user lands
	// straight on the database picker.
	useEffect(function hydrateConnectionState() {
		let cancelled = false
		void isPlanetscaleConnected().then(function (connected) {
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

	// Resolve which organization the stored token belongs to, so the user can
	// confirm they're connected as the right account before picking a database.
	useEffect(
		function loadAccount() {
			if (!isConnected) {
				setOrganization(null)
				return
			}
			let cancelled = false
			void getPlanetscaleAccount()
				.then(function (orgs) {
					if (!cancelled) setOrganization(orgs[0] ?? null)
				})
				.catch(function () {
					if (!cancelled) setOrganization(null)
				})
			return function () {
				cancelled = true
			}
		},
		[isConnected]
	)

	const accountLabel = useMemo(
		function deriveAccountLabel() {
			return organization?.name?.trim() || null
		},
		[organization]
	)

	const filteredDatabases = useMemo(
		function filterDatabases() {
			const normalizedQuery = query.trim().toLowerCase()
			if (!normalizedQuery) return databases
			return databases.filter(function (database) {
				return database.name.toLowerCase().includes(normalizedQuery)
			})
		},
		[databases, query]
	)

	async function handleConnect() {
		const token = tokenInput.trim()
		if (!token) return
		setIsAuthorizing(true)
		setAuthError(null)
		try {
			await savePlanetscaleToken(token)
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
			await disconnectPlanetscale()
			setIsConnected(false)
			setOrganization(null)
			setSelectedDatabase(null)
			setSelectedBranch(null)
			setBranches([])
			setQuery('')
			setTokenInput('')
			reset()
			toast('PlanetScale disconnected', {
				description: 'Stored PlanetScale credentials were removed.'
			})
		} catch (error) {
			setAuthError(formatBackendError(error))
		}
	}

	async function handleSelectDatabase(database: PlanetscaleDatabase) {
		if (!organizationName) return
		setSelectedDatabase(database)
		setSelectedBranch(null)
		setBranches([])
		setAuthError(null)
		setIsLoadingBranches(true)
		try {
			const list = await listPlanetscaleBranches(
				organizationName,
				database.name,
				database.defaultBranch
			)
			setBranches(list)
			// Preselect the default branch so the common case is one click.
			const preferred = list.find(function (branch) {
				return branch.isDefault
			})
			setSelectedBranch(preferred?.name ?? list[0]?.name ?? null)
		} catch (error) {
			setAuthError(formatBackendError(error))
		} finally {
			setIsLoadingBranches(false)
		}
	}

	function handleBackToDatabases() {
		setSelectedDatabase(null)
		setSelectedBranch(null)
		setBranches([])
		setAuthError(null)
	}

	async function handleGenerateToken() {
		try {
			await open(TOKENS_URL)
		} catch (error) {
			toast.error('Could not open PlanetScale', {
				description: 'Use Copy URL here and open it in your browser.'
			})
			console.error('Failed to open PlanetScale service tokens page:', error)
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
			console.error('Failed to copy PlanetScale service tokens URL:', error)
		}
	}

	async function handleCreateConnection() {
		if (!organizationName || !selectedDatabase || !selectedBranch) return
		setIsBuilding(true)
		setAuthError(null)
		try {
			const credential = await createPlanetscalePassword(
				organizationName,
				selectedDatabase.name,
				selectedBranch
			)
			const url = buildMysqlUrl({
				host: credential.host,
				user: credential.username,
				password: credential.password,
				database: selectedDatabase.name
			})
			onComplete({
				name: `${selectedDatabase.name}/${selectedBranch}`,
				type: 'mysql',
				url,
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
						PlanetScale
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
							Add a service token to pick a database — Dora mints the MySQL
							password for you.
						</p>
					)}
				</div>
				{isConnected ? (
					<Button
						type='button'
						variant='outline'
						onClick={handleDisconnect}
						className='gap-2 border-border/70'
						title='Remove this PlanetScale account connection so you can connect a different one'
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
						<Label htmlFor='planetscale-token' className='text-xs text-muted-foreground'>
							Service token
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
							id='planetscale-token'
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
							placeholder='<token-id>:<token>'
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
						Create a service token with the read_databases, read_branch, and
						create_password scopes. It is validated, then encrypted and stored on this
						device only.
					</p>
				</div>
			) : selectedDatabase ? (
				<div className='min-h-0 space-y-4'>
					<div className='flex items-center justify-between gap-2'>
						<button
							type='button'
							onClick={handleBackToDatabases}
							className='inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
						>
							<ChevronLeft className='h-3.5 w-3.5' />
							Databases
						</button>
						<span className='truncate text-xs font-medium text-foreground'>
							{selectedDatabase.name}
						</span>
					</div>

					<div className='space-y-1.5'>
						<Label className='text-xs text-muted-foreground'>Branch</Label>
						<div className='max-h-[min(14rem,28vh)] space-y-2 overflow-y-auto pr-1'>
							{isLoadingBranches ? (
								<div className='flex items-center gap-2 py-3 text-sm text-muted-foreground'>
									<Loader2 className='h-3.5 w-3.5 animate-spin' />
									Loading branches
								</div>
							) : null}
							{!isLoadingBranches && branches.length === 0 ? (
								<p className='px-1 py-3 text-xs text-muted-foreground'>
									No branches found for this database.
								</p>
							) : null}
							{branches.map(function (branch) {
								const isSelected = selectedBranch === branch.name
								return (
									<button
										key={branch.name}
										type='button'
										onClick={function () {
											setSelectedBranch(branch.name)
											setAuthError(null)
										}}
										className={cn(
											'flex w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors',
											isSelected
												? 'border-emerald-500/45 bg-emerald-500/10'
												: 'border-border/60 bg-background/45 hover:border-border hover:bg-card/65'
										)}
									>
										<GitBranch className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
										<span className='min-w-0 flex-1'>
											<span className='block truncate text-sm font-medium text-foreground'>
												{branch.name}
											</span>
											<span className='block truncate text-xs text-muted-foreground'>
												{branch.isDefault
													? 'Default branch'
													: branch.production
														? 'Production'
														: 'Development'}
											</span>
										</span>
										{isSelected ? (
											<Check className='h-4 w-4 text-emerald-500' />
										) : null}
									</button>
								)
							})}
						</div>
					</div>

					{selectedBranch ? (
						<div className='sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-border/60 bg-card/95 px-4 py-3 shadow-[0_-18px_32px_-28px_hsl(var(--foreground)/0.45)] backdrop-blur'>
							<Button
								type='button'
								onClick={handleCreateConnection}
								disabled={isBuilding}
								className='gap-2'
							>
								{isBuilding ? (
									<Loader2 className='h-3.5 w-3.5 animate-spin' />
								) : (
									<PlugZap className='h-3.5 w-3.5' />
								)}
								Create PlanetScale Connection
							</Button>
						</div>
					) : null}
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
								placeholder='Search PlanetScale databases'
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
							title='Re-fetch databases from PlanetScale'
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
									? 'No PlanetScale databases found for this account. Create one in the PlanetScale dashboard, then Refresh.'
									: 'No databases match your search.'}
							</p>
						) : null}
						{filteredDatabases.map(function (database) {
							return (
								<button
									key={database.name}
									type='button'
									onClick={function () {
										void handleSelectDatabase(database)
									}}
									className='flex w-full items-center gap-3 border border-border/60 bg-background/45 px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-card/65'
								>
									<span className='min-w-0 flex-1'>
										<span className='block truncate text-sm font-medium text-foreground'>
											{database.name}
										</span>
										<span className='block truncate text-xs text-muted-foreground'>
											Default branch: {database.defaultBranch || 'unknown'}
										</span>
									</span>
								</button>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}
