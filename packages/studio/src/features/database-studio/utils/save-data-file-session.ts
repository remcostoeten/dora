import type { Connection } from '@studio/features/connections/types'
import { isNativeDuckDbFileConnection } from '@studio/features/connections/source-caps'
import { connectionNameFromPath } from '@studio/features/connections/utils/data-files'
import type { SaveDataFileSessionResult } from '@studio/lib/bindings'

export function basename(path: string): string {
	return path.split(/[\\/]/).pop() ?? path
}

export function findExistingDuckDbFileConnection(
	connections: Connection[],
	destinationPath: string
): Connection | undefined {
	return connections.find(function (connection) {
		return isNativeDuckDbFileConnection(connection) && connection.url === destinationPath
	})
}

export function isEditableDuckDbFileConnection(connection: Connection): boolean {
	return isNativeDuckDbFileConnection(connection)
}

export function buildSavedDuckDbConnectionPayload(destinationPath: string) {
	return {
		name: connectionNameFromPath(destinationPath),
		databaseType: {
			DuckDB: {
				db_path: destinationPath,
				file_sources: [] as string[]
			}
		}
	} as const
}

export function formatSaveDataFileSessionToast(result: SaveDataFileSessionResult): {
	title: string
	description: string
} {
	const fileName = basename(result.path)
	const tableCount = result.tables.length
	const tableLabel = tableCount === 1 ? 'table' : 'tables'
	let description = `Saved ${tableCount} ${tableLabel} to ${fileName}.`

	if (result.skipped.length > 0) {
		description += ` Skipped ${result.skipped.length} missing or failed source file(s).`
	}

	return {
		title: `Saved ${tableCount} ${tableLabel} to ${fileName}`,
		description
	}
}

export function hasSkippedDataFileSources(entries: { status: string }[]): boolean {
	return entries.some(function (entry) {
		return entry.status !== 'active'
	})
}
