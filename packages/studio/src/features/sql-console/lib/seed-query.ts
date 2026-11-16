import {
	buildDefaultDrizzleQuery,
	buildDefaultSqlQuery,
	pickDefaultQueryTable
} from '@studio/shared/utils/default-query-table'

type HistoryEntry = {
	query: string
	connectionId: string | null
	timestamp: number
}

type Args = {
	history: HistoryEntry[]
	connectionId: string
	tables: { name: string }[]
	selectedTableName?: string | null
}

type SeedQueries = {
	sql: string | null
	drizzle: string | null
}

// Drizzle runner queries always start from the `db` builder; everything else is SQL.
const DRIZZLE_QUERY_PATTERN = /^\s*(await\s+)?db\s*\./

function latestQuery(history: HistoryEntry[], connectionId: string, wantDrizzle: boolean) {
	let latest: HistoryEntry | null = null
	for (const entry of history) {
		if (entry.connectionId !== connectionId) continue
		if (!entry.query.trim()) continue
		if (DRIZZLE_QUERY_PATTERN.test(entry.query) !== wantDrizzle) continue
		if (!latest || entry.timestamp > latest.timestamp) latest = entry
	}
	return latest?.query ?? null
}

/**
 * @name isBlankEditorContent
 * @description Whether an editor holds nothing the user wrote: empty, or still the untouched placeholder.
 * @example
 * isBlankEditorContent(tab.sqlContent, DEFAULT_SQL)
 */
export function isBlankEditorContent(content: string, placeholder: string): boolean {
	const trimmed = content.trim()
	return trimmed === '' || trimmed === placeholder.trim()
}

/**
 * @name resolveSeedQueries
 * @description Picks what a blank console opens with: the connection's last run query, else a starter query for the selected table, else for the first table that is not migration bookkeeping.
 * @example
 * resolveSeedQueries({ history, connectionId, tables, selectedTableName: 'users' })
 */
export function resolveSeedQueries({
	history,
	connectionId,
	tables,
	selectedTableName
}: Args): SeedQueries {
	const selected = selectedTableName
		? tables.find(function (table) {
				return table.name === selectedTableName
			})
		: undefined
	const table = selected ?? pickDefaultQueryTable(tables)

	return {
		sql:
			latestQuery(history, connectionId, false) ??
			(table ? buildDefaultSqlQuery(table.name) : null),
		drizzle:
			latestQuery(history, connectionId, true) ??
			(table ? buildDefaultDrizzleQuery(table.name) : null)
	}
}
