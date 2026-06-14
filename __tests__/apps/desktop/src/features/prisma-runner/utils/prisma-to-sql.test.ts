import { describe, expect, it } from 'vitest'
import type { ColumnInfo, DatabaseSchema, TableInfo } from '@/lib/bindings'
import {
	prismaToSql,
	type TranslationResult
} from '@/features/prisma-runner/utils/prisma-to-sql'

function col(name: string, overrides: Partial<ColumnInfo> = {}): ColumnInfo {
	return {
		name,
		data_type: 'text',
		is_nullable: true,
		default_value: null,
		...overrides
	}
}

function table(name: string, columns: ColumnInfo[], pk: string[] = ['id']): TableInfo {
	return { name, schema: 'public', columns, primary_key_columns: pk }
}

const buildSchema: DatabaseSchema = {
	tables: [
		table('users', [
			col('id', { data_type: 'integer', is_nullable: false, is_primary_key: true }),
			col('email'),
			col('name'),
			col('age', { data_type: 'integer' }),
			col('active', { data_type: 'boolean' })
		]),
		table('posts', [
			col('id', { data_type: 'integer', is_nullable: false, is_primary_key: true }),
			col('title'),
			col('published', { data_type: 'boolean' }),
			col('author_id', {
				data_type: 'integer',
				foreign_key: {
					referenced_table: 'users',
					referenced_column: 'id',
					referenced_schema: 'public'
				}
			})
		])
	],
	schemas: ['public'],
	unique_columns: []
}

function asSql(result: TranslationResult): { sql: string; params: unknown[] } {
	if ('error' in result) throw new Error(`expected sql, got error: ${result.error}`)
	return result
}

function asError(result: TranslationResult): { error: string; hint?: string } {
	if (!('error' in result)) throw new Error(`expected error, got sql: ${result.sql}`)
	return result
}

describe('prismaToSql - findMany', function () {
	it('translates a bare findMany', function () {
		const r = asSql(prismaToSql('prisma.user.findMany()', buildSchema, 'postgresql'))
		expect(r.sql).toBe('SELECT * FROM "users"')
		expect(r.params).toEqual([])
	})

	it('translates where, orderBy, take, skip', function () {
		const r = asSql(
			prismaToSql(
				"prisma.user.findMany({ where: { active: true }, orderBy: { email: 'asc' }, take: 10, skip: 5 })",
				buildSchema,
				'postgresql'
			)
		)
		expect(r.sql).toBe(
			'SELECT * FROM "users" WHERE "active" = $1 ORDER BY "email" ASC LIMIT 10 OFFSET 5'
		)
		expect(r.params).toEqual([true])
	})

	it('uses ? placeholders and 1/0 booleans for mysql', function () {
		const r = asSql(
			prismaToSql('prisma.user.findMany({ where: { active: true } })', buildSchema, 'mysql')
		)
		expect(r.sql).toBe('SELECT * FROM `users` WHERE `active` = ?')
		expect(r.params).toEqual([1])
	})

	it('supports select with named columns', function () {
		const r = asSql(
			prismaToSql(
				'prisma.user.findMany({ select: { email: true, name: true } })',
				buildSchema,
				'postgresql'
			)
		)
		expect(r.sql).toBe('SELECT "users"."email", "users"."name" FROM "users"')
	})

	it('rejects unknown select column', function () {
		expect(
			asError(
				prismaToSql('prisma.user.findMany({ select: { nope: true } })', buildSchema, 'sqlite')
			).error
		).toContain('nope')
	})

	it('supports array orderBy', function () {
		const r = asSql(
			prismaToSql(
				"prisma.user.findMany({ orderBy: [{ name: 'asc' }, { age: 'desc' }] })",
				buildSchema,
				'postgresql'
			)
		)
		expect(r.sql).toBe('SELECT * FROM "users" ORDER BY "name" ASC, "age" DESC')
	})
})

describe('prismaToSql - findFirst / findUnique / count', function () {
	it('findFirst adds LIMIT 1', function () {
		const r = asSql(prismaToSql('prisma.user.findFirst()', buildSchema, 'postgresql'))
		expect(r.sql).toBe('SELECT * FROM "users" LIMIT 1')
	})

	it('findUnique by id', function () {
		const r = asSql(
			prismaToSql('prisma.user.findUnique({ where: { id: 1 } })', buildSchema, 'postgresql')
		)
		expect(r.sql).toBe('SELECT * FROM "users" WHERE "id" = $1 LIMIT 1')
		expect(r.params).toEqual([1])
	})

	it('count with where', function () {
		const r = asSql(
			prismaToSql('prisma.user.count({ where: { active: true } })', buildSchema, 'postgresql')
		)
		expect(r.sql).toBe('SELECT COUNT(*) FROM "users" WHERE "active" = $1')
	})
})

