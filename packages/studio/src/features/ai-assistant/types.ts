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

export type AiAssistantColumnContext = {
	name: string
	dataType: string
	nullable?: boolean
	primaryKey?: boolean
	foreignKey?: string
}

export type AiAssistantEditorContext = {
	mode: 'sql' | 'drizzle'
	content: string
}

export type AiAssistantContext = {
	activeView?: string
	activeConnectionId?: string | null
	selectedTableId?: string | null
	selectedTableName?: string | null
	selectedTableColumns?: AiAssistantColumnContext[]
	editor?: AiAssistantEditorContext | null
}
