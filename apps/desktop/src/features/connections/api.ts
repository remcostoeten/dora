import type { Connection as FrontendConnection } from '@/features/connections/types'
import { commands, ConnectionInfo as BackendConnection, DatabaseInfo } from '@/lib/bindings'

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

function frontendToBackendSshConfig(conn: FrontendConnection) {
	if (conn.type !== 'postgres' || !conn.sshConfig?.enabled) {
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
	if (conn.type === 'postgres') {
		// Use the URL directly if provided (connection string mode)
		// Otherwise build from individual fields
		let connectionString: string
		if (conn.url) {
			connectionString = conn.url
		} else {
			const user = conn.user || 'postgres'
			const password = conn.password || ''
			const host = conn.host || 'localhost'
			const port = conn.port || 5432
			const database = conn.database || 'postgres'
			const ssl = conn.ssl ? '?sslmode=require' : ''
			connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}${ssl}`
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

export async function loadConnections(): Promise<FrontendConnection[]> {
	const result = await commands.getConnections()
	if (result.status === 'ok') {
		return result.data.map(backendToFrontendConnection)
	}
	return []
}

export async function addConnection(conn: FrontendConnection): Promise<FrontendConnection> {
	const dbInfo = frontendToBackendDatabaseInfo(conn)
	const result = await commands.addConnection(conn.name, dbInfo, null)
	if (result.status === 'ok') {
		return backendToFrontendConnection(result.data)
	}
	throw new Error(result.error as string)
}

export async function updateConnection(conn: FrontendConnection): Promise<FrontendConnection> {
	const dbInfo = frontendToBackendDatabaseInfo(conn)
	const result = await commands.updateConnection(conn.id, conn.name, dbInfo, null)
	if (result.status === 'ok') {
		return backendToFrontendConnection(result.data)
	}
	throw new Error(result.error as string)
}

export async function removeConnection(connectionId: string): Promise<void> {
	const result = await commands.removeConnection(connectionId)
	if (result.status === 'error') {
		throw new Error(result.error as string)
	}
}

export async function connectToDatabase(connectionId: string): Promise<boolean> {
	const result = await commands.connectToDatabase(connectionId)
	if (result.status === 'ok') {
		return result.data
	}
	throw new Error(result.error as string)
}

export async function disconnectFromDatabase(connectionId: string): Promise<void> {
	const result = await commands.disconnectFromDatabase(connectionId)
	if (result.status === 'error') {
		throw new Error(result.error as string)
	}
}

export async function testConnection(conn: FrontendConnection): Promise<boolean> {
	const dbInfo = frontendToBackendDatabaseInfo(conn)
	const result = await commands.testConnection(dbInfo)
	if (result.status === 'ok') {
		return result.data
	}
	throw new Error(result.error as string)
}
