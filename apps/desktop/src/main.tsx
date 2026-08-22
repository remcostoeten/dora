import { createRoot } from 'react-dom/client'
import { getAppearanceSettings, applyAppearanceToDOM } from '@studio/shared/lib/appearance-store'
import { loadFontPair } from '@studio/shared/lib/font-loader'
import { dismissBootScreen, preloadBootAssets, revealMainWindow } from './boot-screen'
import App from './App.tsx'
import '@studio/styles.css'
import '@remcostoeten/notifier/styles'

async function boot() {
	void revealMainWindow()

	const settings = getAppearanceSettings()
	applyAppearanceToDOM(settings)
	const fontPromise =
		settings.fontPair === 'system'
			? Promise.resolve()
			: loadFontPair(settings.fontPair).catch((error) => {
					console.warn('Failed to preload the selected font pair:', error)
				})
	await Promise.all([fontPromise, preloadBootAssets()])

	createRoot(document.getElementById('root')!).render(<App />)

	requestAnimationFrame(() => {
		requestAnimationFrame(dismissBootScreen)
	})
}

void boot().catch((error) => {
	console.error('Failed to boot Dora:', error)
})
