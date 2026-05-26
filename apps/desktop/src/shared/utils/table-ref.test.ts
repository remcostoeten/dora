import { describe, expect, it } from 'vitest'
import { getTableSqlIdentifier } from '@/shared/utils/table-ref'

describe('getTableSqlIdentifier', function () {
	it('keeps schema qualification for postgres by default', function () {
		expect(getTableSqlIdentifier('public.user')).toBe('"public"."user"')
	})

	it('drops schema qualification for sqlite', function () {
		expect(getTableSqlIdentifier('public.user', 'sqlite')).toBe('"user"')
	})

	it('drops schema qualification for libsql', function () {
		expect(getTableSqlIdentifier('public.user', 'libsql')).toBe('"user"')
	})

	it('uses mysql backticks with schema', function () {
		expect(getTableSqlIdentifier('public.user', 'mysql')).toBe('`public`.`user`')
	})

	it('preserves quoted schema and table names for postgres', function () {
		expect(getTableSqlIdentifier('"weird.schema"."Table Name"', 'postgres')).toBe(
			'"weird.schema"."Table Name"'
		)
	})

	it('keeps simple identifiers quoted', function () {
		expect(getTableSqlIdentifier('users')).toBe('"users"')
	})
})
