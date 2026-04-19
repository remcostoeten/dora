type TableCacheEntry = {
	data: unknown
	visibleColumns: string[]
}

export const tableDataCache = new Map<string, TableCacheEntry>()

export function clearTableDataCache() {
	tableDataCache.clear()
}
