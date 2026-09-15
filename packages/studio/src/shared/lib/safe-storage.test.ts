import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	isQuotaExceededError,
	readStorageItem,
	resetStorageQuotaReports,
	subscribeToStorageQuota,
	writeStorageItem
} from './safe-storage'

function quotaError(): DOMException {
	return new DOMException('The quota has been exceeded.', 'QuotaExceededError')
}

describe('safe-storage', () => {
	beforeEach(() => {
		localStorage.clear()
		resetStorageQuotaReports()
		vi.spyOn(console, 'warn').mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('writes and reads through to localStorage', () => {
		expect(writeStorageItem('k', 'v')).toBe('ok')
		expect(readStorageItem('k')).toBe('v')
	})

	it('never throws when the quota is exceeded', () => {
		vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
			throw quotaError()
		})

		expect(writeStorageItem('k', 'v', { label: 'tabs' })).toBe('failed')
	})

	it('retries with a compacted payload and reports recovery', () => {
		const setItem = vi
			.spyOn(window.localStorage, 'setItem')
			.mockImplementationOnce(() => {
				throw quotaError()
			})
			.mockImplementationOnce(() => {
				throw quotaError()
			})
			.mockImplementation(() => {})

		const outcome = writeStorageItem('k', 'big', {
			label: 'query history',
			compact: () => 'small'
		})

		expect(outcome).toBe('compacted')
		expect(setItem).toHaveBeenLastCalledWith('k', 'small')
	})

	it('reports a failing key once and notifies subscribers', () => {
		vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
			throw quotaError()
		})
		const listener = vi.fn()
		const unsubscribe = subscribeToStorageQuota(listener)

		writeStorageItem('k', 'v', { label: 'query history' })
		writeStorageItem('k', 'v2', { label: 'query history' })

		expect(listener).toHaveBeenCalledTimes(1)
		expect(listener).toHaveBeenCalledWith({
			key: 'k',
			label: 'query history',
			recovered: false
		})
		unsubscribe()
	})

	it('recognizes legacy quota error codes', () => {
		expect(isQuotaExceededError(quotaError())).toBe(true)
		expect(isQuotaExceededError(new Error('nope'))).toBe(false)
	})
})
