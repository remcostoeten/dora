import { Button } from '@studio/shared/ui/button'
import { Database, PlugZap, Plus, Settings, Table2 } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'

type NoConnectionProps = {
	onAddConnection?: () => void
}

export function DatabaseStudioNoConnection({ onAddConnection }: NoConnectionProps) {
	return (
		<div className='flex flex-1 flex-col items-center justify-center p-6'>
			<div className='w-20 h-20 bg-sidebar-accent/30 rounded-full flex items-center justify-center mb-6 ring-1 ring-sidebar-border/50 shadow-sm backdrop-blur-sm'>
				<Database className='w-10 h-10 text-primary/60' strokeWidth={1.5} />
			</div>
			<h2 className='text-xl font-semibold mb-2 text-foreground tracking-tight'>
				No Database Connected
			</h2>
			<p className='text-muted-foreground text-center max-w-sm mb-8 leading-relaxed text-sm'>
				Select a connection from the sidebar to view its tables, or create a new
				connection to get started.
			</p>

			{onAddConnection && (
				<Button
					onClick={onAddConnection}
					className='gap-2 shadow-md hover:shadow-lg transition-all'
				>
					<Plus className='w-4 h-4' />
					Add Connection
				</Button>
			)}
		</div>
	)
}

type ConnectionLoadingProps = {
	connectionName?: string
}

export function DatabaseStudioConnectionLoading({ connectionName }: ConnectionLoadingProps) {
	return (
		<div className='flex flex-1 flex-col items-center justify-center p-6 text-center'>
			<Spinner className='h-8 w-8 text-muted-foreground/70 mb-4' />
			<h2 className='text-lg font-semibold text-foreground mb-1 tracking-tight'>
				Connecting…
			</h2>
			<p className='text-muted-foreground text-sm max-w-sm'>
				{connectionName
					? `Loading tables for ${connectionName}.`
					: 'Loading tables for this connection.'}
			</p>
		</div>
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
	return (
		<div className='flex flex-1 flex-col items-center justify-center p-6 text-center'>
			<div className='w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-destructive/20'>
				<PlugZap className='h-10 w-10 text-destructive/80' strokeWidth={1.5} />
			</div>
			<h1 className='text-xl font-semibold text-foreground mb-2 tracking-tight'>
				Connection Unavailable
			</h1>
			<p className='text-muted-foreground text-sm max-w-md leading-relaxed'>
				{connectionName
					? `Could not connect to "${connectionName}".`
					: 'Could not connect to this database.'}{' '}
				Check that the database is running and your credentials are still valid.
			</p>
			{errorMessage ? (
				<p className='mt-3 max-w-md text-xs leading-relaxed text-muted-foreground/80 border border-border/60 bg-muted/20 px-3 py-2'>
					{errorMessage}
				</p>
			) : null}
			<div className='mt-6 flex flex-wrap items-center justify-center gap-2'>
				{onRetry && (
					<Button variant='outline' onClick={onRetry}>
						Try Again
					</Button>
				)}
				{onEditConnection && <Button onClick={onEditConnection}>Edit Connection</Button>}
			</div>
		</div>
	)
}

function formatRecordTotal(count: number): string {
	return count.toLocaleString()
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
		<div className='flex flex-1 flex-col items-center justify-center p-6 text-center'>
			<div className='w-20 h-20 bg-sidebar-accent/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-sidebar-border/30'>
				<svg
					className='h-10 w-10 text-muted-foreground/50'
					viewBox='0 0 24 24'
					fill='none'
					stroke='currentColor'
					strokeWidth='1.5'
				>
					<rect x='3' y='3' width='18' height='18' rx='2' />
					<line x1='9' y1='3' x2='9' y2='21' />
				</svg>
			</div>
			<h1 className='text-xl font-semibold text-foreground mb-2 tracking-tight'>
				No Table Selected
			</h1>
			<p className='text-muted-foreground text-sm max-w-md leading-relaxed'>
				Select a table from the sidebar to browse its records, structure, and
				relationships.
				{connectionName ? (
					<>
						{' '}
						<span className='text-foreground/85'>
							{connectionName} has {tableCount.toLocaleString()} {tableLabel} totaling
							an estimated {formatRecordTotal(totalRecords)} {recordLabel}.
						</span>
					</>
				) : (
					<>
						{' '}
						<span className='text-foreground/85'>
							This connection has {tableCount.toLocaleString()} {tableLabel} totaling an
							estimated {formatRecordTotal(totalRecords)} {recordLabel}.
						</span>
					</>
				)}
			</p>

			{onOpenSettings && (
				<Button
					variant='outline'
					size='sm'
					onClick={onOpenSettings}
					className='mt-6 gap-1.5'
				>
					<Settings className='w-3.5 h-3.5' />
					Enable table preview
				</Button>
			)}
		</div>
	)
}

type NoTablesFoundProps = {
	connectionName?: string
}

export function DatabaseStudioNoTablesFound({ connectionName }: NoTablesFoundProps) {
	return (
		<div className='flex flex-1 flex-col items-center justify-center p-6 text-center'>
			<div className='w-20 h-20 bg-sidebar-accent/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-sidebar-border/30'>
				<Table2 className='h-10 w-10 text-muted-foreground/50' strokeWidth={1.5} />
			</div>
			<h1 className='text-xl font-semibold text-foreground mb-2 tracking-tight'>
				No Tables Found
			</h1>
			<p className='text-muted-foreground text-sm max-w-md leading-relaxed'>
				{connectionName
					? `"${connectionName}" connected successfully, but this database has no tables to browse.`
					: 'This database connected successfully, but it has no tables to browse.'}
			</p>
		</div>
	)
}
