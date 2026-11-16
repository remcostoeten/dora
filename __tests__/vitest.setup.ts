import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Node 25+ ships its own localStorage global that is undefined without --localstorage-file and shadows happy-dom's
if (typeof localStorage === 'undefined') {
	Object.defineProperty(globalThis, 'localStorage', {
		value: new Storage(),
		writable: true,
		configurable: true
	})
}

// Cleanup after each test
afterEach(() => {
	cleanup()
})

// Custom matchers can be added here
