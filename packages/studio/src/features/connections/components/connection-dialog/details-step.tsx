import { memo } from 'react'
import { ClipboardPaste, Upload } from 'lucide-react'
import { Button } from '@studio/shared/ui/button'
import type { NewConnection } from './connection-mapping'
import { NameField, Note } from './fields'
import { isIntegration, getSource } from './sources'
import { ProviderFlow } from './provider-flow'
import { ServerForm } from './server-form'
import { FileForm, LibsqlForm, ManagedNote } from './simple-forms'
import { SourceMark } from './source-mark'
import { kindOfSource } from './store'
import { useDialog, useDialogStore } from './store-context'
import { TestPanel } from './test-panel'

type Props = {
	onProviderComplete: (connection: NewConnection) => void
}

export function DetailsStep({ onProviderComplete }: Props) {
	const source = useDialog((state) => state.source)
	const kind = useDialog((state) =>
		state.source ? kindOfSource(state.source, state.original) : 'managed'
	)
	if (!source) return null

	return (
		<div className='min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-5'>
			<SourceBar />
			<AlertSlot />
			{kind === 'server' ? <ServerForm /> : null}
			{kind === 'file' ? <FileForm /> : null}
			{kind === 'libsql' ? <LibsqlForm /> : null}
			{kind === 'managed' ? <ManagedNote /> : null}
			{kind === 'provider' && isIntegration(source) ? (
				<ProviderFlow provider={source} onComplete={onProviderComplete} />
			) : (
				<>
					{kind === 'managed' ? null : <TestPanel />}
					<div className='mt-[22px] border-t border-border/70 pt-5'>
						<NameField help='Shown in the connection switcher. Suggested from the details above.' />
					</div>
				</>
			)}
		</div>
	)
}

const SourceBar = memo(function SourceBar() {
	const store = useDialogStore()
	const source = useDialog((state) => state.source)
	const via = useDialog((state) => state.via)
	const filledFrom = useDialog((state) => state.filledFrom)
	const isEdit = useDialog((state) => state.original !== null)
	if (!source) return null

	const meta = getSource(source)
	const sub = isEdit ? (
		'The engine of a saved connection is fixed.'
	) : filledFrom === 'url' ? (
		<>
			<ClipboardPaste className='h-3 w-3' /> Filled from the URL you pasted
		</>
	) : filledFrom === 'drop' ? (
		<>
			<Upload className='h-3 w-3' /> Filled from the file you dropped
		</>
	) : (
		meta.blurb
	)

	return (
		<div className='mb-5 flex items-center gap-3 border border-border/70 bg-foreground/[0.02] py-2.5 pl-3 pr-2.5'>
			<SourceMark id={source} />
			<div className='min-w-0 flex-1'>
				<div className='flex items-baseline gap-2 font-semibold'>
					{meta.name}
					{via ? (
						<span className='text-xs font-normal text-muted-foreground'>via {via}</span>
					) : null}
				</div>
				<div className='flex items-center gap-1.5 text-xs text-muted-foreground'>{sub}</div>
			</div>
			{isEdit ? null : (
				<Button
					type='button'
					variant='outline'
					size='sm'
					className='h-7 rounded-none px-2.5 text-xs'
					onClick={() => store.getState().back()}
				>
					Change
				</Button>
			)}
		</div>
	)
})

const AlertSlot = memo(function AlertSlot() {
	const alert = useDialog((state) => state.alert)
	if (!alert) return null
	return (
		<Note
			tone='error'
			className='mb-[18px] animate-in duration-150 fade-in-0 motion-reduce:animate-none'
		>
			{alert}
		</Note>
	)
})
