import { useState } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { exists } from '@tauri-apps/plugin-fs'
import type { Connection } from '@studio/features/connections/types'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import { SAVE_AS_DUCKDB_PLACEHOLDER_HINT, SAVE_AS_DUCKDB_PLACEHOLDER_LABEL } from '@studio/features/connections/data-file-health'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@studio/shared/ui/alert-dialog'
import { useConnections } from '@studio/core/data-provider'
import { DesktopOnlyButton } from '@studio/core/platform'
import { mapSaveDataFileSessionError } from '@studio/features/connections/local-file-errors'
import { useToast } from '@studio/shared/ui/use-toast'
import { cn } from '@studio/shared/utils/cn'
import { Database } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { useSaveDataFileSession } from '../hooks/use-save-data-file-session'
import {
	basename,
	formatSaveDataFileSessionToast,
	hasSkippedDataFileSources,
} from '../utils/save-data-file-session'

type Props = {
	connection: Connection
	entries: DataFileSourceEntry[]
	className?: string
	onConnectionSelect?: (connectionId: string) => void
}

type PendingSave = {
	destinationPath: string
	overwrite: boolean
}

export function SaveAsDuckDbButton({
	connection,
	entries,
	className,
	onConnectionSelect,
}: Props) {
	const { toast } = useToast()
	const { data: connections = [] } = useConnections()
	const { saveSession, openSavedConnection } = useSaveDataFileSession()
	const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
	const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)
	const [showSkippedDialog, setShowSkippedDialog] = useState(false)
	const isBusy = saveSession.isPending || openSavedConnection.isPending

	async function performSave(params: PendingSave) {
		try {
			const result = await saveSession.mutateAsync({
				connectionId: connection.id,
				destinationPath: params.destinationPath,
				overwrite: params.overwrite,
			})

			const savedConnection = await openSavedConnection.mutateAsync({
				result,
				connections,
			})

			onConnectionSelect?.(savedConnection.id)

			const message = formatSaveDataFileSessionToast(result)
			toast({
				title: message.title,
				description: message.description,
				variant: 'success',
			})
		} catch (error) {
			const raw = error instanceof Error ? error.message : 'Save failed'
			toast({
				title: 'Could not save as DuckDB',
				description: mapSaveDataFileSessionError(raw),
				variant: 'destructive',
			})
		} finally {
			setPendingSave(null)
			setShowOverwriteDialog(false)
			setShowSkippedDialog(false)
		}
	}

	function queueSave(destinationPath: string, overwrite: boolean) {
		const nextSave = { destinationPath, overwrite }
		if (hasSkippedDataFileSources(entries)) {
			setPendingSave(nextSave)
			setShowSkippedDialog(true)
			return
		}
		void performSave(nextSave)
	}

	async function handleClick() {
		const defaultPath = `${connection.name.replace(/[^\w.-]+/g, '_')}.duckdb`
		const destinationPath = await save({
			filters: [{ name: 'DuckDB database', extensions: ['duckdb'] }],
			defaultPath,
		})

		if (!destinationPath) {
			return
		}

		if (await exists(destinationPath)) {
			setPendingSave({ destinationPath, overwrite: false })
			setShowOverwriteDialog(true)
			return
		}

		queueSave(destinationPath, false)
	}

	return (
		<div className={cn(className)}>
			<DesktopOnlyButton
				type='button'
				variant='outline'
				size='sm'
				className='h-7 gap-1 px-2 text-xs'
				disabled={isBusy}
				desktopHint='Desktop app only'
				aria-busy={isBusy}
				aria-label={
					isBusy
						? 'Saving data files as DuckDB'
						: `${SAVE_AS_DUCKDB_PLACEHOLDER_LABEL}. ${SAVE_AS_DUCKDB_PLACEHOLDER_HINT}`
				}
				title={SAVE_AS_DUCKDB_PLACEHOLDER_HINT}
				onClick={function () {
					void handleClick()
				}}
			>
				{isBusy ? (
					<Spinner className='h-3 w-3' />
				) : (
					<Database className='h-3 w-3' aria-hidden />
				)}
				{SAVE_AS_DUCKDB_PLACEHOLDER_LABEL}
			</DesktopOnlyButton>

			<AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Overwrite existing DuckDB file?</AlertDialogTitle>
						<AlertDialogDescription>
							{basename(pendingSave?.destinationPath ?? '')} already exists on disk.
							Overwriting permanently replaces that file with materialized tables from this
							session. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={function () {
								setPendingSave(null)
							}}
						>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={function () {
								if (!pendingSave) return
								queueSave(pendingSave.destinationPath, true)
							}}
						>
							Overwrite file
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={showSkippedDialog} onOpenChange={setShowSkippedDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Save with skipped sources?</AlertDialogTitle>
						<AlertDialogDescription>
							Some files in this session are missing or failed to register. Only active
							sources will be materialized into the DuckDB file.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={function () {
								setPendingSave(null)
							}}
						>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={function () {
								if (!pendingSave) return
								void performSave(pendingSave)
							}}
						>
							Continue
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
