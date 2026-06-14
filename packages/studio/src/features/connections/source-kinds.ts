import type { DatabaseType } from './types'

export type DbEngine = DatabaseType

export type DbPreset =
	| 'postgres'
	| 'neon'
	| 'supabase'
	| 'cockroach'
	| 'cockroach-cloud'
	| 'mysql'
	| 'mariadb'
	| 'planetscale'
	| 'tidb'
	| 'sqlite'
	| 'duckdb'
	| 'libsql'
	| 'turso'
	| 'railway'
	| 'fly'
	| 'aiven'
	| 'render'
	| 'vercel'
	| 'digitalocean'
	| 'timescale'
	| 'crunchy'
	| 'generic'

export type SourceKind = 'sql-server' | 'cloud-preset' | 'embedded-database' | 'data-file'

export type SourceMeta = {
	kind: SourceKind
	engine: DbEngine
	preset: DbPreset
	isDataFileSession: boolean
}
