const INTERNAL_TABLE_PATTERN = /^__drizzle/i

export function isInternalQueryTable(name: string): boolean {
	return INTERNAL_TABLE_PATTERN.test(name.trim())
}

export function pickDefaultQueryTable<T extends { name: string }>(
	tables: T[]
): T | undefined {
	if (tables.length === 0) return undefined

	const preferred = tables.find(function (table) {
		return !isInternalQueryTable(table.name)
	})

	return preferred ?? tables[0]
}

export function buildDefaultSqlQuery(tableName: string): string {
	return `SELECT * FROM ${tableName} LIMIT 100;`
}

export function buildDefaultDrizzleQuery(tableName: string): string {
	return `db.select().from(${tableName}).limit(100);`
}
