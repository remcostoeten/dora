import { hydrateWorkspaceFromBootstrap, initTableSnapshotPersistence } from './core/workspace-store'
import { dropCostlyEditorFocusRule } from './core/editor-host/focus-rule'
import { applyAppearanceToDOM, getAppearanceSettings } from './shared/lib/appearance-store'
import { loadFontPair } from './shared/lib/font-loader'
import { purgeLegacyDemoStore } from './shared/lib/legacy-storage'

const FONT_WAIT_LIMIT_MS = 3000

function withinFontWaitLimit(fonts: Promise<unknown>): Promise<unknown> {
	const limit = new Promise((resolve) => window.setTimeout(resolve, FONT_WAIT_LIMIT_MS))
	return Promise.race([fonts, limit])
}

async function preloadFonts(): Promise<void> {
	const results = await Promise.allSettled([
		document.fonts?.load("12px 'JetBrains Mono'") ?? Promise.resolve([]),
		document.fonts?.load("12px 'Inter'") ?? Promise.resolve([])
	])
	results.forEach((result) => {
		if (result.status === 'rejected') {
			console.warn('Failed to preload a boot asset:', result.reason)
		}
	})
}

/**
 * @name prepareStudio
 * @description Runs everything a host has to finish before it first renders
 * `StudioApp`: applies the saved appearance, loads fonts and fills the workspace
 * store, so desktop and web paint the same first frame.
 *
 * @example
 * await prepareStudio()
 * createRoot(element).render(<StudioApp analyticsConfig={config} />)
 */
export async function prepareStudio(): Promise<void> {
	purgeLegacyDemoStore()
	dropCostlyEditorFocusRule()

	const settings = getAppearanceSettings()
	applyAppearanceToDOM(settings)
	const fontPromise =
		settings.fontPair === 'system'
			? Promise.resolve()
			: loadFontPair(settings.fontPair).catch((error) => {
					console.warn('Failed to preload the selected font pair:', error)
				})
	await Promise.all([
		withinFontWaitLimit(Promise.all([fontPromise, preloadFonts()])),
		hydrateWorkspaceFromBootstrap()
	])

	initTableSnapshotPersistence()
}
