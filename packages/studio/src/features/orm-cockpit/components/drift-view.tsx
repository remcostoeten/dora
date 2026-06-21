/**
 * Drift view — renders a {@link SchemaDiff} grouped by table. Each table and
 * column carries a confidence chip (green `safe` / amber `review` / red
 * `destructive`) so a glance communicates how risky reconciling the drift is.
 *
 * Direction is fixed by the hook: live DB = `from`, project code = `to`. So
 * `added` = present in code, missing in the DB (needs creating); `removed` =
 * present in the DB, gone from code (a drop). The header labels this explicitly
 * so the user never has to guess which side is which.
 */

import { useState } from 'react'
import { ChevronRight, Plus, Minus, Pencil } from 'lucide-react'
import { Badge } from '@studio/shared/ui/badge'
import { cn } from '@studio/shared/utils/cn'
import type { ColumnIR } from '@studio/features/orm-cockpit/ir/types'
import type {
	ColumnDiff,
	Confidence,
	SchemaDiff,
	TableDiff,
} from '@studio/features/orm-cockpit/diff/types'

type Props = {
	diff: SchemaDiff
}

function confidenceClass(confidence: Confidence): string {
	if (confidence === 'destructive') {
		return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
	}
	if (confidence === 'review') {
		return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
	}
	return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
}

function ConfidenceChip({ confidence }: { confidence: Confidence }) {
	return (
		<Badge
			variant='outline'
			className={cn('h-5 px-1.5 text-[10px] font-medium capitalize', confidenceClass(confidence))}
		>
			{confidence}
		</Badge>
	)
}

function kindIcon(kind: 'added' | 'removed' | 'changed') {
	if (kind === 'added') return <Plus className='h-3.5 w-3.5 text-emerald-500' />
	if (kind === 'removed') return <Minus className='h-3.5 w-3.5 text-red-500' />
	return <Pencil className='h-3.5 w-3.5 text-amber-500' />
}

/** Human label for the direction of a change (code is the source of truth). */
function kindVerb(kind: 'added' | 'removed' | 'changed'): string {
	if (kind === 'added') return 'create in DB'
	if (kind === 'removed') return 'drop from DB'
	return 'alter'
}

function columnSummary(col: ColumnIR): string {
	const bits: string[] = [col.typeParams ? `${col.type}(${col.typeParams})` : col.type]
	if (col.rawType && col.rawType !== col.type) bits.push(`(${col.rawType})`)
	bits.push(col.nullable ? 'null' : 'not null')
	if (col.default !== null) bits.push(`default ${col.default}`)
	if (col.autoIncrement) bits.push('auto-increment')
	return bits.join(' · ')
}

function ColumnRow({ col }: { col: ColumnDiff }) {
	return (
		<div className='flex items-start gap-2 px-3 py-1.5 text-xs'>
			<span className='mt-0.5 shrink-0'>{kindIcon(col.kind)}</span>
			<div className='min-w-0 flex-1'>
				<div className='flex items-center gap-2'>
					<span className='font-mono font-medium text-foreground'>{col.name}</span>
					<span className='text-muted-foreground'>{kindVerb(col.kind)}</span>
					{col.changedFields && col.changedFields.length > 0 ? (
						<span className='text-muted-foreground/80'>
							({col.changedFields.join(', ')})
						</span>
					) : null}
				</div>
				{col.kind === 'changed' && col.before && col.after ? (
					<div className='mt-0.5 space-y-0.5 font-mono text-[11px]'>
						<div className='text-red-600/90 dark:text-red-400/90'>
							- {columnSummary(col.before)}
						</div>
						<div className='text-emerald-600/90 dark:text-emerald-400/90'>
							+ {columnSummary(col.after)}
						</div>
					</div>
				) : (
					<div className='mt-0.5 font-mono text-[11px] text-muted-foreground'>
						{columnSummary(col.after ?? col.before ?? ({} as ColumnIR))}
					</div>
				)}
			</div>
			<ConfidenceChip confidence={col.confidence} />
		</div>
	)
}

