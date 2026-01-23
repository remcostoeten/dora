import { CONTAINER_PREFIX, MANAGED_LABEL_KEY, MANAGED_LABEL_VALUE } from "../constants";
import type { DockerContainer, DockerAvailability, ContainerState, ContainerHealth, PortMapping, VolumeMount, ContainerLogsOptions } from "../types";
import { isManaged } from "../utilities/container-naming";

type DockerInspectResult = {
	Id: string
	Name: string
	Config: {
		Image: string
		Labels: Record<string, string>
		Env: string[]
	}
	State: {
		Status: string
		Running: boolean
		Paused: boolean
		Health?: {
			Status: string
		}
	}
	Created: string
	HostConfig: {
		PortBindings: Record<string, Array<{ HostPort: string }>>
		Binds?: string[]
	}
	Mounts?: Array<{
		Name: string
		Destination: string
		Type: string
	}>
}

type DockerPsResult = {
	ID: string
	Names: string
	Image: string
	State: string
	Status: string
	Ports: string
	Labels: string
	CreatedAt: string
}

export async function executeDockerCommand(
	args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	if (typeof window !== 'undefined' && 'Tauri' in window) {
		const { Command } = await import('@tauri-apps/plugin-shell')
		const command = Command.create('docker', args)
		const output = await command.execute()
		return {
			stdout: output.stdout,
			stderr: output.stderr,
			exitCode: output.code ?? -1
		}
	}

	throw new Error('Docker commands require Tauri shell plugin')
}

export async function checkDockerAvailability(): Promise<DockerAvailability> {
	try {
		const result = await executeDockerCommand(['version', '--format', '{{.Server.Version}}'])

		if (result.exitCode !== 0) {
			return {
				available: false,
				error: result.stderr || 'Docker is not running'
			}
		}

		return {
			available: true,
			version: result.stdout.trim()
		}
	} catch (error) {
		return {
			available: false,
			error: error instanceof Error ? error.message : 'Failed to connect to Docker'
		}
	}
}

export async function listContainers(
	showAll: boolean = true,
	filterPrefix: boolean = true
): Promise<DockerContainer[]> {
	const args = ['ps', '--format', '{{json .}}']

	if (showAll) {
		args.splice(1, 0, '-a')
	}

	if (filterPrefix) {
		args.push('--filter', `name=^${CONTAINER_PREFIX}`)
	}

	const result = await executeDockerCommand(args)

	if (result.exitCode !== 0) {
		throw new Error(result.stderr || 'Failed to list containers')
	}

	const lines = result.stdout.trim().split('\n').filter(Boolean)

	// Parallelize container inspection to avoid N+1
	const containerIds: string[] = []
	for (const line of lines) {
		try {
			const parsed: DockerPsResult = JSON.parse(line)
			containerIds.push(parsed.ID)
		} catch {
			continue
		}
	}

	const inspectedContainers = await Promise.all(
		containerIds.map(function (id) {
			return getContainerDetails(id)
		})
	)

	const containers: DockerContainer[] = inspectedContainers.filter(
		(container): container is DockerContainer => container !== null
	)

	return containers
}

export async function getContainerDetails(containerId: string): Promise<DockerContainer | null> {
	try {
		const result = await executeDockerCommand(['inspect', containerId])

		if (result.exitCode !== 0) {
			return null
		}

		const inspectData: DockerInspectResult[] = JSON.parse(result.stdout)
		if (inspectData.length === 0) {
			return null
		}

		const data = inspectData[0]
		return parseInspectResult(data)
	} catch {
		return null
	}
}

function parseInspectResult(data: DockerInspectResult): DockerContainer {
	const name = data.Name.startsWith('/') ? data.Name.slice(1) : data.Name
	const [image, tag] = parseImageTag(data.Config.Image)

	return {
		id: data.Id,
		name,
		image,
		imageTag: tag,
		state: mapContainerState(data.State.Status),
		health: mapContainerHealth(data.State.Health?.Status),
		origin:
			isManaged(name) && data.Config.Labels[MANAGED_LABEL_KEY] === MANAGED_LABEL_VALUE
				? 'managed'
				: 'external',
		createdAt: new Date(data.Created).getTime(),
		ports: parsePortBindings(data.HostConfig.PortBindings),
		labels: data.Config.Labels || {},
		volumes: parseVolumeMounts(data.Mounts),
		env: data.Config.Env || []
	}
}

function parseImageTag(imageString: string): [string, string] {
	const lastSlashIndex = imageString.lastIndexOf('/')
	const tagSeparatorIndex = imageString.indexOf(':', lastSlashIndex)

	if (tagSeparatorIndex !== -1) {
		return [imageString.slice(0, tagSeparatorIndex), imageString.slice(tagSeparatorIndex + 1)]
	}

	return [imageString, 'latest']
}

function mapContainerState(status: string): ContainerState {
	const stateMap: Record<string, ContainerState> = {
		created: 'created',
		running: 'running',
		paused: 'paused',
		restarting: 'running',
		removing: 'exited',
		exited: 'exited',
		dead: 'dead'
	}
	return stateMap[status.toLowerCase()] || 'exited'
}

