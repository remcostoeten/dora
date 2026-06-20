/**
 * Wave D acceptance — exercises the cockpit's full data pipeline
 * (parse → introspect → diff → generate) against realistic Drizzle and Prisma
 * schemas with KNOWN drift vs a live database. This is the headless half of the
 * plan-07 acceptance (the GUI click-through with the native folder picker is the
 * human half). It mirrors exactly what `useOrmCockpit` does, minus React.
 */

import { describe, expect, it } from 'vitest'
import type { DatabaseSchema } from '@studio/lib/bindings'
import { fromLiveSchema } from '@studio/features/orm-cockpit/ir/from-live-schema'
import { parseDrizzleSchema } from '@studio/features/orm-cockpit/parsers/drizzle/parse-drizzle-schema'
import { parsePrismaSchema } from '@studio/features/orm-cockpit/parsers/prisma/parse-prisma-schema'
import { diffSchema } from '@studio/features/orm-cockpit/diff/diff-schema'
import { generateMigrationSql } from '@studio/features/orm-cockpit/migration/generate-sql'
import { buildPreviewSql } from '@studio/features/orm-cockpit/components/migration-sections'

// --- The live database: what's actually deployed. Drifted from both schemas:
//   * `users` is MISSING `is_admin` (the code adds it).
//   * `posts` has an EXTRA `legacy_views` column (the code drops it).
//   * there's an EXTRA `sessions` table the code no longer declares.
const LIVE: DatabaseSchema = {
	schemas: ['public'],
	unique_columns: [],
	tables: [
		{
			name: 'users',
			schema: 'public',
			primary_key_columns: ['id'],
			columns: [
				{ name: 'id', data_type: 'int4', is_nullable: false, default_value: null, is_primary_key: true, is_auto_increment: true, foreign_key: null },
				{ name: 'email', data_type: 'text', is_nullable: false, default_value: null, foreign_key: null },
				{ name: 'name', data_type: 'text', is_nullable: true, default_value: null, foreign_key: null },
				{ name: 'created_at', data_type: 'timestamp', is_nullable: false, default_value: 'now()', foreign_key: null },
			],
			indexes: [],
		},
		{
			name: 'posts',
			schema: 'public',
			primary_key_columns: ['id'],
			columns: [
				{ name: 'id', data_type: 'int4', is_nullable: false, default_value: null, is_primary_key: true, is_auto_increment: true, foreign_key: null },
				{ name: 'author_id', data_type: 'int4', is_nullable: false, default_value: null, foreign_key: { referenced_schema: 'public', referenced_table: 'users', referenced_column: 'id' } },
				{ name: 'title', data_type: 'text', is_nullable: false, default_value: null, foreign_key: null },
				{ name: 'body', data_type: 'text', is_nullable: true, default_value: null, foreign_key: null },
				{ name: 'published_at', data_type: 'timestamp', is_nullable: true, default_value: null, foreign_key: null },
				{ name: 'legacy_views', data_type: 'int4', is_nullable: true, default_value: '0', foreign_key: null },
			],
			indexes: [],
		},
		{
			name: 'sessions',
			schema: 'public',
			primary_key_columns: ['id'],
			columns: [
				{ name: 'id', data_type: 'uuid', is_nullable: false, default_value: null, is_primary_key: true, foreign_key: null },
				{ name: 'user_id', data_type: 'int4', is_nullable: false, default_value: null, foreign_key: { referenced_schema: 'public', referenced_table: 'users', referenced_column: 'id' } },
			],
			indexes: [],
		},
	],
}

const DRIZZLE_SCHEMA = `
import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  isAdmin: boolean('is_admin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  authorId: integer('author_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  body: text('body'),
  publishedAt: timestamp('published_at'),
})
`

const PRISMA_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String
  name      String?
  is_admin  Boolean  @default(false)
  created_at DateTime @default(now())
  posts     Post[]

  @@map("users")
}

