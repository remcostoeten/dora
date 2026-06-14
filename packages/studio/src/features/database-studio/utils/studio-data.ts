import type { ColumnDefinition } from '../types'

export function createDefaultValues(columns: ColumnDefinition[]): Record<string, unknown> {
	const defaults: Record<string, unknown> = {}
	const now = new Date().toISOString()

	for (const col of columns) {
		if (col.primaryKey) continue

		const type = col.type.toLowerCase()
		const name = col.name.toLowerCase()
		if (type.includes('timestamp') || type.includes('datetime') || type.includes('date')) {
			defaults[col.name] = now
		} else if (name.includes('created') || name.includes('updated') || name === 'date') {
			defaults[col.name] = now
		} else {
			defaults[col.name] = col.nullable ? null : ''
		}
	}

	return defaults
}

export function normalizeValueForInsert(column: ColumnDefinition, value: unknown): unknown {
	const type = column.type.toLowerCase()
	const isIntegerType = type.includes('int') || type.includes('serial')
	const isFloatType =
		type.includes('float') ||
		type.includes('double') ||
		type.includes('decimal') ||
		type.includes('numeric')
	const isBooleanType = type.includes('bool')
	const isJsonType = type.includes('json')

	if (value === null || value === undefined) {
		return column.nullable ? null : value
	}

	if (typeof value === 'string') {
		const trimmed = value.trim()

		if (trimmed === '') {
			if (column.nullable) return null
			if (isIntegerType || isFloatType) return 0
			if (isBooleanType) return false
			return ''
		}

		if (isIntegerType) {
			const parsed = Number.parseInt(trimmed, 10)
			if (Number.isNaN(parsed)) return column.nullable ? null : 0
			// BIGINT values beyond JS's safe-integer range lose precision as a
			// number, so keep the literal string and let the database parse it
			// exactly. Every adapter accepts string-encoded numerics (Postgres
			// via `$1::text::<type>`, SQLite/libSQL via affinity, MySQL via
			// implicit coercion).
			if (!Number.isSafeInteger(parsed)) return trimmed
			return parsed
		}

		if (isFloatType) {
			const parsed = Number.parseFloat(trimmed)
			if (Number.isNaN(parsed)) return column.nullable ? null : 0
			// High-precision decimals exceed f64 (~15-17 significant digits);
			// keep the literal so the value is not silently rounded.
			const significantDigits = trimmed.replace(/[^0-9]/g, '').replace(/^0+/, '').length
			if (significantDigits > 15) return trimmed
			return parsed
		}

		if (isBooleanType) {
			const normalized = trimmed.toLowerCase()
			return (
				normalized === 'true' ||
				normalized === '1' ||
				normalized === 't' ||
				normalized === 'yes' ||
				normalized === 'on'
			)
		}

		if (isJsonType) {
			try {
				return JSON.parse(trimmed)
			} catch {
				return trimmed
			}
		}

		return value
	}

	return value
}

export function normalizeRowForInsert(
	rowData: Record<string, unknown>,
	columns: ColumnDefinition[]
): Record<string, unknown> {
	const byName = new Map(
		columns.map(function (column) {
			return [column.name, column] as const
		})
	)
	const normalized: Record<string, unknown> = {}

	for (const [key, value] of Object.entries(rowData)) {
		const column = byName.get(key)
		normalized[key] = column ? normalizeValueForInsert(column, value) : value
	}

	return normalized
}

export function rowsToCsv(rows: Record<string, unknown>[], columns?: string[]): string {
	if (rows.length === 0) return ''
	const headers = columns ?? Object.keys(rows[0])

	const csvRows = [
		headers.join(','),
		...rows.map(function (row) {
			return headers
				.map(function (header) {
					const value = row[header]
					if (value === null || value === undefined) return ''
					const stringValue = String(value)
					if (
						stringValue.includes(',') ||
						stringValue.includes('"') ||
						stringValue.includes('\n')
					) {
						return `"${stringValue.replace(/"/g, '""')}"`
					}
					return stringValue
				})
				.join(',')
		})
	]

	return csvRows.join('\n')
}

/** Renders a single value as a SQL literal for an INSERT statement. */
function toSqlLiteral(value: unknown): string {
	if (value === null || value === undefined) return 'NULL'
	if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
	if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
	if (typeof value === 'object') {
		return `'${JSON.stringify(value).replace(/'/g, "''")}'`
	}
	return `'${String(value).replace(/'/g, "''")}'`
}

/**
 * Builds `INSERT INTO` statements for the given rows. Used by the data-grid
 * export so the exported SQL reflects the rows actually fetched (i.e. after any
 * active filters and sort are applied).
 */
export function rowsToSqlInsert(
	rows: Record<string, unknown>[],
	tableName: string,
	columns?: string[]
): string {
	if (rows.length === 0) return ''
	const headers = columns ?? Object.keys(rows[0])
	const columnList = headers.map((header) => `"${header}"`).join(', ')

	return rows
		.map(function (row) {
			const values = headers.map((header) => toSqlLiteral(row[header])).join(', ')
			return `INSERT INTO "${tableName}" (${columnList}) VALUES (${values});`
		})
		.join('\n')
}
