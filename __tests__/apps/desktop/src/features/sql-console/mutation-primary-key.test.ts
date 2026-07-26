import { describe, expect, it } from 'vitest'
import { resolveMutationPrimaryKey } from '@/features/sql-console/mutation-primary-key'
import type { TableInfo } from '@/features/sql-console/types'

function makeColumn(name: string, primaryKey: boolean) {
	return { name, type: 'integer', nullable: false, primaryKey }
}

function makeTable(
	name: string,
	columns: { name: string; primaryKey?: boolean }[],
	schema?: string
): TableInfo {
	return {
		name,
		schema,
		type: 'table',
		rowCount: 0,
		columns: columns.map(function (column) {
			return { name: column.name, type: 'integer', primaryKey: column.primaryKey ?? false }
		})
	}
}

describe('resolveMutationPrimaryKey', function () {
	it('uses a single declared primary key from the result column definitions', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'users',
			resultColumns: ['user_id', 'name'],
			columnDefinitions: [makeColumn('user_id', true), makeColumn('name', false)],
			schemaTables: []
		})
		expect(resolution).toEqual({ kind: 'ok', name: 'user_id' })
	})

	it('disables mutations when there is no source table', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: undefined,
			resultColumns: ['id'],
			columnDefinitions: [],
			schemaTables: []
		})
		expect(resolution.kind).toBe('disabled')
	})

	it('does NOT fall back to a column merely named "id"', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'staging_events',
			resultColumns: ['id', 'payload'],
			columnDefinitions: [makeColumn('id', false), makeColumn('payload', false)],
			schemaTables: [
				makeTable('staging_events', [{ name: 'id' }, { name: 'payload' }])
			]
		})
		expect(resolution.kind).toBe('disabled')
	})

	it('resolves the primary key from the schema when the result carries no PK metadata', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'users',
			resultColumns: ['id', 'name'],
			columnDefinitions: [makeColumn('id', false), makeColumn('name', false)],
			schemaTables: [makeTable('users', [{ name: 'id', primaryKey: true }, { name: 'name' }])]
		})
		expect(resolution).toEqual({ kind: 'ok', name: 'id' })
	})

	it('resolves a non-id primary key from the schema', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'users',
			resultColumns: ['user_uuid', 'name'],
			columnDefinitions: [],
			schemaTables: [
				makeTable('users', [{ name: 'user_uuid', primaryKey: true }, { name: 'name' }])
			]
		})
		expect(resolution).toEqual({ kind: 'ok', name: 'user_uuid' })
	})

	it('matches schema-qualified source tables against the schema list', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'public.users',
			resultColumns: ['id'],
			columnDefinitions: [],
			schemaTables: [makeTable('users', [{ name: 'id', primaryKey: true }], 'public')]
		})
		expect(resolution).toEqual({ kind: 'ok', name: 'id' })
	})

	it('does not match a table from a different schema', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'audit.users',
			resultColumns: ['id'],
			columnDefinitions: [],
			schemaTables: [makeTable('users', [{ name: 'id', primaryKey: true }], 'public')]
		})
		expect(resolution.kind).toBe('disabled')
	})

	it('disables mutations for composite primary keys declared in the result', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'memberships',
			resultColumns: ['user_id', 'team_id'],
			columnDefinitions: [makeColumn('user_id', true), makeColumn('team_id', true)],
			schemaTables: []
		})
		expect(resolution).toEqual({
			kind: 'disabled',
			reason: 'Composite primary keys are not yet supported for SQL result mutations.'
		})
	})

	it('disables mutations for composite primary keys declared in the schema', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'memberships',
			resultColumns: ['user_id', 'team_id'],
			columnDefinitions: [],
			schemaTables: [
				makeTable('memberships', [
					{ name: 'user_id', primaryKey: true },
					{ name: 'team_id', primaryKey: true }
				])
			]
		})
		expect(resolution).toEqual({
			kind: 'disabled',
			reason: 'Composite primary keys are not yet supported for SQL result mutations.'
		})
	})

	it('disables mutations when the primary key column is not in the result set', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'users',
			resultColumns: ['name', 'email'],
			columnDefinitions: [],
			schemaTables: [makeTable('users', [{ name: 'id', primaryKey: true }, { name: 'name' }])]
		})
		expect(resolution.kind).toBe('disabled')
		if (resolution.kind === 'disabled') {
			expect(resolution.reason).toContain('"id"')
		}
	})

	it('matches primary key names case-insensitively and returns the result spelling', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'Users',
			resultColumns: ['ID', 'Name'],
			columnDefinitions: [],
			schemaTables: [makeTable('users', [{ name: 'id', primaryKey: true }, { name: 'name' }])]
		})
		expect(resolution).toEqual({ kind: 'ok', name: 'ID' })
	})

	it('disables mutations when the table is unknown to the schema', function () {
		const resolution = resolveMutationPrimaryKey({
			sourceTable: 'mystery_table',
			resultColumns: ['id'],
			columnDefinitions: [],
			schemaTables: [makeTable('users', [{ name: 'id', primaryKey: true }])]
		})
		expect(resolution.kind).toBe('disabled')
	})
})
