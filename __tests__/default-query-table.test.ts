import { describe, expect, it } from 'vitest'
import {
	buildDefaultDrizzleQuery,
	buildDefaultSqlQuery,
	isInternalQueryTable,
	pickDefaultQueryTable
} from '@studio/shared/utils/default-query-table'

describe('default-query-table', function () {
	it('treats drizzle migration tables as internal', function () {
		expect(isInternalQueryTable('__drizzle_migrations')).toBe(true)
		expect(isInternalQueryTable('__drizzle_meta')).toBe(true)
	})

	it('treats migration bookkeeping from other tools as internal', function () {
		for (const name of [
			'_prisma_migrations',
			'schema_migrations',
			'knex_migrations_lock',
			'flyway_schema_history',
			'django_migrations',
			'alembic_version',
			'sqlite_sequence',
			'migrations'
		]) {
			expect(isInternalQueryTable(name)).toBe(true)
		}
	})

	it('keeps user tables that merely mention migrations', function () {
		expect(isInternalQueryTable('migration_requests')).toBe(false)
		expect(isInternalQueryTable('users')).toBe(false)
	})

	it('prefers the first non-internal table', function () {
		const tables = [{ name: '__drizzle_migrations' }, { name: 'messages' }]

		expect(pickDefaultQueryTable(tables)?.name).toBe('messages')
	})

	it('falls back to the first table when all tables are internal', function () {
		const tables = [{ name: '__drizzle_migrations' }]

		expect(pickDefaultQueryTable(tables)?.name).toBe('__drizzle_migrations')
	})

	it('builds default starter queries', function () {
		expect(buildDefaultSqlQuery('messages')).toBe('SELECT * FROM messages LIMIT 100;')
		expect(buildDefaultDrizzleQuery('messages')).toBe('db.select().from(messages).limit(100);')
	})
})
