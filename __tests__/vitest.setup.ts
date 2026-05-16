import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { expect, afterEach, beforeAll } from 'vitest'

// Polyfill localStorage for environments where happy-dom doesn't expose it as a global
beforeAll(() => {
	if (typeof localStorage === 'undefined') {
		const store: Record<string, string> = {}
		const localStorageMock = {
			getItem: (key: string) => store[key] ?? null,
			setItem: (key: string, value: string) => { store[key] = String(value) },
			removeItem: (key: string) => { delete store[key] },
			clear: () => { Object.keys(store).forEach(k => delete store[k]) },
			get length() { return Object.keys(store).length },
			key: (index: number) => Object.keys(store)[index] ?? null,
		}
		Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })
	}
})

// Cleanup after each test
afterEach(() => {
	cleanup()
})

// Custom matchers can be added here
