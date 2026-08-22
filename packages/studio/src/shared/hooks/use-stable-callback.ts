import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * Returns a function whose identity never changes but which always invokes the
 * latest `callback`. Lets a memoized child keep its memo when the parent
 * re-creates handlers on every render.
 */
export function useStableCallback<Args extends unknown[], Result>(
	callback: ((...args: Args) => Result) | undefined
): (...args: Args) => Result | undefined {
	const latest = useRef(callback)

	useLayoutEffect(
		function syncLatest() {
			latest.current = callback
		},
		[callback]
	)

	return useCallback(function stable(...args: Args) {
		return latest.current?.(...args)
	}, [])
}

/**
 * `useStableCallback` for an optional prop: stays `undefined` while the
 * callback is absent (callers branch on presence), otherwise a stable function.
 */
export function useStableOptionalCallback<Args extends unknown[], Result>(
	callback: ((...args: Args) => Result) | undefined
): ((...args: Args) => Result | undefined) | undefined {
	const stable = useStableCallback(callback)
	return callback ? stable : undefined
}
