import { describe, it, expect } from 'vitest'
import {
	buildExplainQueryPrompt,
	buildFixErrorPrompt,
	buildSuggestIndexesPrompt
} from '@/features/ai-assistant/ai-actions'

describe('AI contextual prompt builders', () => {
	it('builds an explain-query prompt', () => {
		expect(buildExplainQueryPrompt('SELECT 1')).toBe(
			'Explain what this SQL query does, step by step:\n\nSELECT 1'
		)
	})

	it('builds a fix-error prompt with query and error', () => {
		expect(buildFixErrorPrompt('SELECT * FROM userz', 'relation "userz" does not exist')).toBe(
			'This SQL query failed with the following error. Suggest a fix:\n\n' +
				'Query:\nSELECT * FROM userz\n\nError:\nrelation "userz" does not exist'
		)
	})

	it('builds a suggest-indexes prompt with schema and queries', () => {
		expect(buildSuggestIndexesPrompt('CREATE TABLE t (...)', 'SELECT ...')).toBe(
			'Given this table schema and these queries, what indexes would improve performance?\n\n' +
				'CREATE TABLE t (...)\n\nSELECT ...'
		)
	})
})
