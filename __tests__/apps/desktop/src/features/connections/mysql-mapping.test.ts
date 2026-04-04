import { describe, expect, it } from 'vitest'
import { frontendToBackendDatabaseInfo } from '@/features/connections/api'

describe('connections/api mapping (mysql)', function () {
	it('does not map MySQL until the Rust backend provider exists', function () {
		expect(function () {
			frontendToBackendDatabaseInfo({
				id: 'c1',
				name: 'MySQL',
				type: 'mysql',
				host: 'localhost',
				port: 3306,
				user: 'root',
				password: 'pass',
				database: 'mydb',
				createdAt: Date.now()
			} as any)
		}).toThrow(/Unsupported database type: mysql/)
	})

	it.skip('maps MySQL once DatabaseInfo::MySQL is implemented', function () {
		// Enable this when the Rust backend and bindings include DatabaseInfo::MySQL.
		// The expectation should assert the returned DatabaseInfo payload matches the new binding shape.
		expect(true).toBe(false)
	})
})

