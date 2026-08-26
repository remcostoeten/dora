import { useEffect, useRef, useState } from 'react'

/**
 * Presence controller for enter/exit transitions on conditionally-rendered UI.
 * `present` keeps the element mounted for `exitMs` after `open` flips false.
 * `state` is 'closed' on the first mounted frame and flips to 'open' a frame
 * later, so a CSS transition has a from-state to animate away from.
 */
export function usePresence(open: boolean, exitMs: number) {
	const [present, setPresent] = useState(open)
	const [state, setState] = useState<'open' | 'closed'>('closed')
	const timeoutRef = useRef<number | undefined>(undefined)

	useEffect(
		function syncPresence() {
			if (open) {
				window.clearTimeout(timeoutRef.current)
				setPresent(true)
				/*
				 * Double rAF: the first frame can batch into the same paint as the
				 * mount, which would skip the transition. The second guarantees the
				 * 'closed' styles have been painted before flipping to 'open'.
				 */
				let inner: number | undefined
				const outer = window.requestAnimationFrame(function () {
					inner = window.requestAnimationFrame(function () {
						setState('open')
					})
				})
				return function () {
					window.cancelAnimationFrame(outer)
					if (inner !== undefined) window.cancelAnimationFrame(inner)
				}
			}
			setState('closed')
			timeoutRef.current = window.setTimeout(function () {
				setPresent(false)
			}, exitMs)
			return function () {
				window.clearTimeout(timeoutRef.current)
			}
		},
		[open, exitMs]
	)

	return { present, state }
}
