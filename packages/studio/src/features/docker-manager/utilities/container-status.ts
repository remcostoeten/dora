import type {
	ContainerActionType,
	ContainerHealth,
	ContainerState,
	DockerContainer
} from '../types'

export type StatusTone = 'ok' | 'busy' | 'bad' | 'off' | 'new' | 'paused'

export type StatusGroup = 'running' | 'stopped' | 'created'

export type ContainerStatus = {
	tone: StatusTone
	label: string
}

const PENDING_LABELS: Record<ContainerActionType, string> = {
	start: 'Starting',
	stop: 'Stopping',
	restart: 'Restarting'
}

/**
 * @name getContainerStatus
 * @description Maps a container's Docker state, health and any in-flight action to the
 * dot tone and label the containers view shows for it.
 *
 * @example
 * getContainerStatus('running', 'healthy') // { tone: 'ok', label: 'Healthy' }
 */
export function getContainerStatus(
	state: ContainerState,
	health: ContainerHealth,
	pendingAction?: ContainerActionType | null
): ContainerStatus {
	if (pendingAction) return { tone: 'busy', label: PENDING_LABELS[pendingAction] }

	if (state === 'running') {
		if (health === 'healthy') return { tone: 'ok', label: 'Healthy' }
		if (health === 'starting') return { tone: 'busy', label: 'Starting' }
		if (health === 'unhealthy') return { tone: 'bad', label: 'Unhealthy' }
		return { tone: 'ok', label: 'Running' }
	}

	if (state === 'paused') return { tone: 'paused', label: 'Paused' }
	if (state === 'created') return { tone: 'new', label: 'Created' }
	if (state === 'dead') return { tone: 'bad', label: 'Dead' }
	return { tone: 'off', label: 'Stopped' }
}

/**
 * @name formatShortAge
 * @description Formats the time since a millisecond timestamp as a compact age such as
 * `45s`, `12m`, `3h` or `7d`.
 *
 * @example
 * formatShortAge(Date.now() - 3 * 86_400_000) // '3d'
 */
export function formatShortAge(timestamp: number, now = Date.now()): string {
	const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
	if (seconds < 60) return `${seconds}s`
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m`
	const hours = Math.floor(minutes / 60)
	if (hours < 48) return `${hours}h`
	return `${Math.floor(hours / 24)}d`
}

/**
 * @name formatImage
 * @description Joins a container's image and tag, leaving the tag out when it is empty.
 *
 * @example
 * formatImage({ ...container, image: 'postgres', imageTag: '17' }) // 'postgres:17'
 */
export function formatImage(container: Pick<DockerContainer, 'image' | 'imageTag'>): string {
	return container.imageTag ? `${container.image}:${container.imageTag}` : container.image
}

/**
 * @name formatBytes
 * @description Formats a byte count with a binary unit and one decimal.
 *
 * @example
 * formatBytes(268_435_456) // '256.0 MB'
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${Math.round(bytes)} B`
	if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
	return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

/**
 * @name getStatusGroup
 * @description Buckets a container's Docker state into the three groups the list and the
 * status filter use: running (also paused), stopped (exited or dead) and created.
 *
 * @example
 * getStatusGroup(container) // 'stopped'
 */
export function getStatusGroup(container: DockerContainer): StatusGroup {
	if (container.state === 'running' || container.state === 'paused') return 'running'
	if (container.state === 'created') return 'created'
	return 'stopped'
}
