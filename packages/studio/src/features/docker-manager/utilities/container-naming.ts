import { CONTAINER_PREFIX } from '../constants'

export function generateContainerName(baseName?: string): string {
	const timestamp = Date.now().toString(36)
	const randomSuffix = Math.random().toString(36).substring(2, 6)

	if (baseName) {
		const sanitized = sanitizeContainerName(baseName)
		return sanitized
	}

	return `dev_${timestamp}_${randomSuffix}`
}

export function sanitizeContainerName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, '_')
		.replace(/_{2,}/g, '_')
		.replace(/^_+|_+$/g, '')
}

export function validateContainerName(name: string): { valid: boolean; error?: string } {
	if (!name) {
		return { valid: false, error: 'Container name is required' }
	}

	if (name.length > 63) {
		return { valid: false, error: 'Container name must be 63 characters or fewer' }
	}

	const validPattern = /^[a-z0-9][a-z0-9_-]*$/
	if (!validPattern.test(name)) {
		return {
			valid: false,
			error: 'Container name can only contain lowercase letters, numbers, underscores, and hyphens'
		}
	}

	return { valid: true }
}

export function ensurePrefix(name: string): string {
	if (name.startsWith(CONTAINER_PREFIX)) {
		return name
	}
	return name
}

export function stripPrefix(name: string): string {
	if (name.startsWith(CONTAINER_PREFIX)) {
		return name.slice(CONTAINER_PREFIX.length)
	}
	return name
}

export function isManaged(name: string): boolean {
	return name.startsWith(CONTAINER_PREFIX)
}

export function generateVolumeName(containerName: string): string {
	return `${containerName}_data`
}

export function suggestContainerName(existingNames: string[]): string {
	let counter = 1
	let suggestion = `dev_${counter.toString().padStart(3, '0')}`

	while (existingNames.includes(suggestion)) {
		counter++
		suggestion = `dev_${counter.toString().padStart(3, '0')}`
	}

	return suggestion
}
