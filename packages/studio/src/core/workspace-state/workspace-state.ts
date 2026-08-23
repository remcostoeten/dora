import {
	useCallback,
	useRef,
	useSyncExternalStore,
	type Dispatch,
	type SetStateAction
} from 'react'

const values = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()

function subscribe(key: string, listener: () => void): () => void {
	const keyListeners = listeners.get(key) ?? new Set()
	keyListeners.add(listener)
	listeners.set(key, keyListeners)

	return () => {
		keyListeners.delete(listener)
		if (keyListeners.size === 0) listeners.delete(key)
	}
}

export function readWorkspaceState<T>(key: string, fallback: T): T {
	return (values.has(key) ? values.get(key) : fallback) as T
}

export function writeWorkspaceState<T>(key: string, value: T): void {
	if (Object.is(values.get(key), value)) return
	values.set(key, value)
	listeners.get(key)?.forEach((listener) => listener())
}

export function useWorkspaceState<T>(
	key: string,
	createInitialValue: () => T
): [T, Dispatch<SetStateAction<T>>] {
	const initialValuesRef = useRef(new Map<string, T>())
	if (!initialValuesRef.current.has(key)) {
		initialValuesRef.current.set(key, createInitialValue())
	}
	const initialValue = initialValuesRef.current.get(key) as T

	const value = useSyncExternalStore(
		(listener) => subscribe(key, listener),
		() => readWorkspaceState(key, initialValue),
		() => readWorkspaceState(key, initialValue)
	)

	const setValue = useCallback(
		(nextValue: SetStateAction<T>) => {
			const current = readWorkspaceState(key, initialValue)
			const next =
				typeof nextValue === 'function'
					? (nextValue as (previous: T) => T)(current)
					: nextValue
			writeWorkspaceState(key, next)
		},
		[key, initialValue]
	)

	return [value, setValue]
}
