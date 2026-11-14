import { memo } from 'react'
import { Info } from 'lucide-react'
import { commands } from '@studio/lib/bindings'
import { toast } from '@studio/shared/ui/notifier'
import { TextField, Note } from './fields'
import { BrowseButton } from './ssh-section'
import { useDialog, useDialogStore } from './store-context'

export const FileForm = memo(function FileForm() {
	const store = useDialogStore()
	const isDuckDb = useDialog((state) => state.source === 'duckdb')

	async function browse() {
		try {
			const result = isDuckDb
				? await commands.openFile('Pick a DuckDB database file')
				: await commands.openSqliteDb()
			if (result.status === 'ok' && result.data)
				store.getState().setField('path', result.data)
		} catch (error) {
			toast.error('Failed to open file picker', {
				description: error instanceof Error ? error.message : String(error)
			})
		}
	}

	return (
		<div className='grid gap-3'>
			<TextField
				name='path'
				label='Database file'
				mono
				placeholder={isDuckDb ? '~/data/warehouse.duckdb' : '~/dev/acme-shop/prisma/dev.db'}
				help='Opened in place, never copied. You can also drop the file on this dialog.'
				suffix={<BrowseButton label='Browse for file' onClick={() => void browse()} />}
			/>
			{isDuckDb ? (
				<p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
					<Info className='h-3 w-3' />
					DuckDB holds a lock on the file while Dora has it open.
				</p>
			) : null}
		</div>
	)
})

export const LibsqlForm = memo(function LibsqlForm() {
	return (
		<div className='grid gap-4'>
			<TextField
				name='url'
				label='Database URL'
				mono
				placeholder='libsql://your-db-org.turso.io'
			/>
			<TextField
				name='token'
				label='Auth token'
				mono
				secret
				placeholder='eyJhbGciOiJFZERTQSIs…'
				help='Create one with turso db tokens create <db>. Leave empty for a local sqld server.'
			/>
		</div>
	)
})

export function ManagedNote() {
	return (
		<Note tone='info'>
			This connection was created from a provider account or from data files, so its
			connection details are managed there. Only the name can change here.
		</Note>
	)
}
