import { useEffect } from 'react'
import { readUrlParam, writeUrlParams } from '@studio/core/url-state/url-params'
import {
	getAppearanceSettings,
	saveAppearanceSettings,
	applyAppearanceToDOM,
	Theme,
	AppearanceSettings
} from '@studio/shared/lib/appearance-store'

const THEME_PARAM = 'theme'

function applyThemeFromUrl() {
	const themeParam = readUrlParam(THEME_PARAM) as Theme | null
	if (!themeParam) return

	const currentSettings = getAppearanceSettings()
	if (currentSettings.theme !== themeParam) {
		const updated = saveAppearanceSettings({ theme: themeParam })
		applyAppearanceToDOM(updated)
	}
}

export function useThemeSync() {
	useEffect(function syncUrlToStore() {
		applyThemeFromUrl()
		window.addEventListener('popstate', applyThemeFromUrl)
		return () => window.removeEventListener('popstate', applyThemeFromUrl)
	}, [])

	useEffect(function syncStoreToUrl() {
		function handleAppearanceChange(event: Event) {
			const customEvent = event as CustomEvent<AppearanceSettings>
			writeUrlParams({ [THEME_PARAM]: customEvent.detail.theme })
		}

		window.addEventListener('dora-appearance-change', handleAppearanceChange)
		return () => window.removeEventListener('dora-appearance-change', handleAppearanceChange)
	}, [])
}
