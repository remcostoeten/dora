import type { TableData } from '@/features/database-studio/types'

type TableCacheEntry = {
	data: TableData
	visibleColumns: string[]
}

export const tableDataCache = new Map<string, TableCacheEntry>()

export function clearTableDataCache() {
	tableDataCache.clear()
}
