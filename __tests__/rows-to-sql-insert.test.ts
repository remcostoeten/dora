import { describe, it, expect } from 'vitest'
import { rowsToSqlInsert } from '@/features/database-studio/utils/studio-data'

describe('rowsToSqlInsert', () => {
	it('returns empty string for no rows', () => {
		expect(rowsToSqlInsert([], 'users')).toBe('')
	})

	it('builds one INSERT per row with quoted identifiers', () => {
		const sql = rowsToSqlInsert(
			[
				{ id: 1, name: 'Alice' },
				{ id: 2, name: 'Bob' }
			],
			'users'
		)
		expect(sql).toBe(
			`INSERT INTO "users" ("id", "name") VALUES (1, 'Alice');\n` +
				`INSERT INTO "users" ("id", "name") VALUES (2, 'Bob');`
		)
	})

	it('renders null/boolean/number/object literals and escapes quotes', () => {
		const sql = rowsToSqlInsert(
			[{ a: null, b: true, c: 3.5, d: "O'Brien", e: { k: 1 } }],
			't',
			['a', 'b', 'c', 'd', 'e']
		)
		expect(sql).toBe(
			`INSERT INTO "t" ("a", "b", "c", "d", "e") VALUES (NULL, TRUE, 3.5, 'O''Brien', '{"k":1}');`
		)
	})

	it('honours the explicit column order', () => {
		const sql = rowsToSqlInsert([{ id: 1, name: 'x' }], 't', ['name', 'id'])
		expect(sql).toBe(`INSERT INTO "t" ("name", "id") VALUES ('x', 1);`)
	})
})
