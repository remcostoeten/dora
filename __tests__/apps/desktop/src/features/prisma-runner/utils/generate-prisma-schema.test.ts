import { describe, expect, it } from 'vitest'
import type { DatabaseSchema } from '@studio/lib/bindings'
import { databaseSchemaToPrisma } from '@/features/prisma-runner/utils/generate-prisma-schema'

function schema(tables: DatabaseSchema['tables'], unique: string[] = []): DatabaseSchema {
	return { tables, schemas: [], unique_columns: unique }
}

describe('databaseSchemaToPrisma', function () {
	it('emits a datasource + generator header with the given provider', function () {
		const out = databaseSchemaToPrisma(schema([]), 'mysql')
		expect(out).toContain('datasource db {')
		expect(out).toContain('provider = "mysql"')
		expect(out).toContain('generator client {')
		expect(out).toContain('// No tables found')
	})

	it('renders a simple model with @id, autoincrement, and @@map', function () {
		const out = databaseSchemaToPrisma(
			schema([
				{
					name: 'tags',
					schema: 'public',
					columns: [
						{
							name: 'id',
							data_type: 'integer',
							is_nullable: false,
							default_value: null,
							is_primary_key: true,
							is_auto_increment: true
						},
						{ name: 'name', data_type: 'text', is_nullable: false, default_value: null }
					]
				}
			])
		)
		expect(out).toContain(
			'model Tag {\n  id Int  @id @default(autoincrement())\n  name String\n\n  @@map("tags")\n}'
		)
	})

	it('marks nullable columns, defaults, and unique columns', function () {
		const out = databaseSchemaToPrisma(
			schema([
				{
					name: 'user',
					schema: 'public',
					columns: [
						{
							name: 'id',
							data_type: 'serial',
							is_nullable: false,
							default_value: null,
							is_primary_key: true,
							is_auto_increment: true
						},
						{ name: 'email', data_type: 'varchar', is_nullable: false, default_value: null },
						{
							name: 'role',
							data_type: 'varchar',
							is_nullable: true,
							default_value: "'member'"
						}
					],
					indexes: [
						{ name: 'user_email_key', column_names: ['email'], is_unique: true, is_primary: false }
					]
				}
			])
		)
		expect(out).toContain('email String  @unique')
		expect(out).toContain('role String?  @default("member")')
		// model is PascalCased to User, so the lowercase table is preserved via @@map
		expect(out).toContain('model User {')
		expect(out).toContain('@@map("user")')
	})

	it('emits relation fields for foreign keys', function () {
		const out = databaseSchemaToPrisma(
			schema([
				{
					name: 'posts',
					schema: 'public',
					columns: [
						{
							name: 'id',
							data_type: 'int',
							is_nullable: false,
							default_value: null,
							is_primary_key: true,
							is_auto_increment: true
						},
						{
							name: 'user_id',
							data_type: 'int',
							is_nullable: false,
							default_value: null,
							foreign_key: {
								referenced_table: 'users',
								referenced_column: 'id',
								referenced_schema: 'public'
							}
						}
					]
				}
			])
		)
		expect(out).toContain('user_id Int')
		expect(out).toContain('user User @relation(fields: [user_id], references: [id])')
	})

	it('emits @@id for composite primary keys', function () {
		const out = databaseSchemaToPrisma(
			schema([
				{
					name: 'post_tags',
					schema: 'public',
					columns: [
						{ name: 'post_id', data_type: 'int', is_nullable: false, default_value: null },
						{ name: 'tag_id', data_type: 'int', is_nullable: false, default_value: null }
					],
					primary_key_columns: ['post_id', 'tag_id']
				}
			])
		)
		expect(out).toContain('@@id([post_id, tag_id])')
		expect(out).not.toContain('post_id Int  @id')
	})

	it('maps common SQL types to Prisma scalars', function () {
		const out = databaseSchemaToPrisma(
			schema([
				{
					name: 'samples',
					schema: 'public',
					columns: [
						{ name: 'a', data_type: 'bigint', is_nullable: false, default_value: null },
						{ name: 'b', data_type: 'boolean', is_nullable: false, default_value: null },
						{ name: 'c', data_type: 'timestamp', is_nullable: false, default_value: null },
						{ name: 'd', data_type: 'numeric', is_nullable: false, default_value: null },
						{ name: 'e', data_type: 'jsonb', is_nullable: false, default_value: null }
					]
				}
			])
		)
		expect(out).toContain('a BigInt')
		expect(out).toContain('b Boolean')
		expect(out).toContain('c DateTime')
		expect(out).toContain('d Decimal')
		expect(out).toContain('e Json')
	})
})
