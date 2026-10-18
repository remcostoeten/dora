import type { DatabaseType } from '@studio/features/connections/types'
import { REDIS_CONTAINER_PORT, VALKEY_CONTAINER_PORT } from '../constants'
import type { DatabaseProvider, DockerContainer } from '../types'

type KeyValueProvider = Extract<DatabaseProvider, 'redis' | 'valkey'>

export type ContainerConnectionDetails = {
	provider: DatabaseProvider
	/**
	 * The connection type to open in the data viewer. Unlike `provider` (which is
	 * limited to the engines we can spin up locally), this distinguishes plain
	 * MySQL from MariaDB so the backend dialect and SQL generation are correct.
	 */
	type: DatabaseType
	host: string
	port: number
	user: string
	password: string
	database: string
	connectionUrl: string
}

/**
 * Detects the concrete database engine of a container from its image name.
 * Recognises MySQL/Percona separately from MariaDB so the data viewer connects
 * with the right driver instead of falling back to Postgres.
 */
export function detectConnectionType(container: DockerContainer): DatabaseType {
	const image = `${container.image}:${container.imageTag}`.toLowerCase()

	if (image.includes('cockroach')) return 'cockroach'
	if (image.includes('mariadb')) return 'mariadb'
	if (image.includes('mysql') || image.includes('percona')) return 'mysql'
	return 'postgres'
}

/**
 * @name detectKeyValueProvider
 * @description Returns 'redis' or 'valkey' when the container is a key-value
 * server, using its provider field first and its image repository name second.
 * Returns null for every other container, including Redis tooling images.
 *
 * @example
 * detectKeyValueProvider({ ...container, image: 'valkey/valkey' }) // 'valkey'
 */
export function detectKeyValueProvider(container: DockerContainer): KeyValueProvider | null {
	if (container.provider === 'redis' || container.provider === 'valkey') {
		return container.provider
	}

	const repository = container.image.toLowerCase().split('/').pop() ?? ''

	if (repository.startsWith('valkey')) return 'valkey'
	if (repository === 'redis' || repository.startsWith('redis-stack')) return 'redis'
	return null
}

/**
 * @name isKeyValueContainer
 * @description Tells whether a container is a Redis or Valkey server, which opens in
 * KV Studio instead of the SQL data viewer and has no seed or table affordances.
 *
 * @example
 * if (isKeyValueContainer(container)) {
 *   openKvStudio(getKeyValueConnectionUrl(container))
 * }
 */
export function isKeyValueContainer(container: DockerContainer): boolean {
	return detectKeyValueProvider(container) !== null
}

/**
 * @name getKeyValuePort
 * @description Returns the host port mapped to the container's key-value port.
 *
 * @example
 * getKeyValuePort(container) // 6380
 */
export function getKeyValuePort(container: DockerContainer): number {
	const containerPort =
		detectKeyValueProvider(container) === 'valkey'
			? VALKEY_CONTAINER_PORT
			: REDIS_CONTAINER_PORT

	return (
		container.ports.find((port) => port.containerPort === containerPort)?.hostPort ??
		containerPort
	)
}

/**
 * @name getKeyValueConnectionUrl
 * @description Builds the redis:// URL for the host port that maps to the
 * container's 6379, falling back to 6379 when no mapping is listed.
 *
 * @example
 * getKeyValueConnectionUrl(container) // 'redis://127.0.0.1:6380/0'
 */
export function getKeyValueConnectionUrl(container: DockerContainer): string {
	return `redis://127.0.0.1:${getKeyValuePort(container)}/0`
}

export function detectDatabaseProvider(container: DockerContainer): DatabaseProvider {
	const keyValueProvider = detectKeyValueProvider(container)

	if (keyValueProvider) return keyValueProvider

	const type = detectConnectionType(container)

	if (type === 'mariadb') return 'mariadb'
	if (type === 'mysql') return 'mysql'
	if (type === 'cockroach') return 'cockroach'
	return 'postgres'
}

// MySQL and MariaDB are wire-compatible; they share port, env-var, URL and
// CLI-snippet handling. Use this guard wherever that shared path applies.
function isMysqlFamily(provider: DatabaseProvider): boolean {
	return provider === 'mariadb' || provider === 'mysql'
}

export function getPrimaryDatabasePort(container: DockerContainer): number {
	const provider = detectDatabaseProvider(container)

	if (provider === 'redis' || provider === 'valkey') {
		return getKeyValuePort(container)
	}

	if (isMysqlFamily(provider)) {
		return container.ports.find((port) => port.containerPort === 3306)?.hostPort ?? 3306
	}

	if (provider === 'cockroach') {
		return container.ports.find((port) => port.containerPort === 26257)?.hostPort ?? 26257
	}

	return container.ports.find((port) => port.containerPort === 5432)?.hostPort ?? 5432
}

function readEnvValue(container: DockerContainer, keys: string[], fallback: string): string {
	for (const key of keys) {
		const value = container.env.find((entry) => entry.startsWith(`${key}=`))?.split('=')[1]
		if (value) return value
	}

	return fallback
}

function buildUrl(
	provider: DatabaseProvider,
	host: string,
	port: number,
	user: string,
	password: string,
	database: string
): string {
	if (isMysqlFamily(provider)) {
		const auth = password
			? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
			: encodeURIComponent(user)
		return `mysql://${auth}@${host}:${port}/${database}`
	}

	const auth = password
		? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
		: encodeURIComponent(user)

	if (provider === 'cockroach' && !password) {
		return `postgresql://${auth}@${host}:${port}/${database}?sslmode=disable`
	}

	return `postgresql://${auth}@${host}:${port}/${database}`
}

export function getContainerConnectionDetails(
	container: DockerContainer
): ContainerConnectionDetails {
	const provider = detectDatabaseProvider(container)
	const type = detectConnectionType(container)
	const host = 'localhost'
	const port = getPrimaryDatabasePort(container)

	if (isMysqlFamily(provider)) {
		// Covers both MariaDB (MARIADB_*) and MySQL (MYSQL_*) images.
		const user = readEnvValue(
			container,
			['MARIADB_USER', 'MYSQL_USER', 'MARIADB_ROOT_USER'],
			'root'
		)
		const password = readEnvValue(
			container,
			['MARIADB_PASSWORD', 'MYSQL_PASSWORD', 'MARIADB_ROOT_PASSWORD', 'MYSQL_ROOT_PASSWORD'],
			'rootpass'
		)
		const database = readEnvValue(container, ['MARIADB_DATABASE', 'MYSQL_DATABASE'], 'dora')

		return {
			provider,
			type,
			host,
			port,
			user,
			password,
			database,
			connectionUrl: buildUrl(provider, host, port, user, password, database)
		}
	}

	if (provider === 'cockroach') {
		const user = readEnvValue(container, ['COCKROACH_USER', 'POSTGRES_USER'], 'root')
		const database = readEnvValue(container, ['COCKROACH_DATABASE', 'POSTGRES_DB'], 'defaultdb')

		return {
			provider,
			type,
			host,
			port,
			user,
			password: '',
			database,
			connectionUrl: buildUrl(provider, host, port, user, '', database)
		}
	}

	const user = readEnvValue(container, ['POSTGRES_USER'], 'postgres')
	const password = readEnvValue(container, ['POSTGRES_PASSWORD'], 'postgres')
	const database = readEnvValue(container, ['POSTGRES_DB'], 'postgres')

	return {
		provider,
		type,
		host,
		port,
		user,
		password,
		database,
		connectionUrl: buildUrl(provider, host, port, user, password, database)
	}
}
