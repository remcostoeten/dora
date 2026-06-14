import { useAiAssistantStore } from './store'

/**
 * Opens the AI assistant panel and pre-fills it with a prompt. Shared entry
 * point for contextual actions (explain query, fix error, suggest indexes) so
 * they work from anywhere whether the panel is open or closed.
 */
export function askAi(prompt: string): void {
	const store = useAiAssistantStore.getState()
	store.setOpen(true)
	store.setPendingPrompt(prompt)
}

export function buildExplainQueryPrompt(query: string): string {
	return `Explain what this SQL query does, step by step:\n\n${query}`
}

export function buildFixErrorPrompt(query: string, error: string): string {
	return `This SQL query failed with the following error. Suggest a fix:\n\nQuery:\n${query}\n\nError:\n${error}`
}

export function buildSuggestIndexesPrompt(schema: string, queries: string): string {
	return `Given this table schema and these queries, what indexes would improve performance?\n\n${schema}\n\n${queries}`
}
