import {
	POSTGRES_IMAGE,
	POSTGRES_CONTAINER_PORT,
	MARIADB_IMAGE,
	MARIADB_CONTAINER_PORT,
	MYSQL_IMAGE,
	MYSQL_CONTAINER_PORT,
	COCKROACH_IMAGE,
	COCKROACH_CONTAINER_PORT,
	REDIS_IMAGE,
	REDIS_CONTAINER_PORT,
	VALKEY_IMAGE,
	VALKEY_CONTAINER_PORT,
	MANAGED_LABEL_KEY,
	MANAGED_LABEL_VALUE,
	PROJECT_LABEL_KEY,
	COMPOSE_PATH_LABEL_KEY
} from '../constants'
import type {
	DatabaseContainerConfig,
	PostgresContainerConfig,
	DockerContainer,
	CreateContainerResult,
	ContainerActionResult,
	RemoveContainerOptions,
	ContainerTerminalHandlers,
	ContainerTerminalSession
} from '../types'
import { validateContainerName, generateVolumeName } from '../utilities/container-naming'
import {
	checkDockerAvailability as clientCheckDocker,
	listContainers,
	getContainerDetails,
	startContainer as clientStartContainer,
	stopContainer as clientStopContainer,
	restartContainer as clientRestartContainer,
	removeContainer as clientRemoveContainer,
	pullImage,
	imageExists,
	executeDockerCommand,
	getContainerLogs as clientGetLogs,
	streamContainerLogs as clientStream,
	openContainerTerminal as clientOpenTerminal,
	copyToContainer,
	execCommand
} from './docker-client'
import * as demoService from './demo-service'

const isTauri =
	typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

export async function createPostgresContainer(
	config: PostgresContainerConfig
): Promise<CreateContainerResult> {
	return createDatabaseContainer(config)
}

export async function createDatabaseContainer(
	config: DatabaseContainerConfig
): Promise<CreateContainerResult> {
	if (!isTauri) return demoService.createDatabaseContainer(config)

	const validation = validateContainerName(config.name)
	if (!validation.valid) {
		return { success: false, error: validation.error }
	}

	const availability = await clientCheckDocker()
	if (!availability.available) {
		return { success: false, error: availability.error }
	}

	const databaseConfig = getDatabaseImageConfig(config)
	const { image, imageTag, buildArgs, displayName, command } = databaseConfig
	const hasImage = await imageExists(image, imageTag)

	if (!hasImage) {
		try {
			await pullImage(image, imageTag)
		} catch (error) {
			return {
				success: false,
				error: `Failed to pull ${displayName} image: ${
					error instanceof Error ? error.message : String(error)
				}`
			}
		}
	}

	const args = buildCreateContainerArgs(config, imageTag, {
		image,
		imageTag,
		displayName,
		buildArgs,
		command
	})

	try {
		const result = await executeDockerCommand(args)

		if (result.exitCode !== 0) {
			return { success: false, error: result.stderr || 'Failed to create container' }
		}

		const containerId = result.stdout.trim()

		const startResult = await executeDockerCommand(['start', containerId])
		if (startResult.exitCode !== 0) {
			return {
				success: false,
				error: startResult.stderr || 'Container created but failed to start'
			}
		}

		return { success: true, containerId }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error creating container'
		}
	}
}

type DatabaseImageConfig = {
	image: string
	imageTag: string
	displayName: string
	buildArgs: string[]
	command?: string[]
}

// CockroachDB publishes its images under `v`-prefixed tags (e.g. `v25.1.1`).
// The UI stores the bare version (`25.1.1`), so prepend `v` unless it's already
// there or a non-numeric tag like `latest` was supplied.
function normalizeCockroachTag(tag: string): string {
	return /^\d/.test(tag) ? `v${tag}` : tag
}

