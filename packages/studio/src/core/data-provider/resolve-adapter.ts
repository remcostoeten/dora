import { createTauriAdapter } from './adapters/tauri'
import type { DataAdapter } from './types'

export function detectTauri(): boolean {
	return (
		typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
	)
}

let pending: Promise<DataAdapter> | null = null
let resolved: DataAdapter | null = null

/**
 * Resolve the adapter outside React, memoized for the life of the process.
 *
 * The boot path needs an adapter before the first render — bootstrap has to
 * land in the store while the boot screen is still up — and the provider needs
 * the same instance afterwards. Resolving here rather than in an effect keeps
 * both on one adapter and one mock-chunk load.
 */
export function resolveAdapter(forceMock = false): Promise<DataAdapter> {
	if (resolved) return Promise.resolve(resolved)
	if (pending) return pending

	pending = (async function () {
		if (!forceMock && detectTauri()) {
			resolved = createTauriAdapter()
			return resolved
		}

		// The mock adapter (and its bundled demo dataset) is only for the web
		// demo — load it on demand so desktop startup never pays for it.
		const mock = await import('./adapters/mock')
		resolved = mock.createMockAdapter()
		return resolved
	})()

	pending.catch(function () {
		pending = null
	})

	return pending
}

/** The adapter if one has already resolved, for callers that cannot await. */
export function peekAdapter(): DataAdapter | null {
	return resolved
}
