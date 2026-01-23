import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { getAppearanceSettings, saveAppearanceSettings, applyAppearanceToDOM, Theme, AppearanceSettings } from "@/shared/lib/appearance-store";

const THEME_PARAM = 'theme'

export function useThemeSync() {
	const [searchParams, setSearchParams] = useSearchParams()

	// Sync URL -> Store/DOM
	useEffect(() => {
		const themeParam = searchParams.get(THEME_PARAM) as Theme | null
		if (!themeParam) return

		const currentSettings = getAppearanceSettings()
		if (currentSettings.theme !== themeParam) {
			const updated = saveAppearanceSettings({ theme: themeParam })
			applyAppearanceToDOM(updated)
		}
	}, [searchParams])

	// Sync Store/Event -> URL
	useEffect(() => {
		function handleAppearanceChange(event: Event) {
			const customEvent = event as CustomEvent<AppearanceSettings>
			const newTheme = customEvent.detail.theme

			setSearchParams(
				(prev) => {
					if (prev.get(THEME_PARAM) === newTheme) {
						return prev
					}

					const newParams = new URLSearchParams(prev)
					newParams.set(THEME_PARAM, newTheme)
					return newParams
				},
				{ replace: true }
			)
		}

		window.addEventListener('dora-appearance-change', handleAppearanceChange)
		return () => window.removeEventListener('dora-appearance-change', handleAppearanceChange)
	}, [setSearchParams])
}
