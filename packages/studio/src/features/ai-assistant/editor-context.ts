import { useSyncExternalStore } from 'react'
import type { AiAssistantEditorContext } from './types'

/**
 * What the SQL console currently has in its editor, for the AI assistant to
 * read.
 *
 * This is keystroke-rate data, so it deliberately does not travel through the
 * shell: the console writes here and only the assistant panel — a leaf, mounted
 * only while it is open — subscribes. Routing it through a shell prop would
 * commit the whole shell on every character typed, which the performance
 * contract forbids.
 */
let context: AiAssistantEditorContext | null = null
const listeners = new Set<() => void>()

export function setAiEditorContext(next: AiAssistantEditorContext | null): void {
	if (context === next) return
	context = next
	listeners.forEach((listener) => listener())
}

export function readAiEditorContext(): AiAssistantEditorContext | null {
	return context
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return function unsubscribe() {
		listeners.delete(listener)
	}
}

export function useAiEditorContext(): AiAssistantEditorContext | null {
	return useSyncExternalStore(subscribe, readAiEditorContext, readAiEditorContext)
}
