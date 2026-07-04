import type { Connection as FrontendConnection } from '@studio/features/connections/types'
import { ConnectionInfo as BackendConnection, DatabaseInfo, JsonValue } from '@studio/lib/bindings'
import { hasPostgresPoolerMode, setPostgresPoolerMode } from './providers'

function backendToFrontendSshConfig(
	sshConfig: {
		host: string
		port: number
		username: string
		private_key_path: string | null
		password: string | null
	} | null
) {
	if (!sshConfig) {
		return undefined
	}

	return {
		enabled: true,
		host: sshConfig.host,
		port: sshConfig.port,
		username: sshConfig.username,
		authMethod: sshConfig.private_key_path ? 'keyfile' : 'password',
		password: sshConfig.password ?? undefined,
		privateKeyPath: sshConfig.private_key_path ?? undefined
	} as const
}

export function frontendToBackendSshConfig(conn: FrontendConnection) {
	if (
		(conn.type !== 'postgres' &&
			conn.type !== 'cockroach' &&
			conn.type !== 'mysql' &&
			conn.type !== 'mariadb') ||
		!conn.sshConfig?.enabled
	) {
		return null
	}

	return {
		host: conn.sshConfig.host,
		port: conn.sshConfig.port,
		username: conn.sshConfig.username,
		private_key_path:
			conn.sshConfig.authMethod === 'keyfile' ? conn.sshConfig.privateKeyPath || null : null,
		password: conn.sshConfig.authMethod === 'password' ? conn.sshConfig.password || null : null
	}
}

export function backendToFrontendConnection(conn: BackendConnection): FrontendConnection {
	let type: 'postgres' | 'cockroach' | 'mysql' | 'mariadb' | 'sqlite' | 'duckdb' | 'libsql' | 'd1' | 'posthog' = 'sqlite'
	let host, port, user, database, url, authToken, sshConfig, poolerMode
	let fileSources: string[] | undefined

	if ('Postgres' in conn.database_type) {
		type = 'postgres'
		const connString = conn.database_type.Postgres.connection_string
		sshConfig = backendToFrontendSshConfig(conn.database_type.Postgres.ssh_config)
		try {
			const urlObj = new URL(connString)
			host = urlObj.hostname
			port = urlObj.port ? parseInt(urlObj.port) : 5432
			user = urlObj.username
			database = urlObj.pathname.slice(1)
		} catch {
			host = 'localhost'
			port = 5432
		}
		url = connString
		poolerMode = hasPostgresPoolerMode(connString)
	} else if ('CockroachDB' in conn.database_type) {
		type = 'cockroach'
		const connString = conn.database_type.CockroachDB.connection_string
		sshConfig = backendToFrontendSshConfig(conn.database_type.CockroachDB.ssh_config)
		try {
			const urlObj = new URL(connString)
			host = urlObj.hostname
			port = urlObj.port ? parseInt(urlObj.port) : 26257
			user = urlObj.username
			database = urlObj.pathname.slice(1)
		} catch {
			host = 'localhost'
			port = 26257
		}
		url = connString
		poolerMode = hasPostgresPoolerMode(connString)
	} else if ('MySQL' in conn.database_type) {
		type = 'mysql'
		const connString = conn.database_type.MySQL.connection_string
		sshConfig = backendToFrontendSshConfig(conn.database_type.MySQL.ssh_config)
		try {
			const urlObj = new URL(connString)
			host = urlObj.hostname
			port = urlObj.port ? parseInt(urlObj.port) : 3306
			user = urlObj.username
			database = urlObj.pathname.slice(1)
		} catch {
			host = 'localhost'
			port = 3306
		}
		url = connString
	} else if ('MariaDB' in conn.database_type) {
		type = 'mariadb'
		const connString = conn.database_type.MariaDB.connection_string
		sshConfig = backendToFrontendSshConfig(conn.database_type.MariaDB.ssh_config)
		try {
			const urlObj = new URL(connString)
			host = urlObj.hostname
			port = urlObj.port ? parseInt(urlObj.port) : 3306
			user = urlObj.username
			database = urlObj.pathname.slice(1)
		} catch {
			host = 'localhost'
			port = 3306
		}
		url = connString
	} else if ('SQLite' in conn.database_type) {
		type = 'sqlite'
		url = conn.database_type.SQLite.db_path
	} else if ('DuckDB' in conn.database_type) {
		type = 'duckdb'
		url = conn.database_type.DuckDB.db_path
		const sources = conn.database_type.DuckDB.file_sources
		fileSources = sources && sources.length > 0 ? sources : undefined
	} else if ('LibSQL' in conn.database_type) {
		type = 'libsql'
		url = conn.database_type.LibSQL.url
		authToken = conn.database_type.LibSQL.auth_token ?? undefined
	} else if ('D1' in conn.database_type) {
		type = 'd1'
		url = conn.database_type.D1.url
	} else if ('Posthog' in conn.database_type) {
		type = 'posthog'
		url = conn.database_type.Posthog.url
	}

	return {
		id: conn.id,
		name: conn.name,
		type,
		host,
		port,
		user,
		database,
		url,
		authToken,
		fileSources,
		sshConfig,
		poolerMode,
		status: conn.connected ? 'connected' : 'idle',
		createdAt: conn.created_at ?? Date.now(),
		lastConnectedAt: conn.last_connected_at
	}
}

