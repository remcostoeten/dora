import { ShieldAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { commands, type CredentialStorageStatus } from '@studio/lib/bindings'
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
	const [dismissed, setDismissed] = useState(readDismissed)
	const [status, setStatus] = useState<CredentialStorageStatus | null>(null)

	useEffect(
		function loadStatus() {
			if (!isTauri || dismissed) return

			commands
				.getCredentialStorageStatus()
				.then(function (result) {
					if (result.backend === 'local_encrypted_file') {
						setStatus(result)
					}
				})
				.catch(function () {})
		},
		[isTauri, dismissed]
	)

	if (!isTauri || dismissed || !status) {
		return null
	}

	return (
		<div
			className={cn(
				'flex items-start gap-3 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100',
				className
			)}
			role='status'
		>
			<ShieldAlert className='mt-0.5 h-4 w-4 shrink-0 text-amber-400' />
			<div className='min-w-0 flex-1 space-y-1'>
				<p className='font-medium text-amber-50'>Using local credential storage</p>
				<p className='leading-relaxed text-amber-100/90'>{status.message}</p>
				{status.install_hint ? (
					<p className='leading-relaxed text-amber-200/80'>{status.install_hint}</p>
				) : null}
			</div>
			<Button
				variant='ghost'
				size='icon'
				className='h-7 w-7 shrink-0 text-amber-200 hover:bg-amber-500/10 hover:text-amber-50'
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
