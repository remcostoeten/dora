import {
	MOCK_TABLE_DATA as SIDEBAR_MOCK_DATA,
	MOCK_TABLE_COLUMNS as SIDEBAR_MOCK_COLUMNS
} from '../sidebar/database-data'
import { ColumnDefinition, TableData } from './types'

export const TABLE_COLUMNS = SIDEBAR_MOCK_COLUMNS
export const TABLE_DATA = SIDEBAR_MOCK_DATA

// Function to get table data with sort, filter, and pagination
export async function getTableData(params: {
	tableId: string
	limit?: number
	offset?: number
	sort?: { column: string; direction: 'asc' | 'desc' }
	filters?: { column: string; operator: string; value: unknown }[]
}): Promise<TableData> {
	const { tableId, limit = 50, offset = 0, sort, filters } = params

	// Handle full tableId format (database.schema.table)
	// Fallback to simple tableId format for backward compatibility
	const lookupId = tableId.includes('.') ? tableId : tableId

	// Simulate network delay - slower for large tables
	const tableData = TABLE_DATA[lookupId]
	const rowCount = tableData ? tableData.length : 0
	const baseDelay = rowCount > 10000 ? 300 : 100
	await new Promise((resolve) => setTimeout(resolve, baseDelay + Math.random() * 200))

	const columns = TABLE_COLUMNS[lookupId] || []
	let rows = [...(TABLE_DATA[lookupId] || [])]

	// 1. Filter
	if (filters && filters.length > 0) {
		rows = rows.filter((row) => {
			return filters.every((filter) => {
				const cellValue = row[filter.column]
				const filterValue = filter.value

				switch (filter.operator) {
					case 'eq':
						return String(cellValue) === String(filterValue)
					case 'neq':
						return String(cellValue) !== String(filterValue)
					case 'gt':
						return (cellValue as number) > (filterValue as number)
					case 'gte':
						return (cellValue as number) >= (filterValue as number)
					case 'lt':
						return (cellValue as number) < (filterValue as number)
					case 'lte':
						return (cellValue as number) <= (filterValue as number)
					case 'ilike':
						return String(cellValue)
							.toLowerCase()
							.includes(String(filterValue).toLowerCase())
					case 'contains':
						return String(cellValue).includes(String(filterValue))
					default:
						return true
				}
			})
		})
	}

	// 2. Sort
	if (sort) {
		rows.sort((a, b) => {
			const valA = a[sort.column] as string | number
			const valB = b[sort.column] as string | number

			if (valA < valB) return sort.direction === 'asc' ? -1 : 1
			if (valA > valB) return sort.direction === 'asc' ? 1 : -1
			return 0
		})
	}

	const totalCount = rows.length
	const paginatedRows = rows.slice(offset, offset + limit)

	return {
		columns,
		rows: paginatedRows,
		totalCount,
		executionTime: Math.floor(baseDelay * 0.5 + Math.random() * 100)
	}
}

// Update a cell value in the mock database
export function updateCell(
	tableId: string,
	rowIndex: number,
	columnName: string,
	newValue: unknown
): boolean {
	const lookupId = tableId.includes('.') ? tableId : tableId
	const rows = TABLE_DATA[lookupId]
	if (!rows || rowIndex < 0 || rowIndex >= rows.length) {
		return false
	}

	rows[rowIndex][columnName] = newValue
	return true
}

// Delete a row from the mock database
export function deleteRow(tableId: string, rowIndex: number): boolean {
	const lookupId = tableId.includes('.') ? tableId : tableId
	const rows = TABLE_DATA[lookupId]
	if (!rows || rowIndex < 0 || rowIndex >= rows.length) {
		return false
	}

	rows.splice(rowIndex, 1)
	return true
}

// Get all available table IDs
export function getAvailableTableIds(): string[] {
	return Object.keys(TABLE_COLUMNS)
}
