import { memo, useRef } from 'react'
import { AlertCircle, Check, Info, Play, Zap } from 'lucide-react'
import { Button } from '@studio/shared/ui/button'
import { Spinner } from '@studio/shared/ui/spinner'
import { cn } from '@studio/shared/utils/cn'
import type { TestPhase } from './model'
import { MOD_KEY } from './shortcuts'
import { useDialog, useDialogStore, useFocusRequest } from './store-context'

type View = {
	tone: 'idle' | 'testing' | 'success' | 'error' | 'info'
	title: string
	sub: string
	label: string | null
}

function viewOf(phase: TestPhase, stale: boolean, savedUntouched: boolean): View {
	switch (phase.name) {
		case 'testing':
			return {
				tone: 'testing',
				title: 'Testing connection…',
				sub: 'Opening a connection to the database',
				label: 'Testing…'
			}
		case 'success':
			return {
				tone: stale ? 'idle' : 'success',
				title: stale ? 'Passed before your last change' : 'Connection successful',
				sub: `Connected in ${phase.ms} ms`,
				label: 'Test again'
			}
		case 'error':
			return {
				tone: stale ? 'idle' : 'error',
				title: stale ? 'Failed before your last change' : "Couldn't connect",
				sub: phase.message,
				label: 'Test again'
			}
		case 'desktop-only':
			return {
				tone: 'info',
				title: 'Desktop app only',
				sub: "Testing opens a real network socket, which a browser tab can't do. You can still save, then test from the Dora desktop app.",
				label: null
			}
		default:
			if (stale) {
				return {
					tone: 'idle',
					title: 'Details changed',
					sub: 'Test again to check the new details.',
					label: 'Test again'
				}
			}
			if (savedUntouched) {
				return {
					tone: 'idle',
					title: 'Saved connection',
					sub: 'Test it again after you change the details.',
					label: 'Test connection'
				}
			}
			return {
				tone: 'idle',
				title: 'Not tested yet',
				sub: 'Check that Dora can reach the database before you save.',
				label: 'Test connection'
			}
	}
}

function usePhase() {
	const phase = useDialog((state) => state.test)
	const stale = useDialog((state) => state.testStale)
	const savedUntouched = useDialog((state) => state.original !== null && !state.detailsDirty)
	return { phase, stale, savedUntouched }
}

const TONE = {
	idle: 'border-border/70 bg-foreground/[0.02]',
	testing: 'border-border/70 bg-foreground/[0.02]',
	success: 'border-emerald-500/30 bg-emerald-500/[0.06]',
	error: 'border-red-500/30 bg-red-500/[0.06]',
	info: 'border-blue-500/30 bg-blue-500/[0.06]'
} as const

const GLYPH_TONE = {
	idle: 'text-muted-foreground',
	testing: 'text-muted-foreground',
	success: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400',
	error: 'border-red-500/40 text-red-600 dark:text-red-400',
	info: 'border-blue-500/40 text-blue-600 dark:text-blue-400'
} as const

export const TestPanel = memo(function TestPanel() {
	const store = useDialogStore()
	const { phase, stale, savedUntouched } = usePhase()
	const view = viewOf(phase, stale, savedUntouched)
	const buttonRef = useRef<HTMLButtonElement>(null)
	useFocusRequest('test-btn', buttonRef)
	const testing = phase.name === 'testing'

	return (
		<section
			aria-label='Connection test'
			aria-live='polite'
			data-state={phase.name}
			className={cn('mt-[22px] border transition-colors duration-200', TONE[view.tone])}
		>
			<div className='flex items-center gap-3 py-3 pl-3.5 pr-3'>
				<span
					className={cn(
						'grid h-7 w-7 flex-none place-items-center border border-border/70',
						GLYPH_TONE[view.tone]
					)}
				>
					{view.tone === 'testing' ? (
						<Spinner className='h-[15px] w-[15px]' />
					) : view.tone === 'success' ? (
						<Check className='h-[15px] w-[15px]' />
					) : view.tone === 'error' ? (
						<AlertCircle className='h-[15px] w-[15px]' />
					) : view.tone === 'info' ? (
						<Info className='h-[15px] w-[15px]' />
					) : (
						<Zap className='h-[15px] w-[15px]' />
					)}
				</span>
				<div className='min-w-0 flex-1'>
					<div
						className={cn(
							'text-[13px] font-medium',
							view.tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
							view.tone === 'error' && 'text-red-600 dark:text-red-400'
						)}
					>
						{view.title}
					</div>
					{phase.name === 'error' ? null : (
						<div className='text-xs text-muted-foreground'>{view.sub}</div>
					)}
				</div>
				{view.label ? (
					<Button
						ref={buttonRef}
						type='button'
						variant='outline'
						size='sm'
						disabled={testing}
						onClick={() => void store.getState().runTest()}
						className='h-7 shrink-0 gap-1.5 rounded-none px-2.5 text-xs'
					>
						{testing ? <Spinner className='h-3 w-3' /> : <Play className='h-3 w-3' />}
						{view.label}
						{testing ? null : (
							<kbd className='ml-1 border border-border/70 px-1 font-mono text-[11px] text-muted-foreground'>
								{MOD_KEY}↵
							</kbd>
						)}
					</Button>
				) : null}
			</div>
			{phase.name === 'error' ? (
				<div
					className={cn(
						'mx-3.5 mb-3.5 border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5',
						stale && 'opacity-55'
					)}
				>
					<code className='block break-words font-mono text-[12.5px] leading-relaxed text-red-600 dark:text-red-400'>
						{phase.message}
					</code>
				</div>
			) : null}
		</section>
	)
})
