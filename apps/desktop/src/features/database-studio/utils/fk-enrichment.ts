import type { ColumnDefinition, ForeignKeyRef } from '../types'
import type { DatabaseSchema } from '@/lib/bindings'

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

	const fkMap = new Map<string, ForeignKeyRef>()
	for (const col of tableInfo.columns) {
		if (col.foreign_key) {
			fkMap.set(col.name, {
				referencedTable: col.foreign_key.referenced_table,
				referencedColumn: col.foreign_key.referenced_column,
				referencedSchema: col.foreign_key.referenced_schema || undefined,
			})
		}
	}

	if (fkMap.size === 0) return columns

	return columns.map((col) => {
		const fk = fkMap.get(col.name)
		return fk ? { ...col, foreignKey: fk } : col
	})
}
