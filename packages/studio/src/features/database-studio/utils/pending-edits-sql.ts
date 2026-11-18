import type { PendingEdit } from '@studio/core/pending-edits'
import {
	getColumnSqlIdentifier,
	getTableSqlIdentifier,
	type TableDialect
} from '@studio/shared/utils/table-ref'
import { toSqlLiteral } from './studio-data'

const TABLE_DIALECTS: readonly TableDialect[] = [
	'postgres',
	'cockroach',
	'mysql',
	'mariadb',
	'sqlite',
	'duckdb',
	'libsql',
	'd1',
	'posthog'
]

/**
 * @name toTableDialect
 * @description Narrows a connection type to a SQL dialect the identifier
 * quoting knows about. Returns undefined for any other source.
 *
 * @example
 * toTableDialect('mysql') // 'mysql'
 */
export function toTableDialect(connectionType: string | undefined): TableDialect | undefined {
	return TABLE_DIALECTS.find((dialect) => dialect === connectionType)
}

/**
 * @name buildPendingEditsSql
 * @description Renders staged edits as the UPDATE statements they are
 * equivalent to, one per edited row with its columns merged. This is a
 * preview: the edits are applied through bound parameters, not this text.
 *
 * @example
 * buildPendingEditsSql([edit], 'public.users', 'postgres')
 * // ['UPDATE "public"."users" SET "email" = \'a@b.c\' WHERE "id" = 7;']
 */
export function buildPendingEditsSql(
	edits: PendingEdit[],
	tableRef: string,
	dialect?: TableDialect
): string[] {
	const table = getTableSqlIdentifier(tableRef, dialect)
	const byRow = new Map<string, PendingEdit[]>()
	for (const edit of edits) {
		const rowKey = `${edit.primaryKeyColumn}:${String(edit.primaryKeyValue)}`
		byRow.set(rowKey, [...(byRow.get(rowKey) ?? []), edit])
	}

	return Array.from(byRow.values(), (rowEdits) => {
		const assignments = rowEdits
			.map((edit) => {
				const column = getColumnSqlIdentifier(edit.columnName, dialect)
				return `${column} = ${toSqlLiteral(edit.newValue)}`
			})
			.join(', ')
		const first = rowEdits[0]
		const primaryKey = getColumnSqlIdentifier(first.primaryKeyColumn, dialect)
		return `UPDATE ${table} SET ${assignments} WHERE ${primaryKey} = ${toSqlLiteral(first.primaryKeyValue)};`
	})
}
