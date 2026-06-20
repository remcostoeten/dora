import { describe, expect, it } from 'vitest'
import type {
	ColumnIR,
	Dialect,
	ForeignKeyIR,
	IndexIR,
	SchemaIR,
	TableIR,
} from '@studio/features/orm-cockpit/ir/types'
import { diffSchema } from '@studio/features/orm-cockpit/diff/diff-schema'
import { generateMigrationSql } from '@studio/features/orm-cockpit/migration/generate-sql'

type ColOpts = {
	rawType?: string
	nullable?: boolean
	default?: string | null
	autoIncrement?: boolean
}

function col(name: string, type: ColumnIR['type'], opts: ColOpts = {}): ColumnIR {
	return {
		name,
		type,
		rawType: opts.rawType ?? type,
		nullable: opts.nullable ?? false,
		default: opts.default ?? null,
		autoIncrement: opts.autoIncrement ?? false,
	}
}

function table(
	name: string,
	columns: ColumnIR[],
	opts: { primaryKey?: string[]; indexes?: IndexIR[]; foreignKeys?: ForeignKeyIR[] } = {},
): TableIR {
	return {
		name,
		columns: [...columns].sort((a, b) => a.name.localeCompare(b.name)),
		primaryKey: opts.primaryKey ?? [],
		indexes: opts.indexes ?? [],
		foreignKeys: opts.foreignKeys ?? [],
	}
}

function ir(dialect: Dialect, tables: TableIR[]): SchemaIR {
	return { dialect, tables: [...tables].sort((a, b) => a.name.localeCompare(b.name)) }
}

function migrate(dialect: Dialect, from: SchemaIR, to: SchemaIR) {
	return generateMigrationSql(diffSchema(from, to), dialect, { from, to })
}

