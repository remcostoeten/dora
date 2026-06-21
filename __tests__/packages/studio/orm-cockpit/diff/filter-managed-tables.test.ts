import { describe, expect, it } from 'vitest'
import {
	isManagedTable,
	filterManagedTables,
	countManagedTables,
} from '@studio/features/orm-cockpit/diff/filter-managed-tables'
import type { SchemaIR, TableIR } from '@studio/features/orm-cockpit/ir/types'

function table(name: string, schema?: string): TableIR {
	return { name, columns: [], primaryKey: [], indexes: [], foreignKeys: [], schema }
}

function ir(tables: TableIR[]): SchemaIR {
	return { dialect: 'postgres', tables }
}

describe('isManagedTable', function () {
	it('flags ORM migration bookkeeping tables in any dialect', function () {
		expect(isManagedTable(table('__drizzle_migrations', 'public'), 'postgres')).toBe(true)
		expect(isManagedTable(table('_prisma_migrations'), 'mysql')).toBe(true)
	})

	it('flags provider/system schemas on postgres', function () {
		expect(isManagedTable(table('users', 'auth'), 'postgres')).toBe(true)
		expect(isManagedTable(table('objects', 'storage'), 'postgres')).toBe(true)
	})

	it('keeps application tables in the public schema', function () {
		expect(isManagedTable(table('users', 'public'), 'postgres')).toBe(false)
		expect(isManagedTable(table('posts'), 'postgres')).toBe(false)
	})

	it('does not treat non-public schemas as system on mysql/sqlite', function () {
		expect(isManagedTable(table('users', 'whatever'), 'mysql')).toBe(false)
	})
})

describe('filterManagedTables', function () {
	const schema = ir([
		table('users', 'public'),
		table('__drizzle_migrations', 'public'),
		table('objects', 'storage'),
	])

	it('drops managed tables when not showing', function () {
		const result = filterManagedTables(schema, 'postgres', false)
		expect(result.tables.map((t) => t.name)).toEqual(['users'])
	})

	it('is a no-op when showing', function () {
		expect(filterManagedTables(schema, 'postgres', true)).toBe(schema)
	})

	it('counts the managed tables', function () {
		expect(countManagedTables(schema, 'postgres')).toBe(2)
	})
})
