import { Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'
import { commands, DatabaseInfo } from '@/lib/bindings'
import { Button } from '@/shared/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Connection, DatabaseType, SshAuthMethod, SshTunnelConfig } from '../types'
import {
	sanitizeConnectionUrl,
	isValidConnectionUrl,
	detectProviderName,
	buildConnectionString,
	PROVIDER_CONFIGS
} from '../utils/providers'
import { validateConnection } from '../validation'
import { ConnectionForm } from './connection-dialog/connection-form'
import { DatabaseTypeSelector } from './connection-dialog/database-type-selector'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSave: (connection: Omit<Connection, 'id' | 'createdAt'>) => void
	initialValues?: Connection
}

export function ConnectionDialog({ open, onOpenChange, onSave, initialValues }: Props) {
	const [formData, setFormData] = useState<Partial<Connection>>({
		type: 'postgres',
		host: 'localhost',
		port: 5432,
		user: 'postgres',
		database: 'postgres',
		ssl: false,
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
	const [validationError, setValidationError] = useState<{ field?: string; message?: string } | null>(null)

	useEffect(
		function resetFormOnOpen() {
			if (open) {
				const hasUrl =
					initialValues?.url &&
					(initialValues.type === 'postgres' || initialValues.type === 'mysql')
				setFormData({
					type: 'postgres',
					host: 'localhost',
					port: 5432,
					user: 'postgres',
					database: 'postgres',
					ssl: false,
					...initialValues
				})
				setUseConnectionString(!!hasUrl)
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

				setFormData(function (prev) {
					const updates: Partial<Connection> = {
						url: sanitized,
						host: undefined,
						port: undefined,
						user: undefined,
						password: undefined,
						database: undefined,
						ssl: undefined
					}

					if (!prev.name || prev.name === '') {
						updates.name = detectProviderName(sanitized)
					}

					return { ...prev, ...updates }
				})
				setUseConnectionString(true)
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
			}

			return newData
		})
		setTestStatus('idle')
		// Clear validation error for this field
		if (validationError?.field === field) {
			setValidationError(null)
		}
	}

	function handleTypeSelect(type: DatabaseType) {
		updateField('type', type)
		if (type === 'sqlite' || type === 'libsql') {
			setUseConnectionString(false)
		}
	}

	async function handleTestConnection(e: React.MouseEvent) {
		e.preventDefault()
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

				databaseInfo = {
					Postgres: {
						connection_string: connectionString,
						ssh_config: sshConfig
					}
				}
			}

			const result = await commands.testConnection(databaseInfo)

			if (result.status === 'ok' && result.data) {
				setTestStatus('success')
				setTestMessage('Connection successful!')
			} else {
				setTestStatus('error')
				let errorMsg = 'Connection failed'

				if (result.status === 'error' && result.error) {
					if (typeof result.error === 'string') {
						errorMsg = result.error
					} else if (typeof result.error === 'object') {
						if ('message' in result.error && typeof result.error.message === 'string') {
							errorMsg = result.error.message
						} else {
							errorMsg = JSON.stringify(result.error, null, 2)
						}
					} else {
						errorMsg = String(result.error)
					}
				}

				setTestMessage(errorMsg)
			}
		} catch (error) {
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
		const validation = validateConnection(formData as Record<string, unknown>, useConnectionString)

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
		try {
			const result = await commands.openSqliteDb()
			if (result.status === 'ok' && result.data) {
				updateField('url', result.data)
			}
		} catch (error) {
			console.error('Failed to open file picker:', error)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-[560px] max-h-[85vh] flex flex-col glass border-border/50 p-0 gap-0 overflow-hidden'>
				<DialogHeader className='px-6 py-5 border-b border-border/50'>
					<div className='flex items-center gap-3'>
						<div className='relative'>
							<div className='p-2.5 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/20'>
								<Sparkles className='h-5 w-5 text-primary' />
							</div>
							<div className='absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-primary rounded-full animate-pulse' />
						</div>
						<div>
							<DialogTitle className='text-lg font-semibold'>
								{initialValues ? 'Edit Connection' : 'New Connection'}
							</DialogTitle>
							<DialogDescription className='text-sm text-muted-foreground'>
								Configure your database connection
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className='flex-1 overflow-y-auto p-6 space-y-5'>
					<div className='space-y-2'>
						<Label
							htmlFor='name'
							className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
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
							className='input-glow'
							autoFocus
						/>
					</div>

					<div className='space-y-3'>
						<Label className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
							Database Type
						</Label>
						<DatabaseTypeSelector
							selectedType={formData.type || 'postgres'}
							onSelect={handleTypeSelect}
						/>
					</div>

					<ConnectionForm
						formData={formData}
						updateField={updateField}
						setFormData={setFormData}
						useConnectionString={useConnectionString}
						setUseConnectionString={setUseConnectionString}
					/>

					{testMessage && (
						<div
							className={`text-sm p-3 rounded-md flex items-center gap-2 ${
								testStatus === 'success'
									? 'bg-green-500/10 text-green-500 border border-green-500/20'
									: 'bg-red-500/10 text-red-500 border border-red-500/20'
							}`}
						>
							<div
								className={`h-2 w-2 rounded-full ${
									testStatus === 'success' ? 'bg-green-500' : 'bg-red-500'
								}`}
							/>
							{testMessage}
						</div>
					)}
				</div>

				<DialogFooter className='px-6 py-4 border-t border-border/50 bg-muted/50'>
					<div className='flex items-center justify-between w-full'>
						<Button
							type='button'
							variant='ghost'
							onClick={handleTestConnection}
							disabled={isTesting || !formData.type}
						>
							{isTesting ? 'Testing...' : 'Test Connection'}
						</Button>
						<div className='flex items-center gap-2'>
							<Button
								type='button'
								variant='outline'
								onClick={function () {
									onOpenChange(false)
								}}
							>
								Cancel
							</Button>
							<Button
								type='button'
								onClick={handleSave}
								disabled={isSaving || !formData.name}
							>
								{isSaving ? 'Saving...' : 'Save Connection'}
							</Button>
						</div>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
