import { DEFAULT_HOST_PORT_START, DEFAULT_HOST_PORT_END } from "../constants";

export async function findFreePort(
	preferredPort?: number,
	startPort: number = DEFAULT_HOST_PORT_START,
	endPort: number = DEFAULT_HOST_PORT_END
): Promise<number> {
	if (preferredPort && (await isPortAvailable(preferredPort))) {
		return preferredPort
	}

	for (let port = startPort; port <= endPort; port++) {
		if (await isPortAvailable(port)) {
			return port
		}
	}

	throw new Error(`No available ports found in range ${startPort}-${endPort}`)
}

export async function isPortAvailable(port: number): Promise<boolean> {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), 200)

	try {
		await fetch(`http://localhost:${port}`, {
			method: 'HEAD',
			signal:
				typeof AbortSignal.timeout === 'function'
					? AbortSignal.timeout(200)
					: controller.signal
		})
		clearTimeout(timeoutId)
		return false
	} catch (error) {
		clearTimeout(timeoutId)

		// If the fetch failed, it might be because nothing is listening (good)
		// or because of a network error.

		if (error instanceof TypeError) {
			// "Failed to fetch" usually means connection refused (nothing listening)
			return true
		}

		if (error instanceof DOMException && error.name === 'AbortError') {
			// Timeout implies something might be there but not responding,
			// or it's just slow. For safety, we treat timeouts as "occupied"
			// to avoid conflicts, or at least "unknown".
			// However, strictly speaking, we don't know.
			// The previous code returned true (available) on abort,
			// but the review says that's "brittle".
			// Let's assume if it times out, we shouldn't try to use it.
			return false
		}

		return true
	}
}

export function formatPortMapping(hostPort: number, containerPort: number): string {
	return `${hostPort}:${containerPort}`
}

export function parsePortMapping(
	mapping: string
): { hostPort: number; containerPort: number } | null {
	const parts = mapping.split(':')
	if (parts.length !== 2) {
		return null
	}

	const hostPort = parseInt(parts[0], 10)
	const containerPort = parseInt(parts[1], 10)

	if (isNaN(hostPort) || isNaN(containerPort)) {
		return null
	}

	return { hostPort, containerPort }
}

export function isValidPort(port: number): boolean {
	return Number.isInteger(port) && port >= 1 && port <= 65535
}

export function isPrivilegedPort(port: number): boolean {
	return port < 1024
}

export function getPortRange(): { start: number; end: number } {
	return {
		start: DEFAULT_HOST_PORT_START,
		end: DEFAULT_HOST_PORT_END
	}
}
