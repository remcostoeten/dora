/**
 * Appearance Store
 * Manages theme, font pair, and UI density preferences with localStorage persistence.
 */

export type Theme = 'dark' | 'light' | 'midnight' | 'forest' | 'claude' | 'claude-dark' | 'night'
export type FontPair = 'system' | 'serif' | 'compact' | 'playful' | 'technical' | 'vintage'

export type AppearanceSettings = {
	theme: Theme
	fontPair: FontPair
	hueShift: number // 0-360
}

const STORAGE_KEY = 'dora-appearance'

export const DEFAULT_SETTINGS: AppearanceSettings = {
	theme: 'dark',
	fontPair: 'system',
	hueShift: 0
}

export function getAppearanceSettings(): AppearanceSettings {
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored) {
			// Merge with defaults to handle removal of density or new fields
			const parsed = JSON.parse(stored)
			// Remove legacy density if present
			delete parsed.density
			return { ...DEFAULT_SETTINGS, ...parsed }
		}
	} catch (e) {
		console.warn('Failed to load appearance settings:', e)
	}
	return DEFAULT_SETTINGS
}

export function saveAppearanceSettings(settings: Partial<AppearanceSettings>): AppearanceSettings {
	const current = getAppearanceSettings()
	const updated = { ...current, ...settings }
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
		window.dispatchEvent(new CustomEvent('dora-appearance-change', { detail: updated }))
	} catch (e) {
		console.warn('Failed to save appearance settings:', e)
	}
	return updated
}

export function applyAppearanceToDOM(settings: AppearanceSettings): void {
	const root = document.documentElement

	// Theme
	root.classList.remove('light', 'dark', 'midnight', 'forest', 'claude', 'claude-dark', 'night')
	root.classList.add(settings.theme)

	// Font Pair
	root.classList.remove(
		'font-system',
		'font-serif',
		'font-compact',
		'font-playful',
		'font-technical',
		'font-vintage'
	)
	root.classList.add(`font-${settings.fontPair}`)

	// Density (Hardcoded to comfortable for now as option was removed)
	root.classList.remove('density-compact', 'density-spacious')
	root.classList.add('density-comfortable')

	// Hue Shift
	root.style.setProperty('--hue-shift', `${settings.hueShift}`)
}
