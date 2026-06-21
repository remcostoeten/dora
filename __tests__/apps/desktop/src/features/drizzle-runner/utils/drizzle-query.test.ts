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

	it('converts .where(eq(...)) chains', function () {
		expect(drizzleQueryToSql('db.select().from(messages).where(eq(messages.id, 1))')).toBe(
			'SELECT * FROM messages WHERE id = 1'
		)
	})

	it('converts .where(eq(...)) with .limit(n)', function () {
		expect(
			drizzleQueryToSql('db.select().from(users).where(eq(users.id, 1)).limit(10)')
		).toBe('SELECT * FROM users WHERE id = 1 LIMIT 10')
	})

	it('converts multi-condition .where(and(...))', function () {
		expect(
			drizzleQueryToSql(
				'db.select().from(messages).where(and(eq(messages.id, 1), eq(messages.active, true)))'
			)
		).toBe('SELECT * FROM messages WHERE (id = 1 AND active = true)')
	})

	it('converts nested and/or/not conditions', function () {
		expect(
			drizzleQueryToSql(
				'db.select().from(users).where(or(eq(users.role, "admin"), not(isNull(users.email))))'
			)
		).toBe("SELECT * FROM users WHERE (role = 'admin' OR (NOT email IS NULL))")
	})

	it('converts inArray and between conditions', function () {
		expect(drizzleQueryToSql('db.select().from(users).where(inArray(users.id, [1, 2, 3]))')).toBe(
			'SELECT * FROM users WHERE id IN (1, 2, 3)'
		)
		expect(drizzleQueryToSql('db.select().from(users).where(between(users.age, 18, 65))')).toBe(
			'SELECT * FROM users WHERE age BETWEEN 18 AND 65'
		)
	})

	it('converts .orderBy() with asc/desc and column refs', function () {
		expect(drizzleQueryToSql('db.select().from(messages).orderBy(messages.createdAt)')).toBe(
			'SELECT * FROM messages ORDER BY createdAt'
		)
		expect(
			drizzleQueryToSql('db.select().from(messages).orderBy(desc(messages.createdAt), asc(messages.id))')
		).toBe('SELECT * FROM messages ORDER BY createdAt DESC, id ASC')
	})

	it('orders SQL clauses as WHERE, ORDER BY, LIMIT, OFFSET regardless of chain order', function () {
		expect(
			drizzleQueryToSql(
				'db.select().from(users).limit(5).orderBy(users.id).where(eq(users.active, true))'
			)
		).toBe('SELECT * FROM users WHERE active = true ORDER BY id LIMIT 5')
	})

	it('rejects joins/grouping/set-ops with a precise, method-named message', function () {
		expect(function () {
			drizzleQueryToSql('db.select().from(messages).groupBy(messages.id)')
		}).toThrow('.groupBy() is not auto-translated')
		expect(function () {
			drizzleQueryToSql('db.select().from(users).leftJoin(orders, eq(orders.userId, users.id))')
		}).toThrow('.leftJoin() is not auto-translated')
	})

	it('converts insert with a single values object', function () {
		expect(drizzleQueryToSql('db.insert(users).values({ name: "Ada", age: 36 })')).toBe(
			"INSERT INTO users (name, age) VALUES ('Ada', 36)"
		)
	})

	it('converts insert with .returning() and multiple rows', function () {
		expect(
			drizzleQueryToSql('db.insert(users).values([{ name: "a" }, { name: "b" }]).returning()')
		).toBe("INSERT INTO users (name) VALUES ('a'), ('b') RETURNING *")
	})

	it('converts delete with a where clause', function () {
		expect(drizzleQueryToSql('db.delete(users).where(eq(users.id, 1))')).toBe(
			'DELETE FROM users WHERE id = 1'
		)
	})

	it('rejects delete without a where clause (whole-table guard)', function () {
		expect(function () {
			drizzleQueryToSql('db.delete(users)')
		}).toThrow('without .where() is rejected')
	})

	it('rejects update without a where clause (whole-table guard)', function () {
		expect(function () {
			drizzleQueryToSql('db.update(users).set({ name: "a" })')
		}).toThrow('without .where() is rejected')
	})

	it('converts update with .returning()', function () {
		expect(
			drizzleQueryToSql('db.update(users).set({ name: "a" }).where(eq(users.id, 1)).returning()')
		).toBe("UPDATE users SET name = 'a' WHERE id = 1 RETURNING *")
	})

	it('strips .toSQL() before translating', function () {
		expect(drizzleQueryToSql('db.select().from(users).toSQL()')).toBe('SELECT * FROM users')
	})

	it('strips .toSQL() from a query with .where()', function () {
		expect(
			drizzleQueryToSql('db.select().from(users).where(eq(users.id, 1)).toSQL()')
		).toBe('SELECT * FROM users WHERE id = 1')
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

	it('converts db.$count(table)', function () {
		expect(drizzleQueryToSql('db.$count(messages)')).toBe('SELECT count(*) FROM messages')
	})

	it('converts db.$count(table, eq(...))', function () {
		expect(drizzleQueryToSql('db.$count(messages, eq(messages.active, true))')).toBe(
			'SELECT count(*) FROM messages WHERE active = true'
		)
	})

	it('converts db.$count with .toSQL()', function () {
		expect(drizzleQueryToSql('db.$count(users).toSQL()')).toBe('SELECT count(*) FROM users')
	})

	it('tolerates whitespace and await in db.$count', function () {
		expect(drizzleQueryToSql('await db.$count(  messages  )')).toBe(
			'SELECT count(*) FROM messages'
		)
	})

	it('converts db.$count(table, and(...)) with a multi-condition filter', function () {
		expect(
			drizzleQueryToSql('db.$count(messages, and(eq(messages.a, 1), eq(messages.b, 2)))')
		).toBe('SELECT count(*) FROM messages WHERE (a = 1 AND b = 2)')
	})

	it('rejects a db.$count condition it cannot translate', function () {
		expect(function () {
			drizzleQueryToSql('db.$count(messages, sql`a = 1`)')
		}).toThrow('Unsupported db.$count() condition')
	})
})
