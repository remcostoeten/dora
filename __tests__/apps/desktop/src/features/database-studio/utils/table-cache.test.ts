import { describe, expect, it } from 'vitest'
import { buildTableCacheKey, schemaHasTable } from '@/features/database-studio/utils/table-cache'

describe('table-cache', function () {
	it('builds a stable cache key from table query inputs', function () {
		expect(
			buildTableCacheKey(
				'conn-1',
				'public.users',
				50,
				0,
				{ column: 'name', direction: 'asc' },
				[{ column: 'name', operator: 'eq', value: 'A' }]
			)
		).toContain('"tableId":"public.users"')
	})

	it('matches schema-qualified tables correctly', function () {
		expect(
			schemaHasTable(
				{
					tables: [
						{ name: 'users', schema: 'public' },
						{ name: 'audit_log', schema: 'admin' }
					]
				},
				'public.users'
			)
		).toBe(true)
		expect(
			schemaHasTable(
				{
					tables: [{ name: 'users', schema: 'public' }]
				},
				'admin.users'
			)
		).toBe(false)
	})
})
