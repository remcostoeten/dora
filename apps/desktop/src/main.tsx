import { createRoot } from 'react-dom/client'
import { getAppearanceSettings, applyAppearanceToDOM } from '@studio/shared/lib/appearance-store'
import { loadFontPair } from '@studio/shared/lib/font-loader'
import App from './App.tsx'
import '@studio/styles.css'
import '@remcostoeten/notifier/styles'

// Initialize appearance before rendering to prevent theme flash
const settings = getAppearanceSettings()
applyAppearanceToDOM(settings)
if (settings.fontPair !== 'system') {
	loadFontPair(settings.fontPair).catch(console.error)
}

createRoot(document.getElementById('root')!).render(<App />)
