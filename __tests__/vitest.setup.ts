import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

class MemoryStorage {
	getItem(key: string): string | null {
		return Object.hasOwn(this, key) ? (this as unknown as Record<string, string>)[key] : null
	}
	setItem(key: string, value: string): void {
		;(this as unknown as Record<string, string>)[key] = String(value)
	}
	removeItem(key: string): void {
		delete (this as unknown as Record<string, string>)[key]
	}
	clear(): void {
		for (const key of Object.keys(this)) this.removeItem(key)
	}
	key(index: number): string | null {
		return Object.keys(this)[index] ?? null
	}
	get length(): number {
		return Object.keys(this).length
	}
}

// Node 25+ defines a global localStorage that is undefined without --localstorage-file, shadowing happy-dom's.
for (const name of ['localStorage', 'sessionStorage'] as const) {
	if (typeof globalThis[name]?.setItem !== 'function') {
		Object.defineProperty(globalThis, name, {
			value: new MemoryStorage(),
			configurable: true,
			writable: true
		})
	}
}

// Cleanup after each test
afterEach(() => {
	cleanup()
})

// Custom matchers can be added here
