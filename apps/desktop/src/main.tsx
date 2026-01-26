import { createRoot } from 'react-dom/client'
import { getAppearanceSettings, applyAppearanceToDOM } from '@/shared/lib/appearance-store'
import { loadFontPair } from '@/shared/lib/font-loader'
import App from './App.tsx'
import './index.css'
import './monaco-workers'

// Initialize appearance before rendering to prevent theme flash
const settings = getAppearanceSettings()
applyAppearanceToDOM(settings)
if (settings.fontPair !== 'system') {
	loadFontPair(settings.fontPair).catch(console.error)
}

createRoot(document.getElementById('root')!).render(<App />)