export function frontendToBackendDatabaseInfo(conn: FrontendConnection): DatabaseInfo {
	if (conn.type === 'postgres' || conn.type === 'cockroach' || conn.type === 'mysql' || conn.type === 'mariadb') {
		let connectionString: string
		if (conn.url) {
			connectionString = conn.url
		} else {
			const isMySqlLike = conn.type === 'mysql' || conn.type === 'mariadb'
			const user = conn.user || (isMySqlLike ? 'root' : conn.type === 'cockroach' ? 'root' : 'postgres')
			const password = conn.password || ''
			const host = conn.host || 'localhost'
			const port =
				conn.port ||
				(conn.type === 'cockroach' ? 26257 : isMySqlLike ? 3306 : 5432)
			const database =
				conn.database ||
				(conn.type === 'cockroach' ? 'defaultdb' : isMySqlLike ? 'mysql' : 'postgres')
			const ssl = conn.ssl ? '?sslmode=require' : ''
			const protocol = isMySqlLike ? 'mysql' : 'postgresql'
			const encodedUser = encodeURIComponent(user)
			const encodedPassword = encodeURIComponent(password)
			const encodedDatabase = encodeURIComponent(database)
			connectionString = `${protocol}://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}${ssl}`
		}
		if (conn.type === 'postgres' || conn.type === 'cockroach') {
			connectionString = setPostgresPoolerMode(connectionString, conn.poolerMode ?? false)
		}
		if (conn.type === 'mysql') {
			return {
				MySQL: {
					connection_string: connectionString,
					ssh_config: frontendToBackendSshConfig(conn)
				}
			}
		}
		if (conn.type === 'mariadb') {
			return {
				MariaDB: {
					connection_string: connectionString,
					ssh_config: frontendToBackendSshConfig(conn)
				}
			}
		}
		if (conn.type === 'cockroach') {
			return {
				CockroachDB: {
					connection_string: connectionString,
					ssh_config: frontendToBackendSshConfig(conn)
				}
			}
		}

		return {
			Postgres: {
				connection_string: connectionString,
				ssh_config: frontendToBackendSshConfig(conn)
			}
		}
	} else if (conn.type === 'sqlite') {
		return { SQLite: { db_path: conn.url || ':memory:' } }
	} else if (conn.type === 'duckdb') {
		if (conn.fileSources && conn.fileSources.length > 0) {
			return { DuckDB: { db_path: ':memory:', file_sources: conn.fileSources } }
		}
		return { DuckDB: { db_path: conn.url || ':memory:' } }
	} else if (conn.type === 'libsql') {
		return { LibSQL: { url: conn.url || 'file:local.db', auth_token: conn.authToken ?? null } }
	} else if (conn.type === 'd1') {
		return { D1: { url: conn.url || '' } }
	} else if (conn.type === 'posthog') {
		return { Posthog: { url: conn.url || '' } }
	}
	throw new Error(`Unsupported database type: ${conn.type}`)
}
