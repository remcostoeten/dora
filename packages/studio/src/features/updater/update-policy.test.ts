import { describe, expect, it } from 'vitest'
import {
	SNOOZE_MS,
	deriveIndicatorMode,
	formatLastChecked,
	isCheckDue,
	isSnoozed,
	parseReleaseNotes
} from './update-policy'

const NOW = 1_800_000_000_000

describe('isSnoozed', function () {
	it('pauses only the snoozed version until the deadline', function () {
		const snooze = { version: '0.46.0', until: NOW + SNOOZE_MS }
		expect(isSnoozed(snooze, '0.46.0', NOW)).toBe(true)
		expect(isSnoozed(snooze, '0.47.0', NOW)).toBe(false)
		expect(isSnoozed(snooze, '0.46.0', NOW + SNOOZE_MS + 1)).toBe(false)
	})
})

describe('deriveIndicatorMode', function () {
	const base = { errorSource: null, availableVersion: '0.46.0', snooze: null, now: NOW } as const

	it('shows nothing for idle, checking and up-to-date', function () {
		for (const status of ['idle', 'checking', 'up-to-date'] as const) {
			expect(deriveIndicatorMode({ ...base, status })).toBe('hidden')
		}
	})

	it('quiets a snoozed update instead of hiding it', function () {
		const snooze = { version: '0.46.0', until: NOW + 1000 }
		expect(deriveIndicatorMode({ ...base, status: 'available', snooze })).toBe('snoozed')
		expect(deriveIndicatorMode({ ...base, status: 'available' })).toBe('available')
	})

	it('surfaces download failures but not failed background checks', function () {
		expect(deriveIndicatorMode({ ...base, status: 'error', errorSource: 'download' })).toBe(
			'error'
		)
		expect(deriveIndicatorMode({ ...base, status: 'error', errorSource: 'check' })).toBe(
			'hidden'
		)
	})
})

describe('isCheckDue', function () {
	it('is due when never checked or after six hours', function () {
		expect(isCheckDue(null, NOW)).toBe(true)
		expect(isCheckDue(NOW - 60_000, NOW)).toBe(false)
		expect(isCheckDue(NOW - 6 * 60 * 60 * 1000, NOW)).toBe(true)
	})
})

describe('parseReleaseNotes', function () {
	it('returns bullet lines without markers', function () {
		expect(parseReleaseNotes('## 0.46.0\n\n- Faster open\n* Fixes paste\n')).toEqual([
			'Faster open',
			'Fixes paste'
		])
	})

	it('falls back to plain lines without headings', function () {
		expect(parseReleaseNotes('## Title\nOne line of notes')).toEqual(['One line of notes'])
	})

	it('returns nothing for empty notes', function () {
		expect(parseReleaseNotes(undefined)).toEqual([])
	})
})

describe('formatLastChecked', function () {
	it('uses relative phrases', function () {
		expect(formatLastChecked(null, NOW)).toBe('never')
		expect(formatLastChecked(NOW - 10_000, NOW)).toBe('just now')
		expect(formatLastChecked(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago')
		expect(formatLastChecked(NOW - 2 * 3_600_000, NOW)).toBe('2 hours ago')
	})
})
