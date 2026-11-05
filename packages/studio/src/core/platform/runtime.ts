export class DesktopOnlyError extends Error {
	constructor(message = 'This feature is only available in the desktop app.') {
		super(message)
		this.name = 'DesktopOnlyError'
	}
}

export function isTauriRuntime(): boolean {
	return (
		typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
	)
}

export function isDesktopOnlyError(error: unknown): error is DesktopOnlyError {
	return error instanceof DesktopOnlyError
}

export function assertTauriRuntime(message?: string): void {
	if (!isTauriRuntime()) {
		throw new DesktopOnlyError(message)
	}
}
