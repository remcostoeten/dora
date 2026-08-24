import { describe, expect, it } from 'vitest'
import { isConnectionUnavailableError } from './error-messages'

describe('isConnectionUnavailableError', () => {
	it('recognises a dead backend connection', () => {
		expect(isConnectionUnavailableError('Postgres connection not active')).toBe(true)
		expect(isConnectionUnavailableError(new Error('Could not connect to this database'))).toBe(
			true
		)
		expect(isConnectionUnavailableError('connection refused (os error 111)')).toBe(true)
	})

	it('leaves operation-level failures alone', () => {
		expect(isConnectionUnavailableError('syntax error at or near "SELCT"')).toBe(false)
		expect(isConnectionUnavailableError(new Error('permission denied for table users'))).toBe(
			false
		)
		expect(isConnectionUnavailableError(null)).toBe(false)
		expect(isConnectionUnavailableError(undefined)).toBe(false)
	})
})
