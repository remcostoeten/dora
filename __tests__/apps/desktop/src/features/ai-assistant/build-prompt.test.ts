import { describe, expect, it } from 'vitest'
import { buildChatPrompt } from '@/features/ai-assistant/build-prompt'

describe('buildChatPrompt', function () {
	it('prepends current Dora UI context without changing the visible chat message', function () {
		const prompt = buildChatPrompt(
			[
				{
					id: 'user-1',
					role: 'user',
					content: 'How do I search this table?',
					createdAt: 1
				}
			],
			{
				activeView: 'database-studio',
				activeConnectionId: 'conn-1',
				selectedTableId: 'public.messages',
				selectedTableName: 'messages',
				selectedTableColumns: [
					{ name: 'id', dataType: 'uuid', primaryKey: true, nullable: false },
					{ name: 'message', dataType: 'text', nullable: true }
				],
				editor: {
					mode: 'sql',
					content: "SELECT * FROM messages WHERE message ILIKE '%quinten%';"
				}
			}
		)

		expect(prompt).toContain('Current Dora UI context:')
		expect(prompt).toContain('- Active view: Database Studio')
		expect(prompt).toContain('- Selected table id: public.messages')
		expect(prompt).toContain('- message text')
		expect(prompt).toContain('- Active editor mode: SQL')
		expect(prompt).toContain("SELECT * FROM messages WHERE message ILIKE '%quinten%';")
		expect(prompt).toContain('SQL syntax notes:')
		expect(prompt).toContain('SELECT ... FROM ... WHERE ... GROUP BY ... HAVING ... ORDER BY ... LIMIT ... OFFSET ...')
		expect(prompt).toContain('User request:\nHow do I search this table?')
	})
})
