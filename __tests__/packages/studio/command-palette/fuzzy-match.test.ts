import { describe, expect, it } from 'vitest'
import { fuzzyMatchScore } from '@studio/features/command-palette/fuzzy-match'

describe('fuzzyMatchScore', function () {
	it('returns 0 for an empty query so every command stays eligible', function () {
		expect(fuzzyMatchScore('', 'Open Connection')).toBe(0)
	})

	it('returns null when the text is empty', function () {
		expect(fuzzyMatchScore('open', '')).toBeNull()
	})

	it('returns null when a query character is absent', function () {
		expect(fuzzyMatchScore('xyz', 'Open Connection')).toBeNull()
	})

	it('matches case-insensitively', function () {
		expect(fuzzyMatchScore('OPEN', 'open connection')).not.toBeNull()
	})

	it('scores a substring hit above a scattered subsequence hit', function () {
		const substring = fuzzyMatchScore('conn', 'New Connection')
		const scattered = fuzzyMatchScore('conn', 'Copy Or Not Now')

		expect(substring).not.toBeNull()
		expect(scattered).not.toBeNull()
		expect(substring!).toBeGreaterThan(scattered!)
	})

	it('ranks an earlier substring above a later one', function () {
		const early = fuzzyMatchScore('conn', 'Connection Settings')!
		const late = fuzzyMatchScore('conn', 'Reset The Connection')!

		expect(early).toBeGreaterThan(late)
	})

	it('rewards a substring that starts on a word boundary', function () {
		const boundary = fuzzyMatchScore('base', 'My base url')!
		const midWord = fuzzyMatchScore('base', 'my database')!

		expect(boundary).toBeGreaterThan(midWord)
	})

	it('rewards subsequence characters landing on word boundaries', function () {
		const initials = fuzzyMatchScore('ndc', 'new database connection')!
		const buried = fuzzyMatchScore('ndc', 'unindexed columns')!

		expect(initials).toBeGreaterThan(buried)
	})

	it('treats the start of the text as a word boundary', function () {
		expect(fuzzyMatchScore('n', 'new')!).toBeGreaterThan(fuzzyMatchScore('n', 'unset')!)
	})
})
