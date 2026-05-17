export type ParsedAssistantSqlResponse = {
	sql: string
	explanation: string
	warnings: string[]
	examples: string[]
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value
		.map(function (item) {
			return String(item).trim()
		})
		.filter(Boolean)
}

function parseObject(value: unknown): ParsedAssistantSqlResponse | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null

	const record = value as Record<string, unknown>
	const sql = asString(record.sql) || asString(record.query)
	if (!sql) return null

	const examples = [asString(record.example)]
		.filter(Boolean)
		.filter(function (example) {
			return example !== sql
		})

	return {
		sql,
		explanation: asString(record.explanation) || asString(record.reasoning),
		warnings: asStringArray(record.warnings),
		examples
	}
}

function stripJsonFence(raw: string): string {
	return raw
		.trim()
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim()
}

export function parseAssistantSqlResponse(content: string): ParsedAssistantSqlResponse | null {
	const trimmed = content.trim()
	if (!trimmed) return null

	const candidates = [trimmed, stripJsonFence(trimmed)]
	for (const candidate of candidates) {
		if (!candidate.startsWith('{') || !candidate.endsWith('}')) continue
		try {
			const parsed = parseObject(JSON.parse(candidate))
			if (parsed) return parsed
		} catch {
			/* Fall through to markdown rendering. */
		}
	}

	return null
}
