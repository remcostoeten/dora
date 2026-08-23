// Types for the SQL Console feature
import type { ColumnDefinition } from '@studio/features/database-studio/types'
import type { ResultChartConfig } from '@studio/features/result-charts/types'
import type { QueryRowSource } from '@studio/core/data-provider/query-row-source'

export type SqlSnippet = {
	id: string
	name: string
	content: string
	createdAt: Date
	updatedAt: Date
	isFolder?: boolean
	parentId?: string | null
}

export type SqlQueryResult = {
	columns: string[]
	rows: Record<string, unknown>[]
	rowSource?: QueryRowSource
	rowCount: number
	executionTime: number
	error?: string
	affectedRows?: number
	queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER'
	columnDefinitions?: ColumnDefinition[]
	sourceTable?: string
	/** The exact SQL that produced this result, used to detect EXPLAIN plans. */
	executedQuery?: string
}

export type TableInfo = {
	name: string
	schema?: string
	type: 'table' | 'view'
	rowCount: number
	columns?: {
		name: string
		type: string
		nullable?: boolean
		primaryKey?: boolean
		defaultValue?: string
	}[]
}

export type ResultViewMode = 'table' | 'json' | 'chart'

export type ConsoleState = {
	snippets: SqlSnippet[]
	activeSnippetId: string | null
	currentQuery: string
	result: SqlQueryResult | null
	isExecuting: boolean
	viewMode: ResultViewMode
	chartConfig: ResultChartConfig | null
	showLeftSidebar: boolean
	showRightSidebar: boolean
}

export type QueryTab = {
	id: string
	title: string
	mode: 'sql' | 'drizzle' | 'prisma'
	sqlContent: string
	drizzleContent: string
	result: SqlQueryResult | null
	isExecuting: boolean
	isDirty: boolean
	viewMode: ResultViewMode
	chartConfig: ResultChartConfig | null
	historyEntryId: string | null
	connectionId: string | null
	createdAt: number
	lastExecutedAt: number | null
}
