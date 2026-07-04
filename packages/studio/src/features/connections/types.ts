export type DatabaseType =
	| 'postgres'
	| 'cockroach'
	| 'mysql'
	| 'mariadb'
	| 'sqlite'
	| 'duckdb'
	| 'libsql'
	| 'd1'
	| 'posthog'

export type SshAuthMethod = 'password' | 'keyfile'

export type SshTunnelConfig = {
	enabled: boolean
	host: string
	port: number
	username: string
	authMethod: SshAuthMethod
	password?: string
	privateKeyPath?: string
}

export type Connection = {
	id: string
	name: string
	type: DatabaseType
	host?: string
	port?: number
	user?: string
	password?: string
	database?: string
	ssl?: boolean
	poolerMode?: boolean
	url?: string
	authToken?: string
	/**
	 * For DuckDB "data file" connections: the CSV/TSV/Parquet/JSON files opened
	 * as read-only views in an in-memory DuckDB. Empty/undefined means a normal
	 * single-file DuckDB database.
	 */
	fileSources?: string[]
	status?: 'connected' | 'error' | 'idle'
	error?: string
	sshConfig?: SshTunnelConfig
	createdAt: number
	lastConnectedAt?: number | null
}

import { isReadonlySource } from './source-caps'

/** @deprecated Prefer `isReadonlySource()` or `getSourceCaps().isReadonly`. */
export function isReadOnlyConnection(connection: Pick<Connection, 'type' | 'fileSources' | 'url'>): boolean {
	return isReadonlySource(connection)
}

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
	postgres: 5432,
	cockroach: 26257,
	mysql: 3306,
	mariadb: 3306,
	sqlite: 0,
	duckdb: 0,
	libsql: 0,
	d1: 0,
	posthog: 0
}
