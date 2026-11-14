import {
	memo,
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent
} from 'react'
import { Check, ClipboardPaste, Search } from 'lucide-react'
import { Button } from '@studio/shared/ui/button'
import { cn } from '@studio/shared/utils/cn'
import { DATABASE_META } from '../database-icons'
import { detect, isActionable, type Detection, type UrlDetection } from './detect'
import { MICRO_CLASS, Note } from './fields'
import {
	GROUPS,
	SOURCES,
	filterSources,
	getSource,
	type ListedSourceId,
	type Source
} from './sources'
import type { SourceId } from './model'
import { SourceMark } from './source-mark'
import { useDialog, useDialogStore, useFocusRequest } from './store-context'

type StepProps = {
	canOpenDataFiles: boolean
	onPickFiles: () => void
	onOpenDataFiles: (paths: string[]) => void
}

const EXAMPLES = [
	{
		label: 'Neon URL',
		text: 'postgres://app:secret@ep-cool-123.us-east-2.aws.neon.tech/shop?sslmode=require'
	},
	{
		label: 'Supabase pooler',
		text: 'postgresql://postgres.xkqbtmrnvz:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres'
	},
	{ label: 'Turso', text: 'libsql://shop-edge-acme.turso.io' },
	{
		label: 'PlanetScale env var',
		text: 'DATABASE_URL="mysql://orders_rw:pscale_pw_8xk2@aws.connect.psdb.cloud/orders?sslaccept=strict"'
	},
	{ label: 'Fly.io host', text: 'postgres://postgres:secret@acme-db.fly.dev:5432/acme' },
	{ label: 'SQLite path', text: '~/dev/acme-shop/prisma/dev.db' }
] as const

export function SourceStep({ canOpenDataFiles, onPickFiles, onOpenDataFiles }: StepProps) {
	const store = useDialogStore()
	const query = useDialog((state) => state.query)
	const current = useDialog((state) => state.source)
	const deferred = useDeferredValue(query)
	const detection = useMemo(() => detect(deferred), [deferred])
	const [moved, setMoved] = useState<{ query: string; index: number } | null>(null)

	const visible = useMemo(
		() =>
			filterSources(SOURCES, deferred).filter(
				(source) => canOpenDataFiles || source.id !== 'files'
			),
		[deferred, canOpenDataFiles]
	)
	const total = useMemo(
		() => SOURCES.filter((source) => canOpenDataFiles || source.id !== 'files').length,
		[canOpenDataFiles]
	)
	const showingList = detection === null
	const restingIndex = useMemo(
		() =>
			Math.max(
				0,
				visible.findIndex((source) => source.id === current)
			),
		[visible, current]
	)
	const cursor = moved && moved.query === deferred ? moved.index : restingIndex
	const activeIndex = Math.min(cursor, Math.max(visible.length - 1, 0))
	const activeId = showingList ? visible[activeIndex]?.id : undefined

	useEffect(() => {
		if (activeId)
			document.getElementById(`cd-opt-${activeId}`)?.scrollIntoView({ block: 'nearest' })
	}, [activeId])

	const choose = useCallback(
		(id: ListedSourceId) => {
			if (id === 'files') {
				onPickFiles()
				return
			}
			store.getState().chooseSource(id)
		},
		[onPickFiles, store]
	)

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter') {
			event.preventDefault()
			const liveQuery = store.getState().query
			const found = detect(liveQuery)
			if (found) {
				if (isActionable(found)) proceedWithDetection(found)
				return
			}
			const live = filterSources(SOURCES, liveQuery).filter(
				(source) => canOpenDataFiles || source.id !== 'files'
			)
			const target = liveQuery === deferred ? live[activeIndex] : live[0]
			if (target) choose(target.id)
			return
		}
		if (!showingList || visible.length === 0) return
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			const delta = event.key === 'ArrowDown' ? 1 : -1
			setMoved({
				query: deferred,
				index: (activeIndex + delta + visible.length) % visible.length
			})
		}
	}

	function proceedWithDetection(found: Exclude<Detection, { kind: 'unknown' | 'badpath' }>) {
		if (found.kind === 'datafile') {
			if (canOpenDataFiles) onOpenDataFiles([found.path])
			return
		}
		store.getState().applyDetection(found, 'url')
	}

	return (
		<div className='flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-7'>
			<Omnibox
				query={query}
				total={total}
				isUrl={detection !== null}
				activeId={activeId}
				onKeyDown={handleKeyDown}
			/>
			{detection ? (
				<div id='cd-results' aria-live='polite' className='pt-1'>
					<DetectionCard
						detection={detection}
						canOpenDataFiles={canOpenDataFiles}
						onProceed={proceedWithDetection}
					/>
				</div>
			) : (
				<SourceList
					visible={visible}
					activeId={activeId}
					current={current}
					query={deferred}
					onChoose={choose}
				/>
			)}
		</div>
	)
}

