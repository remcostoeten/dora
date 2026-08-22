import { describe, expect, it } from 'vitest'
import {
	buildQuerySignature,
	DEFAULT_QUERY_SIGNATURE,
	schemaHasTable
} from '@/features/database-studio/utils/table-snapshot'

describe('table-snapshot', function () {
	it('builds a stable signature from the table query inputs', function () {
		const signature = buildQuerySignature(50, 0, { column: 'name', direction: 'asc' }, [
			{ column: 'name', operator: 'eq', value: 'A' }
		])
		expect(signature).toContain('"column":"name"')
		expect(signature).toBe(
			buildQuerySignature(50, 0, { column: 'name', direction: 'asc' }, [
				{ column: 'name', operator: 'eq', value: 'A' }
			])
		)
	})

	it('separates the default page from a sorted or filtered one', function () {
		expect(
			buildQuerySignature(50, 0, undefined, [], 'AND', { logic: 'AND', conditions: [] })
		).toBe(DEFAULT_QUERY_SIGNATURE)
		expect(
			buildQuerySignature(50, 0, { column: 'name', direction: 'asc' }, [], 'AND', {
				logic: 'AND',
				conditions: []
			})
		).not.toBe(DEFAULT_QUERY_SIGNATURE)
		expect(
			buildQuerySignature(50, 50, undefined, [], 'AND', { logic: 'AND', conditions: [] })
		).not.toBe(DEFAULT_QUERY_SIGNATURE)
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
