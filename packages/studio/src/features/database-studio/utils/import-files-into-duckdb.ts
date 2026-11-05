import type { QueryClient } from '@tanstack/react-query'
import type { ImportFilesIntoDuckDbResult } from '@studio/lib/bindings'
import { LOCAL_FILE_ERRORS } from '@studio/features/connections/local-file-errors'
import { viewNameForPath } from '@studio/features/connections/utils/data-file-views'

export function basename(path: string): string {
	return path.split(/[\\/]/).pop() ?? path
}

export function detectImportNameCollisions(
	filePaths: string[],
	existingTableNames: string[]
): string[] {
	const existing = new Set(
		existingTableNames.map(function (name) {
			return name.toLowerCase()
		})
	)
	const batchTaken = new Set<string>()
	const collisions: string[] = []

	for (const path of filePaths) {
		const proposed = viewNameForPath(path, batchTaken)
		batchTaken.add(proposed)
		if (existing.has(proposed.toLowerCase())) {
			collisions.push(proposed)
		}
	}

	return collisions
}

export function formatImportFilesIntoDuckDbToast(
	result: ImportFilesIntoDuckDbResult,
	connectionLabel: string
): { title: string; description: string } {
	const count = result.tables.length
	const fileLabel = count === 1 ? 'file' : 'files'

	if (result.failed.length > 0) {
		return {
			title: `Imported ${count} ${fileLabel} into ${connectionLabel}`,
			description: LOCAL_FILE_ERRORS.partialImportCompleted(count, result.failed.length)
		}
	}

	let description = `Imported ${count} ${fileLabel} into ${connectionLabel}.`

	if (result.warnings.length > 0) {
		description += ` ${result.warnings[0]}`
	}

	return {
		title: `Imported ${count} ${fileLabel} into ${connectionLabel}`,
		description
	}
}

export function refreshStudioSchema(connectionId: string) {
	if (typeof window === 'undefined' || !connectionId) return
	window.dispatchEvent(
		new CustomEvent('dora-schema-refresh', {
			detail: { connectionId }
		})
	)
}

export async function refreshStudioSchemaAfterImport(
	queryClient: QueryClient,
	connectionId: string
): Promise<boolean> {
	refreshStudioSchema(connectionId)
	await queryClient.refetchQueries({ queryKey: ['schema', connectionId], type: 'active' })
	const query = queryClient.getQueryCache().find({ queryKey: ['schema', connectionId] })
	return query?.state.status !== 'error'
}
