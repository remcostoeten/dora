/**
 * Renders the Drizzle migration status: the repo's journal entries, each tagged
 * applied (in the live DB) or pending. Read-only — applying migrations is a CLI
 * concern (`drizzle-kit migrate`); this just shows the gap.
 */

import { CheckCircle2, Clock, Info, Loader2 } from 'lucide-react'
import { cn } from '@studio/shared/utils/cn'
import { EmptyState } from '@studio/shared/ui/empty-state'
import type { MigrationStatusState } from '@studio/features/orm-cockpit/components/use-migration-status'

export function MigrationStatusView({ state }: { state: MigrationStatusState }) {
	if (state.loading && !state.status) {
		return (
			<div className='flex h-full items-center justify-center gap-2 text-muted-foreground'>
				<Loader2 className='h-5 w-5 animate-spin' />
				<span className='text-sm'>Reading migrations…</span>
			</div>
		)
	}

	if (!state.status) {
		return (
			<EmptyState
				icon={<Info className='h-9 w-9' />}
				title='No migration status'
				description={state.note ?? 'Nothing to show for this project.'}
			/>
		)
	}

	const { rows, appliedCount, pendingCount, tableMissing } = state.status

	return (
		<div className='flex h-full flex-col'>
			<div className='flex items-center gap-3 border-b border-border/60 px-3 py-2 text-xs'>
				<span className='flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400'>
					<CheckCircle2 className='h-3.5 w-3.5' />
					{appliedCount} applied
				</span>
				<span className='flex items-center gap-1.5 text-amber-600 dark:text-amber-400'>
					<Clock className='h-3.5 w-3.5' />
					{pendingCount} pending
				</span>
				<span className='ml-auto text-muted-foreground'>{rows.length} total</span>
			</div>

			{tableMissing ? (
				<p className='border-b border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300'>
					No <span className='font-mono'>__drizzle_migrations</span> table in this database —
					nothing has been applied here yet.
				</p>
			) : null}

			<ul className='min-h-0 flex-1 overflow-auto'>
				{rows.map(function (row) {
					const applied = row.state === 'applied'
					return (
						<li
							key={row.idx}
							className='flex items-center gap-3 border-b border-border/40 px-3 py-2 text-sm'
						>
							{applied ? (
								<CheckCircle2 className='h-4 w-4 shrink-0 text-emerald-500' />
							) : (
								<Clock className='h-4 w-4 shrink-0 text-amber-500' />
							)}
							<span className='font-mono text-xs text-foreground'>{row.tag}</span>
							<span
								className={cn(
									'ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
									applied
										? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
										: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
								)}
							>
								{row.state}
							</span>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
