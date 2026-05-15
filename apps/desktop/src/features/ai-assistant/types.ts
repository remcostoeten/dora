export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
	id: string
	role: ChatRole
	content: string
	createdAt: number
	/** True while tokens are still arriving from the stream. */
	streaming?: boolean
	/** Set when this assistant message failed mid-stream. */
	error?: string
}

export type ChatThread = {
	connectionId: string | null
	messages: ChatMessage[]
}