model Post {
  id           Int      @id @default(autoincrement())
  author_id    Int
  title        String
  body         String?
  published_at DateTime?
  author       User     @relation(fields: [author_id], references: [id])

  @@map("posts")
}
`

describe('Wave D acceptance — real schema drift → migration', function () {
	const live = fromLiveSchema(LIVE, 'postgres')

	it('Drizzle project: detects drift with correct confidence + valid SQL', function () {
		const parsed = parseDrizzleSchema([{ path: 'schema.ts', text: DRIZZLE_SCHEMA }], 'postgres')
		expect(parsed.warnings).toEqual([])

		const diff = diffSchema(live, parsed.ir)
		expect(diff.hasChanges).toBe(true)

		const byName = new Map(diff.tables.map((t) => [t.name, t]))

		// users: code adds is_admin (NOT NULL + default → safe additive).
		const users = byName.get('users')
		expect(users?.kind).toBe('changed')
		const isAdmin = users?.columns.find((c) => c.name === 'is_admin')
		expect(isAdmin?.kind).toBe('added')
		expect(isAdmin?.confidence).toBe('safe')

		// posts: code drops legacy_views → destructive.
		const posts = byName.get('posts')
		const legacy = posts?.columns.find((c) => c.name === 'legacy_views')
		expect(legacy?.kind).toBe('removed')
		expect(legacy?.confidence).toBe('destructive')

		// sessions: present live, absent in code → destructive drop.
		const sessions = byName.get('sessions')
		expect(sessions?.kind).toBe('removed')
		expect(sessions?.confidence).toBe('destructive')

		const migration = generateMigrationSql(diff, 'postgres', { from: live, to: parsed.ir })

		// Default copy is safe: adds the column, never drops.
		const safe = buildPreviewSql(migration.up, { includeDestructive: false, includeReview: false })
		expect(safe).toContain('ADD COLUMN')
		expect(safe).toContain('is_admin')
		expect(safe).not.toContain('DROP COLUMN')
		expect(safe).not.toContain('DROP TABLE')

		// Destructive opt-in surfaces the drops.
		const danger = buildPreviewSql(migration.up, { includeDestructive: true, includeReview: false })
		expect(danger).toContain('DROP COLUMN')
		expect(danger).toContain('legacy_views')
		expect(danger).toContain('DROP TABLE')
		expect(danger).toContain('sessions')
	})

	it('Prisma project: same drift surfaces equivalently', function () {
		const parsed = parsePrismaSchema(PRISMA_SCHEMA)
		expect(parsed.warnings).toEqual([])

		const diff = diffSchema(live, parsed.ir)
		expect(diff.hasChanges).toBe(true)

		const byName = new Map(diff.tables.map((t) => [t.name, t]))
		expect(byName.get('users')?.columns.find((c) => c.name === 'is_admin')?.kind).toBe('added')
		expect(byName.get('posts')?.columns.find((c) => c.name === 'legacy_views')?.kind).toBe(
			'removed',
		)
		expect(byName.get('sessions')?.kind).toBe('removed')

		const migration = generateMigrationSql(diff, 'postgres', { from: live, to: parsed.ir })

		const safe = buildPreviewSql(migration.up, { includeDestructive: false, includeReview: false })
		expect(safe).toContain('is_admin')
		expect(safe).not.toContain('DROP TABLE')
		const danger = buildPreviewSql(migration.up, { includeDestructive: true, includeReview: false })
		expect(danger).toContain('DROP TABLE')
	})

	it('identical schema → in sync, no spurious diff', function () {
		// Build a live DB straight from the parsed Drizzle IR → zero drift.
		const parsed = parseDrizzleSchema([{ path: 'schema.ts', text: DRIZZLE_SCHEMA }], 'postgres')
		const diff = diffSchema(parsed.ir, parsed.ir)
		expect(diff.hasChanges).toBe(false)
		expect(diff.tables).toEqual([])
	})
})
