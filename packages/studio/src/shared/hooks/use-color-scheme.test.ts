import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { getColorScheme, useColorScheme } from './use-color-scheme'

function setTheme(name: string | null) {
	const classList = document.documentElement.classList
	classList.remove('light', 'dark', 'claude', 'midnight')
	if (name) classList.add(name)
}

describe('use-color-scheme', () => {
	afterEach(() => {
		setTheme(null)
	})

	it('treats light and claude as light and everything else as dark', () => {
		setTheme('light')
		expect(getColorScheme()).toBe('light')
		setTheme('claude')
		expect(getColorScheme()).toBe('light')
		setTheme('midnight')
		expect(getColorScheme()).toBe('dark')
		setTheme(null)
		expect(getColorScheme()).toBe('dark')
	})

	it('re-renders when the appearance changes', async () => {
		setTheme('dark')
		const { result } = renderHook(() => useColorScheme())
		expect(result.current).toBe('dark')

		await act(async () => {
			setTheme('light')
			window.dispatchEvent(new CustomEvent('dora-appearance-change'))
		})
		expect(result.current).toBe('light')
	})
})
