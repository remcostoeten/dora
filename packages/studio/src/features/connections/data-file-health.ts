import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import { describeConnectionSource, type ConnectionSourceInput } from './resolve-source'
import type { SourceMeta } from './source-kinds'

export type DataFileHealth = 'active' | 'connected-with-issues' | 'unavailable'

export const DATA_FILE_HELP_ITEMS = [
	'SQLite and DuckDB files are real editable database files.',
	'CSV, JSON, and Parquet open as readonly data files (DuckDB views).',
	'Use Save as DuckDB to materialize data files into an editable .duckdb file.',
	'Use Import files on native DuckDB files to add CSV, JSON, or Parquet as tables.',
	'Broken or moved files can be relocated from the source panel.',
] as const

export const SAVE_AS_DUCKDB_PLACEHOLDER_LABEL = 'Save as DuckDB'
export const SAVE_AS_DUCKDB_PLACEHOLDER_HINT =
	'Materialize active data files into a new editable .duckdb file on disk.'

type HealthInput = {
	entries?: DataFileSourceEntry[] | null
	connectionStatus?: 'connected' | 'error' | 'idle'
}

export function resolveDataFileHealth(input: HealthInput): DataFileHealth | null {
	const { entries, connectionStatus } = input

	if (connectionStatus === 'error') {
		return 'unavailable'
	}

	if (!entries || entries.length === 0) {
		return null
	}

	const activeCount = entries.filter(function (entry) {
		return entry.status === 'active'
	}).length

	if (activeCount === 0) {
		return 'unavailable'
	}

	const hasIssues = entries.some(function (entry) {
		return entry.status !== 'active'
	})

	return hasIssues ? 'connected-with-issues' : 'active'
}

export function dataFileHealthLabel(health: DataFileHealth): string {
	switch (health) {
		case 'active':
			return 'Active'
		case 'connected-with-issues':
			return 'Connected with issues'
		case 'unavailable':
			return 'Unavailable'
	}
}

export function formatDataFileSourceSummary(
	entries: DataFileSourceEntry[] | null | undefined,
	fileSourcePaths: string[] | undefined
): string {
	if (entries && entries.length > 0) {
		const activeCount = entries.filter(function (entry) {
			return entry.status === 'active'
		}).length
		const missingCount = entries.filter(function (entry) {
			return entry.status === 'missing'
		}).length
		const failedCount = entries.filter(function (entry) {
			return entry.status === 'failed'
		}).length
		const issueCount = missingCount + failedCount

		if (issueCount === 0) {
			return activeCount === 1 ? 'Data files · 1 file' : `Data files · ${activeCount} files`
		}

		const parts: string[] = []
		if (activeCount > 0) {
			parts.push(`${activeCount} active`)
		}
		if (missingCount > 0) {
			parts.push(`${missingCount} missing`)
		}
		if (failedCount > 0) {
			parts.push(`${failedCount} failed`)
		}

		return `Data files · ${parts.join(', ')}`
	}

	const count = fileSourcePaths?.length ?? 0
	if (count === 0) {
		return 'Data files · Local'
	}
	return count === 1 ? 'Data files · 1 file' : `Data files · ${count} files`
}

export function shouldShowDataFileHelpPanel(meta: SourceMeta): boolean {
	return meta.kind === 'data-file'
}

export function isDataFileConnection(connection: ConnectionSourceInput): boolean {
	return describeConnectionSource(connection).kind === 'data-file'
}

export function resolveDataFileConnectionSummary(
	connection: ConnectionSourceInput & { fileSources?: string[] },
	entries?: DataFileSourceEntry[] | null
): string {
	return formatDataFileSourceSummary(entries, connection.fileSources)
}

export function resolveDataFileSearchText(
	entries: DataFileSourceEntry[] | null | undefined,
	fileSourcePaths: string[] | undefined
): string {
	const summary = formatDataFileSourceSummary(entries, fileSourcePaths)
	const health = resolveDataFileHealth({ entries })
	const healthText = health ? dataFileHealthLabel(health) : ''
	return `${summary} ${healthText}`.trim().toLowerCase()
}
