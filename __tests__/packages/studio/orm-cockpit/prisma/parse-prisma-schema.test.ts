import { describe, expect, it } from 'vitest'
import { parsePrismaSchema } from '@studio/features/orm-cockpit/parsers/prisma/parse-prisma-schema'

const SCHEMA = `
datasource db {
	provider = "postgresql"
	url      = env("DATABASE_URL")
}

generator client {
	provider = "prisma-client-js"
}

enum Role {
	USER
	ADMIN
}

model User {
	id        Int      @id @default(autoincrement())
	email     String   @unique @db.VarChar(255)
	fullName  String?  @map("full_name")
	role      Role     @default(USER)
	createdAt DateTime @default(now()) @map("created_at")
	bio       String?
	posts     Post[]

	@@map("users")
}

model Post {
	id       Int     @id @default(autoincrement())
	title    String
	authorId Int     @map("author_id")
	author   User    @relation(fields: [authorId], references: [id], onDelete: Cascade)

	@@index([authorId])
}

model PostTag {
	postId Int @map("post_id")
	tagId  Int @map("tag_id")

	@@id([postId, tagId])
	@@ignore
}

model Weird {
	id   Int   @id
	data Whatsit
}
`

describe('parsePrismaSchema', function () {
	const { ir, warnings } = parsePrismaSchema(SCHEMA)

	it('infers the dialect from the datasource provider', function () {
		expect(ir.dialect).toBe('postgres')
	})

	it('sorts tables by their DB name and uses @@map names', function () {
		// localeCompare ordering (matches the live mapper's byName sort).
		expect(ir.tables.map(function (t) { return t.name })).toEqual([
			'Post',
			'PostTag',
			'users',
			'Weird',
		])
	})

	it('maps scalar columns, honoring @map and @db native types', function () {
		const users = ir.tables.find(function (t) { return t.name === 'users' })!
		expect(users.schema).toBe('public')
		expect(users.columns.map(function (c) { return c.name })).toEqual([
			'bio',
			'created_at',
			'email',
			'full_name',
			'id',
			'role',
		])

		const id = users.columns.find(function (c) { return c.name === 'id' })!
		expect(id.type).toBe('int')
		expect(id.autoIncrement).toBe(true)
		expect(id.nullable).toBe(false)
		expect(id.default).toBe(null)

		const email = users.columns.find(function (c) { return c.name === 'email' })!
		expect(email.type).toBe('varchar')

		const created = users.columns.find(function (c) { return c.name === 'created_at' })!
		expect(created.type).toBe('timestamp')
		expect(created.default).toBe('now()')

		const fullName = users.columns.find(function (c) { return c.name === 'full_name' })!
		expect(fullName.nullable).toBe(true)
	})

	it('treats enum-typed fields as text and warns', function () {
		const users = ir.tables.find(function (t) { return t.name === 'users' })!
		const role = users.columns.find(function (c) { return c.name === 'role' })!
		expect(role.type).toBe('text')
		expect(role.default).toBe('USER')
		expect(warnings.some(function (w) {
			return w.includes('User.role') && w.includes('enum')
		})).toBe(true)
	})

	it('does not emit a column for relation/virtual fields', function () {
		const users = ir.tables.find(function (t) { return t.name === 'users' })!
		expect(users.columns.some(function (c) { return c.name === 'posts' })).toBe(false)
		const post = ir.tables.find(function (t) { return t.name === 'Post' })!
		expect(post.columns.some(function (c) { return c.name === 'author' })).toBe(false)
	})

	it('records a single-column @unique as a unique index', function () {
		const users = ir.tables.find(function (t) { return t.name === 'users' })!
		const idx = users.indexes.find(function (i) { return i.columns.join(',') === 'email' })!
		expect(idx).toBeTruthy()
		expect(idx.unique).toBe(true)
	})

	it('resolves a relation @relation into a foreign key with @map column names', function () {
		const post = ir.tables.find(function (t) { return t.name === 'Post' })!
		expect(post.foreignKeys).toHaveLength(1)
		const fk = post.foreignKeys[0]
		expect(fk.columns).toEqual(['author_id'])
		expect(fk.refTable).toBe('users')
		expect(fk.refColumns).toEqual(['id'])
		expect(fk.onDelete).toBe('Cascade')
	})

	it('records @@index referencing @map columns, preserving order', function () {
		const post = ir.tables.find(function (t) { return t.name === 'Post' })!
		const idx = post.indexes.find(function (i) { return !i.unique })!
		expect(idx.columns).toEqual(['author_id'])
	})

	it('builds a composite primary key from @@id, in order, using DB names', function () {
		const tag = ir.tables.find(function (t) { return t.name === 'PostTag' })!
		expect(tag.primaryKey).toEqual(['post_id', 'tag_id'])
	})

	it('warns on an unmodeled block attribute (@@ignore) without throwing', function () {
		expect(warnings.some(function (w) {
			return w.includes('PostTag') && w.includes('@@ignore')
		})).toBe(true)
	})

	it('maps an unrecognized field type to unknown and warns (conservative rule)', function () {
		const weird = ir.tables.find(function (t) { return t.name === 'Weird' })!
		const data = weird.columns.find(function (c) { return c.name === 'data' })!
		expect(data.type).toBe('unknown')
		expect(warnings.some(function (w) {
			return w.includes('Weird.data') && w.includes('unknown')
		})).toBe(true)
	})

	it('handles sqlite and mysql provider dialects', function () {
		const sqlite = parsePrismaSchema('datasource db {\n\tprovider = "sqlite"\n}\nmodel A {\n\tid Int @id\n}\n')
		expect(sqlite.ir.dialect).toBe('sqlite')
		const mysql = parsePrismaSchema('datasource db {\n\tprovider = "mysql"\n}\nmodel A {\n\tid Int @id\n\tname String\n}\n')
		expect(mysql.ir.dialect).toBe('mysql')
		const a = mysql.ir.tables[0]
		expect(a.columns.find(function (c) { return c.name === 'name' })!.type).toBe('varchar')
		// SQLite reports no schema.
		expect(sqlite.ir.tables[0].schema).toBeUndefined()
	})
})
