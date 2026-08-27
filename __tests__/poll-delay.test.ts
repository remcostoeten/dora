import { describe, expect, it } from 'vitest'
import {
	nextPollDelay,
	QUERY_POLL_INITIAL_MS,
	QUERY_POLL_INTERVAL_MS
} from '@studio/core/data-provider/poll-delay'

describe('nextPollDelay', () => {
	it('backs off 20 → 40 → 80 → 100 and caps there', () => {
		const delays: number[] = []
		let current = QUERY_POLL_INITIAL_MS
		for (let i = 0; i < 5; i++) {
			delays.push(current)
			current = nextPollDelay(current)
		}
		expect(delays).toEqual([20, 40, 80, 100, 100])
	})

	it('never exceeds the legacy interval', () => {
		expect(nextPollDelay(QUERY_POLL_INTERVAL_MS)).toBe(QUERY_POLL_INTERVAL_MS)
		expect(nextPollDelay(999)).toBe(QUERY_POLL_INTERVAL_MS)
	})
})