export function getDatabaseImageConfig(config: DatabaseContainerConfig): DatabaseImageConfig {
	switch (config.provider) {
		case 'mariadb':
			return {
				image: MARIADB_IMAGE,
				imageTag: config.mariadbVersion || '11.4',
				displayName: 'MariaDB',
				buildArgs: [
					'-e',
					`MARIADB_ROOT_PASSWORD=${config.password}`,
					'-e',
					`MARIADB_ROOT_HOST=%`,
					'-e',
					`MARIADB_DATABASE=${config.database}`,
					...(config.user && config.user !== 'root'
						? [
								'-e',
								`MARIADB_USER=${config.user}`,
								'-e',
								`MARIADB_PASSWORD=${config.password}`
							]
						: []),
					'-p',
					`${config.hostPort}:${MARIADB_CONTAINER_PORT}`,
					'--health-cmd',
					'mariadb-admin ping -uroot -p${MARIADB_ROOT_PASSWORD}',
					'--health-interval',
					'5s',
					'--health-timeout',
					'5s',
					'--health-retries',
					'5',
					'--health-start-period',
					'20s'
				]
			}
		case 'mysql':
			return {
				image: MYSQL_IMAGE,
				imageTag: config.mysqlVersion || '8.4',
				displayName: 'MySQL',
				buildArgs: [
					'-e',
					`MYSQL_ROOT_PASSWORD=${config.password}`,
					'-e',
					`MYSQL_DATABASE=${config.database}`,
					...(config.user && config.user !== 'root'
						? [
								'-e',
								`MYSQL_USER=${config.user}`,
								'-e',
								`MYSQL_PASSWORD=${config.password}`
							]
						: []),
					'-p',
					`${config.hostPort}:${MYSQL_CONTAINER_PORT}`,
					'--health-cmd',
					'mysqladmin ping -uroot -p${MYSQL_ROOT_PASSWORD}',
					'--health-interval',
					'5s',
					'--health-timeout',
					'5s',
					'--health-retries',
					'5',
					'--health-start-period',
					'20s'
				]
			}
		case 'cockroach':
			return {
				image: COCKROACH_IMAGE,
				// CockroachDB image tags require a leading `v` (e.g. `v25.1.1`); the
				// version stored from the UI omits it, so normalize here or the pull 404s.
				imageTag: normalizeCockroachTag(config.cockroachVersion || '25.1.1'),
				displayName: 'CockroachDB',
				buildArgs: [
					'-p',
					`${config.hostPort}:${COCKROACH_CONTAINER_PORT}`,
					'-p',
					`${config.hostPort + 1}:8080`,
					'--health-cmd',
					'cockroach sql --insecure --host=127.0.0.1:26257 -e "SELECT 1"',
					'--health-interval',
					'5s',
					'--health-timeout',
					'5s',
					'--health-retries',
					'10',
					'--health-start-period',
					'25s'
				],
				command: [
					'start-single-node',
					'--insecure',
					// CockroachDB v24+ rejects an explicit `0.0.0.0` host in --listen-addr;
					// an empty host (`:port`) binds all interfaces and is accepted.
					'--listen-addr=:26257',
					'--http-addr=:8080',
					'--store=/cockroach-data'
				]
			}
		case 'redis':
			return {
				image: REDIS_IMAGE,
				imageTag: config.redisVersion || '7-alpine',
				displayName: 'Redis',
				buildArgs: [
					'-p',
					`127.0.0.1:${config.hostPort}:${REDIS_CONTAINER_PORT}`,
					'--health-cmd',
					'redis-cli ping',
					'--health-interval',
					'5s',
					'--health-timeout',
					'3s',
					'--health-retries',
					'5'
				],
				command: ['redis-server', '--appendonly', 'yes']
			}
		case 'valkey':
			return {
				image: VALKEY_IMAGE,
				imageTag: config.valkeyVersion || '8-alpine',
				displayName: 'Valkey',
				buildArgs: [
					'-p',
					`127.0.0.1:${config.hostPort}:${VALKEY_CONTAINER_PORT}`,
					'--health-cmd',
					'valkey-cli ping',
					'--health-interval',
					'5s',
					'--health-timeout',
					'3s',
					'--health-retries',
					'5'
				],
				command: ['valkey-server', '--appendonly', 'yes']
			}
		case 'postgres':
		default:
			return {
				image: POSTGRES_IMAGE,
				imageTag: config.postgresVersion || '16',
				displayName: 'PostgreSQL',
				buildArgs: [
					'-e',
					`POSTGRES_USER=${config.user}`,
					'-e',
					`POSTGRES_PASSWORD=${config.password}`,
					'-e',
					`POSTGRES_DB=${config.database}`,
					'-p',
					`${config.hostPort}:${POSTGRES_CONTAINER_PORT}`,
					'--health-cmd',
					'pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}',
					'--health-interval',
					'5s',
					'--health-timeout',
					'5s',
					'--health-retries',
					'5',
					'--health-start-period',
					'10s'
				]
			}
	}
}

