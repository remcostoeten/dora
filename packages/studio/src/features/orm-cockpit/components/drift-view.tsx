import { useEffect, useRef } from 'react'
import {
	Check,
	ChevronRight,
	ChevronsDownUp,
	ChevronsUpDown,
	Eye,
	EyeOff,
	Info
} from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import type { Confidence, SchemaDiff, TableDiff } from '@studio/features/orm-cockpit/diff/types'
import {
	riskLabel,
	tableDiffLines,
	tableNote,
	type MigrationPlan
} from '@studio/features/orm-cockpit/components/migration-plan'

export type RiskFilter = 'all' | Confidence

export type DiffRef = { table: string; target: string | null }

type Props = {
	diff: SchemaDiff
	plan: MigrationPlan
	connectionName: string
	included: (table: TableDiff) => boolean
	onIncludeChange: (tables: TableDiff[], include: boolean) => void
	isOpen: (table: TableDiff) => boolean
	onOpenChange: (tables: TableDiff[], open: boolean) => void
	filter: RiskFilter
	onFilterChange: (filter: RiskFilter) => void
	hovered: DiffRef | null
	pinned: DiffRef | null
	linkedTables: ReadonlySet<string>
	linkedRef: DiffRef | null
	onHover: (ref: DiffRef | null) => void
	onPin: (ref: DiffRef) => void
	systemTables: { hidden: number; shown: boolean; onToggle: () => void } | null
}

const RISKS: Confidence[] = ['safe', 'review', 'destructive']

function plural(n: number, word: string, many?: string): string {
	return `${n} ${n === 1 ? word : (many ?? `${word}s`)}`
}

