import { FolderOpen, Key } from 'lucide-react'
import { useState } from 'react'
import { commands } from '@/lib/bindings'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Connection, DatabaseType, SshTunnelConfig } from '../../types'
import { PROVIDER_CONFIGS, sanitizeConnectionUrl } from '../../utils/providers'
import { SshTunnelConfigForm } from './ssh-tunnel-config-form'

type Props = {
	formData: Partial<Connection>
	updateField: (field: keyof Connection, value: unknown) => void
	setFormData: React.Dispatch<React.SetStateAction<Partial<Connection>>>
	useConnectionString: boolean
	setUseConnectionString: (use: boolean) => void
}

export function ConnectionForm({
	formData,
	updateField,
	setFormData,
	useConnectionString,
	setUseConnectionString
}: Props) {
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

	if (formData.type === 'sqlite') {
		return (
			<div className='form-section space-y-2'>
				<Label
					htmlFor='sqlite-path'
					className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
				>
					Database File
				</Label>
				<div className='flex gap-2'>
					<Input
						id='sqlite-path'
						placeholder='/path/to/database.db'
						value={formData.url || ''}
						onChange={function (e) {
							updateField('url', e.target.value)
						}}
						className='flex-1 input-glow font-mono text-sm'
					/>
					<Button
						variant='outline'
						size='icon'
						onClick={handleBrowseFile}
						className='shrink-0'
						title='Browse for file'
					>
						<FolderOpen className='h-4 w-4' />
					</Button>
				</div>
				<p className='text-xs text-muted-foreground'>
					Select or enter the path to your SQLite database file
				</p>
			</div>
		)
	}

	if (formData.type === 'libsql') {
		return (
			<div className='form-section space-y-4'>
				<div className='space-y-2'>
					<Label
						htmlFor='libsql-url'
						className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
					>
						Database URL
					</Label>
					<Input
						id='libsql-url'
						placeholder='libsql://your-database.turso.io'
						value={formData.url || ''}
						onChange={function (e) {
							updateField('url', e.target.value)
						}}
						className='input-glow font-mono text-sm'
					/>
				</div>
				<div className='space-y-2'>
					<Label
						htmlFor='libsql-token'
						className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
					>
						Auth Token
					</Label>
					<Input
						id='libsql-token'
						type='password'
						placeholder='eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...'
						value={formData.authToken || ''}
						onChange={function (e) {
							updateField('authToken', e.target.value)
						}}
						className='input-glow font-mono text-sm'
					/>
					<p className='text-xs text-muted-foreground'>
						Get your token from the Turso dashboard
					</p>
				</div>
			</div>
		)
	}

	if (formData.type === 'postgres' || formData.type === 'mysql') {
		return (
			<div className='form-section space-y-4'>
				<div className='flex items-center gap-2 py-1'>
					<Checkbox
						id='use-url'
						checked={useConnectionString}
						onCheckedChange={function (checked) {
							setUseConnectionString(!!checked)
							if (checked) {
								updateField('url', '')
							} else {
								updateField('url', undefined)
								updateField('host', 'localhost')
								const config = PROVIDER_CONFIGS[formData.type as DatabaseType]
								updateField('port', config.defaultPort)
							}
						}}
					/>
					<Label htmlFor='use-url' className='text-sm cursor-pointer'>
						Use connection string
					</Label>
				</div>

				{useConnectionString ? (
					<div className='space-y-2'>
						<Label
							htmlFor='connection-string'
							className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
						>
							Connection String
						</Label>
						<Input
							id='connection-string'
							placeholder={`${formData.type}://user:password@host:port/database`}
							value={formData.url || ''}
							onChange={function (e) {
								updateField('url', sanitizeConnectionUrl(e.target.value))
							}}
							className='input-glow font-mono text-sm'
						/>
						<p className='text-xs text-muted-foreground'>
							Paste your full connection URL
						</p>
					</div>
				) : (
					<>
						<div className='grid grid-cols-3 gap-3'>
							<div className='col-span-2 space-y-2'>
								<Label
									htmlFor='host'
									className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
								>
									Host
								</Label>
								<Input
									id='host'
									placeholder='localhost'
									value={formData.host || ''}
									onChange={function (e) {
										updateField('host', e.target.value)
									}}
									className='input-glow'
								/>
							</div>
							<div className='space-y-2'>
								<Label
									htmlFor='port'
									className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
								>
									Port
								</Label>
								<Input
									id='port'
									type='number'
									value={formData.port || ''}
									onChange={function (e) {
										updateField('port', parseInt(e.target.value))
									}}
									className='input-glow'
								/>
							</div>
						</div>

						<div className='grid grid-cols-2 gap-3'>
							<div className='space-y-2'>
								<Label
									htmlFor='user'
									className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
								>
									Username
								</Label>
								<Input
									id='user'
									placeholder='postgres'
									value={formData.user || ''}
									onChange={function (e) {
										updateField('user', e.target.value)
									}}
									className='input-glow'
								/>
							</div>
							<div className='space-y-2'>
								<Label
									htmlFor='password'
									className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
								>
									Password
								</Label>
								<Input
									id='password'
									type='password'
									placeholder='••••••••'
									value={formData.password || ''}
									onChange={function (e) {
										updateField('password', e.target.value)
									}}
									className='input-glow'
								/>
							</div>
						</div>

						<div className='space-y-2'>
							<Label
								htmlFor='database'
								className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
							>
								Database
							</Label>
							<Input
								id='database'
								placeholder='postgres'
								value={formData.database || ''}
								onChange={function (e) {
									updateField('database', e.target.value)
								}}
								className='input-glow'
							/>
						</div>

						<div className='flex items-center gap-2 pt-1'>
							<Checkbox
								id='ssl'
								checked={formData.ssl}
								onCheckedChange={function (checked) {
									updateField('ssl', checked)
								}}
							/>
							<Label
								htmlFor='ssl'
								className='text-sm text-muted-foreground cursor-pointer'
							>
								Use SSL / TLS connection
							</Label>
						</div>

						{formData.type === 'postgres' && (
							<div className='border-t border-border/50 pt-4 mt-4 space-y-4'>
								<div className='flex items-center gap-2'>
									<Checkbox
										id='ssh-tunnel'
										checked={formData.sshConfig?.enabled}
										onCheckedChange={function (checked) {
											setFormData(function (prev) {
												return {
													...prev,
													sshConfig: {
														...prev.sshConfig,
														enabled: !!checked
													} as SshTunnelConfig
												}
											})
										}}
									/>
									<Label
										htmlFor='ssh-tunnel'
										className='text-sm cursor-pointer flex items-center gap-2'
									>
										<Key className='h-4 w-4 text-muted-foreground' />
										Connect via SSH Tunnel
									</Label>
								</div>

								{formData.sshConfig?.enabled && (
									<SshTunnelConfigForm
										config={formData.sshConfig}
										onChange={function (newConfig) {
											setFormData(function (prev) {
												return {
													...prev,
													sshConfig: newConfig
												}
											})
										}}
									/>
								)}
							</div>
						)}
					</>
				)}
			</div>
		)
	}

	return null
}