describe('prismaToSql - where operators', function () {
	function whereSql(where: string, dialect: 'postgresql' = 'postgresql') {
		return asSql(prismaToSql(`prisma.user.findMany({ where: ${where} })`, buildSchema, dialect))
	}

	it('equals / not', function () {
		expect(whereSql('{ email: { equals: "a" } }').sql).toBe(
			'SELECT * FROM "users" WHERE "email" = $1'
		)
		expect(whereSql('{ email: { not: "a" } }').sql).toBe(
			'SELECT * FROM "users" WHERE "email" != $1'
		)
	})

	it('lt lte gt gte', function () {
		expect(whereSql('{ age: { lt: 1, lte: 2, gt: 3, gte: 4 } }').sql).toBe(
			'SELECT * FROM "users" WHERE ("age" < $1 AND "age" <= $2 AND "age" > $3 AND "age" >= $4)'
		)
	})

	it('in / notIn', function () {
		const r = whereSql('{ age: { in: [1, 2, 3] } }')
		expect(r.sql).toBe('SELECT * FROM "users" WHERE "age" IN ($1, $2, $3)')
		expect(r.params).toEqual([1, 2, 3])
		expect(whereSql('{ age: { notIn: [1, 2] } }').sql).toBe(
			'SELECT * FROM "users" WHERE "age" NOT IN ($1, $2)'
		)
	})

	it('contains / startsWith / endsWith', function () {
		expect(whereSql('{ email: { contains: "x" } }').params).toEqual(['%x%'])
		expect(whereSql('{ email: { startsWith: "x" } }').params).toEqual(['x%'])
		expect(whereSql('{ email: { endsWith: "x" } }').params).toEqual(['%x'])
		expect(whereSql('{ email: { contains: "x" } }').sql).toBe(
			'SELECT * FROM "users" WHERE "email" LIKE $1'
		)
	})

	it('nested AND / OR / NOT', function () {
		const r = whereSql(
			'{ AND: [{ active: true }, { OR: [{ age: { gt: 18 } }, { name: "bob" }] }], NOT: { email: "spam" } }'
		)
		expect(r.sql).toBe(
			'SELECT * FROM "users" WHERE ("active" = $1 AND ("age" > $2 OR "name" = $3)) AND NOT ("email" = $4)'
		)
	})

	it('null becomes IS NULL', function () {
		expect(whereSql('{ name: null }').sql).toBe('SELECT * FROM "users" WHERE "name" IS NULL')
	})

	it('rejects unknown column in where', function () {
		const r = prismaToSql('prisma.user.findMany({ where: { nope: 1 } })', buildSchema, 'postgresql')
		expect(asError(r).error).toContain('nope')
	})

	it('rejects unknown operator', function () {
		const r = prismaToSql(
			'prisma.user.findMany({ where: { age: { between: 1 } } })',
			buildSchema,
			'postgresql'
		)
		expect(asError(r).error).toContain('between')
	})
})

