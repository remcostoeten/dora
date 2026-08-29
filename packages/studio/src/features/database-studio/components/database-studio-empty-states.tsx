import { Button } from '@studio/shared/ui/button'
import { Database, PlugZap, Plus, RotateCw, Settings, Table2 } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { motion } from 'framer-motion'

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
	phase?: 'connecting' | 'introspecting' | null
}

export function DatabaseStudioConnectionLoading({ connectionName, phase }: ConnectionLoadingProps) {
	return (
		<div className='flex flex-1 flex-col items-center justify-center p-6 text-center'>
			<Spinner className='h-8 w-8 text-muted-foreground/70 mb-4' />
			<h2 className='text-lg font-semibold text-foreground mb-1 tracking-tight'>
				{phase === 'introspecting' ? 'Reading schema…' : 'Connecting…'}
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
		<div className='flex flex-1 items-center justify-center p-6'>
			<motion.div
				initial={{ opacity: 0, y: 4 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
				className='w-full max-w-sm text-center'
			>
				<PlugZap
					className='mx-auto mb-4 h-7 w-7 text-muted-foreground/60'
					strokeWidth={1.5}
				/>

				<h1 className='text-sm font-medium text-foreground'>Connection unavailable</h1>
				<p className='mt-1.5 text-[13px] leading-relaxed text-muted-foreground'>
					{connectionName ? (
						<span className='text-foreground/80'>{connectionName}</span>
					) : (
						'This database'
					)}{' '}
					is not reachable. Check that it is running and that your credentials are still
					valid.
				</p>

				{errorMessage ? (
					<p className='mt-4 max-h-28 overflow-y-auto rounded-md border border-border/50 bg-muted/15 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-muted-foreground/80'>
						{errorMessage}
					</p>
				) : null}

				<div className='mt-5 flex flex-wrap items-center justify-center gap-2'>
					{onRetry && (
						<Button size='sm' variant='outline' onClick={onRetry} className='gap-1.5'>
							<RotateCw className='h-3.5 w-3.5' />
							Try again
						</Button>
					)}
					{onEditConnection && (
						<Button
							size='sm'
							variant='ghost'
							onClick={onEditConnection}
							className='gap-1.5 text-muted-foreground'
						>
							<Settings className='h-3.5 w-3.5' />
							Edit connection
						</Button>
					)}
				</div>
			</motion.div>
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
