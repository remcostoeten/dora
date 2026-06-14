import type { Connection } from './types'
import type { DbEngine, DbPreset, SourceKind, SourceMeta } from './source-kinds'
import { detectProviderName } from './utils/providers'

export type ConnectionSourceInput = Pick<Connection, 'type' | 'fileSources' | 'url'>

/** Maps a preset to the wire driver family used for execution. */
export function resolvePresetToEngine(preset: DbPreset): DbEngine {
	switch (preset) {
		case 'neon':
		case 'supabase':
		case 'render':
		case 'vercel':
		case 'railway':
		case 'fly':
		case 'aiven':
		case 'digitalocean':
		case 'timescale':
		case 'crunchy':
		case 'postgres':
			return 'postgres'
		// cockroach-cloud uses the cockroach dialect (postgres-wire with cockroach extensions)
		case 'cockroach':
		case 'cockroach-cloud':
			return 'cockroach'
		case 'tidb':
		case 'planetscale':
		case 'mysql':
			return 'mysql'
		case 'mariadb':
			return 'mysql'
		case 'turso':
		case 'libsql':
			return 'libsql'
		case 'duckdb':
			return 'duckdb'
		case 'sqlite':
		case 'generic':
			return 'sqlite'
	}
}

function inferPresetFromConnection(connection: ConnectionSourceInput): DbPreset {
	if (connection.type === 'cockroach') return 'cockroach'
	if (connection.type === 'mariadb') return 'mariadb'
	if (connection.type === 'duckdb') return 'duckdb'
	if (connection.type === 'sqlite') return 'sqlite'
	if (connection.type === 'libsql') return 'turso'
	if (connection.type === 'mysql') return 'mysql'

	if (connection.url) {
		// Use detectProviderName which delegates to PROVIDER_PATTERNS — single source of truth.
		const label = detectProviderName(connection.url).toLowerCase()
		if (label.includes('neon')) return 'neon'
		if (label.includes('supabase')) return 'supabase'
		if (label.includes('planetscale')) return 'planetscale'
		if (label.includes('cockroachdb cloud')) return 'cockroach-cloud'
		if (label.includes('cockroach')) return 'cockroach'
		if (label.includes('turso')) return 'turso'
		if (label.includes('tidb')) return 'tidb'
		if (label.includes('railway')) return 'railway'
		if (label.includes('fly.io')) return 'fly'
		if (label.includes('aiven')) return 'aiven'
		if (label.includes('render')) return 'render'
		if (label.includes('vercel')) return 'vercel'
		if (label.includes('digitalocean')) return 'digitalocean'
		if (label.includes('timescale')) return 'timescale'
		if (label.includes('crunchy')) return 'crunchy'
	}

	return connection.type
}

function inferSourceKind(connection: ConnectionSourceInput, preset: DbPreset): SourceKind {
	if ((connection.fileSources?.length ?? 0) > 0) return 'data-file'
	if (connection.type === 'sqlite' || connection.type === 'duckdb') return 'embedded-database'
	if (connection.type === 'libsql' && connection.url?.startsWith('file:')) {
		return 'embedded-database'
	}
	if (
		preset === 'neon' ||
		preset === 'supabase' ||
		preset === 'turso' ||
		preset === 'planetscale' ||
		preset === 'cockroach-cloud' ||
		preset === 'tidb' ||
		preset === 'railway' ||
		preset === 'fly' ||
		preset === 'aiven' ||
		preset === 'render' ||
		preset === 'vercel' ||
		preset === 'digitalocean' ||
		preset === 'timescale' ||
		preset === 'crunchy'
	) {
		return 'cloud-preset'
	}
	return 'sql-server'
}

export function describeConnectionSource(connection: ConnectionSourceInput): SourceMeta {
	const preset = inferPresetFromConnection(connection)
	const isDataFileSession =
		connection.type === 'duckdb' && (connection.fileSources?.length ?? 0) > 0

	return {
		kind: inferSourceKind(connection, preset),
		engine: connection.type,
		preset,
		isDataFileSession,
	}
}