describe('prismaToSql - create / createMany / update / delete', function () {
	it('create with RETURNING on postgres', function () {
		const r = asSql(
			prismaToSql(
				'prisma.user.create({ data: { email: "a@b.c", age: 30 } })',
				buildSchema,
				'postgresql'
			)
		)
		expect(r.sql).toBe('INSERT INTO "users" ("email", "age") VALUES ($1, $2) RETURNING *')
		expect(r.params).toEqual(['a@b.c', 30])
	})

	it('create without RETURNING on sqlite', function () {
		const r = asSql(
			prismaToSql('prisma.user.create({ data: { email: "a" } })', buildSchema, 'sqlite')
		)
		expect(r.sql).toBe('INSERT INTO "users" ("email") VALUES (?)')
	})

	it('createMany multi-row', function () {
		const r = asSql(
			prismaToSql(
				'prisma.user.createMany({ data: [{ email: "a" }, { email: "b" }] })',
				buildSchema,
				'mysql'
			)
		)
		expect(r.sql).toBe('INSERT INTO `users` (`email`) VALUES (?), (?)')
		expect(r.params).toEqual(['a', 'b'])
	})

	it('update with where', function () {
		const r = asSql(
			prismaToSql(
				'prisma.user.update({ where: { id: 1 }, data: { name: "x" } })',
				buildSchema,
				'postgresql'
			)
		)
		expect(r.sql).toBe('UPDATE "users" SET "name" = $1 WHERE "id" = $2')
		expect(r.params).toEqual(['x', 1])
	})

	it('updateMany without where', function () {
		const r = asSql(
			prismaToSql('prisma.user.updateMany({ data: { active: false } })', buildSchema, 'sqlite')
		)
		expect(r.sql).toBe('UPDATE "users" SET "active" = ?')
		expect(r.params).toEqual([0])
	})

	it('delete with where', function () {
		const r = asSql(
			prismaToSql('prisma.user.delete({ where: { id: 1 } })', buildSchema, 'postgresql')
		)
		expect(r.sql).toBe('DELETE FROM "users" WHERE "id" = $1')
	})

	it('deleteMany with where', function () {
		const r = asSql(
			prismaToSql(
				'prisma.user.deleteMany({ where: { active: false } })',
				buildSchema,
				'postgresql'
			)
		)
		expect(r.sql).toBe('DELETE FROM "users" WHERE "active" = $1')
	})

	it('delete requires where', function () {
		expect(asError(prismaToSql('prisma.user.delete()', buildSchema, 'postgresql')).error).toContain(
			'where'
		)
	})
})

describe('prismaToSql - include -> JOIN', function () {
	it('single-level include emits LEFT JOIN', function () {
		const r = asSql(
			prismaToSql('prisma.user.findMany({ include: { post: true } })', buildSchema, 'postgresql')
		)
		expect(r.sql).toBe(
			'SELECT "users".* FROM "users" LEFT JOIN "posts" ON "posts"."author_id" = "users"."id"'
		)
	})

	it('nested include returns hint', function () {
		const r = asError(
			prismaToSql(
				'prisma.user.findMany({ include: { post: { include: { user: true } } } })',
				buildSchema,
				'postgresql'
			)
		)
		expect(r.hint).toContain('Nested include is not supported')
	})
})

describe('prismaToSql - $queryRaw passthrough', function () {
	it('passes through raw sql and extracts interpolations', function () {
		const r = asSql(
			prismaToSql('prisma.$queryRaw`SELECT * FROM users WHERE id = ${userId}`', buildSchema, 'postgresql')
		)
		expect(r.sql).toBe('SELECT * FROM users WHERE id = $1')
		expect(r.params).toEqual(['userId'])
	})

	it('$executeRaw uses ? for sqlite', function () {
		const r = asSql(
			prismaToSql('prisma.$executeRaw`DELETE FROM users WHERE id = ${id}`', buildSchema, 'sqlite')
		)
		expect(r.sql).toBe('DELETE FROM users WHERE id = ?')
		expect(r.params).toEqual(['id'])
	})
})

describe('prismaToSql - unsupported patterns return errors (never throw)', function () {
	function expectError(code: string) {
		const r = prismaToSql(code, buildSchema, 'postgresql')
		expect('error' in r).toBe(true)
	}

	it('connectOrCreate / nested write', function () {
		expectError(
			'prisma.post.create({ data: { title: "x", author: { connectOrCreate: { where: {} } } } })'
		)
	})

	it('upsert', function () {
		expectError('prisma.user.upsert({ where: { id: 1 }, create: {}, update: {} })')
	})

	it('$transaction', function () {
		expectError('prisma.$transaction([])')
	})

	it('nested relation write in create data', function () {
		expectError('prisma.user.create({ data: { email: "a", posts: { create: {} } } })')
	})

	it('aggregate', function () {
		expectError('prisma.user.aggregate({ _sum: { age: true } })')
	})

	it('groupBy', function () {
		expectError('prisma.user.groupBy({ by: ["age"] })')
	})

	it('unknown model key', function () {
		expectError('prisma.widget.findMany()')
	})

	it('unknown method', function () {
		expectError('prisma.user.frobnicate({})')
	})

	it('select + include together', function () {
		expectError('prisma.user.findMany({ select: { email: true }, include: { post: true } })')
	})
})
