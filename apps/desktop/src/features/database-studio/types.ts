export type ColumnDefinition = {
	name: string
	type: string
	nullable: boolean
	primaryKey: boolean
}

export type TableData = {
	columns: ColumnDefinition[]
	rows: Record<string, unknown>[]
	totalCount: number
	executionTime: number
}

export type SortDescriptor = {
	column: string
	direction: 'asc' | 'desc'
}

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'contains'

export type FilterDescriptor = {
	column: string
	operator: FilterOperator
	value: unknown
}

export type TableQueryParams = {
	tableId: string
	limit: number
	offset: number
	sort?: SortDescriptor
	filters?: FilterDescriptor[]
}

export type ViewMode = 'content' | 'structure'

export type PaginationState = {
	limit: number
	offset: number
} // Keeping for compat, though could be merged
