import { describe, it, expect } from 'vitest'
import { enrichColumnsWithFKs } from '@/features/database-studio/utils/fk-enrichment'
import type { ColumnDefinition } from '@/features/database-studio/types'

// Minimal DatabaseSchema shape for testing
const schema = {
	tables: [{
		name: 'orders',
		schema: 'public',
		columns: [
			{ name: 'id', data_type: 'int4', is_nullable: false, is_primary_key: true, is_auto_increment: false, default_value: null, foreign_key: null },
			{ name: 'user_id', data_type: 'int4', is_nullable: false, is_primary_key: false, is_auto_increment: false, default_value: null,
				foreign_key: { referenced_table: 'users', referenced_column: 'id', referenced_schema: 'public' } },
		],
		primary_key_columns: ['id'],
		indexes: [],
		row_count_estimate: null,
	}],
	schemas: ['public'],
	unique_columns: [],
} as any

const columns: ColumnDefinition[] = [
	{ name: 'id', type: 'int4', nullable: false, primaryKey: true },
	{ name: 'user_id', type: 'int4', nullable: false, primaryKey: false },
]

describe('enrichColumnsWithFKs', () => {
	it('adds foreignKey to matching columns', () => {
		const result = enrichColumnsWithFKs(columns, schema, 'orders', 'public')
		expect(result[1].foreignKey).toEqual({
			referencedTable: 'users',
			referencedColumn: 'id',
			referencedSchema: 'public',
		})
	})

	it('leaves non-FK columns unchanged', () => {
		const result = enrichColumnsWithFKs(columns, schema, 'orders', 'public')
		expect(result[0].foreignKey).toBeUndefined()
	})

	it('returns original columns when table not in schema', () => {
		const result = enrichColumnsWithFKs(columns, schema, 'nonexistent', 'public')
		expect(result).toEqual(columns)
	})

	it('returns original columns when no FKs exist on table', () => {
		const noFkSchema = {
			tables: [{ name: 'users', schema: 'public', columns: [
				{ name: 'id', data_type: 'int4', is_nullable: false, is_primary_key: true, is_auto_increment: false, default_value: null, foreign_key: null },
			], primary_key_columns: ['id'], indexes: [], row_count_estimate: null }],
			schemas: ['public'], unique_columns: [],
		} as any
		const result = enrichColumnsWithFKs(
			[{ name: 'id', type: 'int4', nullable: false, primaryKey: true }],
			noFkSchema, 'users', 'public'
		)
		expect(result[0].foreignKey).toBeUndefined()
	})
})
