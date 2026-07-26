import { describe, expect, it } from 'vitest'
import type { Dialect, SchemaIR } from '@studio/features/orm-cockpit/ir/types'
import { parseDrizzleSchema } from '@studio/features/orm-cockpit/parsers/drizzle/parse-drizzle-schema'
import { convertDrizzleToSql } from '@studio/features/orm-cockpit/converters/drizzle-to-sql'
import { convertSqlToDrizzle } from '@studio/features/orm-cockpit/converters/sql-to-drizzle'
import { DRIZZLE_TO_SQL_FIXTURES } from './fixtures/drizzle-to-sql-fixtures'
import { SQL_TO_DRIZZLE_FIXTURES } from './fixtures/sql-to-drizzle-fixtures'

/**
 * SchemaIR keyed on comparable fields only: `rawType` names the builder/DB
 * token a side happened to use (char vs varchar, serial vs SERIAL), which is
 * exactly the spelling a round-trip is allowed to normalize away.
 */
function comparableIr(source: string, dialect: Dialect): SchemaIR {
	const { ir } = parseDrizzleSchema([{ path: 'roundtrip.ts', text: source }], dialect)
	return {
		dialect: ir.dialect,
		tables: ir.tables.map((table) => ({
			...table,
			columns: table.columns.map(({ rawType: _rawType, ...column }) => ({
				...column,
				rawType: '',
			})),
		})),
	}
}

describe('round-trip: sql → drizzle → sql is byte-exact (drizzle-to-sql fixtures)', function () {
	for (const fixture of DRIZZLE_TO_SQL_FIXTURES) {
		it(fixture.name, function () {
			const toDrizzle = convertSqlToDrizzle(fixture.sql, { dialect: fixture.dialect })
			expect(toDrizzle.ok, JSON.stringify(toDrizzle)).toBe(true)
			if (!toDrizzle.ok) {
				return
			}
			const backToSql = convertDrizzleToSql(toDrizzle.output, { dialect: fixture.dialect })
			expect(backToSql.ok, JSON.stringify(backToSql)).toBe(true)
			if (!backToSql.ok) {
				return
			}
			expect(backToSql.output).toBe(fixture.sql)
		})
	}
})

describe('round-trip: drizzle → sql → drizzle (sql-to-drizzle fixtures)', function () {
	for (const fixture of SQL_TO_DRIZZLE_FIXTURES) {
		it(fixture.name, function () {
			const toSql = convertDrizzleToSql(fixture.drizzle, { dialect: fixture.dialect })
			expect(toSql.ok, JSON.stringify(toSql)).toBe(true)
			if (!toSql.ok) {
				return
			}
			const backToDrizzle = convertSqlToDrizzle(toSql.output, { dialect: fixture.dialect })
			expect(backToDrizzle.ok, JSON.stringify(backToDrizzle)).toBe(true)
			if (!backToDrizzle.ok) {
				return
			}
			if (toSql.surface === 'query') {
				expect(backToDrizzle.output).toBe(fixture.drizzle)
				return
			}
			// SchemaIR sorts tables and columns by name, so DDL emitted from it
			// cannot preserve declaration order; schemas round-trip semantically
			// (identical IR), not byte-exactly.
			expect(comparableIr(backToDrizzle.output, fixture.dialect)).toEqual(
				comparableIr(fixture.drizzle, fixture.dialect),
			)
		})
	}
})
