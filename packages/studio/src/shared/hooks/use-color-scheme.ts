import { useSyncExternalStore } from 'react'
import { noop } from '@studio/shared/utils/noop'

export type ColorScheme = 'light' | 'dark'

const LIGHT_THEME_CLASSES = ['light', 'claude'] as const
const APPEARANCE_EVENT = 'dora-appearance-change'

/**
 * Resolves the app theme to a light/dark scheme. Dora themes are applied as a
 * class on the root element and never set CSS `color-scheme`, so libraries
 * that pick their palette via `light-dark()` need this told to them
 * explicitly.
 */
export function getColorScheme(): ColorScheme {
	if (typeof document === 'undefined') return 'dark'
	const classList = document.documentElement.classList
	return LIGHT_THEME_CLASSES.some(function (name) {
		return classList.contains(name)
	})
		? 'light'
		: 'dark'
}

function subscribe(onChange: () => void): () => void {
	if (typeof window === 'undefined') return noop
	window.addEventListener(APPEARANCE_EVENT, onChange)
	const observer = new MutationObserver(onChange)
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
	return function unsubscribe() {
		window.removeEventListener(APPEARANCE_EVENT, onChange)
		observer.disconnect()
	}
}

export function useColorScheme(): ColorScheme {
	return useSyncExternalStore(subscribe, getColorScheme, getColorScheme)
}
