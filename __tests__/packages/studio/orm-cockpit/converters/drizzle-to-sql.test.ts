import { describe, expect, it } from 'vitest'
import type {
	ConvertResult,
	DrizzleToSql,
	SelectQuery,
} from '@studio/features/orm-cockpit/converters/contract'
import { convertDrizzleToSql } from '@studio/features/orm-cockpit/converters/drizzle-to-sql'
import { emitSql } from '@studio/features/orm-cockpit/converters/emit-sql'
import { DRIZZLE_TO_SQL_FIXTURES } from './fixtures/drizzle-to-sql-fixtures'

const CONTRACT_IMPL: DrizzleToSql = convertDrizzleToSql

function expectOk(result: ConvertResult): Extract<ConvertResult, { ok: true }> {
	if (!result.ok) {
		throw new Error(`expected success, got ${JSON.stringify(result.errors)}`)
	}
	return result
}

function expectFailure(result: ConvertResult): Extract<ConvertResult, { ok: false }> {
	if (result.ok) {
		throw new Error(`expected failure, got ${result.output}`)
	}
	return result
}

describe('convertDrizzleToSql fixtures', () => {
	it('satisfies the contract signature', () => {
		expect(CONTRACT_IMPL).toBe(convertDrizzleToSql)
	})

	for (const fixture of DRIZZLE_TO_SQL_FIXTURES) {
		it(fixture.name, () => {
			const result = expectOk(convertDrizzleToSql(fixture.drizzle, { dialect: fixture.dialect }))
			expect(result.output).toBe(fixture.sql)
		})
	}

	it('is deterministic for every fixture', () => {
		for (const fixture of DRIZZLE_TO_SQL_FIXTURES) {
			const first = convertDrizzleToSql(fixture.drizzle, { dialect: fixture.dialect })
			const second = convertDrizzleToSql(fixture.drizzle, { dialect: fixture.dialect })
			expect(second).toEqual(first)
		}
	})
})

describe('surface detection', () => {
	const SCHEMA = `import { pgTable, serial } from 'drizzle-orm/pg-core'

export const users = pgTable('users', { id: serial('id').primaryKey() })
`
	const QUERY = 'db.select().from(users).where(eq(users.id, 1))'

	it('detects the schema surface from table builders', () => {
		expect(expectOk(convertDrizzleToSql(SCHEMA, { dialect: 'postgres' })).surface).toBe('schema')
	})

	it('detects the query surface from a db chain', () => {
		expect(expectOk(convertDrizzleToSql(QUERY, { dialect: 'postgres' })).surface).toBe('query')
	})

	it('detects the query surface from a tx chain', () => {
		const result = expectOk(convertDrizzleToSql('tx.delete(users)', { dialect: 'postgres' }))
		expect(result.surface).toBe('query')
		expect(result.output).toBe('DELETE FROM "users";')
	})

	it('prefers the query surface when a snippet carries both', () => {
		const result = expectOk(convertDrizzleToSql(`${SCHEMA}\n${QUERY}`, { dialect: 'postgres' }))
		expect(result.surface).toBe('query')
	})

	it('honours a pinned surface', () => {
		const result = expectOk(
			convertDrizzleToSql(`${SCHEMA}\n${QUERY}`, { dialect: 'postgres', surface: 'schema' }),
		)
		expect(result.surface).toBe('schema')
		expect(result.output).toContain('CREATE TABLE "users"')
	})

	it('fails when the query surface is pinned on a schema-only snippet', () => {
		const result = expectFailure(convertDrizzleToSql(SCHEMA, { dialect: 'postgres', surface: 'query' }))
		expect(result.errors[0].code).toBe('parse-error')
	})
})

describe('identifier mapping', () => {
	const SCHEMA_AND_QUERY = `import { pgTable, serial, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('user_account', {
	id: serial('id').primaryKey(),
	createdAt: timestamp('created_at'),
})

db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, 1))
`

	it('maps JS identifiers onto DB names when the schema is in the snippet', () => {
		const result = expectOk(convertDrizzleToSql(SCHEMA_AND_QUERY, { dialect: 'postgres' }))
		expect(result.output).toBe('SELECT "created_at" FROM "user_account" WHERE "id" = 1;')
	})

	it('uses the identifier text verbatim without a schema, and does not warn', () => {
		const result = expectOk(
			convertDrizzleToSql('db.select({ createdAt: users.createdAt }).from(users)', {
				dialect: 'postgres',
			}),
		)
		expect(result.output).toBe('SELECT "createdAt" FROM "users";')
		expect(result.warnings).toEqual([])
	})
})

