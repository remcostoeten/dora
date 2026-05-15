import type { ChatMessage } from './types'

/**
 * Pack the conversation history into a single user prompt string so we can
 * reuse the existing `ai_complete_stream` command (which takes a single
 * `prompt`). The Rust chat-mode system prompt is aware of this `USER:` /
 * `ASSISTANT:` shape and will only respond to the trailing user turn.
 */
export function buildChatPrompt(messages: ChatMessage[]): string {
	const trimmed = messages.filter(function (m) {
		return m.content.trim().length > 0
	})

	if (trimmed.length === 0) return ''
	if (trimmed.length === 1 && trimmed[0].role === 'user') {
		return trimmed[0].content.trim()
	}

	const parts: string[] = []
	for (const message of trimmed) {
		const tag = message.role === 'user' ? 'USER' : 'ASSISTANT'
		parts.push(`${tag}: ${message.content.trim()}`)
	}
	return parts.join('\n\n')
}
