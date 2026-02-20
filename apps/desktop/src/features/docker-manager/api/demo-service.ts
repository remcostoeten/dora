import { CONTAINER_PREFIX, MANAGED_LABEL_KEY, MANAGED_LABEL_VALUE } from '../constants'
import type {
	DockerContainer,
	DockerAvailability,
	PostgresContainerConfig,
	CreateContainerResult,
	ContainerActionResult,
	RemoveContainerOptions,
	ContainerTerminalHandlers,
	ContainerTerminalSession
} from '../types'
import { generateVolumeName } from '../utilities/container-naming'

let demoContainers: DockerContainer[] = [
	{
		id: 'a1b2c3d4e5f6',
		name: `${CONTAINER_PREFIX}analytics_db`,
		image: 'postgres',
		imageTag: '16',
		state: 'running',
		health: 'healthy',
		origin: 'managed',
		createdAt: Date.now() - 86400000 * 3,
		ports: [{ hostPort: 5433, containerPort: 5432, protocol: 'tcp' }],
		labels: { [MANAGED_LABEL_KEY]: MANAGED_LABEL_VALUE },
		volumes: [{ name: 'dora_analytics_db_data', mountPath: '/var/lib/postgresql/data', isEphemeral: false }],
		env: ['POSTGRES_USER=analytics', 'POSTGRES_DB=analytics', 'POSTGRES_PASSWORD=***']
	},
	{
		id: 'b2c3d4e5f6a7',
		name: `${CONTAINER_PREFIX}dev_postgres`,
		image: 'postgres',
		imageTag: '17',
		state: 'running',
		health: 'healthy',
		origin: 'managed',
		createdAt: Date.now() - 86400000,
		ports: [{ hostPort: 5434, containerPort: 5432, protocol: 'tcp' }],
		labels: { [MANAGED_LABEL_KEY]: MANAGED_LABEL_VALUE },
		volumes: [{ name: 'dora_dev_postgres_data', mountPath: '/var/lib/postgresql/data', isEphemeral: false }],
		env: ['POSTGRES_USER=dev', 'POSTGRES_DB=devdb', 'POSTGRES_PASSWORD=***']
	},
	{
		id: 'c3d4e5f6a7b8',
		name: `${CONTAINER_PREFIX}test_ephemeral`,
		image: 'postgres',
		imageTag: '16',
		state: 'exited',
		health: 'none',
		origin: 'managed',
		createdAt: Date.now() - 3600000,
		ports: [{ hostPort: 5435, containerPort: 5432, protocol: 'tcp' }],
		labels: { [MANAGED_LABEL_KEY]: MANAGED_LABEL_VALUE },
		volumes: [],
		env: ['POSTGRES_USER=test', 'POSTGRES_DB=testdb', 'POSTGRES_PASSWORD=***']
	},
	{
		id: 'd4e5f6a7b8c9',
		name: 'redis-cache',
		image: 'redis',
		imageTag: '7-alpine',
		state: 'running',
		health: 'none',
		origin: 'external',
		createdAt: Date.now() - 86400000 * 7,
		ports: [{ hostPort: 6379, containerPort: 6379, protocol: 'tcp' }],
		labels: {},
		volumes: [{ name: 'redis_data', mountPath: '/data', isEphemeral: false }],
		env: []
	},
	{
		id: 'e5f6a7b8c9d0',
		name: 'minio-storage',
		image: 'minio/minio',
		imageTag: 'latest',
		state: 'running',
		health: 'healthy',
		origin: 'external',
		createdAt: Date.now() - 86400000 * 2,
		ports: [
			{ hostPort: 9000, containerPort: 9000, protocol: 'tcp' },
			{ hostPort: 9001, containerPort: 9001, protocol: 'tcp' }
		],
		labels: {},
		volumes: [{ name: 'minio_data', mountPath: '/data', isEphemeral: false }],
		env: []
	}
]

let nextId = 1000

function delay(ms: number): Promise<void> {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms)
	})
}

export async function checkDockerAvailability(): Promise<DockerAvailability> {
	await delay(200)
	return { available: true, version: '27.1.1 (demo)' }
}

export async function getContainers(
	showAll: boolean = true,
	showExternal: boolean = false
): Promise<DockerContainer[]> {
	await delay(150)

	let containers = [...demoContainers]

	if (!showAll) {
		containers = containers.filter(function (c) {
			return c.state === 'running'
		})
	}

	if (!showExternal) {
		containers = containers.filter(function (c) {
			return c.origin === 'managed'
		})
	}

	return containers.sort(function (a, b) {
		if (a.origin === 'managed' && b.origin !== 'managed') return -1
		if (a.origin !== 'managed' && b.origin === 'managed') return 1
		return b.createdAt - a.createdAt
	})
}

export async function getContainer(containerId: string): Promise<DockerContainer | null> {
	await delay(100)
	return demoContainers.find(function (c) {
		return c.id === containerId
	}) ?? null
}