describe('generateMigrationSql — CREATE TABLE', function () {
	it('emits postgres CREATE TABLE with SERIAL PK, NOT NULL, DEFAULT, and a unique index', function () {
		const from = ir('postgres', [])
		const to = ir('postgres', [
			table(
				'user',
				[
					col('id', 'int', { autoIncrement: true }),
					col('email', 'varchar', { nullable: false }),
					col('created_at', 'timestamptz', { nullable: false, default: 'now()' }),
				],
				{ primaryKey: ['id'], indexes: [{ name: 'user_email_idx', columns: ['email'], unique: true }] },
			),
		])
		const { up, down } = migrate('postgres', from, to)

		expect(up).toContain('CREATE TABLE "user" (')
		expect(up).toContain('"id" SERIAL PRIMARY KEY')
		expect(up).toContain('"email" VARCHAR NOT NULL')
		expect(up).toContain('"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
		expect(up).toContain('CREATE UNIQUE INDEX "user_email_idx" ON "user" ("email");')
		expect(up.startsWith('BEGIN;')).toBe(true)
		expect(up).toContain('COMMIT;')
		expect(down).toContain('DROP TABLE "user";')
	})

	it('inlines foreign keys for SQLite and uses INTEGER PRIMARY KEY AUTOINCREMENT', function () {
		const from = ir('sqlite', [])
		const to = ir('sqlite', [
			table('user', [col('id', 'int', { autoIncrement: true })], { primaryKey: ['id'] }),
			table(
				'post',
				[col('id', 'int', { autoIncrement: true }), col('author_id', 'int')],
				{
					primaryKey: ['id'],
					foreignKeys: [{ columns: ['author_id'], refTable: 'user', refColumns: ['id'] }],
				},
			),
		])
		const { up } = migrate('sqlite', from, to)

		expect(up).toContain('"id" INTEGER PRIMARY KEY AUTOINCREMENT')
		expect(up).toContain('FOREIGN KEY ("author_id") REFERENCES "user" ("id")')
		// SQLite is not wrapped in a transaction by us.
		expect(up.startsWith('BEGIN;')).toBe(false)
	})

	it('emits mysql AUTO_INCREMENT PK and VARCHAR(255), warning about non-transactional DDL', function () {
		const from = ir('mysql', [])
		const to = ir('mysql', [
			table('user', [col('id', 'bigint', { autoIncrement: true }), col('name', 'varchar')], {
				primaryKey: ['id'],
			}),
		])
		const { up, warnings } = migrate('mysql', from, to)

		expect(up).toContain('`id` BIGINT AUTO_INCREMENT PRIMARY KEY')
		expect(up).toContain('`name` VARCHAR(255) NOT NULL')
		expect(warnings.some((w) => /transactional DDL/.test(w))).toBe(true)
	})

	it('adds postgres foreign keys via ALTER after the creates', function () {
		const from = ir('postgres', [])
		const to = ir('postgres', [
			table('user', [col('id', 'int', { autoIncrement: true })], { primaryKey: ['id'] }),
			table('post', [col('id', 'int', { autoIncrement: true }), col('author_id', 'int')], {
				primaryKey: ['id'],
				foreignKeys: [{ columns: ['author_id'], refTable: 'user', refColumns: ['id'] }],
			}),
		])
		const { up } = migrate('postgres', from, to)
		expect(up).toContain(
			'ALTER TABLE "post" ADD CONSTRAINT "post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user" ("id");',
		)
		// FK comes after the CREATE TABLE statements.
		expect(up.indexOf('ADD CONSTRAINT')).toBeGreaterThan(up.indexOf('CREATE TABLE "post"'))
	})
})

describe('generateMigrationSql — ALTER', function () {
	const base = ir('postgres', [
		table('user', [col('id', 'int', { autoIncrement: true })], { primaryKey: ['id'] }),
	])

	it('adds a nullable column as an additive change', function () {
		const to = ir('postgres', [
			table('user', [col('id', 'int', { autoIncrement: true }), col('age', 'int', { nullable: true })], {
				primaryKey: ['id'],
			}),
		])
		const { up, down } = migrate('postgres', base, to)
		expect(up).toContain('ALTER TABLE "user" ADD COLUMN "age" INTEGER;')
		expect(up).not.toContain('DESTRUCTIVE')
		expect(down).toContain('ALTER TABLE "user" DROP COLUMN "age";')
	})

	it('flags an added NOT NULL column without default as destructive', function () {
		const to = ir('postgres', [
			table('user', [col('id', 'int', { autoIncrement: true }), col('age', 'int', { nullable: false })], {
				primaryKey: ['id'],
			}),
		])
		const { up } = migrate('postgres', base, to)
		expect(up).toContain('⚠ DESTRUCTIVE')
		expect(up).toContain('ALTER TABLE "user" ADD COLUMN "age" INTEGER NOT NULL;')
	})

	it('emits DROP COLUMN under the destructive banner with a lossy down caveat', function () {
		const from = ir('postgres', [
			table('user', [col('id', 'int', { autoIncrement: true }), col('nickname', 'text', { nullable: true })], {
				primaryKey: ['id'],
			}),
		])
		const { up, down } = migrate('postgres', from, base)
		expect(up).toContain('⚠ DESTRUCTIVE')
		expect(up).toContain('ALTER TABLE "user" DROP COLUMN "nickname";')
		expect(down).toContain('ALTER TABLE "user" ADD COLUMN "nickname" TEXT;')
		expect(down).toContain('cannot be restored')
	})

	it('comments out an uncertain (review) type change', function () {
		const from = ir('postgres', [
			table('m', [col('id', 'int', { autoIncrement: true }), col('data', 'unknown', { rawType: 'geometry' })], {
				primaryKey: ['id'],
			}),
		])
		const to = ir('postgres', [
			table('m', [col('id', 'int', { autoIncrement: true }), col('data', 'unknown', { rawType: 'geography' })], {
				primaryKey: ['id'],
			}),
		])
		const { up } = migrate('postgres', from, to)
		expect(up).toContain('-- REVIEW:')
		expect(up).toContain('-- ALTER TABLE "m" ALTER COLUMN "data" TYPE geography;')
	})

	it('treats a SQLite column change as review needing a table rebuild', function () {
		const from = ir('sqlite', [table('t', [col('n', 'int')], { primaryKey: [] })])
		const to = ir('sqlite', [table('t', [col('n', 'text')], { primaryKey: [] })])
		const { up, warnings } = migrate('sqlite', from, to)
		expect(up).toContain('-- REVIEW:')
		expect(warnings.some((w) => /table rebuild/.test(w))).toBe(true)
	})
})

describe('generateMigrationSql — DROP TABLE and no-op', function () {
	it('drops a removed table and recreates it (best-effort) in down', function () {
		const from = ir('postgres', [
			table('legacy', [col('id', 'int', { autoIncrement: true }), col('val', 'text', { nullable: true })], {
				primaryKey: ['id'],
			}),
		])
		const to = ir('postgres', [])
		const { up, down } = migrate('postgres', from, to)
		expect(up).toContain('⚠ DESTRUCTIVE')
		expect(up).toContain('DROP TABLE "legacy";')
		expect(down).toContain('CREATE TABLE "legacy"')
		expect(down).toContain('cannot be restored')
	})

	it('returns a no-op message when there are no changes', function () {
		const schema = ir('postgres', [
			table('user', [col('id', 'int', { autoIncrement: true })], { primaryKey: ['id'] }),
		])
		const { up, down, warnings } = migrate('postgres', schema, schema)
		expect(up).toBe('-- No changes.')
		expect(down).toBe('-- No reversible statements.')
		expect(warnings).toEqual([])
	})
})

describe('generateMigrationSql — index & FK changes on existing tables', function () {
	const from = ir('postgres', [
		table('user', [col('id', 'int', { autoIncrement: true }), col('email', 'varchar')], {
			primaryKey: ['id'],
		}),
	])

	it('creates an added index and drops it in down', function () {
		const to = ir('postgres', [
			table('user', [col('id', 'int', { autoIncrement: true }), col('email', 'varchar')], {
				primaryKey: ['id'],
				indexes: [{ name: 'user_email_idx', columns: ['email'], unique: true }],
			}),
		])
		const { up, down } = migrate('postgres', from, to)
		expect(up).toContain('CREATE UNIQUE INDEX "user_email_idx" ON "user" ("email");')
		expect(down).toContain('DROP INDEX "user_email_idx";')
	})

	it('infers a primary key from autoIncrement when no schema context is given', function () {
		// Call the generator with only the diff (no context) to exercise degradation.
		const to = ir('postgres', [
			table('widget', [col('id', 'int', { autoIncrement: true }), col('label', 'text', { nullable: true })], {
				primaryKey: ['id'],
			}),
		])
		const result = generateMigrationSql(diffSchema(ir('postgres', []), to), 'postgres')
		expect(result.up).toContain('"id" SERIAL PRIMARY KEY')
		expect(result.warnings.some((w) => /inferred primary key/.test(w))).toBe(true)
	})
})
