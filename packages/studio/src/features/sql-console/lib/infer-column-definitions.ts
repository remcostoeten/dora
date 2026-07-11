import type { ColumnDefinition } from '@studio/features/database-studio/types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/
const SAMPLE_ROWS = 50

function inferType(name: string, rows: Record<string, unknown>[]): string {
	for (const row of rows) {
		const value = row[name]
		if (value === null || value === undefined) continue
		if (typeof value === 'boolean') return 'boolean'
		if (typeof value === 'number') return 'numeric'
		if (typeof value === 'object') return 'json'
		if (typeof value === 'string' && ISO_DATE.test(value)) return 'timestamp'
		return 'text'
	}
	return 'text'
}

/**
 * Ad-hoc query results (HogQL, raw SQL over engines that return no metadata)
 * carry column names but no types, so the grid renders every cell as a flat
 * string. Sniff a type per column from the first rows so the type-aware cell
 * renderer can style dates, numbers, booleans and JSON.
 */
export function inferColumnDefinitions(
	columns: string[],
	rows: Record<string, unknown>[],
	known?: ColumnDefinition[]
): Map<string, ColumnDefinition> {
	const sample = rows.slice(0, SAMPLE_ROWS)

	return new Map(
		columns.map((name) => {
			const existing = known?.find((definition) => definition.name === name)
			if (existing) return [name, existing] as const

			return [
				name,
				{
					name,
					type: inferType(name, sample),
					nullable: true,
					primaryKey: false
				}
			] as const
		})
	)
}