function joinList(items: string[]): string {
	if (items.length <= 1) return items.join('')
	return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function sameRef(a: DiffRef | null, b: DiffRef | null): boolean {
	return Boolean(a && b && a.table === b.table && a.target === b.target)
}

function IncludeBox({
	checked,
	indeterminate,
	label,
	onChange
}: {
	checked: boolean
	indeterminate?: boolean
	label: string
	onChange: (checked: boolean) => void
}) {
	const ref = useRef<HTMLInputElement>(null)
	useEffect(
		function () {
			if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
		},
		[indeterminate]
	)
	return (
		<label className='sd-ck' title={label}>
			<input
				ref={ref}
				type='checkbox'
				checked={checked}
				aria-label={label}
				onChange={(event) => onChange(event.target.checked)}
			/>
			<span className='sd-ck-box'>
				<Check className='sd-ck-tick' strokeWidth={3.5} />
				<span className='sd-ck-mid' />
			</span>
		</label>
	)
}

function PlanSummary({
	diff,
	plan,
	connectionName,
	includedTables
}: {
	diff: SchemaDiff
	plan: MigrationPlan
	connectionName: string
	includedTables: TableDiff[]
}) {
	const destructive = plan.statements.filter((s) => s.section === 'destructive' && !s.review)
	const review = plan.statements.filter((s) => s.review !== null)
	const creates = includedTables.filter((t) => t.kind === 'added').length
	const alters = includedTables.filter((t) => t.kind === 'changed').length
	const drops = includedTables.filter((t) => t.kind === 'removed').length
	const parts: string[] = []
	if (creates) parts.push(`creates ${plural(creates, 'table')}`)
	if (alters) parts.push(`alters ${creates ? alters : plural(alters, 'table')}`)
	if (drops) parts.push(`drops ${creates || alters ? drops : plural(drops, 'table')}`)
	const first = joinList(parts)
	const heldBack = plan.heldBackDestructive + plan.heldBackReview

	let detail: string
	if (destructive.length > 0) {
		detail = `${plural(destructive.length, 'statement')} ${destructive.length === 1 ? 'drops or rewrites' : 'drop or rewrite'} data.`
	} else if (review.length > 0) {
		detail = `No data is removed. ${plural(review.length, 'statement')} ${review.length === 1 ? 'needs' : 'need'} a check before running.`
	} else if (heldBack > 0) {
		detail = `${plural(heldBack, 'statement')} ${heldBack === 1 ? 'is' : 'are'} held back until you allow ${heldBack === 1 ? 'it' : 'them'}.`
	} else {
		detail = 'No data is removed, every change is additive.'
	}

	const losses = destructive.map(function (s) {
		const column = s.target?.startsWith('column:') ? s.target.slice('column:'.length) : null
		return column ? `${s.table}.${column}` : s.table
	})
	const kept = diff.tables
		.filter((t) => t.kind === 'removed' && !includedTables.includes(t))
		.map((t) => t.name)

	return (
		<div className='sd-plan'>
			<div className='sd-plan-h'>
				<span className='sd-eyebrow'>What this migration does</span>
				<span className='sd-plan-from'>code → {connectionName}</span>
			</div>
			<p className='sd-plan-say'>
				{includedTables.length === 0 ? (
					<>
						Nothing included yet.{' '}
						<span className='sd-quiet'>
							Tick a table below to add its changes to the migration.
						</span>
					</>
				) : (
					<>
						{first.charAt(0).toUpperCase() + first.slice(1)}.{' '}
						<span className='sd-quiet'>{detail}</span>
					</>
				)}
			</p>
			<div className='sd-stats'>
				<div className='sd-stat'>
					<span className='sd-eyebrow'>Tables</span>
					<span className='sd-stat-v'>
						{includedTables.length}
						<small> / {diff.tables.length}</small>
					</span>
				</div>
				<div className='sd-stat'>
					<span className='sd-eyebrow'>Statements</span>
					<span className={cn('sd-stat-v', plan.statements.length === 0 && 'is-zero')}>
						{plan.statements.length}
					</span>
				</div>
				<div className='sd-stat'>
					<span className='sd-eyebrow'>Needs a check</span>
					<span
						className={cn(
							'sd-stat-v',
							review.length + plan.heldBackReview === 0 && 'is-zero'
						)}
					>
						{review.length + plan.heldBackReview}
					</span>
				</div>
				<div className='sd-stat'>
					<span className='sd-eyebrow'>Destructive</span>
					<span
						className={cn(
							'sd-stat-v',
							destructive.length > 0
								? 'is-destructive'
								: plan.heldBackDestructive === 0 && 'is-zero'
						)}
					>
						{destructive.length + plan.heldBackDestructive}
					</span>
				</div>
			</div>
			{losses.length > 0 || kept.length > 0 ? (
				<div className='sd-loss'>
					{losses.length > 0 ? <span>Destructive</span> : null}
					{losses.map(function (name) {
						return (
							<span key={name} className='sd-loss-item'>
								<i />
								{name}
							</span>
						)
					})}
					{kept.length > 0 ? (
						<span>
							{losses.length > 0 ? '· ' : ''}Kept in database:{' '}
							<span className='sd-mono sd-sec'>{kept.join(', ')}</span>
						</span>
					) : null}
				</div>
			) : null}
		</div>
	)
}

function TableRow({ table, props }: { table: TableDiff; props: Props }) {
	const on = props.included(table)
	const open = props.isOpen(table)
	const lines = open ? tableDiffLines(table) : []
	const tableRef: DiffRef = { table: table.name, target: null }
	const counts = { '+': 0, '~': 0, '−': 0 }
	if (table.kind === 'changed') {
		for (const line of tableDiffLines(table)) counts[line.sign]++
	}
	const columnCount = table.columns.length
	const summary =
		table.kind === 'added'
			? `new table · ${plural(columnCount, 'column')}`
			: table.kind === 'removed'
				? `drop table · ${plural(columnCount, 'column')}`
				: null
	const highlighted = sameRef(props.hovered, tableRef) || props.linkedTables.has(table.name)

	return (
		<div className={cn('sd-trow', open && 'is-open', !on && 'is-off', highlighted && 'is-hl')}>
			<div
				className='sd-th'
				onMouseEnter={() => props.onHover(tableRef)}
				onMouseLeave={() => props.onHover(null)}
			>
				<IncludeBox
					checked={on}
					label={`Include ${table.name} in the migration`}
					onChange={(checked) => props.onIncludeChange([table], checked)}
				/>
				<button
					type='button'
					className='sd-th-btn'
					aria-expanded={open}
					onClick={() => props.onOpenChange([table], !open)}
				>
					<ChevronRight className='sd-chev' />
					<span className='sd-tname'>{table.name}</span>
					{on ? (
						<span className='sd-tsum'>
							{summary ? (
								<span className='sd-sans'>{summary}</span>
							) : (
								(['+', '~', '−'] as const)
									.filter((sign) => counts[sign] > 0)
									.map((sign) => (
										<span key={sign}>
											{sign}
											{counts[sign]}
										</span>
									))
							)}
						</span>
					) : (
						<span className='sd-offtag'>
							{table.kind === 'removed'
								? 'kept, not in migration'
								: 'not in migration'}
						</span>
					)}
					<span className={cn('sd-risk', `is-${table.confidence}`)}>
						<span className='sd-dot' />
						{riskLabel(table.confidence)}
					</span>
				</button>
			</div>
			{open ? (
				<div className='sd-tbody'>
					<p className='sd-note'>
						<Info className='sd-note-ic' />
						<span>{tableNote(table)}</span>
					</p>
					{lines.length > 0 ? (
						<div className={cn('sd-dlines', table.kind === 'removed' && 'is-grid')}>
							{lines.map(function (line) {
								const ref: DiffRef = { table: table.name, target: line.target }
								const lineHl =
									line.target !== null &&
									(sameRef(props.hovered, ref) || sameRef(props.linkedRef, ref))
								return (
									<button
										type='button'
										key={line.key}
										className={cn(
											'sd-dline',
											line.sign === '+' && 'is-add',
											line.sign === '−' && 'is-del',
											lineHl && 'is-hl',
											line.target !== null &&
												sameRef(props.pinned, ref) &&
												'is-pin'
										)}
										onMouseEnter={() => props.onHover(ref)}
										onFocus={() => props.onHover(ref)}
										onClick={() => props.onPin(ref)}
									>
										<span className='sd-sign'>{line.sign}</span>
										<span className='sd-cn'>{line.name}</span>
										<span className='sd-ty'>
											{line.before !== null ? (
												<>
													<span className='sd-old'>{line.before}</span>
													<span className='sd-arr'>→</span>
													<span className='sd-new'>{line.after}</span>
												</>
											) : (
												<span>{line.after}</span>
											)}
											{line.meta ? (
												<span className='sd-meta'>{line.meta}</span>
											) : null}
										</span>
									</button>
								)
							})}
						</div>
					) : null}
				</div>
			) : null}
		</div>
	)
}

function Section({
	title,
	hint,
	tables,
	total,
	props
}: {
	title: string
	hint: string
	tables: TableDiff[]
	total: TableDiff[]
	props: Props
}) {
	if (total.length === 0) return null
	const includedCount = total.filter(props.included).length
	return (
		<div>
			<div className='sd-sec-h'>
				<span className='sd-sec-t'>{title}</span>
				<span className='sd-sec-s'>{hint}</span>
				<span className='sd-sec-n'>
					{includedCount}/{total.length} included
				</span>
			</div>
			{tables.length === 0 ? (
				<p className='sd-sec-empty'>No tables match this filter.</p>
			) : (
				<div className='sd-tlist'>
					{tables.map(function (table) {
						return <TableRow key={table.name} table={table} props={props} />
					})}
				</div>
			)}
		</div>
	)
}

export function DriftView(props: Props) {
	const { diff, plan, filter } = props
	const visible = diff.tables.filter((t) => filter === 'all' || t.confidence === filter)
	const includedVisible = visible.filter(props.included).length
	const includedTables = diff.tables.filter(props.included)
	const anyOpen = visible.some(props.isOpen)
	const toApply = diff.tables.filter((t) => t.kind !== 'removed')
	const onlyInDb = diff.tables.filter((t) => t.kind === 'removed')

	return (
		<div className='sd-list' onMouseLeave={() => props.onHover(null)}>
			<PlanSummary
				diff={diff}
				plan={plan}
				connectionName={props.connectionName}
				includedTables={includedTables}
			/>
			<div className='sd-toolbar'>
				<IncludeBox
					checked={includedVisible === visible.length && includedVisible > 0}
					indeterminate={includedVisible > 0 && includedVisible < visible.length}
					label='Include all visible tables'
					onChange={(checked) => props.onIncludeChange(visible, checked)}
				/>
				<div className='sd-seg' role='radiogroup' aria-label='Filter by risk'>
					<button
						type='button'
						role='radio'
						aria-checked={filter === 'all'}
						className={cn(filter === 'all' && 'is-on')}
						onClick={() => props.onFilterChange('all')}
					>
						All <span className='sd-seg-n'>{diff.tables.length}</span>
					</button>
					{RISKS.map(function (risk) {
						return (
							<button
								key={risk}
								type='button'
								role='radio'
								aria-checked={filter === risk}
								className={cn(filter === risk && 'is-on', `is-${risk}`)}
								onClick={() => props.onFilterChange(risk)}
							>
								<span className='sd-dot' />
								{riskLabel(risk)}
								<span className='sd-seg-n'>
									{diff.tables.filter((t) => t.confidence === risk).length}
								</span>
							</button>
						)
					})}
				</div>
				<div className='sd-grow' />
				{props.systemTables ? (
					<button
						type='button'
						className='sd-btn is-ghost'
						onClick={props.systemTables.onToggle}
						title='Migration bookkeeping and provider/system tables (e.g. Supabase auth, storage) are hidden by default.'
					>
						{props.systemTables.shown ? <EyeOff /> : <Eye />}
						{props.systemTables.shown
							? 'Hide system tables'
							: `Show ${plural(props.systemTables.hidden, 'system table')}`}
					</button>
				) : null}
				<button
					type='button'
					className='sd-btn is-ghost'
					onClick={() => props.onOpenChange(visible, !anyOpen)}
				>
					{anyOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
					{anyOpen ? 'Collapse all' : 'Expand all'}
				</button>
			</div>
			<Section
				title='In your code, not in the database'
				hint='the migration creates or alters these'
				tables={visible.filter((t) => t.kind !== 'removed')}
				total={toApply}
				props={props}
			/>
			<Section
				title='In the database, not in your code'
				hint='excluded by default, dropping them deletes data'
				tables={visible.filter((t) => t.kind === 'removed')}
				total={onlyInDb}
				props={props}
			/>
			<p className='sd-foot'>
				<span>Hover a change to find its statement, click to pin it.</span>
				<span>
					<kbd>Esc</kbd> clears the pin
				</span>
			</p>
		</div>
	)
}
