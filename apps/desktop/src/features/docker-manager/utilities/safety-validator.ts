import { LOCAL_HOST_PATTERNS, LOCAL_IP_REGEX_PATTERNS, MANAGED_LABEL_KEY, MANAGED_LABEL_VALUE } from "../constants";
import type { DockerContainer, AllowedConnection } from "../types";

type ValidationResult = { allowed: true } | { allowed: false; reason: string }

export function validateConnectionTarget(host: string): ValidationResult {
	const normalizedHost = host.toLowerCase().trim()

	if (!isLocalHost(normalizedHost)) {
		return {
			allowed: false,
			reason: 'Remote hosts are blocked. Only localhost and Docker network IPs are allowed for safety.'
		}
	}

	return { allowed: true }
}

export function isLocalHost(host: string): boolean {
	const normalizedHost = host.toLowerCase().trim()

	if (
		LOCAL_HOST_PATTERNS.some(function (pattern) {
			return normalizedHost === pattern
		})
	) {
		return true
	}

	if (
		LOCAL_IP_REGEX_PATTERNS.some(function (pattern) {
			return pattern.test(normalizedHost)
		})
	) {
		return true
	}

	return false
}

export function isManagedContainer(container: DockerContainer): boolean {
	return container.labels[MANAGED_LABEL_KEY] === MANAGED_LABEL_VALUE
}

export function isContainerTrusted(
	container: DockerContainer,
	allowedConnections: AllowedConnection[]
): boolean {
	if (isManagedContainer(container)) {
		return true
	}

	return allowedConnections.some(function (allowed) {
		return allowed.containerId === container.id
	})
}

export function addToAllowlist(
	containerId: string,
	containerName: string,
	reason: string,
	currentAllowlist: AllowedConnection[]
): AllowedConnection[] {
	const existing = currentAllowlist.find(function (c) {
		return c.containerId === containerId
	})

	if (existing) {
		return currentAllowlist
	}

	const newEntry: AllowedConnection = {
		id: `allowed_${Date.now()}`,
		containerId,
		containerName,
		addedAt: Date.now(),
		reason
	}

	return [...currentAllowlist, newEntry]
}

export function removeFromAllowlist(
	containerId: string,
	currentAllowlist: AllowedConnection[]
): AllowedConnection[] {
	return currentAllowlist.filter(function (c) {
		return c.containerId !== containerId
	})
}

export function validateDestructiveAction(
	container: DockerContainer,
	action: string
): { safe: boolean; warning?: string } {
	if (!isManagedContainer(container)) {
		return {
			safe: false,
			warning: `This container was not created by Dora. ${action} may affect external applications.`
		}
	}

	if (container.state === 'running' && action === 'remove') {
		return {
			safe: true,
			warning:
				'This will stop and remove the running container. Any unsaved work will be lost.'
		}
	}

	return { safe: true }
}

export function getSandboxStatus(
	activeContainer: DockerContainer | null,
	allowedConnections: AllowedConnection[]
): { isSandboxed: boolean; reason: string } {
	if (!activeContainer) {
		return { isSandboxed: false, reason: 'No container selected' }
	}

	if (isManagedContainer(activeContainer)) {
		return {
			isSandboxed: true,
			reason: 'Connected to a Dora-managed container'
		}
	}

	const isAllowed = allowedConnections.some(function (c) {
		return c.containerId === activeContainer.id
	})

	if (isAllowed) {
		return {
			isSandboxed: true,
			reason: 'Connected to a user-trusted container'
		}
	}

	return {
		isSandboxed: false,
		reason: 'Container is not in the trusted list'
	}
}
