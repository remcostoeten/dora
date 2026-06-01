import { Channel } from '@tauri-apps/api/core'
import { useCallback, useRef, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { commands } from '@studio/lib/bindings'
import type { AiStreamEvent } from '@studio/lib/bindings'
import { buildChatPrompt } from './build-prompt'
import { buildMockChatResponse, streamMockText } from './mock-ai'
import { buildThreadKey, useAiAssistantStore } from './store'
import type { AiAssistantContext, ChatMessage } from './types'

type SendArgs = {
	prompt: string
	activeConnectionId: string | null
	context?: AiAssistantContext
}

type UseAiChatResult = {
	messages: ChatMessage[]
	isStreaming: boolean
	error: string | null
	send: (args: SendArgs) => Promise<void>
	abort: () => void
	clear: (connectionId: string | null) => void
}

const EMPTY_MESSAGES: ChatMessage[] = []

function newId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function useAiChat(connectionId: string | null): UseAiChatResult {
	const isTauri = useIsTauri()
	const threadKey = buildThreadKey(connectionId)
	const thread = useAiAssistantStore(function (s) {
		return s.threads[threadKey]
	})
	const messages = thread ?? EMPTY_MESSAGES
	const appendMessage = useAiAssistantStore(function (s) {
		return s.appendMessage
	})
	const updateMessage = useAiAssistantStore(function (s) {
		return s.updateMessage
	})
	const clearThread = useAiAssistantStore(function (s) {
		return s.clearThread
	})

	const [isStreaming, setIsStreaming] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const abortRef = useRef<{ cancelled: boolean; requestId: string | null }>({
		cancelled: false,
		requestId: null
	})

	const abort = useCallback(function abort() {
		const id = abortRef.current.requestId
		abortRef.current.cancelled = true
		if (id) {
			commands.aiAbortStream(id).catch(function () {})
		}
	}, [])

	const send = useCallback(
		async function send({ prompt, activeConnectionId, context }: SendArgs) {
			const text = prompt.trim()
			if (!text || isStreaming) return

			setError(null)
			abortRef.current.cancelled = false

			const key = buildThreadKey(activeConnectionId)
			const userMsg: ChatMessage = {
				id: newId(),
				role: 'user',
				content: text,
				createdAt: Date.now()
			}
			appendMessage(key, userMsg)

			const assistantId = newId()
			const assistantMsg: ChatMessage = {
				id: assistantId,
				role: 'assistant',
				content: '',
				createdAt: Date.now(),
				streaming: true
			}
			appendMessage(key, assistantMsg)

			const currentMessages = [
				...(useAiAssistantStore.getState().threads[key] ?? [])
			].filter(function (m) {
				return m.id !== assistantId
			})

			const packed = buildChatPrompt(currentMessages, {
				...context,
				activeConnectionId
			})
			const requestId = newId()
			abortRef.current.requestId = requestId
			setIsStreaming(true)

			if (!isTauri) {
				let accumulated = ''
				try {
					await streamMockText({
						text: buildMockChatResponse(packed, activeConnectionId),
						onToken(token) {
							accumulated += token
							updateMessage(key, assistantId, { content: accumulated })
						},
						isCancelled() {
							return abortRef.current.cancelled
						}
					})
					updateMessage(key, assistantId, { streaming: false })
				} catch (e) {
					if (!abortRef.current.cancelled) {
						const message = e instanceof Error ? e.message : String(e)
						setError(message)
						updateMessage(key, assistantId, { error: message, streaming: false })
					}
				} finally {
					abortRef.current.requestId = null
					setIsStreaming(false)
				}
				return
			}

			const channel = new Channel<AiStreamEvent>()
			let accumulated = ''

			channel.onmessage = function onmessage(event) {
				if (abortRef.current.cancelled) return
				switch (event.type) {
					case 'token':
						accumulated += event.text
						updateMessage(key, assistantId, { content: accumulated })
						break
					case 'final':
						if (event.content && event.content.length > accumulated.length) {
							accumulated = event.content
							updateMessage(key, assistantId, { content: accumulated })
						}
						break
					case 'error':
						setError(event.message)
						updateMessage(key, assistantId, {
							error: event.message,
							streaming: false
						})
						break
				}
			}

			try {
				const result = await commands.aiCompleteStream(
					requestId,
					packed,
					activeConnectionId ?? null,
					2048,
					'chat',
					channel
				)
				if (abortRef.current.cancelled) {
					updateMessage(key, assistantId, { streaming: false })
					return
				}
				if (result.status === 'error') {
					const message =
						typeof result.error === 'string'
							? result.error
							: result.error?.detail ?? 'AI request failed'
					setError(message)
					updateMessage(key, assistantId, { error: message, streaming: false })
					return
				}
				updateMessage(key, assistantId, { streaming: false })
			} catch (e) {
				if (!abortRef.current.cancelled) {
					const message = e instanceof Error ? e.message : String(e)
					setError(message)
					updateMessage(key, assistantId, { error: message, streaming: false })
				}
			} finally {
				abortRef.current.requestId = null
				setIsStreaming(false)
			}
		},
		[appendMessage, updateMessage, isStreaming, isTauri]
	)

	const clear = useCallback(
		function clear(connId: string | null) {
			clearThread(buildThreadKey(connId))
		},
		[clearThread]
	)

	return { messages, isStreaming, error, send, abort, clear }
}
