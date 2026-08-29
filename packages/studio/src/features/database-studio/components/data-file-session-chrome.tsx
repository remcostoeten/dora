import type { ReactNode } from 'react'
import type { Connection } from '@studio/features/connections/types'
import { describeConnectionSource } from '@studio/features/connections/resolve-source'
import { getSourceCaps } from '@studio/features/connections/source-caps'
import { resolveDataFileHealth } from '@studio/features/connections/data-file-health'
import { cn } from '@studio/shared/utils/cn'
import { useToast } from '@studio/shared/ui/use-toast'
import { DataFileSourcePanel } from './data-file-source-panel'
import { FollowerDiffButton } from './follower-diff-button'
import { SaveAsDuckDbButton } from './save-as-duckdb-button'
import { useDataFileSources } from '../hooks/use-data-file-sources'

type Props = {
	connection: Connection
	selectedTableName?: string | null
	className?: string
	onConnectionSelect?: (connectionId: string) => void
	children: ReactNode
}

export function DataFileSessionChrome({
	connection,
	selectedTableName,
	className,
	onConnectionSelect,
	children
}: Props) {
	const { toast } = useToast()
	const meta = describeConnectionSource(connection)
	const caps = getSourceCaps(connection, meta)
	const { entries, isLoading, isRecovering, retryRegistration, removeSource, relocateSource } =
		useDataFileSources(connection)

	if (meta.kind !== 'data-file') {
		return children
	}

	const health = resolveDataFileHealth({
		entries,
		connectionStatus: connection.status
	})

	async function handleRetry() {
		try {
			await retryRegistration.mutateAsync()
			toast({ title: 'Registration retried', description: 'Data file views were refreshed.' })
		} catch (error) {
			toast({
				title: 'Retry failed',
				description:
					error instanceof Error ? error.message : 'Could not retry registration',
				variant: 'destructive'
			})
		}
	}

	async function handleRemove(path: string) {
		try {
			await removeSource.mutateAsync(path)
			toast({ title: 'Source removed', description: 'The connection was updated.' })
		} catch (error) {
			toast({
				title: 'Could not remove source',
				description: error instanceof Error ? error.message : 'Update failed',
				variant: 'destructive'
			})
		}
	}

	async function handleRelocate(path: string) {
		try {
			const result = await relocateSource.mutateAsync(path)
			if (result) {
				toast({ title: 'File relocated', description: 'The source path was updated.' })
			}
		} catch (error) {
			toast({
				title: 'Could not relocate file',
				description: error instanceof Error ? error.message : 'Update failed',
				variant: 'destructive'
			})
		}
	}

	return (
		<div className={cn('flex h-full min-h-0 flex-col', className)}>
			{!isLoading && (
				<DataFileSourcePanel
					entries={entries}
					isReadonly={caps.isReadonly}
					selectedTableName={selectedTableName}
					isRecovering={isRecovering}
					health={health}
					headerActions={
						<>
							<FollowerDiffButton connectionId={connection.id} entries={entries} />
							<SaveAsDuckDbButton
								connection={connection}
								entries={entries}
								onConnectionSelect={onConnectionSelect}
							/>
						</>
					}
					onRetry={handleRetry}
					onRemove={handleRemove}
					onRelocate={handleRelocate}
				/>
			)}
			<div className='flex min-h-0 flex-1 flex-col'>{children}</div>
		</div>
	)
}