function mapContainerHealth(status: string | undefined): ContainerHealth {
	if (!status) {
		return 'none'
	}

	const healthMap: Record<string, ContainerHealth> = {
		starting: 'starting',
		healthy: 'healthy',
		unhealthy: 'unhealthy'
	}
	return healthMap[status.toLowerCase()] || 'none'
}

function parsePortBindings(
	bindings: Record<string, Array<{ HostPort: string }>> | undefined
): PortMapping[] {
	if (!bindings) {
		return []
	}

	const ports: PortMapping[] = []

	for (const [containerPortSpec, hostBindings] of Object.entries(bindings)) {
		if (!hostBindings || hostBindings.length === 0) {
			continue
		}

		const [portStr, protocol] = containerPortSpec.split('/')
		const containerPort = parseInt(portStr, 10)

		for (const binding of hostBindings) {
			const hostPort = parseInt(binding.HostPort, 10)
			if (!isNaN(hostPort) && !isNaN(containerPort)) {
				ports.push({
					hostPort,
					containerPort,
					protocol: protocol === 'udp' ? 'udp' : 'tcp'
				})
			}
		}
	}

	return ports
}

function parseVolumeMounts(
	mounts: Array<{ Name: string; Destination: string; Type: string }> | undefined
): VolumeMount[] {
	if (!mounts) {
		return []
	}

	return mounts.map(function (mount) {
		return {
			name: mount.Name || 'anonymous',
			mountPath: mount.Destination,
			isEphemeral: mount.Type !== 'volume'
		}
	})
}

export async function getContainerLogs(
	containerId: string,
	options: ContainerLogsOptions = {}
): Promise<string> {
	const args = ['logs']

	if (options.tail) {
		args.push('--tail', String(options.tail))
	}

	if (options.since) {
		args.push('--since', options.since)
	}

	args.push(containerId)

	const result = await executeDockerCommand(args)

	return result.stdout + result.stderr
}

export async function streamContainerLogs(
	containerId: string,
	onLog: (line: string) => void,
	onError: (error: string) => void
): Promise<() => void> {
	if (typeof window !== 'undefined' && 'Tauri' in window) {
		const { Command } = await import('@tauri-apps/plugin-shell')
		const command = Command.create('docker', ['logs', '-f', '--tail', '100', containerId])

		command.on('close', (data) => {
			console.log(`command finished with code ${data.code} and signal ${data.signal}`)
		})

		command.on('error', (error) => {
			console.error(`command error: "${error}"`)
			onError(String(error))
		})

		command.stdout.on('data', (line) => {
			onLog(line)
		})

		command.stderr.on('data', (line) => {
			onLog(line)
		})

		const child = await command.spawn()

		return async () => {
			await child.kill()
		}
	}

	throw new Error('Streaming logs requires Tauri shell plugin')
}

export async function startContainer(containerId: string): Promise<void> {
	const result = await executeDockerCommand(['start', containerId])

	if (result.exitCode !== 0) {
		throw new Error(result.stderr || 'Failed to start container')
	}
}

export async function stopContainer(containerId: string): Promise<void> {
	const result = await executeDockerCommand(['stop', containerId])

	if (result.exitCode !== 0) {
		throw new Error(result.stderr || 'Failed to stop container')
	}
}

export async function restartContainer(containerId: string): Promise<void> {
	const result = await executeDockerCommand(['restart', containerId])

	if (result.exitCode !== 0) {
		throw new Error(result.stderr || 'Failed to restart container')
	}
}

export async function removeContainer(
	containerId: string,
	options: { force?: boolean; removeVolumes?: boolean } = {}
): Promise<void> {
	const args = ['rm']

	if (options.force) {
		args.push('-f')
	}

	if (options.removeVolumes) {
		args.push('-v')
	}

	args.push(containerId)

	const result = await executeDockerCommand(args)

	if (result.exitCode !== 0) {
		throw new Error(result.stderr || 'Failed to remove container')
	}
}

export async function pullImage(image: string, tag: string = 'latest'): Promise<void> {
	const imageSpec = `${image}:${tag}`
	const result = await executeDockerCommand(['pull', imageSpec])

	if (result.exitCode !== 0) {
		throw new Error(result.stderr || `Failed to pull image ${imageSpec}`)
	}
}

export async function imageExists(image: string, tag: string = 'latest'): Promise<boolean> {
	const imageSpec = `${image}:${tag}`
	const result = await executeDockerCommand(['image', 'inspect', imageSpec])
	return result.exitCode === 0
}

export async function copyToContainer(
	containerId: string,
	hostPath: string,
	containerPath: string
): Promise<void> {
	const result = await executeDockerCommand(['cp', hostPath, `${containerId}:${containerPath}`])

	if (result.exitCode !== 0) {
		throw new Error(result.stderr || `Failed to copy file to container`)
	}
}

export async function execCommand(
	containerId: string,
	command: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const args = ['exec', containerId, ...command]
	return executeDockerCommand(args)
}