function TableCard({ table }: { table: TableDiff }) {
	const [open, setOpen] = useState(table.confidence === 'destructive')
	const changeCount =
		table.columns.length + table.indexes.length + table.foreignKeys.length
	const detail =
		table.kind === 'added'
			? 'new table'
			: table.kind === 'removed'
				? 'dropped table'
				: `${changeCount} change${changeCount === 1 ? '' : 's'}`

	return (
		<div className='overflow-hidden rounded-md border border-border/60 bg-card/40'>
			<button
				type='button'
				onClick={function () {
					setOpen(function (v) {
						return !v
					})
				}}
				className='flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40'
				aria-expanded={open}
			>
				<ChevronRight
					className={cn(
						'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
						open && 'rotate-90',
					)}
				/>
				{kindIcon(table.kind)}
				<span className='font-mono text-sm font-medium text-foreground'>{table.name}</span>
				<span className='text-xs text-muted-foreground'>{detail}</span>
				<span className='ml-auto'>
					<ConfidenceChip confidence={table.confidence} />
				</span>
			</button>

			{open ? (
				<div className='border-t border-border/50 divide-y divide-border/30'>
					{table.columns.length === 0 &&
					table.indexes.length === 0 &&
					table.foreignKeys.length === 0 ? (
						<div className='px-3 py-2 text-xs text-muted-foreground'>
							{table.kind === 'added'
								? 'Whole table is new — see the migration preview for the full CREATE.'
								: table.kind === 'removed'
									? 'Whole table would be dropped.'
									: 'No column-level changes.'}
						</div>
					) : null}
					{table.columns.map(function (col) {
						return <ColumnRow key={col.name} col={col} />
					})}
					{table.indexes.map(function (idx, i) {
						const ref = idx.after ?? idx.before
						return (
							<div
								key={`idx-${i}`}
								className='flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground'
							>
								{kindIcon(idx.kind)}
								<span className='font-mono'>index {ref?.name ?? ''}</span>
								<span>({(ref?.columns ?? []).join(', ')})</span>
							</div>
						)
					})}
					{table.foreignKeys.map(function (fk, i) {
						const ref = fk.after ?? fk.before
						return (
							<div
								key={`fk-${i}`}
								className='flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground'
							>
								{kindIcon(fk.kind)}
								<span className='font-mono'>
									fk → {ref?.refTable ?? ''} ({(ref?.columns ?? []).join(', ')})
								</span>
							</div>
						)
					})}
				</div>
			) : null}
		</div>
	)
}

/** A labeled group of table diffs sharing a direction. */
function DriftGroup({
	title,
	hint,
	tables,
}: {
	title: string
	hint: string
	tables: TableDiff[]
}) {
	if (tables.length === 0) {
		return null
	}
	return (
		<div className='space-y-2'>
			<div className='flex items-baseline gap-2'>
				<span className='text-xs font-semibold text-foreground'>{title}</span>
				<span className='text-[11px] text-muted-foreground'>{hint}</span>
				<span className='ml-auto text-[11px] text-muted-foreground'>{tables.length}</span>
			</div>
			<div className='space-y-2'>
				{tables.map(function (table) {
					return <TableCard key={table.name} table={table} />
				})}
			</div>
		</div>
	)
}

export function DriftView({ diff }: Props) {
	const destructiveCount = diff.tables.filter(function (t) {
		return t.confidence === 'destructive'
	}).length

	// Group by direction so "apply to the DB" is never confused with "exists in
	// the DB but not your code". `removed` = in the live DB, gone from code;
	// everything else (`added`/`changed`) is work your code wants applied.
	const toApply = diff.tables.filter(function (t) {
		return t.kind !== 'removed'
	})
	const onlyInDb = diff.tables.filter(function (t) {
		return t.kind === 'removed'
	})

	return (
		<div className='space-y-4'>
			<div className='flex items-center gap-2 text-xs text-muted-foreground'>
				<span className='font-medium text-foreground'>
					{diff.tables.length} table{diff.tables.length === 1 ? '' : 's'} differ
				</span>
				{destructiveCount > 0 ? (
					<>
						<span>·</span>
						<span className='text-red-600 dark:text-red-400'>
							{destructiveCount} destructive
						</span>
					</>
				) : null}
			</div>

			<DriftGroup
				title='In your code, not yet in the database'
				hint='your schema would create / alter these'
				tables={toApply}
			/>
			<DriftGroup
				title='In the database, not in your code'
				hint='dropping these would lose data'
				tables={onlyInDb}
			/>
		</div>
	)
}
