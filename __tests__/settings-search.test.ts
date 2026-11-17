import { describe, expect, it } from 'vitest'
import { searchSettings } from '@studio/features/settings/search'

function sectionIds(query: string) {
	return searchSettings(query).map((result) => result.sectionId)
}

describe('settings search', () => {
	it('returns nothing for an empty query', () => {
		expect(searchSettings('')).toEqual([])
		expect(searchSettings('   ')).toEqual([])
	})

	it('matches sections by title, description and keywords', () => {
		expect(sectionIds('ollama')).toEqual(
			expect.arrayContaining(['ai-provider', 'ollama-models'])
		)
		expect(sectionIds('api key')).toContain('ai-keys')
		expect(sectionIds('keyboard')).toContain('shortcuts')
	})

	it('matches individual shortcuts', () => {
		expect(searchSettings('reconnect')).toContainEqual(
			expect.objectContaining({ kind: 'shortcut', sectionId: 'shortcuts' })
		)
	})

	it('matches individual settings', () => {
		expect(searchSettings('restore tabs')).toContainEqual(
			expect.objectContaining({
				kind: 'setting',
				sectionId: 'startup',
				title: 'Restore tabs on launch'
			})
		)
	})
})
