import { describe, expect, it } from 'vitest'
import { parseDrizzleSchema } from '@studio/features/orm-cockpit/parsers/drizzle/parse-drizzle-schema'

const PG_USERS = `
import { pgTable, serial, varchar, text, boolean, timestamp, integer, uuid } from 'drizzle-orm/pg-core'

export const user = pgTable('user', {
	id: serial('id').primaryKey(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	name: text('name'),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at').defaultNow(),
	role: text('role').default('member'),
})
`

const PG_POSTS = `
import { pgTable, serial, varchar, integer, timestamp } from 'drizzle-orm/pg-core'
import { user } from './user'

export const post = pgTable('post', {
	id: serial('id').primaryKey(),
	title: varchar('title', { length: 200 }).notNull(),
	authorId: integer('author_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
	publishedAt: timestamp('published_at'),
})
`

describe('parseDrizzleSchema (postgres, multi-file)', function () {
	const result = parseDrizzleSchema(
		[
			{ path: 'schema/user.ts', text: PG_USERS },
			{ path: 'schema/post.ts', text: PG_POSTS },
		],
		'postgres'
	)

	it('produces a postgres IR with tables sorted by name', function () {
		expect(result.ir.dialect).toBe('postgres')
		expect(result.ir.tables.map((t) => t.name)).toEqual(['post', 'user'])
	})

	it('maps column builders to normalized types and respects explicit DB names', function () {
		const user = result.ir.tables.find((t) => t.name === 'user')!
		const byName = Object.fromEntries(user.columns.map((c) => [c.name, c]))
		expect(user.columns.map((c) => c.name)).toEqual([
			'created_at',
			'email',
			'id',
			'is_active',
			'name',
			'role',
		])
		expect(byName.id.type).toBe('int')
		expect(byName.id.rawType).toBe('serial')
		expect(byName.id.autoIncrement).toBe(true)
		expect(byName.email.type).toBe('varchar')
		expect(byName.email.typeParams).toBe('255')
		expect(byName.is_active.type).toBe('bool')
		expect(byName.created_at.type).toBe('timestamp')
	})

	it('tracks primary keys, nullability and defaults', function () {
		const user = result.ir.tables.find((t) => t.name === 'user')!
		const byName = Object.fromEntries(user.columns.map((c) => [c.name, c]))
		expect(user.primaryKey).toEqual(['id'])
		expect(byName.id.nullable).toBe(false)
		expect(byName.name.nullable).toBe(true)
		expect(byName.is_active.default).toBe('true')
		expect(byName.role.default).toBe('member')
		expect(byName.created_at.default).toBe('now()')
		expect(byName.name.default).toBeNull()
	})

	it('records .unique() as a single-column unique index', function () {
		const user = result.ir.tables.find((t) => t.name === 'user')!
		expect(user.indexes).toEqual([
			{ name: 'user_email_unique', columns: ['email'], unique: true },
		])
	})

	it('defaults postgres tables to the public schema', function () {
		const user = result.ir.tables.find((t) => t.name === 'user')!
		expect(user.schema).toBe('public')
	})

	it('resolves a single-column .references() foreign key across files', function () {
		const post = result.ir.tables.find((t) => t.name === 'post')!
		expect(post.foreignKeys).toEqual([
			{
				columns: ['author_id'],
				refTable: 'user',
				refColumns: ['id'],
				onDelete: 'cascade',
			},
		])
	})

	it('emits no warnings for a clean schema', function () {
		expect(result.warnings).toEqual([])
	})
})

const SQLITE_SCHEMA = `
import { sqliteTable, integer, text, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const account = sqliteTable('account', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	slug: text('slug').notNull(),
})

export const membership = sqliteTable('membership', {
	accountId: integer('account_id').notNull(),
	userId: integer('user_id').notNull(),
	role: text('role').notNull().default('viewer'),
}, (t) => ({
	pk: primaryKey({ columns: [t.accountId, t.userId] }),
	roleIdx: index('membership_role_idx').on(t.role),
	userUnique: uniqueIndex('membership_user_unique').on(t.userId),
}))
`

describe('parseDrizzleSchema (sqlite, table-level config)', function () {
	const result = parseDrizzleSchema([{ path: 'schema.ts', text: SQLITE_SCHEMA }], 'sqlite')

	it('parses both tables with no warnings', function () {
		expect(result.warnings).toEqual([])
		expect(result.ir.dialect).toBe('sqlite')
		expect(result.ir.tables.map((t) => t.name)).toEqual(['account', 'membership'])
	})

	it('does not set a schema on sqlite tables', function () {
		const account = result.ir.tables.find((t) => t.name === 'account')!
		expect(account.schema).toBeUndefined()
	})

	it('captures composite primary keys preserving column order', function () {
		const membership = result.ir.tables.find((t) => t.name === 'membership')!
		expect(membership.primaryKey).toEqual(['account_id', 'user_id'])
	})

	it('captures table-level indexes (plain and unique) sorted by name', function () {
		const membership = result.ir.tables.find((t) => t.name === 'membership')!
		expect(membership.indexes).toEqual([
			{ name: 'membership_role_idx', columns: ['role'], unique: false },
			{ name: 'membership_user_unique', columns: ['user_id'], unique: true },
		])
	})
})

