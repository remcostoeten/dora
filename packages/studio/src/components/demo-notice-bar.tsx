import { FlaskConical, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'

const DISMISS_KEY = 'dora_demo_notice_dismissed'

function wasDismissed(): boolean {
	if (typeof window === 'undefined') return false
	try {
		return window.sessionStorage.getItem(DISMISS_KEY) === 'true'
	} catch {
		return false
	}
}

export function DemoNoticeBar() {
	const isTauri = useIsTauri()
	const [dismissed, setDismissed] = useState(() => wasDismissed())

	const handleClose = useCallback(() => {
		setDismissed(true)
		try {
			window.sessionStorage.setItem(DISMISS_KEY, 'true')
		} catch {}
	}, [])

	if (isTauri || dismissed) return null

	return (
		<div className='flex shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-300'>
			<FlaskConical className='h-3.5 w-3.5 shrink-0' />
			<span className='min-w-0 flex-1 truncate'>
				<span className='font-semibold'>Demo view</span> — you're exploring Dora with mock
				data. Connections, providers, and edits here are simulated and not saved to any real
				database.
			</span>
			<button
				type='button'
				onClick={handleClose}
				className='flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-amber-700/70 transition-colors hover:bg-amber-500/20 hover:text-amber-700 dark:text-amber-300/70 dark:hover:text-amber-300'
				aria-label='Dismiss demo notice'
			>
				<X className='h-3 w-3' />
			</button>
		</div>
	)
}
