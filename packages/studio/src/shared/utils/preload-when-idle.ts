/**
 * @name preloadWhenIdle
 * @description Runs chunk loaders once the browser is idle and returns a cancel function. Failures are swallowed; the real import retries on demand.
 * @example
 * useEffect(() => preloadWhenIdle([() => import('./heavy-dialog')]), [])
 */
export function preloadWhenIdle(loaders: Array<() => Promise<unknown>>, delayMs = 1500) {
	function run() {
		for (const load of loaders) {
			void load().catch(function ignorePreloadFailure() {})
		}
	}

	// WebKitGTK ships without requestIdleCallback, so a timer is the fallback.
	if (typeof window.requestIdleCallback === 'function') {
		const handle = window.requestIdleCallback(run, { timeout: delayMs * 2 })
		return function cancel() {
			window.cancelIdleCallback(handle)
		}
	}

	const handle = window.setTimeout(run, delayMs)
	return function cancel() {
		window.clearTimeout(handle)
	}
}
