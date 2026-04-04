import { describe, expect, it } from 'vitest'
import { extractMutationSourceTable } from '@/features/sql-console/query-target'

describe('extractMutationSourceTable', function () {
	it('extracts a simple select source table', function () {
		expect(extractMutationSourceTable('SELECT * FROM users LIMIT 10')).toBe('users')
	})

	it('extracts a schema-qualified select source table', function () {
		expect(extractMutationSourceTable('SELECT * FROM public.users')).toBe('public.users')
	})

	it('extracts quoted identifiers', function () {
		expect(extractMutationSourceTable('SELECT * FROM "public"."user accounts"')).toBe(
			'public.user accounts'
		)
	})

	it('extracts update targets', function () {
		expect(extractMutationSourceTable('UPDATE public.users SET name = 1 RETURNING *')).toBe(
			'public.users'
		)
	})

	it('extracts delete targets', function () {
		expect(extractMutationSourceTable('DELETE FROM users WHERE id = 1 RETURNING *')).toBe(
			'users'
		)
	})

	it('extracts insert targets', function () {
		expect(extractMutationSourceTable('INSERT INTO users (id) VALUES (1) RETURNING *')).toBe(
			'users'
		)
	})

	it('extracts drizzle from targets', function () {
		expect(extractMutationSourceTable('db.select().from(public.users).limit(10);')).toBe(
			'public.users'
		)
	})

	it('refuses join queries', function () {
		expect(
			extractMutationSourceTable(
				'SELECT users.id FROM users JOIN orders ON orders.user_id = users.id'
			)
		).toBeUndefined()
	})

	it('refuses comma joins', function () {
		expect(extractMutationSourceTable('SELECT * FROM users, orders')).toBeUndefined()
	})
})
