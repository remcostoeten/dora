import { describe, expect, it } from 'vitest'
import type { ColumnIR, SchemaIR, TableIR } from '@studio/features/orm-cockpit/ir/types'
import { diffSchema } from '@studio/features/orm-cockpit/diff/diff-schema'
import { generateMigrationSql } from '@studio/features/orm-cockpit/migration/generate-sql'
import {
	buildMigrationPlan,
	statementMatchesRef,
	tableDiffLines
} from '@studio/features/orm-cockpit/components/migration-plan'

function col(name: string, type: ColumnIR['type'], nullable = false): ColumnIR {
	return { name, type, rawType: type, nullable, default: null, autoIncrement: false }
}

function table(name: string, columns: ColumnIR[], primaryKey: string[] = []): TableIR {
	return { name, columns, primaryKey, indexes: [], foreignKeys: [] }
}

function ir(tables: TableIR[]): SchemaIR {
	return { dialect: 'postgres', tables }
}

const live = ir([
	table('users', [col('id', 'int'), col('legacy', 'text', true)], ['id']),
	table('audit', [col('id', 'int')], ['id'])
])
const code = ir([
	table('users', [col('id', 'int'), col('nickname', 'text', true)], ['id']),
	table('posts', [col('id', 'int'), col('title', 'text')], ['id'])
])

function migration() {
	return generateMigrationSql(diffSchema(live, code), 'postgres', { from: live, to: code })
}

describe('migration statements', function () {
	it('tags every statement with its table and column target', function () {
		const statements = migration().statements
		const nickname = statements.find((s) => s.sql.includes('"nickname"'))
		expect(nickname).toMatchObject({ table: 'users', target: 'column:nickname' })
		const create = statements.find((s) => s.sql.startsWith('CREATE TABLE "posts"'))
		expect(create).toMatchObject({ table: 'posts', target: null, section: 'create' })
		const drop = statements.find((s) => s.sql.startsWith('DROP TABLE "audit"'))
		expect(drop).toMatchObject({ table: 'audit', section: 'destructive' })
	})
})

describe('buildMigrationPlan', function () {
	it('only emits statements for included tables and holds back data loss', function () {
		const plan = buildMigrationPlan(migration().statements, {
			included: new Set(['users', 'posts', 'audit']),
			includeDestructive: false,
			includeReview: false,
			wrapped: true
		})
		expect(plan.text.startsWith('BEGIN;')).toBe(true)
		expect(plan.text.trimEnd().endsWith('COMMIT;')).toBe(true)
		expect(plan.text).toContain('CREATE TABLE "posts"')
		expect(plan.text).toContain('"nickname"')
		expect(plan.text).not.toContain('DROP')
		expect(plan.heldBackDestructive).toBe(2)
	})

	it('includes destructive statements once allowed and drops excluded tables', function () {
		const plan = buildMigrationPlan(migration().statements, {
			included: new Set(['audit']),
			includeDestructive: true,
			includeReview: false,
			wrapped: true
		})
		expect(plan.text).toContain('DROP TABLE "audit"')
		expect(plan.text).not.toContain('posts')
		expect(plan.statements.every((s) => s.table === 'audit')).toBe(true)
	})

	it('returns an empty plan when nothing is included', function () {
		const plan = buildMigrationPlan(migration().statements, {
			included: new Set(),
			includeDestructive: true,
			includeReview: true,
			wrapped: true
		})
		expect(plan.blocks).toHaveLength(0)
		expect(plan.text).toBe('-- No changes selected.')
	})
})

describe('diff rows', function () {
	it('links changed-table lines to their column statements', function () {
		const diff = diffSchema(live, code)
		const users = diff.tables.find((t) => t.name === 'users')
		expect(users).toBeDefined()
		const lines = tableDiffLines(users!)
		const added = lines.find((l) => l.name === 'nickname')
		expect(added?.sign).toBe('+')
		const statement = migration().statements.find((s) => s.sql.includes('"nickname"'))
		expect(
			statementMatchesRef(statement!, { table: 'users', target: added?.target ?? null })
		).toBe(true)
	})
})