export function buildCreateContainerArgs(
	config: DatabaseContainerConfig,
	imageTag: string,
	databaseConfig: DatabaseImageConfig
): string[] {
	const args = [
		'create',
		'--name',
		config.name,
		'--label',
		`${MANAGED_LABEL_KEY}=${MANAGED_LABEL_VALUE}`,
		...databaseConfig.buildArgs
	]

	if (!config.ephemeral) {
		const volumeName = config.volumeName || generateVolumeName(config.name)
		args.push('-v', `${volumeName}:${getDatabaseVolumePath(config.provider)}`)
	}

	if (config.cpuLimit) {
		args.push('--cpus', String(config.cpuLimit))
	}

	if (config.memoryLimitMb) {
		args.push('-m', `${config.memoryLimitMb}m`)
	}

	if (config.projectName) {
		args.push('--label', `${PROJECT_LABEL_KEY}=${config.projectName}`)
	}

	if (config.composePath) {
		args.push('--label', `${COMPOSE_PATH_LABEL_KEY}=${config.composePath}`)
	}

	args.push(`${databaseConfig.image}:${imageTag}`)

	if (databaseConfig.command?.length) {
		args.push(...databaseConfig.command)
	}

	return args
}

export function getDatabaseVolumePath(provider: DatabaseContainerConfig['provider']): string {
	switch (provider) {
		case 'mariadb':
		case 'mysql':
			return '/var/lib/mysql'
		case 'cockroach':
			return '/cockroach-data'
		case 'redis':
		case 'valkey':
			return '/data'
		case 'postgres':
		default:
			return '/var/lib/postgresql/data'
	}
}

export async function performContainerAction(
	containerId: string,
	action: 'start' | 'stop' | 'restart'
): Promise<ContainerActionResult> {
	if (!isTauri) return demoService.performContainerAction(containerId, action)

	try {
		switch (action) {
			case 'start':
				await clientStartContainer(containerId)
				break
			case 'stop':
				await clientStopContainer(containerId)
				break
			case 'restart':
				await clientRestartContainer(containerId)
				break
		}
		return { success: true }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : `Failed to ${action} container`
		}
	}
}

export async function deleteContainer(
	containerId: string,
	options: RemoveContainerOptions = { removeVolumes: false, force: true }
): Promise<ContainerActionResult> {
	if (!isTauri) return demoService.deleteContainer(containerId, options)

	try {
		await clientRemoveContainer(containerId, {
			force: options.force,
			removeVolumes: options.removeVolumes
		})
		return { success: true }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to remove container'
		}
	}
}

export async function getContainers(
	showAll: boolean = true,
	showExternal: boolean = false
): Promise<DockerContainer[]> {
	if (!isTauri) return demoService.getContainers(showAll, showExternal)

	const containers = await listContainers(showAll, !showExternal)

	return containers.sort(function (a, b) {
		if (a.origin === 'managed' && b.origin !== 'managed') return -1
		if (a.origin !== 'managed' && b.origin === 'managed') return 1
		return b.createdAt - a.createdAt
	})
}

