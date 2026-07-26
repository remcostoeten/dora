import type { ColumnDefinition } from '@studio/features/database-studio/types'
import type { TableInfo } from './types'

export type MutationPrimaryKeyResolution =
	| { kind: 'ok'; name: string }
	| { kind: 'disabled'; reason: string }

type ResolveArgs = {
	sourceTable: string | undefined
	resultColumns: string[]
	columnDefinitions?: ColumnDefinition[]
	schemaTables: TableInfo[]
}

const NO_SOURCE_TABLE_REASON =
	'This result set is not tied to a single source table, so edit/delete is disabled.'
const COMPOSITE_KEY_REASON =
	'Composite primary keys are not yet supported for SQL result mutations.'
const NO_PRIMARY_KEY_REASON =
	'No primary key was found for this result set, so edit/delete is disabled.'

/**
 * Resolves which column is safe to use as the `WHERE` key for editing or
 * deleting rows in a SQL-console result set. Only declared primary-key
 * metadata is trusted — from the result's own column definitions, or from the
 * loaded database schema for the query's source table. A column merely named
 * `id` is never assumed to be unique: on tables without a real primary key
 * that heuristic turns a single-cell edit into an update of every matching
 * row.
 */
export function resolveMutationPrimaryKey(args: ResolveArgs): MutationPrimaryKeyResolution {
	const { sourceTable, resultColumns, columnDefinitions, schemaTables } = args

	if (!sourceTable) {
		return { kind: 'disabled', reason: NO_SOURCE_TABLE_REASON }
	}

	const declaredKeys = (columnDefinitions ?? []).filter(function (column) {
		return column.primaryKey
	})
	if (declaredKeys.length > 1) {
		return { kind: 'disabled', reason: COMPOSITE_KEY_REASON }
	}
	if (declaredKeys.length === 1) {
		return requireInResult(declaredKeys[0].name, resultColumns)
	}

	const table = findSchemaTable(sourceTable, schemaTables)
	if (!table) {
		return { kind: 'disabled', reason: NO_PRIMARY_KEY_REASON }
	}

	const schemaKeys = (table.columns ?? []).filter(function (column) {
		return column.primaryKey
	})
	if (schemaKeys.length > 1) {
		return { kind: 'disabled', reason: COMPOSITE_KEY_REASON }
	}
	if (schemaKeys.length === 0) {
		return { kind: 'disabled', reason: NO_PRIMARY_KEY_REASON }
	}

	return requireInResult(schemaKeys[0].name, resultColumns)
}

function requireInResult(
	primaryKeyName: string,
	resultColumns: string[]
): MutationPrimaryKeyResolution {
	const match = resultColumns.find(function (column) {
		return column.toLowerCase() === primaryKeyName.toLowerCase()
	})
	if (!match) {
		return {
			kind: 'disabled',
			reason: `The primary key column "${primaryKeyName}" is not part of this result set, so edit/delete is disabled. Include it in the SELECT to enable mutations.`
		}
	}
	return { kind: 'ok', name: match }
}

function findSchemaTable(sourceTable: string, schemaTables: TableInfo[]): TableInfo | undefined {
	const separatorIndex = sourceTable.lastIndexOf('.')
	const schemaPart = separatorIndex === -1 ? undefined : sourceTable.slice(0, separatorIndex)
	const namePart = separatorIndex === -1 ? sourceTable : sourceTable.slice(separatorIndex + 1)

	return schemaTables.find(function (table) {
		if (table.name.toLowerCase() !== namePart.toLowerCase()) return false
		if (!schemaPart) return true
		return (table.schema ?? '').toLowerCase() === schemaPart.toLowerCase()
	})
}