type OmniProps = {
	query: string
	total: number
	isUrl: boolean
	activeId: string | undefined
	onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

function Omnibox({ query, total, isUrl, activeId, onKeyDown }: OmniProps) {
	const store = useDialogStore()
	const ref = useRef<HTMLInputElement>(null)
	useFocusRequest('omni', ref)

	useEffect(() => {
		ref.current?.focus()
	}, [])

	function fill(text: string) {
		store.getState().setQuery(text)
		ref.current?.focus()
	}

	return (
		<div className='sticky top-0 z-[3] -mx-6 bg-card px-6 pb-3 pt-5'>
			<div className='flex h-[50px] items-center gap-2.5 border border-border/70 bg-foreground/[0.03] pl-3.5 pr-1.5 transition-colors duration-150 focus-within:bg-focus hover:bg-foreground/[0.055]'>
				<Search className='h-4 w-4 flex-none text-muted-foreground' />
				<label htmlFor='cd-omni' className='sr-only'>
					Connection URL or source search
				</label>
				<input
					ref={ref}
					id='cd-omni'
					value={query}
					onChange={(event) => store.getState().setQuery(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder={`Paste a connection URL, or search ${total} sources`}
					autoComplete='off'
					spellCheck={false}
					role='combobox'
					aria-expanded
					aria-controls='cd-results'
					aria-autocomplete='list'
					aria-activedescendant={activeId ? `cd-opt-${activeId}` : undefined}
					className={cn(
						'h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground',
						isUrl && 'font-mono text-[13px]'
					)}
				/>
				<span className='flex gap-1 pr-1'>
					<Kbd>{isUrl ? '↵ continue' : '↑↓'}</Kbd>
					{isUrl ? null : <Kbd>↵</Kbd>}
				</span>
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className='h-7 gap-1.5 px-2 text-xs text-muted-foreground'
					onClick={() => fill(EXAMPLES[0].text)}
				>
					<ClipboardPaste className='h-3.5 w-3.5' />
					Paste example
				</Button>
			</div>
			{query === '' ? (
				<div className='mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
					<span>Try</span>
					{EXAMPLES.map((example) => (
						<button
							key={example.label}
							type='button'
							onClick={() => fill(example.text)}
							className='h-6 border border-border/70 px-2 text-xs text-foreground/80 transition-colors duration-150 hover:bg-focus focus-visible:bg-focus-strong'
						>
							{example.label}
						</button>
					))}
				</div>
			) : null}
		</div>
	)
}

function Kbd({ children }: { children: React.ReactNode }) {
	return (
		<kbd className='inline-flex h-[18px] items-center border border-border/70 px-1.5 font-mono text-[11px] font-medium text-muted-foreground'>
			{children}
		</kbd>
	)
}

type ListProps = {
	visible: readonly Source[]
	activeId: string | undefined
	current: SourceId | null
	query: string
	onChoose: (id: ListedSourceId) => void
}

function SourceList({ visible, activeId, current, query, onChoose }: ListProps) {
	const store = useDialogStore()

	if (visible.length === 0) {
		return (
			<div id='cd-results' className='py-7 text-center text-[13px] text-muted-foreground'>
				No source matches &ldquo;{query}&rdquo;.
				<br />
				Paste a connection URL instead, or{' '}
				<button
					type='button'
					onClick={() => store.getState().setQuery('')}
					className='px-1 text-xs text-foreground underline decoration-foreground/30 underline-offset-[3px] transition-colors duration-150 hover:bg-focus focus-visible:bg-focus-strong'
				>
					clear the search
				</button>
				.
			</div>
		)
	}

	return (
		<div id='cd-results' role='listbox' aria-label='Sources'>
			{GROUPS.map((group) => {
				const items = visible.filter((source) => source.group === group.id)
				if (items.length === 0) return null
				return (
					<section
						key={group.id}
						aria-label={group.label}
						className='mt-[18px] first:mt-1.5'
					>
						<div className='mb-1.5 flex items-baseline justify-between'>
							<span className={MICRO_CLASS}>{group.label}</span>
							<span className='text-xs text-muted-foreground/85'>{group.hint}</span>
						</div>
						<div className='grid grid-cols-1 gap-0.5 sm:grid-cols-2'>
							{items.map((source) => (
								<SourceRow
									key={source.id}
									source={source}
									highlighted={activeId === source.id}
									isCurrent={source.id === current}
									query={query}
									onChoose={onChoose}
								/>
							))}
						</div>
					</section>
				)
			})}
		</div>
	)
}

type RowProps = {
	source: Source
	highlighted: boolean
	isCurrent: boolean
	query: string
	onChoose: (id: ListedSourceId) => void
}

const SourceRow = memo(function SourceRow({
	source,
	highlighted,
	isCurrent,
	query,
	onChoose
}: RowProps) {
	return (
		<button
			type='button'
			id={`cd-opt-${source.id}`}
			role='option'
			aria-selected={highlighted}
			tabIndex={-1}
			onClick={() => onChoose(source.id)}
			className={cn(
				'flex w-full items-center gap-3 px-2.5 py-[9px] text-left transition-colors duration-150 hover:bg-focus',
				isCurrent && 'bg-accent',
				highlighted && 'bg-focus-strong'
			)}
		>
			<SourceMark id={source.id} />
			<span className='min-w-0 flex-1'>
				<span className='flex items-center gap-2 text-sm font-medium'>
					<Highlight text={source.name} query={query} />
					{isCurrent ? (
						<span className='text-[11px] font-normal text-muted-foreground'>
							current
						</span>
					) : null}
				</span>
				<span className='block truncate text-xs text-muted-foreground'>{source.blurb}</span>
			</span>
		</button>
	)
})

type HighlightProps = {
	text: string
	query: string
}

function Highlight({ text, query }: HighlightProps) {
	const needle = query.trim().toLowerCase()
	const at = needle ? text.toLowerCase().indexOf(needle) : -1
	if (at < 0) return <>{text}</>
	return (
		<>
			{text.slice(0, at)}
			<mark className='bg-transparent text-inherit underline decoration-foreground/40 underline-offset-[3px]'>
				{text.slice(at, at + needle.length)}
			</mark>
			{text.slice(at + needle.length)}
		</>
	)
}

type CardProps = {
	detection: Detection
	canOpenDataFiles: boolean
	onProceed: (detection: Exclude<Detection, { kind: 'unknown' | 'badpath' }>) => void
}

function markIdOf(detection: Exclude<Detection, { kind: 'unknown' | 'badpath' }>): ListedSourceId {
	return detection.kind === 'datafile' ? 'files' : detection.engine
}

function DetectionCard({ detection, canOpenDataFiles, onProceed }: CardProps) {
	const store = useDialogStore()

	if (detection.kind === 'unknown') {
		return (
			<Note tone='error'>
				<b>
					Dora can&apos;t read{' '}
					<code className='font-mono text-xs'>{detection.scheme}://</code> URLs.
				</b>
				<br />
				Supported: postgres://, postgresql://, mysql://, libsql://, and paths to SQLite,
				DuckDB, CSV, Parquet or JSON files.
			</Note>
		)
	}
	if (detection.kind === 'badpath') {
		return (
			<Note tone='error'>
				<b>That path isn&apos;t a file Dora can open.</b>
				<br />
				Use a path ending in .sqlite, .db, .duckdb, .csv, .parquet or .json.
			</Note>
		)
	}

	const summary = describe(detection)
	const blocked = detection.kind === 'datafile' && !canOpenDataFiles
	const account = detection.kind === 'url' ? detection.account : null

	return (
		<div className='border border-border/70 bg-foreground/[0.02]'>
			<div className='flex items-center gap-3 px-4 py-3.5'>
				<SourceMark id={markIdOf(detection)} size='lg' />
				<div>
					<div className='text-[15px] font-semibold'>{summary.title}</div>
					<div className='text-xs text-muted-foreground'>{summary.sub}</div>
				</div>
				<span className='ml-auto inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400'>
					<Check className='h-3.5 w-3.5' />
					Recognised
				</span>
			</div>
			<dl className='m-0 grid grid-cols-2 border-t border-border/70 sm:grid-cols-3'>
				{summary.rows.map(([key, value, soft]) => (
					<div
						key={key}
						className='min-w-0 border-b border-r border-border/70 px-4 py-2.5'
					>
						<dt className='mb-0.5 text-[11px] text-muted-foreground'>{key}</dt>
						<dd
							title={value}
							className={cn(
								'm-0 truncate',
								soft
									? 'text-[12.5px] text-muted-foreground'
									: 'font-mono text-[13px]'
							)}
						>
							{value}
						</dd>
					</div>
				))}
			</dl>
			{summary.notes.length > 0 ? (
				<div className='grid gap-2 px-4 pt-3'>
					{summary.notes.map((note) => (
						<Note key={note.text} tone={note.tone}>
							{note.text}
						</Note>
					))}
				</div>
			) : null}
			<div className='flex flex-wrap items-center gap-2 px-4 py-3.5'>
				<Button
					type='button'
					disabled={blocked}
					onClick={() => onProceed(detection)}
					className='h-[34px] gap-2 rounded-none px-3.5 text-[13px]'
				>
					Continue with these details <Kbd>↵</Kbd>
				</Button>
				{account ? (
					<Button
						type='button'
						variant='outline'
						className='h-[34px] rounded-none px-3.5 text-[13px]'
						onClick={() => store.getState().chooseSource(account)}
					>
						Connect {getSource(account).name} account instead
					</Button>
				) : null}
				{blocked ? (
					<span className='text-xs text-muted-foreground'>
						Data files open in the desktop app.
					</span>
				) : null}
				<span className='flex-1' />
				<Button
					type='button'
					variant='ghost'
					size='sm'
					className='rounded-none text-muted-foreground'
					onClick={() => store.getState().setQuery('')}
				>
					Clear
				</Button>
			</div>
		</div>
	)
}

type Summary = {
	title: string
	sub: string
	rows: [string, string, boolean?][]
	notes: { tone: 'info' | 'ok'; text: string }[]
}

function describe(detection: Exclude<Detection, { kind: 'unknown' | 'badpath' }>): Summary {
	if (detection.kind === 'partial') {
		return {
			title: DATABASE_META[detection.engine].name,
			sub: 'Keep typing, or continue and fill in the rest',
			rows: [
				['Engine', DATABASE_META[detection.engine].name, true],
				['Host', 'Not yet', true],
				['Database', 'Not yet', true]
			],
			notes: []
		}
	}
	if (detection.kind === 'file' || detection.kind === 'datafile') {
		const isData = detection.kind === 'datafile'
		const label = isData ? 'Data file' : `${DATABASE_META[detection.engine].name} file`
		return {
			title: label,
			sub: 'Detected from what you pasted',
			rows: [
				['Path', detection.path],
				[
					'Opens as',
					isData
						? 'Table via DuckDB'
						: `${DATABASE_META[detection.engine].name} database`,
					true
				],
				['Mode', isData ? 'Read-only' : 'Read and write', true]
			],
			notes: []
		}
	}
	return describeUrl(detection)
}

function describeUrl(found: UrlDetection): Summary {
	const engine = DATABASE_META[found.engine].name
	const notes: Summary['notes'] = []
	if (found.typo)
		notes.push({ tone: 'info', text: `Read ${found.typo.from}:// as ${found.typo.to}://.` })
	if (found.pooler) {
		notes.push({
			tone: 'ok',
			text: 'This is a transaction pooler, so pooler-compatible mode will be on. Prepared statements are turned off.'
		})
	}
	if (found.fly) {
		notes.push({
			tone: 'info',
			text: "Fly.io databases aren't reachable directly. Run fly proxy 5432 -a <your-app> and connect to localhost:5432."
		})
	}

	if (found.engine === 'libsql') {
		return {
			title: `libSQL${found.provider ? ` on ${found.provider}` : ''}`,
			sub: 'Detected from what you pasted',
			rows: [
				['Database URL', `libsql://${found.host}`],
				['Auth token', found.token ? 'In URL' : 'Needed next', true],
				['Transport', 'HTTPS', true]
			],
			notes
		}
	}

	return {
		title: `${engine}${found.provider ? ` on ${found.provider}` : ''}`,
		sub: 'Detected from what you pasted',
		rows: [
			['Host', found.host],
			['Port', found.port || 'default', !found.port],
			['User', found.user || 'Not in URL', !found.user],
			[
				'Password',
				found.password
					? '•'.repeat(Math.min(found.password.length, 10))
					: 'Not in URL, add it next',
				!found.password
			],
			['Database', found.database || 'default', !found.database],
			['SSL', found.ssl ? `On, ${found.sslWhy}` : 'Off', true]
		],
		notes
	}
}
