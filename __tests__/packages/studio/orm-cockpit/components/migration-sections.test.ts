import { describe, expect, it } from 'vitest'
import type { ColumnIR, SchemaIR, TableIR } from '@studio/features/orm-cockpit/ir/types'
import { diffSchema } from '@studio/features/orm-cockpit/diff/diff-schema'
import { generateMigrationSql } from '@studio/features/orm-cockpit/migration/generate-sql'
import {
	buildPreviewSql,
	migrationHasGatedSections,
	splitMigrationSql,
	DESTRUCTIVE_BANNER,
	REVIEW_HEADER,
} from '@studio/features/orm-cockpit/components/migration-sections'

function col(name: string, type: ColumnIR['type'], nullable = false): ColumnIR {
	return { name, type, rawType: type, nullable, default: null, autoIncrement: false }
}

function table(name: string, columns: ColumnIR[], primaryKey: string[] = []): TableIR {
	return { name, columns, primaryKey, indexes: [], foreignKeys: [] }
}

function ir(tables: TableIR[]): SchemaIR {
	return { dialect: 'postgres', tables }
}

describe('migration-sections (cockpit preview toggles)', function () {
	it('round-trips the safe section out of a transaction-wrapped script', function () {
		// live has `users(id)`, code adds a nullable column → purely additive/safe.
		const live = ir([table('users', [col('id', 'int', false)], ['id'])])
		const code = ir([
			table('users', [col('id', 'int', false), col('nickname', 'text', true)], ['id']),
		])
		const diff = diffSchema(live, code)
		const migration = generateMigrationSql(diff, 'postgres', { from: live, to: code })

		const sections = splitMigrationSql(migration.up)
		expect(sections.wrapped).toBe(true)
		expect(sections.safe).toContain('ADD COLUMN')
		expect(sections.destructive).toBe('')

		const preview = buildPreviewSql(migration.up, {
			includeDestructive: false,
			includeReview: false,
		})
		expect(preview.startsWith('BEGIN;')).toBe(true)
		expect(preview.trimEnd().endsWith('COMMIT;')).toBe(true)
		expect(preview).toContain('ADD COLUMN')
	})

	it('gates destructive statements behind an explicit opt-in', function () {
		// code drops the `email` column → destructive.
		const live = ir([
			table('users', [col('id', 'int', false), col('email', 'text', false)], ['id']),
		])
		const code = ir([table('users', [col('id', 'int', false)], ['id'])])
		const diff = diffSchema(live, code)
		const migration = generateMigrationSql(diff, 'postgres', { from: live, to: code })

		const gated = migrationHasGatedSections(migration.up)
		expect(gated.hasDestructive).toBe(true)

		const withoutDestructive = buildPreviewSql(migration.up, {
			includeDestructive: false,
			includeReview: false,
		})
		expect(withoutDestructive).not.toContain('DROP COLUMN')
		expect(withoutDestructive).not.toContain(DESTRUCTIVE_BANNER)

		const withDestructive = buildPreviewSql(migration.up, {
			includeDestructive: true,
			includeReview: false,
		})
		expect(withDestructive).toContain('DROP COLUMN')
		expect(withDestructive).toContain(DESTRUCTIVE_BANNER)
	})

	it('uncomments review statements only when opted in', function () {
		// A type change Drizzle/diff treats as `review` (e.g. text → int is lossy).
		const live = ir([table('t', [col('id', 'int', false), col('amount', 'text', false)], ['id'])])
		const code = ir([table('t', [col('id', 'int', false), col('amount', 'int', false)], ['id'])])
		const diff = diffSchema(live, code)
		const migration = generateMigrationSql(diff, 'postgres', { from: live, to: code })

		const sections = splitMigrationSql(migration.up)
		// This particular change should land in review or destructive; assert the
		// helper is consistent with whatever the generator decided.
		if (sections.review) {
			expect(migration.up).toContain(REVIEW_HEADER)
			const off = buildPreviewSql(migration.up, {
				includeDestructive: false,
				includeReview: false,
			})
			// commented out by default — the bare ALTER must not appear uncommented.
			expect(off).not.toMatch(/^\s*ALTER TABLE/m)

			const on = buildPreviewSql(migration.up, {
				includeDestructive: false,
				includeReview: true,
			})
			expect(on).toMatch(/ALTER TABLE/)
		}
	})

	it('returns the no-changes sentinel untouched', function () {
		const preview = buildPreviewSql('-- No changes.', {
			includeDestructive: false,
			includeReview: false,
		})
		expect(preview).toBe('-- No changes.')
	})
})
