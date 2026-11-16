import { describe, expect, it } from 'vitest'
import {
	isBlankEditorContent,
	resolveSeedQueries
} from '@studio/features/sql-console/lib/seed-query'

const tables = [{ name: '__drizzle_migrations' }, { name: 'users' }, { name: 'orders' }]

describe('sql console seed query', function () {
	it('opens with the last query run on this connection', function () {
		const seed = resolveSeedQueries({
			connectionId: 'a',
			tables,
			history: [
				{ query: 'SELECT 1', connectionId: 'a', timestamp: 10 },
				{ query: 'SELECT 2', connectionId: 'a', timestamp: 30 },
				{ query: 'SELECT 3', connectionId: 'b', timestamp: 50 },
				{ query: 'db.select().from(users)', connectionId: 'a', timestamp: 40 }
			]
		})

		expect(seed.sql).toBe('SELECT 2')
		expect(seed.drizzle).toBe('db.select().from(users)')
	})

	it('falls back to a starter query for the selected table', function () {
		const seed = resolveSeedQueries({
			connectionId: 'a',
			tables,
			history: [],
			selectedTableName: 'orders'
		})

		expect(seed.sql).toBe('SELECT * FROM orders LIMIT 100;')
		expect(seed.drizzle).toBe('db.select().from(orders).limit(100);')
	})

	it('falls back to the first table that is not migration bookkeeping', function () {
		const seed = resolveSeedQueries({
			connectionId: 'a',
			tables,
			history: [],
			selectedTableName: 'dropped_table'
		})

		expect(seed.sql).toBe('SELECT * FROM users LIMIT 100;')
	})

	it('seeds nothing when there are no tables and no history', function () {
		expect(resolveSeedQueries({ connectionId: 'a', tables: [], history: [] })).toEqual({
			sql: null,
			drizzle: null
		})
	})

	it('treats empty and placeholder content as blank', function () {
		expect(isBlankEditorContent('', '-- placeholder')).toBe(true)
		expect(isBlankEditorContent('  -- placeholder\n', '-- placeholder')).toBe(true)
		expect(isBlankEditorContent('SELECT 1', '-- placeholder')).toBe(false)
	})
})
