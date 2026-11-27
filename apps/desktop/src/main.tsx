import { createRoot } from 'react-dom/client'
import { prepareStudio } from '@studio/boot'
import {
	dismissBootScreen,
	reportFirstPaint,
	revealMainWindow,
	warmEditorHost
} from './boot-screen'
import App from './App.tsx'
import '@studio/styles.css'
import '@remcostoeten/notifier/styles'

async function boot() {
	void revealMainWindow()
	await prepareStudio()

	createRoot(document.getElementById('root')!).render(<App />)

	warmEditorHost()

	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			dismissBootScreen()
			void reportFirstPaint()
		})
	})
}

void boot().catch((error) => {
	console.error('Failed to boot Dora:', error)
})
