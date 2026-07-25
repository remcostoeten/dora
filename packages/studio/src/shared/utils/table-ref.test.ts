import { describe, expect, it } from 'vitest'
import {
	buildDropColumnSql,
	getColumnSqlIdentifier,
	getTableRefParts,
	getTableSqlIdentifier
} from '@studio/shared/utils/table-ref'

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

	it('keeps schema qualification for cockroach', function () {
		expect(getTableSqlIdentifier('public.user', 'cockroach')).toBe('"public"."user"')
	})

	it('uses mysql backticks with schema', function () {
		expect(getTableSqlIdentifier('public.user', 'mysql')).toBe('`public`.`user`')
	})

	it('uses mysql backticks for mariadb', function () {
		expect(getTableSqlIdentifier('public.user', 'mariadb')).toBe('`public`.`user`')
	})

	it('preserves quoted schema and table names for postgres', function () {
		expect(getTableSqlIdentifier('"weird.schema"."Table Name"', 'postgres')).toBe(
			'"weird.schema"."Table Name"'
		)
	})

	it('keeps simple identifiers quoted', function () {
		expect(getTableSqlIdentifier('users')).toBe('"users"')
	})

	it('doubles embedded double quotes', function () {
		expect(getTableSqlIdentifier({ name: 'we"ird' }, 'postgres')).toBe('"we""ird"')
	})

	it('doubles embedded backticks for mysql', function () {
		expect(getTableSqlIdentifier({ name: 'we`ird' }, 'mysql')).toBe('`we``ird`')
	})

	it('round-trips a pre-quoted mysql reference', function () {
		expect(getTableSqlIdentifier('`db`.`tbl`', 'mysql')).toBe('`db`.`tbl`')
	})

	it('splits on the separator outside quotes, not the first dot', function () {
		expect(getTableRefParts('"weird.schema"."Table Name"')).toEqual({
			schemaName: '"weird.schema"',
			tableName: '"Table Name"'
		})
	})

	it('treats an unquoted dotted name as schema-qualified', function () {
		expect(getTableRefParts('public.user')).toEqual({
			schemaName: 'public',
			tableName: 'user'
		})
	})

	it('drops the schema part for sqlite even when quoted', function () {
		expect(getTableSqlIdentifier('"weird.schema"."Table Name"', 'sqlite')).toBe('"Table Name"')
	})
})

describe('getColumnSqlIdentifier', function () {
	it('doubles embedded double quotes', function () {
		expect(getColumnSqlIdentifier('a"b')).toBe('"a""b"')
	})

	it('doubles embedded backticks for mysql', function () {
		expect(getColumnSqlIdentifier('a`b', 'mysql')).toBe('`a``b`')
	})

	it('passes through an already-quoted column', function () {
		expect(getColumnSqlIdentifier('"a b"')).toBe('"a b"')
	})
})

describe('buildDropColumnSql', function () {
	it('quotes both parts of a dotted quoted table and an awkward column', function () {
		expect(buildDropColumnSql('"weird.schema"."Table Name"', 'a"b', 'postgres')).toBe(
			'ALTER TABLE "weird.schema"."Table Name" DROP COLUMN "a""b"'
		)
	})
})
