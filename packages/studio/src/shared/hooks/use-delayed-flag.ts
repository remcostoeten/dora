import { useEffect, useState } from 'react'

/**
 * @name useDelayedFlag
 * @description Returns true only once `flag` has stayed true for `delayMs`, and
 * false again as soon as `flag` turns false. Keeps loading placeholders from
 * flashing on loads that finish before the delay.
 *
 * @example
 * const showSkeleton = useDelayedFlag(isLoading, 150)
 */
export function useDelayedFlag(flag: boolean, delayMs: number): boolean {
	const [elapsed, setElapsed] = useState(false)

	useEffect(
		function trackDelay() {
			if (!flag) {
				setElapsed(false)
				return
			}
			const timer = window.setTimeout(function markElapsed() {
				setElapsed(true)
			}, delayMs)
			return function cancelDelay() {
				window.clearTimeout(timer)
			}
		},
		[flag, delayMs]
	)

	return flag && elapsed
}
