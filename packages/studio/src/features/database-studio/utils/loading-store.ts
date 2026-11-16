import { useSyncExternalStore } from 'react'

const REVALIDATION_INDICATOR_DELAY_MS = 400

export type LoadPhase = 'idle' | 'loading' | 'revalidating'

export type LoadingStore = {
	get: () => LoadPhase
	set: (phase: LoadPhase) => void
	isIndicated: () => boolean
	subscribe: (listener: () => void) => () => void
}

/**
 * @name createLoadingStore
 * @description Creates the store that holds a table's load phase outside
 * React state, so starting and finishing a fetch re-renders only the leaf that
 * shows the indicator, not the component that owns the grid. Subscribers are
 * told when the indicator should appear or disappear, not on every phase
 * change: at once for a fetch the user is waiting on, and only after a delay
 * for a background revalidation, so a refresh that returns quickly renders
 * nothing at all.
 *
 * @example
 * const [loadingStore] = useState(createLoadingStore)
 * loadingStore.set('loading')
 */
export function createLoadingStore(): LoadingStore {
	let phase: LoadPhase = 'idle'
	let indicated = false
	let delayTimer: ReturnType<typeof setTimeout> | null = null
	const listeners = new Set<() => void>()

	function setIndicated(next: boolean) {
		if (next === indicated) return
		indicated = next
		for (const listener of listeners) listener()
	}

	function clearDelay() {
		if (!delayTimer) return
		clearTimeout(delayTimer)
		delayTimer = null
	}

	return {
		get: function () {
			return phase
		},
		set: function (next) {
			if (next === phase) return
			phase = next
			clearDelay()
			if (next === 'revalidating') {
				delayTimer = setTimeout(function showSlowRevalidation() {
					delayTimer = null
					setIndicated(true)
				}, REVALIDATION_INDICATOR_DELAY_MS)
				return
			}
			setIndicated(next === 'loading')
		},
		isIndicated: function () {
			return indicated
		},
		subscribe: function (listener) {
			listeners.add(listener)
			return function unsubscribe() {
				listeners.delete(listener)
			}
		}
	}
}

/**
 * @name useIsLoadIndicated
 * @description Subscribes a component to whether a loading store's busy
 * indicator should show.
 *
 * @example
 * const isBusy = useIsLoadIndicated(loadingStore)
 */
export function useIsLoadIndicated(store: LoadingStore): boolean {
	return useSyncExternalStore(store.subscribe, store.isIndicated, store.isIndicated)
}
