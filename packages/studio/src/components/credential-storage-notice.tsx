import { notify } from '@remcostoeten/notifier'
import { Check, Copy, Download, KeyRound, X } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { useEffect, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import {
	commands,
	type CredentialStorageStatus,
	type KeyringInstallPlan,
} from '@studio/lib/bindings'
import { useClipboard } from '@studio/shared/hooks/use-clipboard'
import { Button } from '@studio/shared/ui/button'
import { cn } from '@studio/shared/utils/cn'

const DISMISS_KEY = 'dora:credential-storage-notice-dismissed'

function readDismissed(): boolean {
	try {
		return localStorage.getItem(DISMISS_KEY) === '1'
	} catch {
		return false
	}
}

function persistDismissed(): void {
	try {
		localStorage.setItem(DISMISS_KEY, '1')
	} catch {
		/* storage unavailable */
	}
}

export function CredentialStorageNotice({ className }: { className?: string }) {
	const isTauri = useIsTauri()
	const { hasCopied, copyToClipboard } = useClipboard()
	const [dismissed, setDismissed] = useState(readDismissed)
	const [status, setStatus] = useState<CredentialStorageStatus | null>(null)
	const [plan, setPlan] = useState<KeyringInstallPlan | null>(null)
	const [installing, setInstalling] = useState(false)

	useEffect(
		function loadStatus() {
			if (!isTauri || dismissed) return

			commands
				.getCredentialStorageStatus()
				.then(function (result) {
					if (result.backend === 'local_encrypted_file') {
						setStatus(result)
						return commands.getKeyringInstallPlan()
					}
					return null
				})
				.then(function (installPlan) {
					if (installPlan) setPlan(installPlan)
				})
				.catch(function () {})
		},
		[isTauri, dismissed]
	)

	if (!isTauri || dismissed || !status) {
		return null
	}

	function handleInstall() {
		if (!plan) return

		if (!plan.can_auto_install) {
			copyToClipboard(plan.command)
			notify.info('Install command copied — run it in a terminal, then restart Dora.')
			return
		}

		setInstalling(true)
		const pending = notify.loading(`Installing ${plan.package}…`)
		commands
			.installCredentialKeyring()
			.then(function (result) {
				if (result.ok) {
					pending.success(result.message)
					persistDismissed()
					setDismissed(true)
					setStatus(null)
				} else {
					pending.error(result.message)
				}
			})
			.catch(function (error) {
				pending.error(String(error))
			})
			.finally(function () {
				setInstalling(false)
			})
	}

	const installLabel = plan?.can_auto_install
		? plan.package_manager
			? `Install ${plan.package} (${plan.package_manager})`
			: `Install ${plan.package}`
		: 'Copy install command'

	return (
		<div
			className={cn(
				'group relative flex items-center gap-2.5 overflow-hidden border-b border-sidebar-border bg-sidebar/95 px-3 py-2 text-xs text-sidebar-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]',
				className
			)}
			role='status'
		>
			<div className='pointer-events-none absolute inset-y-0 left-0 w-px bg-warning/70' />
			<div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-warning/20 bg-warning/10 text-warning shadow-[0_0_18px_hsl(var(--warning)/0.12)]'>
				<KeyRound className='h-3.5 w-3.5' />
			</div>
			<div className='min-w-0 flex-1'>
				<div className='flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5'>
					<p className='font-medium text-sidebar-foreground'>Local credential storage</p>
					<p className='min-w-0 truncate text-sidebar-foreground/68'>{status.message}</p>
				</div>
				{status.install_hint ? (
					<p className='mt-0.5 truncate text-[11px] leading-4 text-sidebar-foreground/48'>
						{status.install_hint}
					</p>
				) : null}
			</div>
			{plan ? (
				<Button
					variant='outline'
					size='sm'
					className='h-7 shrink-0 gap-1.5 rounded-md border-warning/30 bg-warning/10 px-2.5 text-[11px] font-medium text-warning hover:bg-warning/20 hover:text-warning'
					onClick={handleInstall}
					disabled={installing}
					title={plan.command}
				>
					{installing ? (
						<Spinner className='h-3.5 w-3.5' />
					) : plan.can_auto_install ? (
						<Download className='h-3.5 w-3.5' />
					) : hasCopied ? (
						<Check className='h-3.5 w-3.5' />
					) : (
						<Copy className='h-3.5 w-3.5' />
					)}
					{installing ? 'Installing…' : installLabel}
				</Button>
			) : null}
			<Button
				variant='ghost'
				size='icon'
				className='h-6 w-6 shrink-0 rounded-md text-sidebar-foreground/45 opacity-70 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:opacity-100'
				onClick={function () {
					persistDismissed()
					setDismissed(true)
					setStatus(null)
				}}
				title='Dismiss'
			>
				<X className='h-3.5 w-3.5' />
			</Button>
		</div>
	)
}
