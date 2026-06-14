import type { SourceCaps } from './source-caps'
import type { SourceMeta } from './source-kinds'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import {
	formatDataFileSourceSummary,
	resolveDataFileSearchText,
} from '@studio/features/connections/data-file-health'
import { describeConnectionSource, type ConnectionSourceInput } from './resolve-source'

export const DATA_FILE_READONLY_MESSAGE =
	'Data files open as readonly DuckDB views. SQL queries and export work, but row editing is disabled until you Save as DuckDB or import into a native DuckDB file.'

export function shouldShowDataFileReadonlyMessage(meta: SourceMeta): boolean {
	return meta.kind === 'data-file'
}

export function resolveProviderLabel(meta: SourceMeta): string {
	if (meta.kind === 'data-file') {
		return 'Data files'
	}

	switch (meta.preset) {
		case 'neon':
			return 'Neon'
		case 'supabase':
			return 'Supabase'
		case 'planetscale':
			return 'PlanetScale'
		case 'turso':
		case 'libsql':
			return 'Turso'
		case 'cockroach':
			return 'CockroachDB'
		case 'mariadb':
			return 'MariaDB'
		case 'mysql':
			return 'MySQL'
		case 'postgres':
			return 'PostgreSQL'
		case 'sqlite':
			return 'SQLite'
		case 'duckdb':
			return 'DuckDB'
		case 'generic':
			break
	}

	switch (meta.engine) {
		case 'postgres':
			return 'PostgreSQL'
		case 'mysql':
			return 'MySQL'
		case 'mariadb':
			return 'MariaDB'
		case 'cockroach':
			return 'CockroachDB'
		case 'sqlite':
			return 'SQLite'
		case 'duckdb':
			return 'DuckDB'
		case 'libsql':
			return 'Turso'
		default:
			return meta.engine
	}
}

export function resolveSourceKindBadge(meta: SourceMeta): string {
	switch (meta.kind) {
		case 'sql-server':
			return 'Server'
		case 'cloud-preset':
			return 'Cloud'
		case 'embedded-database':
			return 'Local database'
		case 'data-file':
			return 'Data files'
	}
}

export function shouldShowSourceKindBadge(meta: SourceMeta): boolean {
	return resolveSourceKindBadge(meta) !== resolveProviderLabel(meta)
}

export function resolveConnectionLocationLabel(
	connection: ConnectionSourceInput & { host?: string },
	meta: SourceMeta = describeConnectionSource(connection)
): string {
	switch (meta.kind) {
		case 'data-file': {
			const count = connection.fileSources?.length ?? 0
			if (count === 0) return 'Local'
			return count === 1 ? '1 file' : `${count} files`
		}
		case 'embedded-database':
			return 'Local'
		case 'cloud-preset':
			return 'Cloud'
		case 'sql-server':
			return connection.host || 'Local'
	}
}

export function resolveConnectionSubtitle(
	connection: ConnectionSourceInput & { host?: string },
	meta: SourceMeta = describeConnectionSource(connection)
): string {
	return `${resolveProviderLabel(meta)} · ${resolveConnectionLocationLabel(connection, meta)}`
}

export function resolveConnectionSearchText(
	connection: ConnectionSourceInput & { host?: string; name?: string },
	caps?: Pick<SourceCaps, 'isReadonly'>,
	dataFileEntries?: DataFileSourceEntry[] | null
): string {
	const meta = describeConnectionSource(connection)
	const parts = [
		connection.name,
		resolveProviderLabel(meta),
		resolveSourceKindBadge(meta),
		meta.kind === 'data-file'
			? resolveDataFileSearchText(dataFileEntries, connection.fileSources)
			: resolveConnectionLocationLabel(connection, meta),
		connection.host,
		meta.engine,
		meta.preset,
		meta.kind,
	]

	if (meta.kind === 'data-file') {
		parts.push(formatDataFileSourceSummary(dataFileEntries, connection.fileSources))
	}

	if (caps?.isReadonly) {
		parts.push('readonly')
	}

	return parts.filter(Boolean).join(' ').toLowerCase()
}
