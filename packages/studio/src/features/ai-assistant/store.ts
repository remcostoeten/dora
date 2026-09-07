import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
	readStorageItem,
	removeStorageItem,
	writeStorageItem
} from '@studio/shared/lib/safe-storage'
import type { ChatMessage } from './types'

type ThreadsMap = Record<string, ChatMessage[]>

const MAX_PERSISTED_MESSAGES_PER_THREAD = 40

function pruneThreads(threads: ThreadsMap, limit: number): ThreadsMap {
	const pruned: ThreadsMap = {}
	for (const [key, messages] of Object.entries(threads)) {
		if (messages.length === 0) continue
		pruned[key] = messages.slice(-limit)
	}
	return pruned
}

/**
 * The panel persists on every state change (including opening it), so an
 * unguarded write turned a full disk into a thrown error mid-click. Under
 * pressure it keeps only the most recent turns rather than losing the thread.
 */
const quotaSafeStorage: StateStorage = {
	getItem: readStorageItem,
	removeItem: removeStorageItem,
	setItem(name, value) {
		writeStorageItem(name, value, {
			label: 'AI chat history',
			compact(attempt) {
				const limit = Math.floor(MAX_PERSISTED_MESSAGES_PER_THREAD / 2 ** attempt)
				if (limit < 1) return null
				const parsed = JSON.parse(value) as { state?: { threads?: ThreadsMap } }
				if (!parsed.state?.threads) return null
				parsed.state.threads = pruneThreads(parsed.state.threads, limit)
				return JSON.stringify(parsed)
			}
		})
	}
}

type AiAssistantState = {
	open: boolean
	threads: ThreadsMap
	pendingPrompt: string | null
	toggleOpen: () => void
	setOpen: (open: boolean) => void
	getMessages: (key: string) => ChatMessage[]
	setMessages: (key: string, messages: ChatMessage[]) => void
	appendMessage: (key: string, message: ChatMessage) => void
	updateMessage: (key: string, id: string, patch: Partial<ChatMessage>) => void
	clearThread: (key: string) => void
	setPendingPrompt: (prompt: string | null) => void
}

export const useAiAssistantStore = create<AiAssistantState>()(
	persist(
		(set, get) => ({
			open: false,
			threads: {},
			pendingPrompt: null,

			toggleOpen() {
				set({ open: !get().open })
			},
			setOpen(open) {
				set({ open })
			},
			getMessages(key) {
				return get().threads[key] ?? []
			},
			setMessages(key, messages) {
				set({ threads: { ...get().threads, [key]: messages } })
			},
			appendMessage(key, message) {
				const current = get().threads[key] ?? []
				set({ threads: { ...get().threads, [key]: [...current, message] } })
			},
			updateMessage(key, id, patch) {
				const current = get().threads[key] ?? []
				set({
					threads: {
						...get().threads,
						[key]: current.map(function (m) {
							if (m.id !== id) return m
							return { ...m, ...patch }
						})
					}
				})
			},
			clearThread(key) {
				const { [key]: _omit, ...rest } = get().threads
				set({ threads: rest })
			},
			setPendingPrompt(prompt) {
				set({ pendingPrompt: prompt })
			}
		}),
		{
			name: 'dora-ai-assistant',
			storage: createJSONStorage(function () {
				return quotaSafeStorage
			}),
			partialize(state) {
				return { threads: pruneThreads(state.threads, MAX_PERSISTED_MESSAGES_PER_THREAD) }
			}
		}
	)
)

export function buildThreadKey(connectionId: string | null | undefined): string {
	return connectionId ?? '__none__'
}
