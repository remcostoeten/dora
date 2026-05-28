import { getTableRefParts } from '@/shared/utils/table-ref'
import type { SortDescriptor, FilterDescriptor } from '../types'

export function buildTableCacheKey(
	connectionId: string | undefined,
	tableId: string | null,
	limit: number,
	offset: number,
	sort: SortDescriptor | undefined,
	filters: FilterDescriptor[]
) {
	return JSON.stringify({
		connectionId: connectionId || '',
		tableId: tableId || '',
		limit,
		offset,
		sort: sort || null,
		filters
	})
}

export function schemaHasTable(
	schema: { tables: Array<{ name: string; schema?: string | null }> },
	tableRef: string
) {
	const { tableName, schemaName } = getTableRefParts(tableRef)
	return schema.tables.some(function (table) {
		if (table.name !== tableName) return false
		if (!schemaName) return true
		return table.schema === schemaName
	})
}
