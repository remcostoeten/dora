/**
 * UI Zoom & window view controls.
 *
 * Zoom scales the whole UI. On desktop it uses the Tauri webview zoom factor
 * (crisp native rendering); in a plain browser it falls back to CSS `zoom`.
 * The level is persisted to localStorage and re-applied on startup.
 */

const ZOOM_STORAGE_KEY = 'dora-ui-zoom'
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1

function isTauriRuntime(): boolean {
	return (
		typeof window !== 'undefined' &&
		('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
	)
}

function clampZoom(value: number): number {
	const rounded = Math.round(value * 100) / 100
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded))
}

/** Current persisted zoom factor, defaulting to 1 when unset or invalid. */
export function getZoom(): number {
	try {
		const stored = Number(localStorage.getItem(ZOOM_STORAGE_KEY))
		if (Number.isFinite(stored) && stored >= MIN_ZOOM && stored <= MAX_ZOOM) {
			return stored
		}
	} catch (error) {
		console.warn('Failed to read UI zoom:', error)
	}
	return 1
}

async function applyZoom(factor: number): Promise<void> {
	if (isTauriRuntime()) {
		try {
			const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
			await getCurrentWebviewWindow().setZoom(factor)
			return
		} catch (error) {
			console.error('Failed to set webview zoom:', error)
		}
	}
	document.documentElement.style.zoom = String(factor)
}

/** Persist and apply a zoom factor, clamped to the supported range. */
export async function setZoom(factor: number): Promise<number> {
	const clamped = clampZoom(factor)
	try {
		localStorage.setItem(ZOOM_STORAGE_KEY, String(clamped))
	} catch (error) {
		console.warn('Failed to persist UI zoom:', error)
	}
	await applyZoom(clamped)
	return clamped
}

export function zoomIn(): Promise<number> {
	return setZoom(getZoom() + ZOOM_STEP)
}

export function zoomOut(): Promise<number> {
	return setZoom(getZoom() - ZOOM_STEP)
}

export function resetZoom(): Promise<number> {
	return setZoom(1)
}

/** Re-apply the persisted zoom factor. Call once on app startup. */
export function initZoom(): Promise<number> {
	return setZoom(getZoom())
}

/** Toggle native fullscreen (desktop) or the Fullscreen API (browser). */
export async function toggleFullscreen(): Promise<void> {
	if (isTauriRuntime()) {
		try {
			const { getCurrentWindow } = await import('@tauri-apps/api/window')
			const appWindow = getCurrentWindow()
			const isFull = await appWindow.isFullscreen()
			await appWindow.setFullscreen(!isFull)
			return
		} catch (error) {
			console.error('Failed to toggle fullscreen:', error)
		}
	}

	try {
		if (document.fullscreenElement) {
			await document.exitFullscreen()
		} else {
			await document.documentElement.requestFullscreen()
		}
	} catch (error) {
		console.error('Failed to toggle fullscreen:', error)
	}
}
