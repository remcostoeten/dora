import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
	Loader2,
	CheckCircle2,
	XCircle,
	DatabaseZap,
	FileSpreadsheet,
	Info,
	X,
	Monitor
} from 'lucide-react'
import { commands, DatabaseInfo } from '@studio/lib/bindings'
import { useIsTauri } from '@studio/core/data-provider'
import { isDesktopOnlyError } from '@studio/core/platform/runtime'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import { cn } from '@studio/shared/utils/cn'
import { Button } from '@studio/shared/ui/button'
import { toast } from '@studio/shared/ui/notifier'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription
} from '@studio/shared/ui/dialog'
import { Input } from '@studio/shared/ui/input'
import { Label } from '@studio/shared/ui/label'
import { SupabaseConnectFlow } from '@studio/features/integrations/supabase/supabase-connect-flow'
import { TursoConnectFlow } from '@studio/features/integrations/turso/turso-connect-flow'
import { NeonConnectFlow } from '@studio/features/integrations/neon/neon-connect-flow'
import { VercelConnectFlow } from '@studio/features/integrations/vercel/vercel-connect-flow'
import { Connection, DatabaseType, SshAuthMethod, SshTunnelConfig } from '../types'
import { getSourceCaps } from '../source-caps'
import {
	sanitizeConnectionUrl,
	isValidConnectionUrl,
	detectProviderName,
	parseConnectionUrl,
	buildConnectionString,
	hasPostgresPoolerMode,
	setPostgresPoolerMode,
	isFlyPublicHost,
	PROVIDER_CONFIGS
} from '../utils/providers'
import { validateConnection } from '../validation'
import { ConnectionForm } from './connection-dialog/connection-form'
import { DatabaseTypeSelector, type ProviderKey } from './connection-dialog/database-type-selector'
import { DatabaseIcon, DATABASE_META } from './database-icons'
import { classifyDroppedPaths, connectionNameFromPath } from '../utils/data-files'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSave: (connection: Omit<Connection, 'id' | 'createdAt'>) => void
	/** Opens data files — with paths from a drop, or opens the picker when omitted. */
	onOpenDataFiles?: (paths?: string[]) => void | Promise<void>
	/** Resolve `.db` and other ambiguous database files via header probing. */
	resolveDatabaseType?: (path: string) => Promise<DatabaseType>
	droppedFilePaths?: string[] | null
	externalDropActive?: boolean
	onDroppedFilePathsHandled?: () => void
	initialValues?: Connection
}

