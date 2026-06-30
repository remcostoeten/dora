import { describe, expect, it } from 'vitest'
import {
	filterSections,
	filterSettingsSearchResults,
	getAutocompleteSuffix
} from '@studio/features/sidebar/components/settings-panel'

describe('settings panel search', function () {
	it('returns all sections for an empty query', function () {
		expect(filterSections('')).toHaveLength(13)
	})

	it('matches sections by title, description, and keywords', function () {
		const ollamaMatches = filterSections('ollama').map(function (section) {
			return section.id
		})
		expect(ollamaMatches).toContain('ai-provider')
		expect(ollamaMatches).toContain('ollama-models')

		expect(filterSections('api key').map(function (section) {
			return section.id
		})).toContain('ai-keys')

		expect(filterSections('keyboard').map(function (section) {
			return section.id
		})).toContain('shortcuts')
	})

	it('matches individual shortcuts from the main settings search', function () {
		const reconnectMatches = filterSettingsSearchResults('reconnect')

		expect(reconnectMatches).toContainEqual(
			expect.objectContaining({
				kind: 'shortcut',
				sectionId: 'shortcuts',
				title: 'Reconnect to database'
			})
		)
		expect(filterSections('reconnect').map(function (section) {
			return section.id
		})).toContain('shortcuts')
	})

	it('matches individual settings from the main settings search', function () {
		expect(filterSettingsSearchResults('restore tabs')).toContainEqual(
			expect.objectContaining({
				kind: 'setting',
				sectionId: 'startup',
				title: 'Restore tabs on launch'
			})
		)
	})

	it('builds inline autocomplete suffixes from titles', function () {
		expect(getAutocompleteSuffix('Appearance', 'app')).toBe('earance')
		expect(getAutocompleteSuffix('Shortcuts', '')).toBe('Shortcuts')
		expect(getAutocompleteSuffix('AI Keys', 'keys')).toBe('')
	})
})