export async function createPostgresContainer(
	config: PostgresContainerConfig
): Promise<CreateContainerResult> {
	await delay(800)

	const containerId = `demo_${nextId++}`
	const container: DockerContainer = {
		id: containerId,
		name: config.name.startsWith(CONTAINER_PREFIX) ? config.name : `${CONTAINER_PREFIX}${config.name}`,
		image: 'postgres',
		imageTag: config.postgresVersion || '16',
		state: 'running',
		health: 'healthy',
		origin: 'managed',
		createdAt: Date.now(),
		ports: [{ hostPort: config.hostPort, containerPort: 5432, protocol: 'tcp' }],
		labels: { [MANAGED_LABEL_KEY]: MANAGED_LABEL_VALUE },
		volumes: config.ephemeral
			? []
			: [{
				name: config.volumeName || generateVolumeName(config.name),
				mountPath: '/var/lib/postgresql/data',
				isEphemeral: false
			}],
		env: [
			`POSTGRES_USER=${config.user}`,
			`POSTGRES_DB=${config.database}`,
			'POSTGRES_PASSWORD=***'
		]
	}

	demoContainers = [...demoContainers, container]
	return { success: true, containerId }
}

export async function performContainerAction(
	containerId: string,
	action: 'start' | 'stop' | 'restart'
): Promise<ContainerActionResult> {
	await delay(400)

	demoContainers = demoContainers.map(function (c) {
		if (c.id !== containerId) return c
		switch (action) {
			case 'start':
				return { ...c, state: 'running' as const, health: 'healthy' as const }
			case 'stop':
				return { ...c, state: 'exited' as const, health: 'none' as const }
			case 'restart':
				return { ...c, state: 'running' as const, health: 'starting' as const }
		}
	})

	return { success: true }
}

export async function deleteContainer(
	containerId: string,
	_options?: RemoveContainerOptions
): Promise<ContainerActionResult> {
	await delay(300)
	demoContainers = demoContainers.filter(function (c) {
		return c.id !== containerId
	})
	return { success: true }
}

export async function waitForHealthy(
	_containerId: string,
	_timeoutMs: number = 30000,
	_intervalMs: number = 1000
): Promise<boolean> {
	await delay(500)
	return true
}

export async function getContainerLogs(
	_containerId: string,
	_options?: { tail?: number; since?: string }
): Promise<string> {
	await delay(100)
	const now = new Date().toISOString()
	return [
		`${now} LOG:  database system is ready to accept connections`,
		`${now} LOG:  listening on IPv4 address "0.0.0.0", port 5432`,
		`${now} LOG:  database system was shut down at ${new Date(Date.now() - 60000).toISOString()}`,
		`${now} LOG:  checkpoint starting: time`,
		`${now} LOG:  checkpoint complete: wrote 42 buffers (0.3%); 0 WAL file(s) added`,
		`${now} LOG:  autovacuum launcher started`
	].join('\n')
}

export async function streamContainerLogs(
	_containerId: string,
	onLog: (line: string) => void,
	_onError: (error: string) => void
): Promise<() => void> {
	const lines = [
		'LOG:  database system is ready to accept connections',
		'LOG:  listening on IPv4 address "0.0.0.0", port 5432',
		'LOG:  checkpoint starting: time',
		'LOG:  checkpoint complete: wrote 42 buffers (0.3%)',
		'LOG:  autovacuum launcher started',
		'LOG:  received fast shutdown request',
		'LOG:  aborting any active transactions',
		'LOG:  background worker "logical replication launcher" (PID 28) exited',
		'LOG:  shutting down',
		'LOG:  database system is shut down',
		'LOG:  database system was shut down at 2024-01-15 10:30:00 UTC',
		'LOG:  database system is ready to accept connections'
	]

	let index = 0
	const interval = setInterval(function () {
		if (index < lines.length) {
			onLog(`${new Date().toISOString()} ${lines[index]}\n`)
			index++
		} else {
			index = 0
		}
	}, 2000)

	return async function () {
		clearInterval(interval)
	}
}

export async function openContainerTerminal(
	containerId: string,
	handlers: ContainerTerminalHandlers
): Promise<ContainerTerminalSession> {
	handlers.onOutput(`Connected to ${containerId} (demo mode)\n`)
	handlers.onOutput('Type a command and press Enter.\n')

	let closed = false

	return {
		write: async function (data: string) {
			if (closed) return

			const command = data.trim()
			if (!command) {
				return
			}

			if (command === 'exit') {
				handlers.onOutput('logout\n')
				closed = true
				handlers.onClose?.(0, null)
				return
			}

			handlers.onOutput(`$ ${command}\n`)
			handlers.onOutput(`demo: executed "${command}"\n`)
		},
		kill: async function () {
			if (closed) return
			closed = true
			handlers.onOutput('terminal session closed\n')
			handlers.onClose?.(0, null)
		}
	}
}

export async function seedDatabase(
	_containerId: string,
	_filePath: string,
	_connectionConfig: { user: string; database: string }
): Promise<{ success: boolean; error?: string }> {
	await delay(1500)
	return { success: true }
}
