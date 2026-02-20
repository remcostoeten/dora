export type ContainerOrigin = 'managed' | 'external'

export type ContainerHealth = 'starting' | 'healthy' | 'unhealthy' | 'none'

export type ContainerState = 'created' | 'running' | 'paused' | 'exited' | 'dead'

export type PortMapping = {
	hostPort: number
	containerPort: number
	protocol: 'tcp' | 'udp'
}

export type VolumeMount = {
	name: string
	mountPath: string
	isEphemeral: boolean
}

export type DockerContainer = {
	id: string
	name: string
	image: string
	imageTag: string
	state: ContainerState
	health: ContainerHealth
	origin: ContainerOrigin
	createdAt: number
	ports: PortMapping[]
	labels: Record<string, string>
	volumes: VolumeMount[]
	env: string[]
}

export type PostgresContainerConfig = {
	name: string
	postgresVersion: string
	hostPort: number
	user: string
	password: string
	database: string
	ephemeral: boolean
	volumeName?: string
	cpuLimit?: number
	memoryLimitMb?: number
	projectName?: string
	composePath?: string
}

export type SeedStrategy =
	| { type: 'sql_file'; paths: string[] }
	| { type: 'pg_dump'; path: string }
	| { type: 'generator'; profile: string; scale: number }

export type SeedPhase = 'preparing' | 'executing' | 'completed' | 'failed' | 'cancelled'

export type SeedProgress = {
	phase: SeedPhase
	progress: number
	message: string
	rowsInserted?: number
	sizeBytes?: number
}

export type SeedResult = {
	success: boolean
	tablesCreated?: number
	rowsInserted?: number
	sizeBytes?: number
	elapsedMs?: number
	error?: string
}

export type AllowedConnection = {
	id: string
	containerId: string
	containerName: string
	addedAt: number
	reason: string
}

export type DockerFeatureState = {
	containers: DockerContainer[]
	selectedContainerId: string | null
	showExternalContainers: boolean
	containerPrefix: string
	allowedConnections: AllowedConnection[]
}

export type DockerAvailability = {
	available: boolean
	version?: string
	error?: string
}

export type ContainerActionType = 'start' | 'stop' | 'restart'

export type GeneratorProfile = {
	id: string
	name: string
	description: string
	tables: string[]
}

export type GeneratorScale = {
	id: string
	label: string
	rowCount: number
	estimatedTimeSeconds: number
}

export type ConnectionEnvVars = {
	DATABASE_URL: string
	PGHOST: string
	PGPORT: string
	PGUSER: string
	PGPASSWORD: string
	PGDATABASE: string
}

export type ContainerSortField = 'name' | 'createdAt' | 'state' | 'origin' | 'size'

export type SortDirection = 'asc' | 'desc'

export type ContainerSortConfig = {
	field: ContainerSortField
	direction: SortDirection
}

export type ContainerFilterConfig = {
	states: ContainerState[]
	healths: ContainerHealth[]
	origins: ContainerOrigin[]
}

export type ContainerSize = {
	containerId: string
	virtualSize: number
	rwSize: number
}

export type ContainerEventType = 'created' | 'started' | 'stopped' | 'restarted' | 'removed'

export type ContainerEvent = {
	id: string
	containerId: string
	containerName: string
	type: ContainerEventType
	timestamp: number
}

export type ProjectLink = {
	containerId: string
	projectName: string
	composePath?: string
}

export type ContainerLogsOptions = {
	tail?: number
	since?: string
}

export type ContainerTerminalHandlers = {
	onOutput: (chunk: string) => void
	onError: (error: string) => void
	onClose?: (code: number | null, signal: number | null) => void
}

export type ContainerTerminalSession = {
	write: (data: string) => Promise<void>
	kill: () => Promise<void>
}

export type CreateContainerResult = {
	success: boolean
	containerId?: string
	error?: string
}

export type ContainerActionResult = {
	success: boolean
	error?: string
}

export type RemoveContainerOptions = {
	removeVolumes: boolean
	force: boolean
}
