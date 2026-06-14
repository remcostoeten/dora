import { describe, expect, it } from 'vitest'
import { filterModelOptions } from '@studio/features/ai-assistant/components/model-id-input'

describe('filterModelOptions', function () {
	const options = [
		{ id: 'gpt-5.5', label: 'GPT-5.5', tier: 'flagship' },
		{ id: 'gpt-4o-mini', label: 'GPT-4o mini', tier: 'fast' },
		{ id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', tier: 'balanced' }
	]

	it('returns the first models when the query is empty', function () {
		expect(filterModelOptions(options, '')).toEqual(options)
	})

	it('matches model ids and labels case-insensitively', function () {
		expect(filterModelOptions(options, '4o mini').map(function (option) {
			return option.id
		})).toEqual(['gpt-4o-mini'])

		expect(filterModelOptions(options, 'sonnet').map(function (option) {
			return option.id
		})).toEqual(['claude-sonnet-4-6'])
	})
})
