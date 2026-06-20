import { describe, expect, it } from 'vitest'
import type { DatabaseSchema, TableInfo } from '@studio/lib/bindings'
import { fromLiveSchema } from '@studio/features/orm-cockpit/ir/from-live-schema'
import { normalizeDbType } from '@studio/features/orm-cockpit/ir/normalize-type'

function schema(tables: TableInfo[]): DatabaseSchema {
	return { tables, schemas: [], unique_columns: [] }
}

describe('fromLiveSchema (postgres)', function () {
	const pg = schema([
		{
			name: 'post',
			schema: 'public',
			primary_key_columns: ['id'],
			columns: [
				// Deliberately out of alphabetical order to prove sorting.
				{
					name: 'author_id',
					data_type: 'integer',
					is_nullable: false,
					default_value: null,
					is_primary_key: false,
					is_auto_increment: false,
					foreign_key: {
						referenced_table: 'user',
						referenced_column: 'id',
						referenced_schema: 'public',
					},
				},
				{
					name: 'id',
					data_type: 'bigint',
					is_nullable: false,
					default_value: null,
					is_primary_key: true,
					is_auto_increment: true,
					foreign_key: null,
				},
				{
					name: 'created_at',
					data_type: 'timestamp with time zone',
					is_nullable: false,
					default_value: 'now()',
					is_primary_key: false,
					is_auto_increment: false,
					foreign_key: null,
				},
			],
			indexes: [
				{ name: 'post_pkey', column_names: ['id'], is_unique: true, is_primary: true },
				{
					name: 'post_author_idx',
					column_names: ['author_id'],
					is_unique: false,
					is_primary: false,
				},
			],
		},
		{
			name: 'user',
			schema: 'public',
			primary_key_columns: ['id'],
			columns: [
				{
					name: 'id',
					data_type: 'bigint',
					is_nullable: false,
					default_value: null,
					is_primary_key: true,
					is_auto_increment: true,
					foreign_key: null,
				},
			],
			indexes: [],
		},
	])

	const ir = fromLiveSchema(pg, 'postgres')

	it('sorts tables by name', function () {
		expect(ir.tables.map((t) => t.name)).toEqual(['post', 'user'])
	})

	it('sorts columns by name and normalizes types', function () {
		const post = ir.tables[0]
		expect(post.columns.map((c) => c.name)).toEqual(['author_id', 'created_at', 'id'])
		expect(post.columns.map((c) => c.type)).toEqual(['int', 'timestamptz', 'bigint'])
	})

	it('keeps the raw type alongside the normalized one', function () {
		const createdAt = ir.tables[0].columns.find((c) => c.name === 'created_at')
		expect(createdAt?.rawType).toBe('timestamp with time zone')
	})

	it('preserves primary-key order and the schema', function () {
		expect(ir.tables[0].primaryKey).toEqual(['id'])
		expect(ir.tables[0].schema).toBe('public')
	})

	it('drops the implicit primary-key index but keeps real ones', function () {
		expect(ir.tables[0].indexes.map((i) => i.name)).toEqual(['post_author_idx'])
	})

	it('folds per-column foreign keys into the IR', function () {
		expect(ir.tables[0].foreignKeys).toEqual([
			{ columns: ['author_id'], refTable: 'user', refColumns: ['id'] },
		])
	})

	it('carries through autoIncrement and nullability', function () {
		const id = ir.tables[0].columns.find((c) => c.name === 'id')
		expect(id?.autoIncrement).toBe(true)
		expect(id?.nullable).toBe(false)
	})
})

describe('fromLiveSchema (sqlite)', function () {
	const sqlite = schema([
		{
			name: 'todo',
			schema: '',
			primary_key_columns: [],
			columns: [
				{
					name: 'id',
					data_type: 'INTEGER',
					is_nullable: false,
					default_value: null,
					is_primary_key: true,
					is_auto_increment: true,
					foreign_key: null,
				},
				{
					name: 'title',
					data_type: 'TEXT',
					is_nullable: true,
					default_value: '   ',
					is_primary_key: false,
					is_auto_increment: false,
					foreign_key: null,
				},
			],
			indexes: [],
		},
	])

	const ir = fromLiveSchema(sqlite, 'sqlite')

	it('omits the schema field when the engine reports none', function () {
		expect(ir.tables[0].schema).toBeUndefined()
	})

	it('derives the primary key from per-column flags when the list is empty', function () {
		expect(ir.tables[0].primaryKey).toEqual(['id'])
	})

	it('collapses whitespace-only defaults to null', function () {
		const title = ir.tables[0].columns.find((c) => c.name === 'title')
		expect(title?.default).toBeNull()
	})
})

