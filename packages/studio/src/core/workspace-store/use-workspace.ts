import { useCallback, useRef, useSyncExternalStore } from 'react'
import { workspaceStore, type WorkspaceAction } from './store'
import type { WorkspaceState } from './types'

type Selection<T> = {
	state: WorkspaceState
	selector: (state: WorkspaceState) => T
	value: T
}

/**
 * Subscribe to one narrow slice of the workspace state.
 *
 * The selected value is recomputed only when the store's state object changes
 * identity or the selector itself does, and the previous value's reference is
 * kept whenever `isEqual` says nothing moved. That is what keeps a component
 * reading `activeTabId` from committing when a table snapshot lands.
 *
 * For a selector that derives a new object or array on every call (a `filter`,
 * a `map`), pass an `isEqual` that compares contents — otherwise the identity
 * check re-renders every time any part of the store changes.
 */
export function useWorkspaceSelector<T>(
	selector: (state: WorkspaceState) => T,
	isEqual: (a: T, b: T) => boolean = Object.is
): T {
	const selectorRef = useRef(selector)
	const isEqualRef = useRef(isEqual)
	selectorRef.current = selector
	isEqualRef.current = isEqual

	const selectionRef = useRef<Selection<T> | null>(null)

	const getSelection = useCallback(function () {
		const state = workspaceStore.getState()
		const current = selectorRef.current
		const previous = selectionRef.current

		if (previous && previous.state === state && previous.selector === current) {
			return previous.value
		}

		const value = current(state)
		if (previous && isEqualRef.current(previous.value, value)) {
			selectionRef.current = { state, selector: current, value: previous.value }
			return previous.value
		}

		selectionRef.current = { state, selector: current, value }
		return value
	}, [])

	return useSyncExternalStore(workspaceStore.subscribe, getSelection, getSelection)
}

/**
 * Dispatch is stable for the life of the app, so a component can depend on it
 * without re-subscribing to anything.
 */
export function useWorkspaceDispatch(): (action: WorkspaceAction) => void {
	return workspaceStore.dispatch
}

export function shallowArrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
	if (a === b) return true
	if (a.length !== b.length) return false
	return a.every((item, index) => Object.is(item, b[index]))
}