export async function getContainer(containerId: string): Promise<DockerContainer | null> {
	if (!isTauri) return demoService.getContainer(containerId)
	return getContainerDetails(containerId)
}

export async function waitForHealthy(
	containerId: string,
	timeoutMs: number = 30000,
	intervalMs: number = 1000
): Promise<boolean> {
	if (!isTauri) return demoService.waitForHealthy(containerId, timeoutMs, intervalMs)

	const startTime = Date.now()

	while (Date.now() - startTime < timeoutMs) {
		const container = await getContainerDetails(containerId)

		if (container?.health === 'healthy') {
			return true
		}

		if (container?.health === 'unhealthy') {
			return false
		}

		if (container?.state !== 'running') {
			return false
		}

		await sleep(intervalMs)
	}

	return false
}

function sleep(ms: number): Promise<void> {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms)
	})
}

export async function checkDockerAvailability() {
	if (!isTauri) return demoService.checkDockerAvailability()
	return clientCheckDocker()
}

export async function getContainerLogs(
	containerId: string,
	options?: { tail?: number; since?: string }
): Promise<string> {
	if (!isTauri) return demoService.getContainerLogs(containerId, options)
	return clientGetLogs(containerId, options)
}

export async function streamContainerLogs(
	containerId: string,
	onLog: (line: string) => void,
	onError: (error: string) => void,
	tail: number = 100
): Promise<() => void> {
	if (!isTauri) return demoService.streamContainerLogs(containerId, onLog, onError, tail)
	return clientStream(containerId, onLog, onError, tail)
}

export async function openContainerTerminal(
	containerId: string,
	handlers: ContainerTerminalHandlers
): Promise<ContainerTerminalSession> {
	if (!isTauri) return demoService.openContainerTerminal(containerId, handlers)
	return clientOpenTerminal(containerId, handlers)
}

export async function seedDatabase(
	containerId: string,
	filePath: string,
	connectionConfig: {
		provider?: DatabaseContainerConfig['provider']
		user: string
		password?: string
		database: string
	}
): Promise<{ success: boolean; error?: string }> {
	if (!isTauri) return demoService.seedDatabase(containerId, filePath, connectionConfig)

	try {
		const targetPath = '/tmp/seed.sql'

		// 1. Copy file to container
		await copyToContainer(containerId, filePath, targetPath)

		// 2. Execute SQL file
		const result = await executeSeedCommand(containerId, connectionConfig, targetPath)

		if (result.exitCode !== 0) {
			throw new Error(result.stderr || 'Failed to execute SQL seed file')
		}

		// 3. Cleanup
		await execCommand(containerId, ['rm', targetPath])

		return { success: true }
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error during seeding'
		}
	}
}

async function executeSeedCommand(
	containerId: string,
	connectionConfig: {
		provider?: DatabaseContainerConfig['provider']
		user: string
		password?: string
		database: string
	},
	targetPath: string
) {
	switch (connectionConfig.provider) {
		case 'mariadb':
		case 'mysql':
			// MariaDB images ship the `mariadb` client; MySQL images ship `mysql`.
			return execCommand(
				containerId,
				[
					connectionConfig.provider === 'mysql' ? 'mysql' : 'mariadb',
					'-u',
					connectionConfig.user,
					connectionConfig.password ? `-p${connectionConfig.password}` : '',
					connectionConfig.database,
					'-e',
					`source ${targetPath}`
				].filter(Boolean) as string[]
			)
		case 'cockroach':
			return execCommand(containerId, [
				'cockroach',
				'sql',
				'--insecure',
				'--host=127.0.0.1:26257',
				'--database',
				connectionConfig.database,
				'-f',
				targetPath
			])
		case 'postgres':
		default:
			return execCommand(containerId, [
				'psql',
				'-U',
				connectionConfig.user,
				'-d',
				connectionConfig.database,
				'-f',
				targetPath
			])
	}
}
