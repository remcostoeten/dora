export type BackendErrorShape = {
	kind: string
	detail: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

export function isBackendErrorShape(error: unknown): error is BackendErrorShape {
	return (
		isRecord(error) &&
		typeof error.kind === 'string' &&
		typeof error.detail === 'string'
	)
}

export function formatBackendError(error: unknown): string {
	if (typeof error === 'string') return error
	if (error instanceof Error) return error.message

	if (isBackendErrorShape(error)) {
		return error.detail || error.kind
	}

	if (isRecord(error)) {
		if (typeof error.message === 'string') return error.message
		if (typeof error.detail === 'string') return error.detail
		if (typeof error.error === 'string') return error.error

		try {
			return JSON.stringify(error)
		} catch {
			return 'Unknown error'
		}
	}

	if (error == null) return 'Unknown error'
	return String(error)
}

export function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(formatBackendError(error))
}
