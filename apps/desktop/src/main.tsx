import { createRoot } from 'react-dom/client'
import { getAppearanceSettings, applyAppearanceToDOM } from '@studio/shared/lib/appearance-store'
import { loadFontPair } from '@studio/shared/lib/font-loader'
import { dismissBootScreen, revealMainWindow } from './boot-screen'
import App from './App.tsx'
import '@studio/styles.css'
import '@remcostoeten/notifier/styles'

// Show the window with the inline boot screen — avoids a blank frame on all platforms.
void revealMainWindow()

const settings = getAppearanceSettings()
applyAppearanceToDOM(settings)
if (settings.fontPair !== 'system') {
	loadFontPair(settings.fontPair).catch(console.error)
}

createRoot(document.getElementById('root')!).render(<App />)

requestAnimationFrame(() => {
	requestAnimationFrame(dismissBootScreen)
})
