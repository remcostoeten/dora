import { useEffect, useSyncExternalStore } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { commands } from '@studio/lib/bindings'
import { buildMockAiStatus } from './mock-ai'

export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434'

export const KEYLESS_PROVIDERS: ReadonlySet<string> = new Set(['ollama', 'mock'])

type AiSelection = {
	provider: string
	ollamaEndpoint: string
	ready: boolean
}

let state: AiSelection = {
	provider: 'groq',
	ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT,
	ready: false
}

const listeners = new Set<() => void>()

function emit() {
	for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

function getSnapshot(): AiSelection {
	return state
}

/**
 * Publish the provider the user is currently pointing the assistant at, so
 * sibling settings sections can show or hide themselves without each one
 * re-reading the config from the backend.
 */
export function publishAiSelection(next: Partial<Omit<AiSelection, 'ready'>>) {
	const merged: AiSelection = { ...state, ...next, ready: true }
	if (
		merged.provider === state.provider &&
		merged.ollamaEndpoint === state.ollamaEndpoint &&
		state.ready
	) {
		return
	}
	state = merged
	emit()
}

let inflight: Promise<void> | null = null

function loadAiSelection(isTauri: boolean): Promise<void> {
	if (inflight) return inflight

	inflight = (async () => {
		try {
			if (!isTauri) {
				const mock = buildMockAiStatus()
				publishAiSelection({
					provider: mock.active_provider,
					ollamaEndpoint: DEFAULT_OLLAMA_ENDPOINT
				})
				return
			}

			const result = await commands.aiGetConfig()
			if (result.status === 'ok') {
				publishAiSelection({
					provider: result.data.provider,
					ollamaEndpoint: result.data.ollama_endpoint || DEFAULT_OLLAMA_ENDPOINT
				})
			}
		} finally {
			inflight = null
		}
	})()

	return inflight
}

export function useAiSelection(): AiSelection {
	const isTauri = useIsTauri()
	const selection = useSyncExternalStore(subscribe, getSnapshot)

	useEffect(() => {
		if (selection.ready) return
		void loadAiSelection(isTauri)
	}, [isTauri, selection.ready])

	return selection
}
