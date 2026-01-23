import { Lock, Key } from "lucide-react";
import { commands } from "@/lib/bindings";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/utils/cn";
import { SshTunnelConfig } from "../../types";

type Props = {
	config: SshTunnelConfig
	onChange: (config: SshTunnelConfig) => void
}

export function SshTunnelConfigForm({ config, onChange }: Props) {
	function updateConfig(updates: Partial<SshTunnelConfig>) {
		onChange({ ...config, ...updates })
	}

	return (
		<div className='pl-6 space-y-4 border-l-2 border-border/50'>
			<div className='grid grid-cols-3 gap-3'>
				<div className='col-span-2 space-y-2'>
					<Label
						htmlFor='ssh-host'
						className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
					>
						SSH Host
					</Label>
					<Input
						id='ssh-host'
						placeholder='ssh.example.com'
						value={config.host || ''}
						onChange={function (e) {
							updateConfig({ host: e.target.value })
						}}
						className='input-glow'
					/>
				</div>
				<div className='space-y-2'>
					<Label
						htmlFor='ssh-port'
						className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
					>
						SSH Port
					</Label>
					<Input
						id='ssh-port'
						type='number'
						value={config.port || 22}
						onChange={function (e) {
							updateConfig({ port: parseInt(e.target.value) || 22 })
						}}
						className='input-glow'
					/>
				</div>
			</div>

			<div className='space-y-2'>
				<Label
					htmlFor='ssh-username'
					className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
				>
					SSH Username
				</Label>
				<Input
					id='ssh-username'
					placeholder='root'
					value={config.username || ''}
					onChange={function (e) {
						updateConfig({ username: e.target.value })
					}}
					className='input-glow'
				/>
			</div>

			<div className='space-y-3'>
				<Label className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>
					Authentication Method
				</Label>
				<div className='grid grid-cols-2 gap-2'>
					<button
						type='button'
						onClick={function () {
							updateConfig({ authMethod: 'password' })
						}}
						className={cn(
							'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
							config.authMethod === 'password'
								? 'bg-primary/10 border-primary/50 text-primary'
								: 'bg-card/50 border-border hover:bg-muted/50'
						)}
					>
						<Lock className='h-4 w-4' />
						Password
					</button>
					<button
						type='button'
						onClick={function () {
							updateConfig({ authMethod: 'keyfile' })
						}}
						className={cn(
							'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all',
							config.authMethod === 'keyfile'
								? 'bg-primary/10 border-primary/50 text-primary'
								: 'bg-card/50 border-border hover:bg-muted/50'
						)}
					>
						<Key className='h-4 w-4' />
						Key File
					</button>
				</div>
			</div>

			{config.authMethod === 'password' && (
				<div className='space-y-2'>
					<Label
						htmlFor='ssh-password'
						className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
					>
						SSH Password
					</Label>
					<Input
						id='ssh-password'
						type='password'
						placeholder='••••••••'
						value={config.password || ''}
						onChange={function (e) {
							updateConfig({ password: e.target.value })
						}}
						className='input-glow'
					/>
				</div>
			)}

			{config.authMethod === 'keyfile' && (
				<div className='space-y-2'>
					<Label
						htmlFor='ssh-keyfile'
						className='text-xs font-medium uppercase tracking-wider text-muted-foreground'
					>
						Private Key Path
					</Label>
					<div className='flex gap-2'>
						<Input
							id='ssh-keyfile'
							placeholder='~/.ssh/id_rsa'
							value={config.privateKeyPath || ''}
							onChange={function (e) {
								updateConfig({ privateKeyPath: e.target.value })
							}}
							className='flex-1 input-glow font-mono text-sm'
						/>
						<Button
							variant='outline'
							size='icon'
							onClick={async function () {
								try {
									const result = await commands.openFile('Select SSH Private Key')
									if (result.status === 'ok' && result.data) {
										updateConfig({ privateKeyPath: result.data })
									}
								} catch (error) {
									console.error('Failed to open file picker:', error)
								}
							}}
							className='shrink-0'
							title='Browse for key file'
						>
							<FolderOpenIcon className='h-4 w-4' />
						</Button>
					</div>
				</div>
			)}
		</div>
	)
}

function FolderOpenIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='2'
			strokeLinecap='round'
			strokeLinejoin='round'
			className={className}
		>
			<path d='M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z' />
		</svg>
	)
}
