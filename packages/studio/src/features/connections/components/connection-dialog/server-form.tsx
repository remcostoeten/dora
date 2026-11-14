import { memo, useMemo } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@studio/shared/ui/button'
import { PROVIDER_CONFIGS } from '../../utils/providers'
import { detect } from './detect'
import { CheckRow, MICRO_CLASS, Note, Segmented, SwitchRow, TextField } from './fields'
import { isServerEngine, type ServerEngine } from './model'
import { SshSection } from './ssh-section'
import { useDialog, useDialogStore } from './store-context'
import { DATABASE_META } from '../database-icons'

const FLY_HOST = /fly\.dev|flympg/i

const MODES = [
	{ value: 'fields', label: 'Fields' },
	{ value: 'string', label: 'Connection string' }
] as const

export const ServerForm = memo(function ServerForm() {
	const store = useDialogStore()
	const useString = useDialog((state) => state.form.useString)
	const source = useDialog((state) =>
		state.source && isServerEngine(state.source) ? state.source : null
	)
	const isEdit = useDialog((state) => state.original !== null)

	if (!source) return null

	return (
		<div>
			<div className='mb-3 flex items-center justify-between'>
				<span className={MICRO_CLASS}>Connection</span>
				<Segmented
					label='How to enter details'
					value={useString ? 'string' : 'fields'}
					items={MODES}
					onChange={(value) => store.getState().setUseString(value === 'string')}
				/>
			</div>
			{useString ? <StringMode source={source} /> : <FieldsMode source={source} />}
			<div className='mt-4 grid gap-3.5'>
				{source === 'postgres' ? (
					<CheckRow
						name='pooler'
						title='Pooler-compatible mode'
						hint='For PgBouncer, Supavisor or Neon poolers in transaction mode. Turns off prepared statements.'
					/>
				) : null}
				<SshSection />
				{isEdit ? (
					<CheckRow
						name='clearSavedPassword'
						title='Forget the previously saved password'
					/>
				) : null}
			</div>
		</div>
	)
})

type ModeProps = {
	source: ServerEngine
}

function FieldsMode({ source }: ModeProps) {
	const defaults = PROVIDER_CONFIGS[source]
	const sslWhy = useDialog((state) => state.sslWhy)

	return (
		<div className='grid grid-cols-6 gap-x-3 gap-y-4'>
			<TextField
				name='host'
				label='Host'
				mono
				placeholder='db.example.com'
				className='col-span-4'
			/>
			<TextField
				name='port'
				label='Port'
				mono
				inputMode='numeric'
				placeholder={String(defaults.defaultPort)}
				className='col-span-2'
			/>
			<TextField
				name='user'
				label='User'
				mono
				placeholder={defaults.defaultUser}
				className='col-span-3'
			/>
			<TextField name='password' label='Password' mono secret className='col-span-3' />
			<TextField
				name='database'
				label='Database'
				mono
				placeholder={defaults.defaultDatabase}
				className='col-span-3'
			/>
			<div className='col-span-3'>
				<span className='mb-1.5 block text-xs font-medium text-foreground/80'>
					Security
				</span>
				<SwitchRow name='ssl' title='Require SSL' why={sslWhy} />
			</div>
			<FlyNote className='col-span-6' />
		</div>
	)
}

function StringMode({ source }: ModeProps) {
	const scheme = source === 'mysql' || source === 'mariadb' ? 'mysql' : 'postgresql'
	const defaults = PROVIDER_CONFIGS[source]

	return (
		<div className='grid gap-3'>
			<TextField
				name='connStr'
				label='Connection string'
				mono
				multiline
				placeholder={`${scheme}://user:password@host:${defaults.defaultPort}/${defaults.defaultDatabase}`}
				help='Edits here stay in sync with the fields view.'
			/>
			<StringReading />
			<FlyNote />
		</div>
	)
}

const StringReading = memo(function StringReading() {
	const connStr = useDialog((state) => state.form.connStr)
	const reading = useMemo(() => {
		if (!connStr.trim()) return null
		const found = detect(connStr)
		if (found?.kind !== 'url') return { ok: false, text: 'Not a complete connection URL yet.' }
		const via = found.provider ? ` on ${found.provider}` : ''
		const port = found.port ? `:${found.port}` : ''
		return {
			ok: true,
			text: `Reads as ${DATABASE_META[found.engine].name}${via} · ${found.host}${port}`
		}
	}, [connStr])

	if (!reading) return null
	return (
		<p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
			{reading.ok ? <Check className='h-3 w-3' /> : null}
			{reading.text}
		</p>
	)
})

type FlyProps = {
	className?: string
}

const FlyNote = memo(function FlyNote({ className }: FlyProps) {
	const store = useDialogStore()
	const app = useDialog((state) => {
		const raw = state.form.useString ? state.form.connStr : state.form.host
		if (!FLY_HOST.test(raw)) return null
		const host = state.form.useString ? hostOf(raw) : raw
		return host.split('.')[0] || 'your-app'
	})
	if (!app) return null

	return (
		<Note tone='info' className={className}>
			Fly.io databases aren&apos;t reachable directly. Run{' '}
			<code className='bg-foreground/[0.07] px-1 font-mono text-xs'>
				fly proxy 5432 -a {app}
			</code>{' '}
			then connect to localhost:5432.
			<br />
			<Button
				type='button'
				variant='outline'
				size='sm'
				className='mt-2 h-7 rounded-none text-xs'
				onClick={() => store.getState().switchToFlyProxy()}
			>
				Use localhost:5432
			</Button>
		</Note>
	)
})

function hostOf(connStr: string): string {
	const found = detect(connStr)
	return found?.kind === 'url' ? found.host : ''
}
