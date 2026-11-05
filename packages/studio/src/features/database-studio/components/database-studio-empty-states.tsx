import { Check, Database, Plus, RotateCw, Settings } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { EmptyState, type EmptyStateAction } from '@studio/shared/ui/empty-state'
import {
	ConnectingIllustration,
	IconStack,
	OfflineIllustration,
	ProjectIllustration,
	RecordIllustration
} from '@studio/shared/ui/empty-state-illustrations'

type NoConnectionProps = {
	onAddConnection?: () => void
}

export function DatabaseStudioNoConnection({ onAddConnection }: NoConnectionProps) {
	return (
		<EmptyState
			className='flex-1'
			loop
			pointer
			illustration={<IconStack icon={<Database />} />}
			title='No database connected'
			description='Select a connection from the sidebar to view its tables, or create a new connection to get started.'
			actions={
				onAddConnection
					? [
							{
								id: 'add-connection',
								label: 'Add connection',
								icon: <Plus />,
								onClick: onAddConnection
							}
						]
					: []
			}
		/>
	)
}

type ConnectionLoadingProps = {
	connectionName?: string
	phase?: 'connecting' | 'introspecting' | null
}

export function DatabaseStudioConnectionLoading({ connectionName, phase }: ConnectionLoadingProps) {
	const introspecting = phase === 'introspecting'
	const steps = [
		{ id: 'connect', label: 'Connect', state: introspecting ? 'done' : 'active' },
		{ id: 'schema', label: 'Read schema', state: introspecting ? 'active' : 'pending' }
	]

	return (
		<EmptyState
			className='flex-1'
			loop
			role='status'
			aria-live='polite'
			illustration={<ConnectingIllustration />}
			title={introspecting ? 'Reading schema' : 'Connecting'}
			description={
				<>
					{introspecting ? 'Loading tables for ' : 'Opening a connection to '}
					{connectionName ? <strong>{connectionName}</strong> : 'this database'}.
				</>
			}
		>
			<ol className='m-0 flex list-none items-center gap-3 p-0 text-xs text-muted-foreground'>
				{steps.map((step, index) => (
					<li key={step.id} className='flex items-center gap-3'>
						{index > 0 && <span className='h-px w-6 bg-border' aria-hidden='true' />}
						<span
							data-state={step.state}
							className='flex items-center gap-1.5 transition-colors duration-200 data-[state=active]:text-foreground data-[state=pending]:opacity-60'
						>
							{step.state === 'done' ? (
								<Check className='size-3.5' />
							) : step.state === 'active' ? (
								<Spinner className='size-3.5' />
							) : (
								<span
									className='size-1.5 rounded-full bg-current'
									aria-hidden='true'
								/>
							)}
							{step.label}
						</span>
					</li>
				))}
			</ol>
		</EmptyState>
	)
}

type ConnectionFailedProps = {
	connectionName?: string
	errorMessage?: string
	onRetry?: () => void
	onEditConnection?: () => void
}

export function DatabaseStudioConnectionFailed({
	connectionName,
	errorMessage,
	onRetry,
	onEditConnection
}: ConnectionFailedProps) {
	const actions: EmptyStateAction[] = []
	if (onRetry) {
		actions.push({ id: 'retry', label: 'Try again', icon: <RotateCw />, onClick: onRetry })
	}
	if (onEditConnection) {
		actions.push({
			id: 'edit',
			label: 'Edit connection',
			icon: <Settings />,
			variant: 'secondary',
			onClick: onEditConnection
		})
	}

	return (
		<EmptyState
			className='flex-1'
			headingLevel='h1'
			loop
			illustration={<OfflineIllustration />}
			title='Connection unavailable'
			description={
				<>
					{connectionName ? <strong>{connectionName}</strong> : 'This database'} is not
					reachable. Check that it is running and that your credentials are still valid.
				</>
			}
			actions={actions}
		>
			{errorMessage ? (
				<p className='order-first max-h-28 w-full max-w-sm overflow-y-auto rounded-md border border-border/50 bg-muted/15 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-muted-foreground/80'>
					{errorMessage}
				</p>
			) : null}
		</EmptyState>
	)
}

export function DatabaseStudioNoTable({
	connectionName,
	tableCount,
	totalRecords,
	onOpenSettings
}: {
	connectionName?: string
	tableCount: number
	totalRecords: number
	onOpenSettings?: () => void
}) {
	const tableLabel = tableCount === 1 ? 'table' : 'tables'
	const recordLabel = totalRecords === 1 ? 'record' : 'records'

	return (
		<EmptyState
			className='flex-1'
			headingLevel='h1'
			loop
			pointer
			illustration={<RecordIllustration />}
			title='No table selected'
			description={
				<>
					Select a table from the sidebar to browse its records, structure, and
					relationships.{' '}
					<strong>
						{connectionName ?? 'This connection'} has {tableCount.toLocaleString()}{' '}
						{tableLabel} totaling an estimated {totalRecords.toLocaleString()}{' '}
						{recordLabel}.
					</strong>
				</>
			}
			actions={
				onOpenSettings
					? [
							{
								id: 'table-preview',
								label: 'Enable table preview',
								icon: <Settings />,
								variant: 'secondary',
								onClick: onOpenSettings
							}
						]
					: []
			}
		/>
	)
}

type NoTablesFoundProps = {
	connectionName?: string
}

export function DatabaseStudioNoTablesFound({ connectionName }: NoTablesFoundProps) {
	return (
		<EmptyState
			className='flex-1'
			headingLevel='h1'
			loop
			pointer
			illustration={<ProjectIllustration />}
			title='No tables found'
			description={
				connectionName
					? `"${connectionName}" connected successfully, but this database has no tables to browse.`
					: 'This database connected successfully, but it has no tables to browse.'
			}
		/>
	)
}