describe('fromLiveSchema (composite foreign key)', function () {
	const withComposite = schema([
		{
			name: 'membership',
			schema: 'public',
			primary_key_columns: ['org_id', 'user_id'],
			columns: [
				{
					name: 'user_id',
					data_type: 'bigint',
					is_nullable: false,
					default_value: null,
					is_primary_key: true,
					is_auto_increment: false,
					foreign_key: {
						referenced_table: 'account',
						referenced_column: 'user_id',
						referenced_schema: 'public',
					},
				},
				{
					name: 'org_id',
					data_type: 'bigint',
					is_nullable: false,
					default_value: null,
					is_primary_key: true,
					is_auto_increment: false,
					foreign_key: {
						referenced_table: 'account',
						referenced_column: 'org_id',
						referenced_schema: 'public',
					},
				},
			],
			indexes: [],
		},
	])

	it('groups multiple columns referencing the same table into one FK', function () {
		const ir = fromLiveSchema(withComposite, 'postgres')
		expect(ir.tables[0].foreignKeys).toEqual([
			{
				columns: ['user_id', 'org_id'],
				refTable: 'account',
				refColumns: ['user_id', 'org_id'],
			},
		])
	})

	it('preserves composite primary-key order', function () {
		const ir = fromLiveSchema(withComposite, 'postgres')
		expect(ir.tables[0].primaryKey).toEqual(['org_id', 'user_id'])
	})
})

describe('normalizeDbType', function () {
	it('maps the postgres vocabulary the live DB emits', function () {
		expect(normalizeDbType('bigserial', 'postgres')).toBe('bigint')
		expect(normalizeDbType('integer', 'postgres')).toBe('int')
		expect(normalizeDbType('smallint', 'postgres')).toBe('smallint')
		expect(normalizeDbType('character varying(255)', 'postgres')).toBe('varchar')
		expect(normalizeDbType('jsonb', 'postgres')).toBe('jsonb')
		expect(normalizeDbType('json', 'postgres')).toBe('json')
		expect(normalizeDbType('timestamptz', 'postgres')).toBe('timestamptz')
		expect(normalizeDbType('timestamp without time zone', 'postgres')).toBe('timestamp')
		expect(normalizeDbType('uuid', 'postgres')).toBe('uuid')
		expect(normalizeDbType('numeric(10,2)', 'postgres')).toBe('decimal')
		expect(normalizeDbType('double precision', 'postgres')).toBe('double')
		expect(normalizeDbType('bytea', 'postgres')).toBe('bytes')
	})

	it('maps the mysql vocabulary, including tinyint(1) as bool', function () {
		expect(normalizeDbType('tinyint(1)', 'mysql')).toBe('bool')
		expect(normalizeDbType('tinyint', 'mysql')).toBe('smallint')
		expect(normalizeDbType('bigint unsigned', 'mysql')).toBe('bigint')
		expect(normalizeDbType('varchar(191)', 'mysql')).toBe('varchar')
		expect(normalizeDbType('datetime', 'mysql')).toBe('timestamp')
		expect(normalizeDbType('json', 'mysql')).toBe('json')
		expect(normalizeDbType('longblob', 'mysql')).toBe('bytes')
	})

	it('maps loose sqlite affinities', function () {
		expect(normalizeDbType('INTEGER', 'sqlite')).toBe('int')
		expect(normalizeDbType('REAL', 'sqlite')).toBe('float')
		expect(normalizeDbType('TEXT', 'sqlite')).toBe('text')
		expect(normalizeDbType('BLOB', 'sqlite')).toBe('bytes')
	})

	it('falls back to unknown rather than guessing', function () {
		expect(normalizeDbType('geometry', 'postgres')).toBe('unknown')
		expect(normalizeDbType('', 'postgres')).toBe('unknown')
		expect(normalizeDbType('inet', 'postgres')).toBe('unknown')
	})
})
