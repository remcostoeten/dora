import { useCallback, useEffect, useState } from 'react'
import {
	applyAppearanceToDOM,
	getAppearanceSettings,
	saveAppearanceSettings,
	type AppearanceSettings
} from '@studio/shared/lib/appearance-store'

export function useAppearanceSettings() {
	const [settings, setSettings] = useState<AppearanceSettings>(getAppearanceSettings)

	useEffect(() => {
		function sync() {
			setSettings(getAppearanceSettings())
		}
		window.addEventListener('dora-appearance-change', sync)
		return () => window.removeEventListener('dora-appearance-change', sync)
	}, [])

	const update = useCallback((patch: Partial<AppearanceSettings>) => {
		const next = saveAppearanceSettings(patch)
		setSettings(next)
		applyAppearanceToDOM(next)
	}, [])

	return { settings, update }
}