export function ConnectionDialog({
	open,
	onOpenChange,
	onSave,
	onOpenDataFiles,
	resolveDatabaseType,
	droppedFilePaths,
	externalDropActive = false,
	onDroppedFilePathsHandled,
	initialValues
}: Props) {
	const [formData, setFormData] = useState<Partial<Connection>>({
		type: 'postgres',
		host: 'localhost',
		port: 5432,
		user: 'postgres',
		database: 'postgres',
		ssl: false,
		poolerMode: false,
		sshConfig: {
			enabled: false,
			host: '',
			port: 22,
			username: '',
			authMethod: 'password' as SshAuthMethod,
			password: '',
			privateKeyPath: ''
		},
		...initialValues
	})

	const [isTesting, setIsTesting] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle')
	const [testMessage, setTestMessage] = useState('')
	const [useConnectionString, setUseConnectionString] = useState(false)
	const [validationError, setValidationError] = useState<{
		field?: string
		message?: string
	} | null>(null)
	const [isDropTargetActive, setIsDropTargetActive] = useState(false)
	const [flyHintDismissed, setFlyHintDismissed] = useState(false)
	// Provider integrations (Supabase, Turso) aren't real DatabaseTypes — they
	// resolve to an engine connection but live outside formData.type. When one is
	// active, the standard form is swapped for that provider's connect flow.
	const [selectedIntegration, setSelectedIntegration] = useState<
		'supabase' | 'turso' | 'neon' | 'vercel' | null
	>(null)
	const supabaseSelected = selectedIntegration === 'supabase'
	const tursoSelected = selectedIntegration === 'turso'
	const vercelSelected = selectedIntegration === 'vercel'
	const integrationSelected = selectedIntegration !== null
	const [showDesktopOnlyHint, setShowDesktopOnlyHint] = useState(false)
	const isTauri = useIsTauri()
	const showDropOverlay = isDropTargetActive || externalDropActive

	const applyDatabaseFile = useCallback(
		async function applyDatabaseFile(path: string) {
			const type = resolveDatabaseType
				? await resolveDatabaseType(path)
				: path.toLowerCase().endsWith('.duckdb')
					? 'duckdb'
					: 'sqlite'

			setFormData(function (prev) {
				return {
					...prev,
					type,
					url: path,
					name: prev.name && prev.name !== '' ? prev.name : connectionNameFromPath(path),
					fileSources: undefined
				}
			})
			setUseConnectionString(false)
			setTestStatus('idle')
			setTestMessage('')
		},
		[resolveDatabaseType]
	)

	useEffect(
		function handleDroppedFiles() {
			if (!open || !droppedFilePaths?.length) return

			void (async function () {
				const { dataFiles, databaseFiles, unsupported } =
					classifyDroppedPaths(droppedFilePaths)

				if (unsupported.length > 0) {
					toast.error('Unsupported file type', {
						description: unsupported
							.map(function (p) {
								return p.split(/[\\/]/).pop() ?? p
							})
							.join(', ')
					})
				}

				if (dataFiles.length > 0 && databaseFiles.length > 0) {
					toast.error('Drop one kind at a time', {
						description:
							'Drop either data files (CSV, Parquet, JSON) or a database file, not both.'
					})
					onDroppedFilePathsHandled?.()
					return
				}

				if (dataFiles.length > 0) {
					onDroppedFilePathsHandled?.()
					if (onOpenDataFiles) {
						await onOpenDataFiles(dataFiles)
					}
					return
				}

				if (databaseFiles.length > 1) {
					toast.error('One database file at a time', {
						description:
							'Drop a single SQLite or DuckDB file to pre-fill this connection.'
					})
					onDroppedFilePathsHandled?.()
					return
				}

				if (databaseFiles.length === 1) {
					await applyDatabaseFile(databaseFiles[0])
					onDroppedFilePathsHandled?.()
					return
				}

				onDroppedFilePathsHandled?.()
			})()
		},
		[open, droppedFilePaths, onDroppedFilePathsHandled, onOpenDataFiles, applyDatabaseFile]
	)

	useEffect(
		function resetFormOnOpen() {
			if (open) {
				const initialCaps = initialValues
					? getSourceCaps({
							type: initialValues.type ?? 'postgres',
							fileSources: initialValues.fileSources,
							url: initialValues.url
						})
					: null
				const hasUrl = !!initialValues?.url && !!initialCaps?.supportsSshTunnel
				setFormData({
					type: 'postgres',
					host: 'localhost',
					port: 5432,
					user: 'postgres',
					database: 'postgres',
					ssl: false,
					poolerMode: false,
					...initialValues
				})
				setUseConnectionString(!!hasUrl)
				setFlyHintDismissed(false)
				setSelectedIntegration(null)
				setTestStatus('idle')
				setTestMessage('')
			}
		},
		[open, initialValues]
	)

	useEffect(
		function handleClipboardPaste() {
			if (!open) return

			function handlePaste(e: ClipboardEvent) {
				const pastedText = e.clipboardData?.getData('text')
				if (!pastedText) return

				const sanitized = sanitizeConnectionUrl(pastedText)
				if (!isValidConnectionUrl(sanitized)) return

				e.preventDefault()

				// Switch the form to the provider the URL belongs to, so the
				// matching section (e.g. libSQL's Auth Token field) is shown
				// without the user having to click the provider tab first.
				const detectedType = parseConnectionUrl(sanitized)?.type

				setFormData(function (prev) {
					const nextType = detectedType ?? prev.type
					const updates: Partial<Connection> = {
						type: nextType,
						url: sanitized,
						host: undefined,
						port: undefined,
						user: undefined,
						password: undefined,
						database: undefined,
						ssl: undefined
					}
					if (updates.url && (nextType === 'postgres' || nextType === 'cockroach')) {
						updates.poolerMode = hasPostgresPoolerMode(updates.url)
					}

					if (!prev.name || prev.name === '') {
						updates.name = detectProviderName(sanitized)
					}

					return { ...prev, ...updates }
				})
				// Host/port providers use the connection-string toggle; file/token
				// providers (sqlite/libsql) have their own dedicated fields.
				setUseConnectionString(
					detectedType
						? getSourceCaps({ type: detectedType, url: sanitized }).supportsSshTunnel
						: false
				)

				// After libSQL switches in, move focus to the Auth Token field so
				// the user can paste their token straight away.
				if (detectedType === 'libsql') {
					requestAnimationFrame(function () {
						const tokenInput = document.getElementById('libsql-token')
						if (tokenInput instanceof HTMLInputElement) {
							tokenInput.focus()
						}
					})
				}
			}

			document.addEventListener('paste', handlePaste)
			return function cleanup() {
				document.removeEventListener('paste', handlePaste)
			}
		},
		[open]
	)

	function updateField(field: keyof Connection, value: unknown) {
		setFormData(function (prev) {
			const newData = { ...prev, [field]: value }

			if (field === 'type') {
				const newType = value as DatabaseType
				const config = PROVIDER_CONFIGS[newType]
				if (config.defaultPort > 0) {
					newData.port = config.defaultPort
				}
				newData.user = config.defaultUser || undefined
				newData.database = config.defaultDatabase || undefined
			}

			return newData
		})
		setTestStatus('idle')
		// Clear validation error for this field
		if (validationError?.field === field) {
			setValidationError(null)
		}
	}

	function handleProviderSelect(key: ProviderKey) {
		if (key === 'files') {
			// Not a real engine — opens flat files as a read-only DuckDB
			// connection via the native picker. Leaves formData.type untouched.
			void onOpenDataFiles?.()
			return
		}
		if (key === 'supabase' || key === 'turso' || key === 'neon' || key === 'vercel') {
			setSelectedIntegration(key)
			setTestStatus('idle')
			return
		}
		setSelectedIntegration(null)
		updateField('type', key)
		const caps = getSourceCaps({
			type: key,
			fileSources: formData.fileSources,
			url: formData.url
		})
		if (!caps.supportsSshTunnel) {
			setUseConnectionString(false)
		}
	}

	async function handleTestConnection(e: React.MouseEvent) {
		e.preventDefault()

		if (!isTauri) {
			setShowDesktopOnlyHint(true)
			setTestStatus('idle')
			setTestMessage('')
			window.setTimeout(function resetDesktopHint() {
				setShowDesktopOnlyHint(false)
			}, 2600)
			return
		}

		setIsTesting(true)
		setTestStatus('idle')
		setTestMessage('')

		try {
			let databaseInfo: DatabaseInfo

			if (formData.type === 'sqlite') {
				if (!formData.url) {
					setTestStatus('error')
					setTestMessage('Database path is required')
					setIsTesting(false)
					return
				}
				databaseInfo = { SQLite: { db_path: formData.url } }
			} else if (formData.type === 'duckdb') {
				if (!formData.url) {
					setTestStatus('error')
					setTestMessage('Database path is required')
					setIsTesting(false)
					return
				}
				databaseInfo = { DuckDB: { db_path: formData.url } }
			} else if (formData.type === 'libsql') {
				if (!formData.url) {
					setTestStatus('error')
					setTestMessage('Database URL is required')
					setIsTesting(false)
					return
				}
				databaseInfo = {
					LibSQL: {
						url: formData.url,
						auth_token: formData.authToken || null
					}
				}
			} else {
				let connectionString: string

				if (useConnectionString && formData.url) {
					connectionString = formData.url
				} else {
					if (!formData.host) {
						setTestStatus('error')
						setTestMessage('Host is required')
						setIsTesting(false)
						return
					}

					if (!formData.user) {
						setTestStatus('error')
						setTestMessage('Username is required')
						setIsTesting(false)
						return
					}

					if (!formData.database) {
						setTestStatus('error')
						setTestMessage('Database name is required')
						setIsTesting(false)
						return
					}

					connectionString = buildConnectionString({
						type: formData.type as DatabaseType,
						host: formData.host,
						port: formData.port,
						user: formData.user,
						password: formData.password,
						database: formData.database,
						ssl: formData.ssl
					})
				}

				const sshConfig = formData.sshConfig?.enabled
					? {
							host: formData.sshConfig.host,
							port: formData.sshConfig.port,
							username: formData.sshConfig.username,
							private_key_path:
								formData.sshConfig.authMethod === 'keyfile'
									? formData.sshConfig.privateKeyPath || null
									: null,
							password:
								formData.sshConfig.authMethod === 'password'
									? formData.sshConfig.password || null
									: null
						}
					: null

				if (formData.sshConfig?.enabled) {
					// Basic validation for SSH config
					if (!sshConfig?.host) {
						setTestStatus('error')
						setTestMessage('SSH Host is required')
						setIsTesting(false)
						return
					}
					if (!sshConfig?.username) {
						setTestStatus('error')
						setTestMessage('SSH Username is required')
						setIsTesting(false)
						return
					}
				}

				if (formData.type === 'mysql') {
					databaseInfo = {
						MySQL: {
							connection_string: connectionString,
							ssh_config: sshConfig
						}
					}
				} else if (formData.type === 'mariadb') {
					databaseInfo = {
						MariaDB: {
							connection_string: connectionString,
							ssh_config: sshConfig
						}
					}
				} else if (formData.type === 'cockroach') {
					connectionString = setPostgresPoolerMode(
						connectionString,
						formData.poolerMode ?? false
					)
					databaseInfo = {
						CockroachDB: {
							connection_string: connectionString,
							ssh_config: sshConfig
						}
					}
				} else {
					connectionString = setPostgresPoolerMode(
						connectionString,
						formData.poolerMode ?? false
					)
					databaseInfo = {
						Postgres: {
							connection_string: connectionString,
							ssh_config: sshConfig
						}
					}
				}
			}

			const result = await commands.testConnection(databaseInfo, initialValues?.id ?? null)

			if (result.status === 'ok' && result.data) {
				setTestStatus('success')
				setTestMessage('Connection successful!')
			} else {
				setTestStatus('error')
				let errorMsg = 'Connection failed'

				if (result.status === 'error') {
					errorMsg = formatBackendError(result.error)
				}

				setTestMessage(errorMsg)
			}
		} catch (error) {
			if (isDesktopOnlyError(error)) {
				setShowDesktopOnlyHint(true)
				setTestStatus('idle')
				setTestMessage('')
				window.setTimeout(function resetDesktopHint() {
					setShowDesktopOnlyHint(false)
				}, 2600)
				return
			}

			setTestStatus('error')
			let errorMsg = 'Unexpected error'
			if (error instanceof Error) {
				errorMsg = error.message
			}
			setTestMessage(errorMsg)
		} finally {
			setIsTesting(false)
		}
	}

	function handleSave() {
		const validation = validateConnection(
			formData as Record<string, unknown>,
			useConnectionString
		)

		if (!validation.success) {
			setValidationError({ field: validation.field, message: validation.error })
			return
		}

		setValidationError(null)
		setIsSaving(true)
		setTimeout(function () {
			setIsSaving(false)
			onSave(formData as Omit<Connection, 'id' | 'createdAt'>)
			onOpenChange(false)
		}, 400)
	}

	async function handleBrowseFile() {
		if (!isTauri) {
			setShowDesktopOnlyHint(true)
			window.setTimeout(function resetDesktopHint() {
				setShowDesktopOnlyHint(false)
			}, 2600)
			return
		}

		try {
			const result = await commands.openSqliteDb()
			if (result.status === 'ok' && result.data) {
				updateField('url', result.data)
			}
		} catch (error) {
			console.error('Failed to open file picker:', error)
			toast.error('Failed to open file picker', {
				description: error instanceof Error ? error.message : String(error)
			})
		}
	}

	const selectedProvider = DATABASE_META[formData.type || 'postgres']

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className='flex max-h-[min(calc(100vh-2rem),880px)] flex-col gap-0 overflow-hidden rounded-none border-border/70 bg-background p-0 shadow-2xl sm:max-w-[640px] [&_input]:rounded-none [&_button]:rounded-none'
				onDragEnter={function (e) {
					if (!onOpenDataFiles && !resolveDatabaseType) return
					e.preventDefault()
					setIsDropTargetActive(true)
				}}
				onDragOver={function (e) {
					if (!onOpenDataFiles && !resolveDatabaseType) return
					e.preventDefault()
					setIsDropTargetActive(true)
				}}
				onDragLeave={function (e) {
					if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
					setIsDropTargetActive(false)
				}}
				onDrop={function (e) {
					setIsDropTargetActive(false)
					if (!onOpenDataFiles && !resolveDatabaseType) return
					e.preventDefault()
					e.stopPropagation()
					const paths = Array.from(e.dataTransfer.files)
						.map(function (file) {
							const withPath = file as File & { path?: string }
							return withPath.path ?? ''
						})
						.filter(Boolean)
					if (paths.length === 0) return
					void (async function () {
						const { dataFiles, databaseFiles, unsupported } =
							classifyDroppedPaths(paths)

						if (unsupported.length > 0) {
							toast.error('Unsupported file type', {
								description: unsupported
									.map(function (p) {
										return p.split(/[\\/]/).pop() ?? p
									})
									.join(', ')
							})
						}

						if (dataFiles.length > 0 && databaseFiles.length > 0) {
							toast.error('Drop one kind at a time', {
								description:
									'Drop either data files (CSV, Parquet, JSON) or a database file, not both.'
							})
							return
						}

						if (dataFiles.length > 0) {
							if (onOpenDataFiles) await onOpenDataFiles(dataFiles)
							return
						}

						if (databaseFiles.length > 1) {
							toast.error('One database file at a time', {
								description:
									'Drop a single SQLite or DuckDB file to pre-fill this connection.'
							})
							return
						}

						if (databaseFiles.length === 1) {
							await applyDatabaseFile(databaseFiles[0])
						}
					})()
				}}
			>
				{showDropOverlay ? (
					<div className='pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-[hsl(48_72%_52%)]/70 bg-background/85 backdrop-blur-[1px]'>
						<div className='flex flex-col items-center gap-2 px-6 text-center'>
							<FileSpreadsheet
								className='h-8 w-8 text-[hsl(48_72%_52%)]'
								strokeWidth={1.8}
							/>
							<p className='text-sm font-medium text-foreground'>
								Drop to detect file type
							</p>
							<p className='text-xs text-muted-foreground'>
								CSV, Parquet, JSON, SQLite, DuckDB, and related database files
							</p>
						</div>
					</div>
				) : null}
				<DialogHeader className='border-b border-border/50 px-6 py-5 pr-12'>
					<div className='flex items-start gap-4'>
						<div className='flex h-11 w-11 shrink-0 items-center justify-center border border-border/70 bg-card shadow-sm'>
							<DatabaseZap className='h-5 w-5 text-foreground/80' strokeWidth={1.8} />
						</div>
						<div className='min-w-0 flex-1'>
							<div className='flex flex-wrap items-center gap-2'>
								<DialogTitle className='text-lg font-semibold tracking-tight'>
									{initialValues ? 'Edit connection' : 'Create connection'}
								</DialogTitle>
								<span className='inline-flex shrink-0 items-center gap-1.5 border border-border/65 bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground'>
									<DatabaseIcon
										type={formData.type || 'postgres'}
										className='h-3.5 w-3.5'
									/>
									{selectedProvider.name}
								</span>
							</div>
							<DialogDescription className='mt-1 text-sm text-muted-foreground'>
								Paste a URL, drop a database or data file, or configure details
								manually.
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className='flex-1 space-y-5 overflow-y-auto px-6 py-5'>
					{!integrationSelected ? (
						<div className='border border-border/60 bg-card/45 p-4 shadow-sm'>
							<Label
								htmlFor='name'
								className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'
							>
								Connection Name
							</Label>
							<Input
								id='name'
								placeholder='e.g. Production Database'
								value={formData.name || ''}
								onChange={function (e) {
									updateField('name', e.target.value)
								}}
								className='input-glow mt-2 h-10 bg-background/70'
								autoFocus
							/>
						</div>
					) : null}

					<div
						data-testid='provider-type-section'
						data-integration-selected={integrationSelected ? 'true' : 'false'}
						data-collapsible-provider-selector={integrationSelected ? 'true' : 'false'}
						className={cn(
							'space-y-3 overflow-hidden border border-border/60 bg-card/35 p-4 shadow-sm',
							'transition-[max-height,opacity,background-color,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
							integrationSelected
								? 'max-h-[118px] opacity-80 hover:max-h-[420px] hover:opacity-100 focus-within:max-h-[420px] focus-within:opacity-100'
								: 'max-h-[520px]'
						)}
					>
						<div className='flex items-center justify-between gap-3'>
							<div>
								<Label className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
									Database Type
								</Label>
								<p className='mt-1 text-xs text-muted-foreground/75'>
									Choose the engine Dora should use for validation and queries.
								</p>
							</div>
						</div>
						<DatabaseTypeSelector
							selectedType={selectedIntegration ?? formData.type ?? 'postgres'}
							onSelect={handleProviderSelect}
							showSupabase={!initialValues}
							showTurso={!initialValues}
							showNeon={!initialValues}
							showVercel={!initialValues}
							showFiles={!!onOpenDataFiles}
							compact={integrationSelected}
						/>
					</div>

					{integrationSelected ? (
						<div
							data-testid='provider-flow-region'
							data-active-provider={selectedIntegration}
							className='min-h-0 flex-1'
						>
							{supabaseSelected ? (
								<SupabaseConnectFlow
									onComplete={function (connection) {
										onSave(connection)
										onOpenChange(false)
									}}
								/>
							) : tursoSelected ? (
								<TursoConnectFlow
									onComplete={function (connection) {
										onSave(connection)
										onOpenChange(false)
									}}
								/>
							) : vercelSelected ? (
								<VercelConnectFlow
									onComplete={function (connection) {
										onSave(connection)
										onOpenChange(false)
									}}
								/>
							) : (
								<NeonConnectFlow
									onComplete={function (connection) {
										onSave(connection)
										onOpenChange(false)
									}}
								/>
							)}
						</div>
					) : (
						<ConnectionForm
							formData={formData}
							updateField={updateField}
							setFormData={setFormData}
							useConnectionString={useConnectionString}
							setUseConnectionString={setUseConnectionString}
						/>
					)}

					{!integrationSelected &&
						!flyHintDismissed &&
						isFlyPublicHost(formData.url ?? '') && (
							<div className='relative flex items-start gap-3 border border-blue-500/20 bg-blue-500/8 px-4 py-3 text-xs text-blue-700 dark:text-blue-300'>
								<div className='pointer-events-none absolute inset-y-0 left-0 w-px bg-blue-500/50' />
								<Info
									className='mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500'
									strokeWidth={2}
								/>
								<p className='flex-1 leading-5'>
									Fly.io databases aren&apos;t reachable directly. Run{' '}
									<code className='rounded bg-blue-500/12 px-1 font-mono text-[11px]'>
										fly proxy 5432 -a &lt;your-app&gt;
									</code>{' '}
									then connect to{' '}
									<span className='font-medium'>localhost:5432</span> — or use the{' '}
									<span className='font-medium'>.internal</span>/
									<span className='font-medium'>.flycast</span> host over a Fly
									WireGuard tunnel.
								</p>
								<button
									type='button'
									onClick={function () {
										setFlyHintDismissed(true)
									}}
									className='mt-0.5 shrink-0 text-blue-500/60 hover:text-blue-500 transition-colors'
									title='Dismiss'
									aria-label='Dismiss Fly.io hint'
								>
									<X className='h-3.5 w-3.5' />
								</button>
							</div>
						)}
				</div>

				<DialogFooter className='border-t border-border/50 bg-muted/30 px-6 py-4'>
					<div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
						{integrationSelected ? (
							<span className='text-xs text-muted-foreground/75'>
								{supabaseSelected
									? 'Authorize Supabase and pick a project to create the connection.'
									: 'Add a token and pick a database to create the connection.'}
							</span>
						) : (
							<TestConnectionButton
								isTesting={isTesting}
								status={testStatus}
								message={testMessage}
								showDesktopOnlyHint={showDesktopOnlyHint}
								disabled={isTesting || !formData.type}
								onClick={handleTestConnection}
							/>
						)}
						<div className='flex items-center gap-2'>
							<Button
								type='button'
								variant='outline'
								onClick={function () {
									onOpenChange(false)
								}}
								className='border-border/70'
							>
								Cancel
							</Button>
							{!integrationSelected && (
								<Button
									type='button'
									onClick={handleSave}
									disabled={isSaving || !formData.name}
									className='gap-2'
								>
									{isSaving ? (
										<>
											<Loader2 className='h-3.5 w-3.5 animate-spin' />
											Saving...
										</>
									) : (
										'Save Connection'
									)}
								</Button>
							)}
						</div>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

const MotionButton = motion(Button)

// Strong ease-out — mirrors the --ease-out token in styles.css.
const EASE_OUT = [0.23, 1, 0.32, 1] as const

type TTestPhase = 'idle' | 'testing' | 'success' | 'error' | 'desktop-only'

type TTestConnectionButtonProps = {
	isTesting: boolean
	status: 'idle' | 'success' | 'error'
	message: string
	showDesktopOnlyHint?: boolean
	disabled: boolean
	onClick: (e: React.MouseEvent) => void
}

function TestConnectionButton({
	isTesting,
	status,
	message,
	showDesktopOnlyHint = false,
	disabled,
	onClick
}: TTestConnectionButtonProps) {
	const reduceMotion = useReducedMotion()
	const phase: TTestPhase = showDesktopOnlyHint ? 'desktop-only' : isTesting ? 'testing' : status

	const phaseContent: Record<TTestPhase, React.ReactNode> = {
		idle: <span className='whitespace-nowrap'>Test Connection</span>,
		testing: (
			<>
				<Loader2 className='h-3.5 w-3.5 animate-spin' />
				<span className='whitespace-nowrap'>Testing…</span>
			</>
		),
		success: (
			<>
				<CheckCircle2 className='h-3.5 w-3.5 shrink-0' strokeWidth={2.25} />
				<span className='whitespace-nowrap'>{message || 'Connection successful!'}</span>
			</>
		),
		error: (
			<>
				<XCircle className='h-3.5 w-3.5 shrink-0' strokeWidth={2.25} />
				<span className='truncate'>{message || 'Connection failed'}</span>
			</>
		),
		'desktop-only': (
			<>
				<Monitor className='h-3.5 w-3.5 shrink-0' strokeWidth={2.25} />
				<span className='whitespace-nowrap'>Desktop app only</span>
			</>
		)
	}

	return (
		<MotionButton
			layout
			type='button'
			variant='outline'
			onClick={onClick}
			disabled={disabled}
			title={phase === 'error' ? message : undefined}
			whileTap={disabled ? undefined : { scale: 0.97 }}
			transition={{ layout: { duration: 0.32, ease: EASE_OUT } }}
			className={cn(
				'max-w-full gap-2 self-start overflow-hidden border-border/70 bg-background/65',
				phase === 'desktop-only' &&
					'desktop-only-hint border-primary/30 bg-primary/5 text-primary',
				phase === 'success' &&
					'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300',
				phase === 'error' &&
					'border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300'
			)}
		>
			<AnimatePresence mode='popLayout' initial={false}>
				<motion.span
					key={phase}
					initial={
						reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: 'blur(4px)' }
					}
					animate={
						reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }
					}
					exit={
						reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: 'blur(4px)' }
					}
					transition={{ duration: 0.18, ease: EASE_OUT }}
					className='flex min-w-0 items-center gap-2'
				>
					{phaseContent[phase]}
				</motion.span>
			</AnimatePresence>
		</MotionButton>
	)
}
