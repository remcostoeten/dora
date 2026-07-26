import { beforeEach, describe, expect, it } from 'vitest'
import {
	isTourCompleted,
	markTourCompleted,
	recordLaunch,
	shouldShowTour
} from '@/features/onboarding/launch-state'

function makeStorage(): Storage {
	const data = new Map<string, string>()
	return {
		get length() {
			return data.size
		},
		clear: function () {
			data.clear()
		},
		getItem: function (key: string) {
			return data.has(key) ? (data.get(key) as string) : null
		},
		key: function (index: number) {
			return Array.from(data.keys())[index] ?? null
		},
		removeItem: function (key: string) {
			data.delete(key)
		},
		setItem: function (key: string, value: string) {
			data.set(key, value)
		}
	}
}

describe('launch-state', function () {
	let storage: Storage

	beforeEach(function () {
		storage = makeStorage()
	})

	it('counts launches starting at 1', function () {
		expect(recordLaunch(storage)).toBe(1)
		expect(recordLaunch(storage)).toBe(2)
		expect(recordLaunch(storage)).toBe(3)
	})

	it('recovers from a corrupted counter', function () {
		storage.setItem('dora_launch_count', 'garbage')
		expect(recordLaunch(storage)).toBe(1)
	})

	it('offers the tour on the first launch', function () {
		expect(shouldShowTour(1, storage)).toBe(true)
	})

	it('keeps offering the tour for the first few launches if never completed', function () {
		expect(shouldShowTour(2, storage)).toBe(true)
		expect(shouldShowTour(3, storage)).toBe(true)
	})

	it('stops offering after the launch limit', function () {
		expect(shouldShowTour(4, storage)).toBe(false)
	})

	it('never offers the tour once completed or skipped', function () {
		markTourCompleted(storage)
		expect(isTourCompleted(storage)).toBe(true)
		expect(shouldShowTour(1, storage)).toBe(false)
	})
})
