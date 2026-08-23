import { preloadEditorHost } from '@studio/core/editor-host'

export function isTauri(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Show the main window once the inline boot screen is in the DOM. */
export async function revealMainWindow(): Promise<void> {
	if (!isTauri()) return
	try {
		const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
		await getCurrentWebviewWindow().show()
	} catch (error) {
		console.warn('Failed to show main window:', error)
	}
}

/** Fade out and remove the inline boot screen after the app has painted. */
export function dismissBootScreen(): void {
	const el = document.getElementById('boot-screen')
	if (!el) return

	el.classList.add('boot-screen--out')
	const remove = () => el.remove()
	el.addEventListener('transitionend', remove, { once: true })
	window.setTimeout(remove, 450)
}

export async function preloadBootAssets(): Promise<void> {
	const results = await Promise.allSettled([
		preloadEditorHost(),
		document.fonts?.load("12px 'JetBrains Mono'") ?? Promise.resolve([]),
		document.fonts?.load("12px 'Inter'") ?? Promise.resolve([])
	])
	results.forEach((result) => {
		if (result.status === 'rejected') {
			console.warn('Failed to preload a boot asset:', result.reason)
		}
	})
}
