import { describe, expect, it } from 'vitest'
import { buildDropColumnSql, getColumnSqlIdentifier } from '@studio/shared/utils/table-ref'

describe('getColumnSqlIdentifier', function () {
	it('quotes with double quotes by default', function () {
		expect(getColumnSqlIdentifier('email')).toBe('"email"')
	})

	it('quotes with double quotes for postgres', function () {
		expect(getColumnSqlIdentifier('email', 'postgres')).toBe('"email"')
	})

	it('uses backticks for mysql', function () {
		expect(getColumnSqlIdentifier('email', 'mysql')).toBe('`email`')
	})

	it('uses backticks for mariadb', function () {
		expect(getColumnSqlIdentifier('email', 'mariadb')).toBe('`email`')
	})

	it('passes through an already double-quoted identifier', function () {
		expect(getColumnSqlIdentifier('"Weird Name"', 'postgres')).toBe('"Weird Name"')
	})

	it('passes through an already backtick-quoted identifier for mysql', function () {
		expect(getColumnSqlIdentifier('`Weird Name`', 'mysql')).toBe('`Weird Name`')
	})
})

describe('buildDropColumnSql', function () {
	it('builds a schema-qualified postgres statement', function () {
		expect(buildDropColumnSql('public.users', 'email', 'postgres')).toBe(
			'ALTER TABLE "public"."users" DROP COLUMN "email"'
		)
	})

	it('builds a cockroach statement with schema qualification', function () {
		expect(buildDropColumnSql('public.users', 'email', 'cockroach')).toBe(
			'ALTER TABLE "public"."users" DROP COLUMN "email"'
		)
	})

	it('uses backticks for mysql', function () {
		expect(buildDropColumnSql('app.users', 'email', 'mysql')).toBe(
			'ALTER TABLE `app`.`users` DROP COLUMN `email`'
		)
	})

	it('uses backticks for mariadb', function () {
		expect(buildDropColumnSql('app.users', 'email', 'mariadb')).toBe(
			'ALTER TABLE `app`.`users` DROP COLUMN `email`'
		)
	})

	it('drops schema qualification for sqlite (native DROP COLUMN, 3.35+)', function () {
		expect(buildDropColumnSql('public.users', 'email', 'sqlite')).toBe(
			'ALTER TABLE "users" DROP COLUMN "email"'
		)
	})

	it('drops schema qualification for libsql', function () {
		expect(buildDropColumnSql('public.users', 'email', 'libsql')).toBe(
			'ALTER TABLE "users" DROP COLUMN "email"'
		)
	})

	it('handles a bare table name with no dialect', function () {
		expect(buildDropColumnSql('users', 'email')).toBe(
			'ALTER TABLE "users" DROP COLUMN "email"'
		)
	})
})
