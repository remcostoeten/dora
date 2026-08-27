import { useSyncExternalStore } from 'react'

export type ConnectionPhase = 'connecting' | 'introspecting'

const phases = new Map<string, ConnectionPhase>()
const listeners = new Set<() => void>()

/**
 * Ephemeral per-connection open progress, written by the schema queryFn and
 * read by loading surfaces so a long connect (e.g. a suspended Neon compute
 * waking up) shows a stage instead of an unexplained skeleton. Deliberately
 * not workspace-store state: it exists only while one fetch is in flight and
 * must be writable from plain async code.
 */
export function setConnectionPhase(connectionId: string, phase: ConnectionPhase | null): void {
	if (phase === null) {
		phases.delete(connectionId)
	} else {
		phases.set(connectionId, phase)
	}
	for (const listener of listeners) {
		listener()
	}
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export function useConnectionPhase(connectionId: string | undefined): ConnectionPhase | null {
	return useSyncExternalStore(subscribe, () =>
		connectionId ? (phases.get(connectionId) ?? null) : null
	)
}
