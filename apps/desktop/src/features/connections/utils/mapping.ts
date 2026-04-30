import type { Connection as FrontendConnection } from '@/features/connections/types'
import { ConnectionInfo as BackendConnection, DatabaseInfo, JsonValue } from '@/lib/bindings'

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
	if ((conn.type !== 'postgres' && conn.type !== 'mysql') || !conn.sshConfig?.enabled) {
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
	let type: 'postgres' | 'mysql' | 'sqlite' | 'libsql' = 'sqlite'
	let host, port, user, database, url, authToken, sshConfig

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
	} else if ('SQLite' in conn.database_type) {
		type = 'sqlite'
		url = conn.database_type.SQLite.db_path
	} else if ('LibSQL' in conn.database_type) {
		type = 'libsql'
		url = conn.database_type.LibSQL.url
		authToken = conn.database_type.LibSQL.auth_token ?? undefined
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
		sshConfig,
		status: conn.connected ? 'connected' : 'idle',
		createdAt: conn.created_at ?? Date.now(),
		lastConnectedAt: conn.last_connected_at
	}
}

export function frontendToBackendDatabaseInfo(conn: FrontendConnection): DatabaseInfo {
	if (conn.type === 'postgres' || conn.type === 'mysql') {
		let connectionString: string
		if (conn.url) {
			connectionString = conn.url
		} else {
			const user = conn.user || (conn.type === 'mysql' ? 'root' : 'postgres')
			const password = conn.password || ''
			const host = conn.host || 'localhost'
			const port = conn.port || (conn.type === 'mysql' ? 3306 : 5432)
			const database = conn.database || (conn.type === 'mysql' ? 'mysql' : 'postgres')
			const ssl = conn.ssl ? '?sslmode=require' : ''
			const protocol = conn.type === 'mysql' ? 'mysql' : 'postgresql'
			const encodedUser = encodeURIComponent(user)
			const encodedPassword = encodeURIComponent(password)
			const encodedDatabase = encodeURIComponent(database)
			connectionString = `${protocol}://${encodedUser}:${encodedPassword}@${host}:${port}/${encodedDatabase}${ssl}`
		}
		if (conn.type === 'mysql') {
			return {
				MySQL: {
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
	} else if (conn.type === 'libsql') {
		return { LibSQL: { url: conn.url || 'file:local.db', auth_token: conn.authToken ?? null } }
	}
	throw new Error(`Unsupported database type: ${conn.type}`)
}
