import {
	POSTGRES_IMAGE,
	POSTGRES_CONTAINER_PORT,
	MANAGED_LABEL_KEY,
	MANAGED_LABEL_VALUE
} from '../constants'
import type {
	PostgresContainerConfig,
	DockerContainer,
	CreateContainerResult,
	ContainerActionResult,
	RemoveContainerOptions
} from '../types'
import { validateContainerName, generateVolumeName } from '../utilities/container-naming'
import {
	checkDockerAvailability,
	listContainers,
	getContainerDetails,
	startContainer as clientStartContainer,
	stopContainer as clientStopContainer,
	restartContainer as clientRestartContainer,
	removeContainer as clientRemoveContainer,
	pullImage,
	imageExists,
	executeDockerCommand
} from './docker-client'

export async function createPostgresContainer(
	config: PostgresContainerConfig
): Promise<CreateContainerResult> {
	const validation = validateContainerName(config.name)
	if (!validation.valid) {
		return { success: false, error: validation.error }
	}

	const availability = await checkDockerAvailability()
	if (!availability.available) {
		return { success: false, error: availability.error }
	}

	const imageTag = config.postgresVersion || '16'
	const hasImage = await imageExists(POSTGRES_IMAGE, imageTag)

	if (!hasImage) {
		try {
			await pullImage(POSTGRES_IMAGE, imageTag)
		} catch (error) {
			return {
				success: false,
				error: `Failed to pull PostgreSQL image: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	const args = buildCreateContainerArgs(config, imageTag)

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

function buildCreateContainerArgs(config: PostgresContainerConfig, imageTag: string): string[] {
	const args = [
		'create',
		'--name',
		config.name,
		'--label',
		`${MANAGED_LABEL_KEY}=${MANAGED_LABEL_VALUE}`,
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

	if (!config.ephemeral) {
		const volumeName = config.volumeName || generateVolumeName(config.name)
		args.push('-v', `${volumeName}:/var/lib/postgresql/data`)
	}

	if (config.cpuLimit) {
		args.push('--cpus', String(config.cpuLimit))
	}

	if (config.memoryLimitMb) {
		args.push('-m', `${config.memoryLimitMb}m`)
	}

	args.push(`${POSTGRES_IMAGE}:${imageTag}`)

	return args
}

export async function performContainerAction(
	containerId: string,
	action: 'start' | 'stop' | 'restart'
): Promise<ContainerActionResult> {
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
	const containers = await listContainers(showAll, !showExternal)

	return containers.sort(function (a, b) {
		if (a.origin === 'managed' && b.origin !== 'managed') return -1
		if (a.origin !== 'managed' && b.origin === 'managed') return 1
		return b.createdAt - a.createdAt
	})
}

export async function getContainer(containerId: string): Promise<DockerContainer | null> {
	return getContainerDetails(containerId)
}

export async function waitForHealthy(
	containerId: string,
	timeoutMs: number = 30000,
	intervalMs: number = 1000
): Promise<boolean> {
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

export { checkDockerAvailability, getContainerLogs } from './docker-client'

export async function seedDatabase(
	containerId: string,
	filePath: string,
	connectionConfig: { user: string; database: string }
): Promise<{ success: boolean; error?: string }> {
	try {
		const { copyToContainer, execCommand } = await import('./docker-client')
		const targetPath = '/tmp/seed.sql'

		// 1. Copy file to container
		await copyToContainer(containerId, filePath, targetPath)

		// 2. Execute SQL file
		const result = await execCommand(containerId, [
			'psql',
			'-U',
			connectionConfig.user,
			'-d',
			connectionConfig.database,
			'-f',
			targetPath
		])

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
