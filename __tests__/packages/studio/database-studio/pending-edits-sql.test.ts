import { describe, expect, it } from 'vitest'
import {
	buildPendingEditsSql,
	toTableDialect
} from '@studio/features/database-studio/utils/pending-edits-sql'

function edit(primaryKeyValue: unknown, columnName: string, newValue: unknown) {
	return { primaryKeyColumn: 'id', primaryKeyValue, columnName, oldValue: 'old', newValue }
}

describe('buildPendingEditsSql', function () {
	it('merges the edits of one row into one UPDATE', function () {
		expect(
			buildPendingEditsSql(
				[edit(7, 'email', 'a@b.c'), edit(7, 'name', "O'Brien"), edit(8, 'email', null)],
				'public.users',
				'postgres'
			)
		).toEqual([
			`UPDATE "public"."users" SET "email" = 'a@b.c', "name" = 'O''Brien' WHERE "id" = 7;`,
			`UPDATE "public"."users" SET "email" = NULL WHERE "id" = 8;`
		])
	})

	it('quotes identifiers with backticks for MySQL', function () {
		expect(buildPendingEditsSql([edit('k1', 'active', true)], 'users', 'mysql')).toEqual([
			"UPDATE `users` SET `active` = TRUE WHERE `id` = 'k1';"
		])
	})

	it('returns nothing without edits', function () {
		expect(buildPendingEditsSql([], 'users')).toEqual([])
	})
})

describe('toTableDialect', function () {
	it('keeps known dialects and drops everything else', function () {
		expect(toTableDialect('mariadb')).toBe('mariadb')
		expect(toTableDialect('redis')).toBeUndefined()
		expect(toTableDialect(undefined)).toBeUndefined()
	})
})
