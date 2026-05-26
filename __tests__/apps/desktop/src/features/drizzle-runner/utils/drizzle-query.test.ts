import { describe, expect, it } from 'vitest'
import { drizzleQueryToSql } from '@/features/drizzle-runner/utils/drizzle-query'

describe('drizzleQueryToSql', function () {
	it('converts a simple Drizzle select with limit', function () {
		expect(drizzleQueryToSql('db.select().from(messages).limit(100)')).toBe(
			'SELECT * FROM messages LIMIT 100'
		)
	})

	it('converts schema-qualified table names', function () {
		expect(drizzleQueryToSql('db.select().from(public.messages).limit(25);')).toBe(
			'SELECT * FROM public.messages LIMIT 25'
		)
	})

	it('extracts SQL from db.execute(sql template)', function () {
		expect(
			drizzleQueryToSql(`db.execute(sql\`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
\`);`)
		).toBe(`SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;`)
	})

	it('extracts bare sql templates', function () {
		expect(drizzleQueryToSql("sql`SELECT * FROM messages LIMIT 1`")).toBe(
			'SELECT * FROM messages LIMIT 1'
		)
	})

	it('rejects .where() chains with a specific message', function () {
		expect(function () {
			drizzleQueryToSql('db.select().from(messages).where(eq(messages.id, 1))')
		}).toThrow('Queries with .where() are not auto-translated')
	})

	it('rejects .orderBy() chains with a specific message', function () {
		expect(function () {
			drizzleQueryToSql('db.select().from(messages).orderBy(messages.createdAt)')
		}).toThrow('Queries with .orderBy() are not auto-translated')
	})

	it('accepts tx.execute(sql) patterns', function () {
		expect(drizzleQueryToSql("tx.execute(sql`SELECT * FROM users`)")).toBe(
			'SELECT * FROM users'
		)
	})

	it('accepts tx.select().from(table).limit(n) patterns', function () {
		expect(drizzleQueryToSql('tx.select().from(users).limit(10)')).toBe(
			'SELECT * FROM users LIMIT 10'
		)
	})

	it('accepts .offset(n) in addition to .limit(n)', function () {
		expect(drizzleQueryToSql('db.select().from(users).limit(10).offset(5)')).toBe(
			'SELECT * FROM users LIMIT 10 OFFSET 5'
		)
		expect(drizzleQueryToSql('db.select().from(users).offset(5)')).toBe(
			'SELECT * FROM users OFFSET 5'
		)
	})

	it('converts a simple Drizzle update with eq where', function () {
		expect(
			drizzleQueryToSql(
				"db.update(user).set({ name: 'New Name' }).where(eq(user.email, 'notprisma@gmail.com'))"
			)
		).toBe(
			'UPDATE "user" SET name = \'New Name\' WHERE email = \'notprisma@gmail.com\''
		)
	})

	it('converts simple update literals', function () {
		expect(
			drizzleQueryToSql(
				"tx.update(users).set({ active: true, age: 42, deletedAt: null }).where(ne(users.id, 1))"
			)
		).toBe('UPDATE users SET active = true, age = 42, deletedAt = NULL WHERE id != 1')
	})

	it('rejects unsupported chains instead of sending JavaScript to the SQL backend', function () {
		expect(function () {
			drizzleQueryToSql('db.select().from(messages).groupBy(messages.id)')
		}).toThrow('Unsupported Drizzle query')
	})
})
