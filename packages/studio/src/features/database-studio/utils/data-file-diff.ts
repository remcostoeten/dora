export const DATA_FILE_DIFF_ROW_LIMIT = 10_000

export type CommonDataFileColumn = {
	label: string
	olderName: string
	newerName: string
}

const PREFERRED_KEY_NAMES = ['user id', 'userid', 'user_id', 'username', 'id'] as const

const PREFERRED_DISPLAY_NAMES = [
	'username',
	'fullname',
	'full name',
	'name',
	'profile url'
] as const

function normalizeColumnName(name: string): string {
	return name.trim().toLowerCase()
}

function quoteIdentifier(identifier: string): string {
	return `"${identifier.split('"').join('""')}"`
}

export function buildDescribeDataFileQuery(viewName: string): string {
	return `DESCRIBE SELECT * FROM ${quoteIdentifier(viewName)}`
}

export function extractDescribedColumns(rows: Record<string, unknown>[]): string[] {
	return rows.flatMap((row) => {
		const value = row.column_name ?? row.columnName
		return typeof value === 'string' ? [value] : []
	})
}

export function findCommonDataFileColumns(
	olderColumns: string[],
	newerColumns: string[]
): CommonDataFileColumn[] {
	const newerByNormalizedName = new Map(
		newerColumns.map((name) => [normalizeColumnName(name), name])
	)

	return olderColumns.flatMap((olderName) => {
		const newerName = newerByNormalizedName.get(normalizeColumnName(olderName))
		return newerName ? [{ label: olderName, olderName, newerName }] : []
	})
}

export function findDefaultDataFileKeyIndex(columns: CommonDataFileColumn[]): number {
	for (const preferredName of PREFERRED_KEY_NAMES) {
		const index = columns.findIndex(
			(column) => normalizeColumnName(column.label) === preferredName
		)
		if (index >= 0) return index
	}

	return columns.length > 0 ? 0 : -1
}

export function buildMissingDataFileRowsQuery(
	olderViewName: string,
	newerViewName: string,
	keyColumn: CommonDataFileColumn
): string {
	const olderView = quoteIdentifier(olderViewName)
	const newerView = quoteIdentifier(newerViewName)
	const olderKey = quoteIdentifier(keyColumn.olderName)
	const newerKey = quoteIdentifier(keyColumn.newerName)

	return [
		`SELECT older.* FROM ${olderView} AS older`,
		`WHERE older.${olderKey} IS NOT NULL`,
		'AND NOT EXISTS (',
		`\tSELECT 1 FROM ${newerView} AS newer`,
		`\tWHERE lower(trim(CAST(newer.${newerKey} AS VARCHAR))) = lower(trim(CAST(older.${olderKey} AS VARCHAR)))`,
		')',
		`LIMIT ${DATA_FILE_DIFF_ROW_LIMIT}`
	].join('\n')
}

export function selectDataFileDiffDisplayColumns(
	columns: string[],
	keyColumnName: string
): string[] {
	const selected: string[] = []
	const columnsByNormalizedName = new Map(
		columns.map((name) => [normalizeColumnName(name), name])
	)

	function addColumn(name: string | undefined) {
		if (name && !selected.includes(name)) selected.push(name)
	}

	addColumn(columnsByNormalizedName.get(normalizeColumnName(keyColumnName)))
	for (const preferredName of PREFERRED_DISPLAY_NAMES) {
		addColumn(columnsByNormalizedName.get(preferredName))
	}
	for (const column of columns) {
		if (selected.length >= 5) break
		addColumn(column)
	}

	return selected
}

export function dataFileName(path: string): string {
	return path.split(/[\\/]/).pop() ?? path
}
