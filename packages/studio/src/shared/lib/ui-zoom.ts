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

const WHEEL_LINE_HEIGHT_PX = 16
const WHEEL_PAGE_HEIGHT_PX = 400
const WHEEL_STEP_THRESHOLD_PX = 50

function normalizeWheelDelta(event: WheelEvent): number {
	if (event.deltaMode === 1) return event.deltaY * WHEEL_LINE_HEIGHT_PX
	if (event.deltaMode === 2) return event.deltaY * WHEEL_PAGE_HEIGHT_PX
	return event.deltaY
}

/**
 * Bind Ctrl/Cmd + mouse-wheel (and trackpad pinch, which browsers deliver as a
 * synthetic ctrl-wheel) to zoom the UI, mirroring the keyboard shortcuts.
 *
 * Delta is accumulated rather than throttled, so high-frequency small-delta
 * trackpad gestures track the finger instead of having most events dropped.
 * Returns a cleanup that removes the listener.
 */
export function attachWheelZoom(target: Window = window): () => void {
	let accumulated = 0

	function onWheel(event: WheelEvent): void {
		if (!event.ctrlKey && !event.metaKey) return
		// Suppress native page/pinch zoom on every matching event, including the
		// ones that have not yet accumulated enough delta to move a zoom step.
		event.preventDefault()

		const delta = normalizeWheelDelta(event)
		if (delta === 0) return

		if (accumulated !== 0 && Math.sign(delta) !== Math.sign(accumulated)) {
			accumulated = 0
		}
		accumulated += delta

		const steps = Math.trunc(accumulated / WHEEL_STEP_THRESHOLD_PX)
		if (steps === 0) return
		accumulated -= steps * WHEEL_STEP_THRESHOLD_PX

		const current = getZoom()
		const next = clampZoom(current - steps * ZOOM_STEP)
		if (next === current) return

		setZoom(next)
	}

	// Capture phase: Monaco and other nested scrollers consume `wheel` on their
	// own containers, so a bubble-phase listener never sees gestures over them.
	target.addEventListener('wheel', onWheel, { passive: false, capture: true })
	return function () {
		target.removeEventListener('wheel', onWheel, { capture: true })
	}
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
