import { describe, expect, it } from 'vitest'
import { parseAssistantSqlResponse } from './assistant-response-parser'

describe('parseAssistantSqlResponse', function () {
	it('parses legacy query JSON responses from the chat assistant', function () {
		const parsed = parseAssistantSqlResponse(
			JSON.stringify({
				query: "SELECT * FROM messages WHERE message ILIKE '%quinten%'",
				example:
					"SELECT * FROM messages WHERE message ILIKE '%quinten%' AND chat_id IN ('123')"
			})
		)

		expect(parsed).toEqual({
			sql: "SELECT * FROM messages WHERE message ILIKE '%quinten%'",
			explanation: '',
			warnings: [],
			examples: [
				"SELECT * FROM messages WHERE message ILIKE '%quinten%' AND chat_id IN ('123')"
			]
		})
	})

	it('parses fenced sql JSON responses', function () {
		const parsed = parseAssistantSqlResponse(
			'```json\n{"sql":"SELECT * FROM users LIMIT 10","warnings":["Review before running."]}\n```'
		)

		expect(parsed?.sql).toBe('SELECT * FROM users LIMIT 10')
		expect(parsed?.warnings).toEqual(['Review before running.'])
	})

	it('ignores normal markdown', function () {
		expect(parseAssistantSqlResponse('Here is a query:\n\n```sql\nSELECT 1;\n```')).toBeNull()
	})
})
