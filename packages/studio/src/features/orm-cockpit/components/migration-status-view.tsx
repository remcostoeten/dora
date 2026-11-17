import { Info } from 'lucide-react'
import { EmptyState } from '@studio/shared/ui/empty-state'
import { IconStack } from '@studio/shared/ui/empty-state-illustrations'
import { SchemaDiffMigrationsSkeleton } from '@studio/shared/ui/view-loading-shell'
import type { MigrationStatusRow } from '@studio/features/orm-cockpit/migration/migration-status'
import type { MigrationStatusState } from '@studio/features/orm-cockpit/components/use-migration-status'

type Props = {
	state: MigrationStatusState
	connectionName: string
}

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
})

function formatWhen(when: number): string {
	return Number.isFinite(when) && when > 0 ? DATE_FORMAT.format(new Date(when)) : ''
}

function MigrationRow({ row }: { row: MigrationStatusRow }) {
	return (
		<li className='sd-mrow'>
			<span className={`sd-dot is-${row.state}`} />
			<span className='sd-mrow-nm'>{row.tag}.sql</span>
			<span className='sd-mrow-st'>
				{row.state === 'pending' ? 'pending' : formatWhen(row.when)}
			</span>
		</li>
	)
}

export function MigrationStatusView({ state, connectionName }: Props) {
	if (state.loading && !state.status) {
		return <SchemaDiffMigrationsSkeleton />
	}

	if (!state.status) {
		return (
			<EmptyState
				loop
				illustration={<IconStack icon={<Info />} />}
				title='No migration status'
				description={state.note ?? 'Nothing to show for this project.'}
			/>
		)
	}

	const { rows, appliedCount, pendingCount, tableMissing } = state.status
	const pending = rows.filter((r) => r.state === 'pending').reverse()
	const applied = rows.filter((r) => r.state === 'applied').reverse()

	return (
		<div className='sd-mig'>
			<div className='sd-mig-h'>
				<span className='sd-eyebrow'>Migration journal</span>
				<p className='sd-mig-say'>
					{pendingCount > 0 ? (
						<>
							{appliedCount} applied,{' '}
							{pendingCount === 1 ? '1 migration' : `${pendingCount} migrations`}{' '}
							waiting to run.
						</>
					) : (
						<>
							All {appliedCount} migrations are applied.{' '}
							<span className='sd-quiet'>The database matches your journal.</span>
						</>
					)}
				</p>
				<p className='sd-mig-sub'>
					Compared against {connectionName}. Apply pending migrations with{' '}
					<code>drizzle-kit migrate</code>; nothing runs from here.
				</p>
				{tableMissing ? (
					<p className='sd-mig-sub'>
						No <code>__drizzle_migrations</code> table in this database, so nothing has
						been applied here yet.
					</p>
				) : null}
			</div>
			<div className='sd-mlist'>
				{pending.length > 0 ? (
					<>
						<p className='sd-eyebrow sd-mgroup'>Pending</p>
						<ul>
							{pending.map((row) => (
								<MigrationRow key={row.idx} row={row} />
							))}
						</ul>
					</>
				) : null}
				{applied.length > 0 ? (
					<>
						<p className='sd-eyebrow sd-mgroup'>Applied</p>
						<ul>
							{applied.map((row) => (
								<MigrationRow key={row.idx} row={row} />
							))}
						</ul>
					</>
				) : null}
			</div>
		</div>
	)
}