describe('warnings', () => {
	it('warns when ilike degrades on a non-postgres dialect', () => {
		const result = expectOk(
			convertDrizzleToSql("db.select().from(users).where(ilike(users.email, 'a%'))", {
				dialect: 'mysql',
			}),
		)
		expect(result.output).toBe('SELECT * FROM `users` WHERE `email` LIKE \'a%\';')
		expect(result.warnings.join(' ')).toContain('ilike()')
	})

	it('warns and emits a named placeholder for a runtime value', () => {
		const result = expectOk(
			convertDrizzleToSql('db.select().from(users).where(eq(users.id, userId))', {
				dialect: 'postgres',
			}),
		)
		expect(result.output).toBe('SELECT * FROM "users" WHERE "id" = :userId;')
		expect(result.warnings.join(' ')).toContain('userId')
	})

	it('warns once when several queries are present and converts the first', () => {
		const source = 'db.delete(users)\ndb.delete(posts)\n'
		const result = expectOk(convertDrizzleToSql(source, { dialect: 'postgres' }))
		expect(result.output).toBe('DELETE FROM "users";')
		expect(result.warnings).toHaveLength(1)
	})

	it('propagates parser warnings on the schema surface', () => {
		const source = `import { pgTable } from 'drizzle-orm/pg-core'

export const widgets = pgTable('widgets', {
	id: mystery('id').primaryKey(),
})
`
		const result = expectOk(convertDrizzleToSql(source, { dialect: 'postgres' }))
		expect(result.warnings.join(' ')).toContain('unrecognized builder')
	})
})

describe('errors', () => {
	it('rejects empty input', () => {
		const result = expectFailure(convertDrizzleToSql('   \n\t', { dialect: 'postgres' }))
		expect(result.errors[0].code).toBe('empty-input')
	})

	it('reports a parse error for broken TypeScript', () => {
		const result = expectFailure(convertDrizzleToSql('const = = =', { dialect: 'postgres' }))
		expect(result.errors[0].code).toBe('parse-error')
		expect(result.errors[0].line).toBe(1)
	})

	it('reports a parse error when nothing convertible is present', () => {
		const result = expectFailure(convertDrizzleToSql('const answer = 42', { dialect: 'postgres' }))
		expect(result.errors[0].code).toBe('parse-error')
	})

	it('rejects .having() by name', () => {
		const result = expectFailure(
			convertDrizzleToSql('db.select().from(users).groupBy(users.role).having(gt(users.id, 1))', {
				dialect: 'postgres',
			}),
		)
		expect(result.errors[0].code).toBe('unsupported-construct')
		expect(result.errors[0].message).toContain('.having()')
	})

	it('rejects a sql`` template in a condition', () => {
		const result = expectFailure(
			convertDrizzleToSql('db.select().from(users).where(sql`id = 1`)', { dialect: 'postgres' }),
		)
		expect(result.errors[0].code).toBe('unsupported-construct')
		expect(result.errors[0].message).toContain('sql``')
	})

	it('rejects unsupported operators by name', () => {
		const result = expectFailure(
			convertDrizzleToSql("db.select().from(users).where(arrayContains(users.tags, ['a']))", {
				dialect: 'postgres',
			}),
		)
		expect(result.errors[0].code).toBe('unsupported-construct')
		expect(result.errors[0].message).toContain('arrayContains()')
	})

	it('rejects unsupported builder steps by name', () => {
		const result = expectFailure(
			convertDrizzleToSql("db.insert(users).values({ id: 1 }).onConflictDoNothing()", {
				dialect: 'postgres',
			}),
		)
		expect(result.errors[0].code).toBe('unsupported-construct')
		expect(result.errors[0].message).toContain('.onConflictDoNothing()')
	})

	it('rejects a non-literal limit', () => {
		const result = expectFailure(
			convertDrizzleToSql('db.select().from(users).limit(pageSize)', { dialect: 'postgres' }),
		)
		expect(result.errors[0].code).toBe('unsupported-construct')
		expect(result.errors[0].message).toContain('.limit()')
	})

	it('reports a parse error when a select has no .from()', () => {
		const result = expectFailure(convertDrizzleToSql('db.select().limit(1)', { dialect: 'postgres' }))
		expect(result.errors[0].code).toBe('parse-error')
	})

	it('never throws on hostile input', () => {
		const inputs = [
			'db',
			'db.',
			'db.select(',
			'pgTable(',
			'export const x = pgTable(1, 2)',
			'db.select().from()',
			'db.update(users)',
			'db.insert(users)',
			'db.select().from(users).where()',
			'db.select().from(db.select().from(users))',
			'🙂',
		]
		for (const input of inputs) {
			for (const dialect of ['postgres', 'mysql', 'sqlite'] as const) {
				expect(() => convertDrizzleToSql(input, { dialect })).not.toThrow()
			}
		}
	})
})

describe('emitSql pivot', () => {
	const QUERY: SelectQuery = {
		kind: 'select',
		from: 'users',
		columns: [{ column: 'id' }],
		joins: [],
		where: { op: 'eq', column: { column: 'role' }, value: { kind: 'string', value: 'ad\'min' } },
		groupBy: [],
		orderBy: [{ column: { column: 'id' }, direction: 'desc' }],
		limit: 5,
	}

	it('emits a QueryIR without a parser', () => {
		expect(emitSql(QUERY, 'postgres')).toBe(
			'SELECT "id" FROM "users" WHERE "role" = \'ad\'\'min\' ORDER BY "id" DESC LIMIT 5;',
		)
	})

	it('quotes identifiers per dialect', () => {
		expect(emitSql(QUERY, 'mysql')).toContain('`users`')
		expect(emitSql(QUERY, 'sqlite')).toContain('"users"')
	})
})
