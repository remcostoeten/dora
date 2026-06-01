import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage } from './types'

type ThreadsMap = Record<string, ChatMessage[]>

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
			partialize(state) {
				return { threads: state.threads }
			}
		}
	)
)

export function buildThreadKey(connectionId: string | null | undefined): string {
	return connectionId ?? '__none__'
}
