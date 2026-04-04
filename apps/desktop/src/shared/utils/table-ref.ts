type TableRefLike = {
	name: string
	schema?: string | null
}

export type TableRefParts = {
	schemaName: string | null
	tableName: string
}

export function getTableRefParts(value: string): TableRefParts {
	const separatorIndex = value.indexOf('.')
	if (separatorIndex === -1) {
		return {
			schemaName: null,
			tableName: value
		}
	}

	return {
		schemaName: value.slice(0, separatorIndex) || null,
		tableName: value.slice(separatorIndex + 1)
	}
}

export function getTableRefId(table: TableRefLike): string {
	if (table.schema) {
		return `${table.schema}.${table.name}`
	}

	return table.name
}

export function getTableSqlIdentifier(table: string | TableRefLike): string {
	const parts =
		typeof table === 'string'
			? getTableRefParts(table)
			: {
					schemaName: table.schema ?? null,
					tableName: table.name
				}

	if (parts.schemaName) {
		return `"${parts.schemaName}"."${parts.tableName}"`
	}

	return `"${parts.tableName}"`
}