const COMPOSITE_FK = `
import { pgTable, integer, text, foreignKey } from 'drizzle-orm/pg-core'

export const parent = pgTable('parent', {
	a: integer('a').notNull(),
	b: integer('b').notNull(),
})

export const child = pgTable('child', {
	pa: integer('pa').notNull(),
	pb: integer('pb').notNull(),
}, (t) => ({
	fk: foreignKey({
		columns: [t.pa, t.pb],
		foreignColumns: [parent.a, parent.b],
	}).onDelete('restrict'),
}))
`

describe('parseDrizzleSchema (composite foreign key)', function () {
	const result = parseDrizzleSchema([{ path: 'schema.ts', text: COMPOSITE_FK }], 'postgres')

	it('resolves a composite foreignKey() with an onDelete action', function () {
		const child = result.ir.tables.find((t) => t.name === 'child')!
		expect(child.foreignKeys).toEqual([
			{
				columns: ['pa', 'pb'],
				refTable: 'parent',
				refColumns: ['a', 'b'],
				onDelete: 'restrict',
			},
		])
	})
})

const DIALECT_MISMATCH = `
import { sqliteTable, integer } from 'drizzle-orm/sqlite-core'

export const thing = sqliteTable('thing', {
	id: integer('id').primaryKey(),
})
`

describe('parseDrizzleSchema (dialect resolution)', function () {
	it('warns but proceeds when the builder dialect disagrees with the arg', function () {
		const result = parseDrizzleSchema([{ path: 'schema.ts', text: DIALECT_MISMATCH }], 'postgres')
		expect(result.ir.tables.map((t) => t.name)).toEqual(['thing'])
		expect(result.warnings.some((w) => w.includes('sqliteTable') && w.includes('sqlite'))).toBe(true)
	})
})

const UNRECOGNIZED = `
import { pgTable, integer, customVectorEmbedding } from 'drizzle-orm/pg-core'

export const widget = pgTable('widget', {
	id: integer('id').primaryKey(),
	payload: customVectorEmbedding('payload').$defaultFn(() => ({})),
})
`

describe('parseDrizzleSchema (conservative degradation)', function () {
	const result = parseDrizzleSchema([{ path: 'schema.ts', text: UNRECOGNIZED }], 'postgres')

	it('marks an unrecognized builder as unknown and warns', function () {
		const widget = result.ir.tables.find((t) => t.name === 'widget')!
		const payload = widget.columns.find((c) => c.name === 'payload')!
		expect(payload.type).toBe('unknown')
		expect(payload.rawType).toBe('customVectorEmbedding')
		expect(result.warnings.some((w) => w.includes('unrecognized builder'))).toBe(true)
	})

	it('marks a runtime $defaultFn default as unknown', function () {
		const widget = result.ir.tables.find((t) => t.name === 'widget')!
		const payload = widget.columns.find((c) => c.name === 'payload')!
		expect(payload.default).toBe('unknown')
	})

	it('still parses the rest of the table', function () {
		const widget = result.ir.tables.find((t) => t.name === 'widget')!
		expect(widget.primaryKey).toEqual(['id'])
		const id = widget.columns.find((c) => c.name === 'id')!
		expect(id.type).toBe('int')
	})
})

const PGVECTOR = `
import { pgTable, integer, vector } from 'drizzle-orm/pg-core'

export const messages = pgTable('messages', {
	id: integer('id').primaryKey(),
	embedding: vector('embedding', { dimensions: 1536 }),
})
`

describe('parseDrizzleSchema (pgvector)', function () {
	const result = parseDrizzleSchema([{ path: 'schema.ts', text: PGVECTOR }], 'postgres')

	it('recognizes the pgvector vector builder without warning', function () {
		const messages = result.ir.tables.find((t) => t.name === 'messages')!
		const embedding = messages.columns.find((c) => c.name === 'embedding')!
		expect(embedding.type).toBe('vector')
		expect(embedding.rawType).toBe('vector')
		expect(embedding.typeParams).toBe('1536')
		expect(result.warnings.some((w) => w.includes('unrecognized builder'))).toBe(false)
	})
})

describe('parseDrizzleSchema (known limitations)', function () {
	it('warns on re-export barrel files', function () {
		const result = parseDrizzleSchema(
			[{ path: 'index.ts', text: `export * from './user'\nexport * from './post'` }],
			'postgres'
		)
		expect(result.ir.tables).toEqual([])
		expect(result.warnings.some((w) => w.includes('re-export'))).toBe(true)
	})

	it('never throws on malformed input', function () {
		const result = parseDrizzleSchema(
			[{ path: 'broken.ts', text: 'export const x = pgTable(' }],
			'postgres'
		)
		expect(Array.isArray(result.ir.tables)).toBe(true)
	})
})
