import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	getCommandFrecency,
	recordCommandUse
} from '@studio/features/command-palette/command-frecency'

const STORAGE_KEY = 'dora:command-frecency:v1'
const DAY_MS = 24 * 60 * 60 * 1000
const NOW = new Date('2026-07-11T12:00:00Z').getTime()

function seed(entries: Record<string, { count: number; lastUsed: number }>) {
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

describe('command frecency', function () {
	beforeEach(function () {
		window.localStorage.clear()
		vi.useFakeTimers()
		vi.setSystemTime(NOW)
	})

	afterEach(function () {
		vi.useRealTimers()
	})

	it('scores nothing when no command has been used', function () {
		expect(getCommandFrecency()).toEqual({})
	})

	it('counts a freshly used command once', function () {
		recordCommandUse('palette.open')
		expect(getCommandFrecency()['palette.open']).toBe(1)
	})

	it('accumulates repeated uses of the same command', function () {
		recordCommandUse('palette.open')
		recordCommandUse('palette.open')
		recordCommandUse('palette.open')

		expect(getCommandFrecency()['palette.open']).toBe(3)
	})

	it('decays a command the longer ago it was last used', function () {
		seed({
			today: { count: 10, lastUsed: NOW - 1 * 60 * 1000 },
			thisWeek: { count: 10, lastUsed: NOW - 3 * DAY_MS },
			thisMonth: { count: 10, lastUsed: NOW - 10 * DAY_MS },
			ancient: { count: 10, lastUsed: NOW - 90 * DAY_MS }
		})

		const scores = getCommandFrecency()

		expect(scores.today).toBe(10)
		expect(scores.thisWeek).toBeCloseTo(7)
		expect(scores.thisMonth).toBeCloseTo(4)
		expect(scores.ancient).toBeCloseTo(2)
	})

	it('ranks a recent rare command above a stale frequent one', function () {
		seed({
			recent: { count: 3, lastUsed: NOW - 1 * 60 * 1000 },
			stale: { count: 10, lastUsed: NOW - 90 * DAY_MS }
		})

		const scores = getCommandFrecency()

		expect(scores.recent).toBeGreaterThan(scores.stale)
	})

	it('evicts the least recently used entries past the 100-command cap', function () {
		const overflowing: Record<string, { count: number; lastUsed: number }> = {}
		for (let i = 0; i < 100; i++) {
			overflowing[`cmd.${i}`] = { count: 1, lastUsed: NOW - (i + 1) * 1000 }
		}
		seed(overflowing)

		recordCommandUse('cmd.new')

		const scores = getCommandFrecency()
		expect(Object.keys(scores)).toHaveLength(100)
		expect(scores['cmd.new']).toBeDefined()
		expect(scores['cmd.99']).toBeUndefined()
	})

	it('ignores a corrupt store rather than throwing', function () {
		window.localStorage.setItem(STORAGE_KEY, 'not json')

		expect(getCommandFrecency()).toEqual({})
	})

	it('skips malformed entries inside an otherwise valid store', function () {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				good: { count: 2, lastUsed: NOW },
				bad: { count: 'lots', lastUsed: NOW },
				alsoBad: null
			})
		)

		const scores = getCommandFrecency()

		expect(scores).toEqual({ good: 2 })
	})
})
