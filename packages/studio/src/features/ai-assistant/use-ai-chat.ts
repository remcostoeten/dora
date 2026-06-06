import { Channel } from '@tauri-apps/api/core'
import { startTransition, useCallback, useRef, useState } from 'react'
import { useIsTauri } from '@studio/core/data-provider'
import { commands } from '@studio/lib/bindings'
import type { AiStreamEvent } from '@studio/lib/bindings'
import { buildChatPrompt } from './build-prompt'
import { buildMockChatResponse, streamMockText } from './mock-ai'
import { createStreamBatcher } from './stream-batch'
import { buildThreadKey, useAiAssistantStore } from './store'
import type { AiAssistantContext, ChatMessage } from './types'

type SendArgs = {
	prompt: string
	activeConnectionId: string | null
	context?: AiAssistantContext
}

type StreamingSnapshot = {
	messageId: string
	content: string
}

type UseAiChatResult = {
	messages: ChatMessage[]
	streamingSnapshot: StreamingSnapshot | null
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
	const [streamingSnapshot, setStreamingSnapshot] = useState<StreamingSnapshot | null>(null)
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

			const batcher = createStreamBatcher(function onFlush(content) {
				startTransition(function () {
					setStreamingSnapshot({ messageId: assistantId, content })
				})
			})
			let accumulated = ''

			function finishStream(finalContent?: string, patch: Partial<ChatMessage> = {}) {
				batcher.flush()
				batcher.dispose()
				const content = finalContent ?? accumulated
				updateMessage(key, assistantId, {
					content,
					streaming: false,
					...patch
				})
				setStreamingSnapshot(null)
			}

			if (!isTauri) {
				try {
					await streamMockText({
						text: buildMockChatResponse(packed, activeConnectionId),
						onToken(token) {
							accumulated += token
							batcher.push(token)
						},
						isCancelled() {
							return abortRef.current.cancelled
						}
					})
					if (!abortRef.current.cancelled) {
						finishStream(accumulated)
					}
				} catch (e) {
					if (!abortRef.current.cancelled) {
						const message = e instanceof Error ? e.message : String(e)
						setError(message)
						finishStream(accumulated, { error: message })
					} else {
						batcher.dispose()
						setStreamingSnapshot(null)
					}
				} finally {
					abortRef.current.requestId = null
					setIsStreaming(false)
				}
				return
			}

			const channel = new Channel<AiStreamEvent>()

			channel.onmessage = function onmessage(event) {
				if (abortRef.current.cancelled) return
				switch (event.type) {
					case 'token':
						accumulated += event.text
						batcher.push(event.text)
						break
					case 'final':
						if (event.content && event.content.length > accumulated.length) {
							accumulated = event.content
							startTransition(function () {
								setStreamingSnapshot({ messageId: assistantId, content: accumulated })
							})
						}
						break
					case 'error':
						setError(event.message)
						finishStream(accumulated, { error: event.message })
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
					finishStream(accumulated)
					return
				}
				if (result.status === 'error') {
					const message =
						typeof result.error === 'string'
							? result.error
							: result.error?.detail ?? 'AI request failed'
					setError(message)
					finishStream(accumulated, { error: message })
					return
				}
				finishStream(accumulated)
			} catch (e) {
				if (!abortRef.current.cancelled) {
					const message = e instanceof Error ? e.message : String(e)
					setError(message)
					finishStream(accumulated, { error: message })
				} else {
					batcher.dispose()
					setStreamingSnapshot(null)
					updateMessage(key, assistantId, { streaming: false })
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
			setStreamingSnapshot(null)
		},
		[clearThread]
	)

	return { messages, streamingSnapshot, isStreaming, error, send, abort, clear }
}
