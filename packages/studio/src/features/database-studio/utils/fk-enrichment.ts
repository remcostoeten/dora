import type { ColumnDefinition, ForeignKeyRef } from '../types'
import type { DatabaseSchema } from '@studio/lib/bindings'

export function enrichColumnsWithFKs(
	columns: ColumnDefinition[],
	schema: DatabaseSchema,
	tableName: string,
	schemaName?: string
): ColumnDefinition[] {
	const tableInfo = schema.tables.find(
		(t) => t.name === tableName && (!schemaName || t.schema === schemaName || t.schema === '')
	)
	if (!tableInfo) return columns

	const schemaColMap = new Map<string, (typeof tableInfo.columns)[number]>()
	for (const col of tableInfo.columns) {
		schemaColMap.set(col.name, col)
	}

	return columns.map((col) => {
		const schemaCol = schemaColMap.get(col.name)
		if (!schemaCol) return col

		const fk: ForeignKeyRef | undefined = schemaCol.foreign_key
			? {
					referencedTable: schemaCol.foreign_key.referenced_table,
					referencedColumn: schemaCol.foreign_key.referenced_column,
					referencedSchema: schemaCol.foreign_key.referenced_schema || undefined,
				}
			: col.foreignKey

		return {
			...col,
			type: col.type && col.type !== 'unknown' ? col.type : schemaCol.data_type,
			nullable:
				typeof schemaCol.is_nullable === 'boolean' ? schemaCol.is_nullable : col.nullable,
			primaryKey: schemaCol.is_primary_key ?? col.primaryKey,
			foreignKey: fk,
		}
	})
}
