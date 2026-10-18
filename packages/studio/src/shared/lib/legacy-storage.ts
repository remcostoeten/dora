import { detectTauri } from '@studio/core/data-provider/resolve-adapter'

const LEGACY_DEMO_STORE_KEY = 'dora_demo_store'

/**
 * @name purgeLegacyDemoStore
 * @description Removes the web demo's persisted mock dataset (and its backups)
 * from localStorage when running inside Tauri, where the mock adapter is never
 * loaded. The dataset is megabytes of JSON that otherwise sits in the origin's
 * storage and eats most of its quota.
 *
 * @example
 * purgeLegacyDemoStore()
 */
export function purgeLegacyDemoStore(): void {
	if (!detectTauri()) return
	try {
		const stale = Object.keys(localStorage).filter(function isDemoStoreKey(key) {
			return (
				key === LEGACY_DEMO_STORE_KEY || key.startsWith(`${LEGACY_DEMO_STORE_KEY}_backup_`)
			)
		})
		for (const key of stale) {
			localStorage.removeItem(key)
		}
	} catch (error) {
		console.warn('Failed to purge the legacy demo store:', error)
	}
}
