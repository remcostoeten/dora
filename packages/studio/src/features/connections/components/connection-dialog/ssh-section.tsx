import { memo } from 'react'
import { ChevronDown, FolderOpen, Route } from 'lucide-react'
import { commands } from '@studio/lib/bindings'
import { DesktopOnlyButton } from '@studio/core/platform'
import { toast } from '@studio/shared/ui/notifier'
import { cn } from '@studio/shared/utils/cn'
import type { SshAuthMethod } from '../../types'
import { Segmented, TextField } from './fields'
import { useDialog, useDialogStore } from './store-context'

const AUTH_ITEMS = [
	{ value: 'keyfile', label: 'Key file' },
	{ value: 'password', label: 'Password' }
] as const

function summaryOf(on: boolean, host: string, user: string, port: string): string {
	if (!on) return 'Reach a database behind a bastion host'
	if (!host) return 'Fill in the bastion host below'
	return `${user || 'user'}@${host}:${port || '22'}`
}

export const SshSection = memo(function SshSection() {
	const store = useDialogStore()
	const on = useDialog((state) => state.form.sshOn)
	const summary = useDialog((state) =>
		summaryOf(state.form.sshOn, state.form.sshHost, state.form.sshUser, state.form.sshPort)
	)

	return (
		<div className='border border-border/70'>
			<button
				type='button'
				aria-expanded={on}
				aria-controls='cd-ssh-body'
				onClick={() => store.getState().setField('sshOn', !on)}
				className='flex w-full items-center gap-3 px-3 py-[11px] text-left transition-colors duration-150 hover:bg-focus focus-visible:bg-focus-strong'
			>
				<Route className='h-4 w-4 flex-none text-muted-foreground' />
				<span className='min-w-0 flex-1'>
					<b className='block text-[13px] font-medium'>SSH tunnel</b>
					<small className='text-xs text-muted-foreground'>{summary}</small>
				</span>
				<span
					className={cn(
						'border border-border/70 px-1.5 py-0.5 text-[11px] text-muted-foreground',
						on && 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
					)}
				>
					{on ? 'On' : 'Off'}
				</span>
				<ChevronDown
					className={cn(
						'h-3.5 w-3.5 flex-none text-muted-foreground transition-transform duration-150',
						on && 'rotate-180'
					)}
				/>
			</button>
			{on ? <SshFields /> : null}
		</div>
	)
})

function SshFields() {
	const store = useDialogStore()
	const auth = useDialog((state) => state.form.sshAuth)

	async function browseKey() {
		try {
			const result = await commands.openFile('Select SSH Private Key')
			if (result.status === 'ok' && result.data)
				store.getState().setField('sshKeyPath', result.data)
		} catch (error) {
			toast.error('Failed to open file picker', {
				description: error instanceof Error ? error.message : String(error)
			})
		}
	}

	return (
		<div
			id='cd-ssh-body'
			className='grid animate-in grid-cols-6 gap-x-3 gap-y-4 border-t border-border/70 px-3 pb-4 pt-5 duration-150 fade-in-0 motion-reduce:animate-none'
		>
			<TextField
				name='sshHost'
				label='SSH host'
				mono
				placeholder='bastion.example.com'
				className='col-span-4'
			/>
			<TextField
				name='sshPort'
				label='Port'
				mono
				inputMode='numeric'
				placeholder='22'
				className='col-span-2'
			/>
			<TextField
				name='sshUser'
				label='Username'
				mono
				placeholder='deploy'
				className='col-span-3'
			/>
			<div className='col-span-3'>
				<span className='mb-1.5 block text-xs font-medium text-foreground/80'>
					Authentication
				</span>
				<Segmented<SshAuthMethod>
					label='SSH authentication'
					value={auth}
					items={AUTH_ITEMS}
					onChange={(value) => store.getState().setField('sshAuth', value)}
				/>
			</div>
			{auth === 'keyfile' ? (
				<TextField
					name='sshKeyPath'
					label='Private key'
					mono
					placeholder='~/.ssh/id_ed25519'
					className='col-span-6'
					suffix={
						<BrowseButton
							label='Browse for private key'
							onClick={() => void browseKey()}
						/>
					}
				/>
			) : (
				<TextField
					name='sshPassword'
					label='SSH password'
					mono
					secret
					className='col-span-6'
				/>
			)}
			<TextField
				name='sshFingerprint'
				label='Host key fingerprint'
				mono
				optional
				placeholder='SHA256:…'
				help='Leave empty to trust the key on first connect. Dora pins it after that.'
				className='col-span-6'
			/>
		</div>
	)
}

type Props = {
	label: string
	onClick: () => void
}

export function BrowseButton({ label, onClick }: Props) {
	return (
		<DesktopOnlyButton
			type='button'
			variant='outline'
			title={label}
			desktopHint='Desktop only'
			onClick={onClick}
			className='h-9 shrink-0 gap-1.5 rounded-none border-l-0 border-border/70 bg-foreground/[0.03] px-3 text-[13px] font-normal'
		>
			<FolderOpen className='h-3.5 w-3.5' />
			Browse
		</DesktopOnlyButton>
	)
}
