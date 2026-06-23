import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { commands } from '@studio/lib/bindings'
import {
	LOCAL_FILE_ERRORS,
	mapImportFilesIntoDuckDbError,
} from '@studio/features/connections/local-file-errors'
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
import { DesktopOnlyButton } from '@studio/core/platform'
import { useToast } from '@studio/shared/ui/use-toast'
import { cn } from '@studio/shared/utils/cn'
import { FileUp } from 'lucide-react'
import { Spinner } from '@studio/shared/ui/spinner'
import { useImportFilesIntoDuckdb } from '../hooks/use-import-files-into-duckdb'
import {
	detectImportNameCollisions,
	formatImportFilesIntoDuckDbToast,
	refreshStudioSchemaAfterImport,
} from '../utils/import-files-into-duckdb'

type Props = {
	connectionId: string
	connectionLabel: string
	existingTableNames?: string[]
	className?: string
	disabled?: boolean
}

export function ImportFilesIntoDuckDbButton({
	connectionId,
	connectionLabel,
	existingTableNames = [],
	className,
	disabled = false,
}: Props) {
	const { toast } = useToast()
	const queryClient = useQueryClient()
	const importFiles = useImportFilesIntoDuckdb()
	const [pendingPaths, setPendingPaths] = useState<string[] | null>(null)
	const [showCollisionDialog, setShowCollisionDialog] = useState(false)

	async function runImport(filePaths: string[]) {
		try {
			const result = await importFiles.mutateAsync({
				connectionId,
				filePaths,
			})

			const schemaRefreshed = await refreshStudioSchemaAfterImport(queryClient, connectionId)
			if (!schemaRefreshed) {
				toast({
					title: 'Import completed with a refresh warning',
					description: LOCAL_FILE_ERRORS.schemaRefreshFailed,
					variant: 'destructive',
				})
			}

			const message = formatImportFilesIntoDuckDbToast(result, connectionLabel)
			toast({
				title: message.title,
				description: message.description,
				variant: result.failed.length > 0 ? 'default' : 'success',
			})
		} catch (error) {
			const raw = error instanceof Error ? error.message : 'Import failed'
			toast({
				title: 'Could not import files',
				description: mapImportFilesIntoDuckDbError(raw),
				variant: 'destructive',
			})
		} finally {
			setPendingPaths(null)
			setShowCollisionDialog(false)
		}
	}

	function queueImport(filePaths: string[]) {
		const collisions = detectImportNameCollisions(filePaths, existingTableNames)
		if (collisions.length > 0) {
			setPendingPaths(filePaths)
			setShowCollisionDialog(true)
			return
		}
		void runImport(filePaths)
	}

	async function handleClick() {
		const result = await commands.openDataFiles()
		if (result.status !== 'ok' || result.data.length === 0) {
			return
		}

		queueImport(result.data)
	}

	return (
		<>
			<DesktopOnlyButton
				type='button'
				variant='outline'
				size='sm'
				className={cn('h-7 px-2 text-xs gap-1.5', className)}
				disabled={disabled || importFiles.isPending}
				desktopHint='Desktop app only'
				aria-busy={importFiles.isPending}
				aria-label={
					disabled
						? 'Import files unavailable for this connection'
						: importFiles.isPending
							? 'Importing files into DuckDB'
							: 'Import CSV, JSON, or Parquet files as tables'
				}
				title='Import CSV, JSON, or Parquet files as tables'
				onClick={function () {
					void handleClick()
				}}
			>
				{importFiles.isPending ? (
					<Spinner className='h-3.5 w-3.5' />
				) : (
					<FileUp className='h-3.5 w-3.5' aria-hidden />
				)}
				<span className='hidden sm:inline'>Import files</span>
			</DesktopOnlyButton>

			<AlertDialog open={showCollisionDialog} onOpenChange={setShowCollisionDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Table name already exists</AlertDialogTitle>
						<AlertDialogDescription>
							One or more imported files would use a table name that already exists (
							{pendingPaths
								? detectImportNameCollisions(pendingPaths, existingTableNames).join(', ')
								: ''}
							). Dora will create suffixed names (for example, sales_2) when importing.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={function () {
								setPendingPaths(null)
							}}
						>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={function () {
								if (!pendingPaths) return
								void runImport(pendingPaths)
							}}
						>
							Import anyway
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
