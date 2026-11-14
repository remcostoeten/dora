import { memo, useRef } from 'react'
import { ArrowLeft, Upload } from 'lucide-react'
import { useIsTauri } from '@studio/core/data-provider'
import { Button } from '@studio/shared/ui/button'
import { Spinner } from '@studio/shared/ui/spinner'
import { cn } from '@studio/shared/utils/cn'
import { kindOfSource } from './store'
import { MOD_KEY } from './shortcuts'
import { useDialog, useDialogStore, useFocusRequest } from './store-context'

type Props = {
	onCancel: () => void
}

export const ConnectionDialogFooter = memo(function ConnectionDialogFooter({ onCancel }: Props) {
	const step = useDialog((state) => state.step)

	return (
		<footer className='flex min-h-[62px] items-center gap-2 border-t border-border/70 py-3 pl-6 pr-4'>
			{step === 'source' ? (
				<SourceFooter onCancel={onCancel} />
			) : (
				<DetailsFooter onCancel={onCancel} />
			)}
		</footer>
	)
})

function SourceFooter({ onCancel }: Props) {
	return (
		<>
			<span className='flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground'>
				<Upload className='h-3.5 w-3.5 flex-none' />
				Drop a database or data file anywhere on this dialog.
			</span>
			<Button type='button' variant='outline' className='rounded-none' onClick={onCancel}>
				Cancel
			</Button>
		</>
	)
}

function DetailsFooter({ onCancel }: Props) {
	const store = useDialogStore()
	const isEdit = useDialog((state) => state.original !== null)
	const providerFlow = useDialog((state) =>
		state.source ? kindOfSource(state.source, state.original) === 'provider' : false
	)

	return (
		<>
			<div className='flex min-w-0 flex-1 items-center gap-3'>
				{isEdit ? null : (
					<Button
						type='button'
						variant='ghost'
						title='Alt+←'
						className='gap-1.5 rounded-none px-3 text-[13px] text-foreground/80'
						onClick={() => store.getState().back()}
					>
						<ArrowLeft className='h-3.5 w-3.5' />
						Sources
					</Button>
				)}
				{providerFlow ? null : <StatusCaption />}
			</div>
			{providerFlow ? (
				<Button type='button' variant='outline' className='rounded-none' onClick={onCancel}>
					Cancel
				</Button>
			) : (
				<SaveActions onCancel={onCancel} />
			)}
		</>
	)
}

const StatusCaption = memo(function StatusCaption() {
	const test = useDialog((state) => state.test)
	const stale = useDialog((state) => state.testStale)
	const isTauri = useIsTauri()

	let dot = 'bg-muted-foreground/60'
	let text = 'Not tested'
	let tone = 'text-muted-foreground'

	if (test.name === 'testing') {
		return (
			<span className='inline-flex items-center gap-2 text-xs text-muted-foreground'>
				<Spinner className='h-3 w-3' />
				Testing…
			</span>
		)
	}
	if (stale) {
		text = 'Changed since last test'
	} else if (test.name === 'success') {
		dot = 'bg-emerald-500'
		text = `Tested · ${test.ms} ms`
		tone = 'text-emerald-600 dark:text-emerald-400'
	} else if (test.name === 'error') {
		dot = 'bg-red-500'
		text = 'Last test failed'
		tone = 'text-red-600 dark:text-red-400'
	} else if (test.name === 'desktop-only' || !isTauri) {
		dot = 'bg-blue-500'
		text = 'Testing needs the desktop app'
	}

	return (
		<span className={cn('inline-flex items-center gap-2 whitespace-nowrap text-xs', tone)}>
			<span className={cn('h-[7px] w-[7px] flex-none', dot)} />
			{text}
		</span>
	)
})

const SaveActions = memo(function SaveActions({ onCancel }: Props) {
	const store = useDialogStore()
	const confirm = useDialog((state) => state.confirmSave)
	const saving = useDialog((state) => state.saving)
	const isEdit = useDialog((state) => state.original !== null)
	const isTauri = useIsTauri()
	const test = useDialog((state) => state.test)
	const stale = useDialog((state) => state.testStale)
	const saveRef = useRef<HTMLButtonElement>(null)
	const primaryRef = useRef<HTMLButtonElement>(null)
	useFocusRequest('save-btn', saveRef)
	useFocusRequest('confirm-primary', primaryRef)

	if (confirm) {
		const text = !isTauri
			? 'Testing needs the desktop app.'
			: stale
				? 'Changed since the last test.'
				: test.name === 'error'
					? 'The last test failed.'
					: "This connection hasn't been tested."
		return (
			<div
				role='group'
				aria-label='Save without a passing test?'
				className='flex animate-in items-center gap-2 duration-150 fade-in-0 motion-reduce:animate-none'
			>
				<span className='mr-1 whitespace-nowrap text-xs text-foreground/85'>{text}</span>
				<Button
					ref={isTauri ? undefined : primaryRef}
					type='button'
					variant='outline'
					className='rounded-none'
					onClick={() => void store.getState().saveAnyway()}
				>
					{isTauri ? 'Save anyway' : 'Save untested'}
				</Button>
				{isTauri ? (
					<Button
						ref={primaryRef}
						type='button'
						className='rounded-none'
						onClick={() => void store.getState().testAndSave()}
					>
						Test and save
					</Button>
				) : null}
			</div>
		)
	}

	return (
		<>
			<Button type='button' variant='outline' className='rounded-none' onClick={onCancel}>
				Cancel
			</Button>
			<Button
				ref={saveRef}
				type='button'
				disabled={saving}
				className='gap-2 rounded-none'
				onClick={() => void store.getState().save()}
			>
				{saving ? (
					<>
						<Spinner className='h-3.5 w-3.5' />
						Saving…
					</>
				) : (
					<>
						{isEdit ? 'Save changes' : 'Save connection'}
						<kbd className='border border-primary-foreground/25 px-1 font-mono text-[11px] text-primary-foreground/65'>
							{MOD_KEY}S
						</kbd>
					</>
				)}
			</Button>
		</>
	)
})
