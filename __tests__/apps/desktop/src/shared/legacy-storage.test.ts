import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { purgeLegacyDemoStore } from '@/shared/lib/legacy-storage'

describe('purgeLegacyDemoStore', () => {
	beforeEach(() => {
		localStorage.clear()
		localStorage.setItem('dora_demo_store', '{"tables":{}}')
		localStorage.setItem('dora_demo_store_backup_1', '{}')
		localStorage.setItem('dora.table-snapshots.v1', '[]')
	})

	afterEach(() => {
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
		localStorage.clear()
	})

	it('removes the demo store and its backups inside Tauri and keeps other keys', () => {
		;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}

		purgeLegacyDemoStore()

		expect(localStorage.getItem('dora_demo_store')).toBeNull()
		expect(localStorage.getItem('dora_demo_store_backup_1')).toBeNull()
		expect(localStorage.getItem('dora.table-snapshots.v1')).toBe('[]')
	})

	it('leaves the demo store alone in browser mode, where the mock adapter owns it', () => {
		purgeLegacyDemoStore()

		expect(localStorage.getItem('dora_demo_store')).toBe('{"tables":{}}')
		expect(localStorage.getItem('dora_demo_store_backup_1')).toBe('{}')
	})
})
