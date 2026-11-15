import { ChevronDown, FolderOpen, Route, ShieldOff } from 'lucide-react'
import { commands } from '@studio/lib/bindings'
import { Button } from '@studio/shared/ui/button'
import { Checkbox } from '@studio/shared/ui/checkbox'
import { Input } from '@studio/shared/ui/input'
import { Label } from '@studio/shared/ui/label'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import { cn } from '@studio/shared/utils/cn'
import { type KvConnectionForm, usesTls } from './kv-connection-form'

type Props = {
	form: KvConnectionForm
	onChange: <K extends keyof KvConnectionForm>(field: K, value: KvConnectionForm[K]) => void
	onError: (message: string) => void
}

export function KvConnectionFields({ form, onChange, onError }: Props) {
	const tls = usesTls(form.url)

	async function browseKey() {
		const result = await commands.openFile('Select SSH private key')
		if (result.status === 'error') {
			onError(formatBackendError(result.error))
			return
		}
		if (result.data) onChange('sshKeyPath', result.data)
	}

	return (
		<>
			<div className='grid gap-1.5'>
				<Label htmlFor='kv-name'>Name</Label>
				<Input
					id='kv-name'
					value={form.name}
					onChange={(event) => onChange('name', event.target.value)}
					required
				/>
			</div>
			<div className='grid gap-1.5'>
				<Label htmlFor='kv-url'>Connection URL</Label>
				<Input
					id='kv-url'
					className='font-mono'
					value={form.url}
					onChange={(event) => onChange('url', event.target.value)}
					placeholder='rediss://default:password@example.com:6379/0'
					required
				/>
				<p className='text-xs text-muted-foreground'>
					Cluster mode is detected on connect. Use rediss:// for TLS.
				</p>
			</div>

			{tls && (
				<label className='flex items-start gap-2.5 text-sm'>
					<Checkbox
						className='mt-0.5'
						checked={form.skipTlsVerify}
						onCheckedChange={(checked) => onChange('skipTlsVerify', checked === true)}
					/>
					<span>
						<span className='flex items-center gap-1.5 font-medium'>
							<ShieldOff className='size-3.5 text-muted-foreground' /> Skip
							certificate verification
						</span>
						<span className='block text-xs text-muted-foreground'>
							For self-signed certificates (Heroku, self-hosted) or TLS through an SSH
							tunnel. Traffic stays encrypted, but the server is not authenticated.
						</span>
					</span>
				</label>
			)}

			<div className='rounded-md border'>
				<button
					type='button'
					aria-expanded={form.sshOn}
					aria-controls='kv-ssh-body'
					onClick={() => onChange('sshOn', !form.sshOn)}
					className='flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-focus focus-visible:bg-focus-strong'
				>
					<Route className='size-4 flex-none text-muted-foreground' />
					<span className='min-w-0 flex-1'>
						<b className='block font-medium'>SSH tunnel</b>
						<small className='text-xs text-muted-foreground'>
							{form.sshOn && form.sshHost
								? `${form.sshUser || 'user'}@${form.sshHost}:${form.sshPort || '22'}`
								: 'Reach ElastiCache, MemoryDB or Memorystore through a bastion host'}
						</small>
					</span>
					<ChevronDown
						className={cn(
							'size-3.5 flex-none text-muted-foreground transition-transform duration-150',
							form.sshOn && 'rotate-180'
						)}
					/>
				</button>
				{form.sshOn && (
					<div id='kv-ssh-body' className='grid grid-cols-6 gap-x-3 gap-y-3 border-t p-3'>
						<Field
							id='kv-ssh-host'
							label='SSH host'
							className='col-span-4'
							value={form.sshHost}
							placeholder='bastion.example.com'
							required
							onChange={(value) => onChange('sshHost', value)}
						/>
						<Field
							id='kv-ssh-port'
							label='Port'
							className='col-span-2'
							value={form.sshPort}
							placeholder='22'
							inputMode='numeric'
							onChange={(value) => onChange('sshPort', value)}
						/>
						<Field
							id='kv-ssh-user'
							label='Username'
							className='col-span-3'
							value={form.sshUser}
							placeholder='ec2-user'
							required
							onChange={(value) => onChange('sshUser', value)}
						/>
						<div className='col-span-3 grid gap-1.5'>
							<Label htmlFor='kv-ssh-auth'>Authentication</Label>
							<select
								id='kv-ssh-auth'
								className='h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring'
								value={form.sshAuth}
								onChange={(event) =>
									onChange(
										'sshAuth',
										event.target.value === 'password' ? 'password' : 'keyfile'
									)
								}
							>
								<option value='keyfile'>Key file or agent</option>
								<option value='password'>Password</option>
							</select>
						</div>
						{form.sshAuth === 'keyfile' ? (
							<div className='col-span-6 grid gap-1.5'>
								<Label htmlFor='kv-ssh-key'>Private key</Label>
								<div className='flex gap-2'>
									<Input
										id='kv-ssh-key'
										className='font-mono'
										value={form.sshKeyPath}
										placeholder='Empty uses the SSH agent'
										onChange={(event) =>
											onChange('sshKeyPath', event.target.value)
										}
									/>
									<Button
										type='button'
										variant='outline'
										onClick={() => void browseKey()}
									>
										<FolderOpen /> Browse
									</Button>
								</div>
							</div>
						) : (
							<Field
								id='kv-ssh-password'
								label='SSH password'
								className='col-span-6'
								type='password'
								value={form.sshPassword}
								required
								onChange={(value) => onChange('sshPassword', value)}
							/>
						)}
						<Field
							id='kv-ssh-fingerprint'
							label='Host key fingerprint (optional)'
							className='col-span-6'
							value={form.sshFingerprint}
							placeholder='SHA256:…'
							hint='Empty checks the host against ~/.ssh/known_hosts.'
							onChange={(value) => onChange('sshFingerprint', value)}
						/>
						<p className='col-span-6 text-xs text-muted-foreground'>
							The URL host is resolved from the SSH server, so use the private
							endpoint. Cluster mode cannot run through a tunnel.
						</p>
					</div>
				)}
			</div>
		</>
	)
}

type FieldProps = {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	className?: string
	placeholder?: string
	hint?: string
	type?: 'text' | 'password'
	inputMode?: 'numeric'
	required?: boolean
}

function Field({ id, label, value, onChange, className, hint, ...input }: FieldProps) {
	return (
		<div className={cn('grid gap-1.5', className)}>
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				className='font-mono'
				value={value}
				onChange={(event) => onChange(event.target.value)}
				{...input}
			/>
			{hint && <p className='text-xs text-muted-foreground'>{hint}</p>}
		</div>
	)
}
