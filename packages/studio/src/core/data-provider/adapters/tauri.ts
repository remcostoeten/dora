import type {
	TableData,
	SortDescriptor,
	FilterDescriptor,
	FilterConjunction,
	FilterGroup,
	ColumnDefinition
} from '@studio/features/database-studio/types'
import { buildWhereClauseFrom } from '../filter-sql'
import type {
	ConnectionInfo,
	DatabaseSchema,
	MutationResult,
	QueryHistoryEntry,
	JsonValue,
	DatabaseInfo,
	SavedQuery
} from '@studio/lib/bindings'
import { commands } from '@studio/lib/bindings'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import { buildDropColumnSql, getTableRefParts, getTableSqlIdentifier, type TableDialect } from '@studio/shared/utils/table-ref'
import type { DataAdapter, AdapterResult, QueryResult } from '../types'

import { backendToFrontendConnection } from '@studio/features/connections/utils/mapping'
import type { Connection } from '@studio/features/connections/types'

function databaseInfoToDialect(databaseType: DatabaseInfo): TableDialect {
	if ('Postgres' in databaseType) return 'postgres'
	if ('CockroachDB' in databaseType) return 'cockroach'
	if ('MySQL' in databaseType) return 'mysql'
	if ('MariaDB' in databaseType) return 'mariadb'
	if ('DuckDB' in databaseType) return 'duckdb'
	if ('LibSQL' in databaseType) return 'libsql'
	return 'sqlite'
}

function createConnectionDialectResolver() {
	const dialectByConnectionId = new Map<string, TableDialect>()

	function rememberConnections(connections: ConnectionInfo[]) {
		for (const connection of connections) {
			dialectByConnectionId.set(connection.id, databaseInfoToDialect(connection.database_type))
		}
	}

	async function resolveConnectionDialect(connectionId: string): Promise<TableDialect | undefined> {
		const cached = dialectByConnectionId.get(connectionId)
		if (cached) return cached

		const result = await commands.getConnections()
		if (result.status !== 'ok') return undefined

		rememberConnections(result.data)
		return dialectByConnectionId.get(connectionId)
	}

	return {
		rememberConnections,
		resolveConnectionDialect
	}
}

function ok<T>(data: T): AdapterResult<T> {
	return { ok: true, data }
}

function err<T>(error: string): AdapterResult<T> {
	return { ok: false, error }
}

const formatError = formatBackendError

/**
 * How long to poll a backend query before giving up. The previous 5s (50 ×
 * 100ms) was too tight for cloud Postgres (Neon/Supabase) cold starts and large
 * tables, and the timeout fell through to a misleading "Failed to get columns".
 */
const QUERY_POLL_TIMEOUT_MS = 30_000
const QUERY_POLL_INTERVAL_MS = 100

type QueryPage = Extract<Awaited<ReturnType<typeof commands.fetchQuery>>, { status: 'ok' }>['data']

type QueryPollResult =
	| { kind: 'completed'; pageInfo: QueryPage }
	| { kind: 'error'; message: string }
	| { kind: 'timeout' }
	| { kind: 'fetch-failed' }

/**
 * Poll a started query to a terminal state. Distinguishes a real timeout (still
 * running) from completion and error, so callers never mistake "still running"
 * for "no columns".
 */
async function pollQueryToCompletion(queryId: number): Promise<QueryPollResult> {
	const deadline = performance.now() + QUERY_POLL_TIMEOUT_MS

	while (performance.now() < deadline) {
		const fetchResult = await commands.fetchQuery(queryId)
		if (fetchResult.status !== 'ok') {
			console.error('[TauriAdapter] Failed to fetch query status for ID:', queryId, fetchResult)
			return { kind: 'fetch-failed' }
		}
		const pageInfo = fetchResult.data
		if (pageInfo.status === 'Completed') {
			return { kind: 'completed', pageInfo }
		}
		if (pageInfo.status === 'Error') {
			return { kind: 'error', message: pageInfo.error || 'Query failed' }
		}
		await delay(QUERY_POLL_INTERVAL_MS)
	}
	return { kind: 'timeout' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

export function createTauriAdapter(): DataAdapter {
	const { rememberConnections, resolveConnectionDialect } = createConnectionDialectResolver()

	return {
		async getConnections(): Promise<AdapterResult<Connection[]>> {
			const result = await commands.getConnections()
			if (result.status === 'ok') {
				rememberConnections(result.data)
				return ok(result.data.map(backendToFrontendConnection))
			}
			return err(formatError(result.error))
		},

		async addConnection(
			name: string,
			databaseType: DatabaseInfo
		): Promise<AdapterResult<Connection>> {
			const result = await commands.addConnection(name, databaseType, null)
			if (result.status === 'ok') {
				return ok(backendToFrontendConnection(result.data))
			}
			return err(formatError(result.error))
		},

		async updateConnection(
			id: string,
			name: string,
			databaseType: DatabaseInfo
		): Promise<AdapterResult<Connection>> {
			const result = await commands.updateConnection(id, name, databaseType, null)
			if (result.status === 'ok') {
				return ok(backendToFrontendConnection(result.data))
			}
			return err(formatError(result.error))
		},

		async removeConnection(id: string): Promise<AdapterResult<void>> {
			const result = await commands.removeConnection(id)
			if (result.status === 'ok') {
				return ok(undefined)
			}
			return err(formatError(result.error))
		},

		async connectToDatabase(
			connectionId: string
		): Promise<AdapterResult<import('@studio/lib/bindings').DatabaseConnectResult>> {
			const result = await commands.connectToDatabase(connectionId)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async getDataFileSourceStatus(connectionId: string) {
			const result = await commands.getDataFileSourceStatus(connectionId)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async retryDataFileRegistration(connectionId: string) {
			const result = await commands.retryDataFileRegistration(connectionId)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async saveDataFileSessionAsDuckdb(
			connectionId: string,
			destinationPath: string,
			overwrite: boolean
		) {
			const result = await commands.saveDataFileSessionAsDuckdb(
				connectionId,
				destinationPath,
				overwrite
			)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async importFilesIntoDuckdb(connectionId: string, filePaths: string[]) {
			const result = await commands.importFilesIntoDuckdb(connectionId, filePaths)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async disconnectFromDatabase(connectionId: string): Promise<AdapterResult<void>> {
			const result = await commands.disconnectFromDatabase(connectionId)
			if (result.status === 'ok') {
				return ok(undefined)
			}
			return err(formatError(result.error))
		},

		async testConnection(connectionId: string): Promise<AdapterResult<boolean>> {
			const result = await commands.getConnections()
			if (result.status !== 'ok') {
				return err(formatError(result.error))
			}
			const conn = result.data.find(function (c) {
				return c.id === connectionId
			})
			if (!conn) {
				return err('Connection not found')
			}
			const testResult = await commands.testConnection(conn.database_type, conn.id)
			if (testResult.status === 'ok') {
				return ok(testResult.data)
			}
			return err(formatError(testResult.error))
		},

		async getSchema(connectionId: string): Promise<AdapterResult<DatabaseSchema>> {
			const result = await commands.getDatabaseSchema(connectionId)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async dropTable(connectionId: string, tableName: string): Promise<AdapterResult<void>> {
			const dialect = await resolveConnectionDialect(connectionId)
			const sql = `DROP TABLE IF EXISTS ${getTableSqlIdentifier(tableName, dialect)}`
			const result = await commands.executeBatch(connectionId, [sql])
			if (result.status === 'ok') {
				return ok(undefined)
			}
			return err(formatError(result.error))
		},

		async dropColumn(
			connectionId: string,
			tableName: string,
			columnName: string
		): Promise<AdapterResult<void>> {
			const dialect = await resolveConnectionDialect(connectionId)
			const sql = buildDropColumnSql(tableName, columnName, dialect)
			const result = await commands.executeBatch(connectionId, [sql])
			if (result.status === 'ok') {
				return ok(undefined)
			}
			return err(formatError(result.error))
		},

		async getDatabaseDDL(connectionId: string): Promise<AdapterResult<string>> {
			// Check connection first to get dialect
			const connResult = await commands.getConnections()
			if (connResult.status !== 'ok') {
				return err(formatError(connResult.error))
			}

			const conn = connResult.data.find(function (c) {
				return c.id === connectionId
			})
			if (!conn) {
				return err('Connection not found')
			}

			// Determine dialect from DatabaseInfo
			let dialect = 'postgresql'
			if ('SQLite' in conn.database_type) dialect = 'sqlite'
			if ('LibSQL' in conn.database_type) dialect = 'sqlite'

			const result = await commands.exportSchemaSql(connectionId, dialect)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async fetchTableData(
			connectionId: string,
			tableName: string,
			page: number,
			pageSize: number,
			sort?: SortDescriptor,
			filters?: FilterDescriptor[],
			conjunction?: FilterConjunction,
			filterGroup?: FilterGroup
		): Promise<AdapterResult<TableData>> {
			const startTime = performance.now()
			const dialect = await resolveConnectionDialect(connectionId)
			let query = `SELECT * FROM ${getTableSqlIdentifier(tableName, dialect)}`

			const whereClause = buildWhereClauseFrom(filterGroup, filters, conjunction)
			if (whereClause) {
				query += ' WHERE ' + whereClause
			}

			if (sort) {
				query += ` ORDER BY "${sort.column}" ${sort.direction.toUpperCase()}`
			}

			query += ` LIMIT ${pageSize}`
			// PostHog's HogQL Query API rejects OFFSET for personal API keys, so
			// posthog browsing is limited to the first page rather than paged offsets.
			if (dialect !== 'posthog' && page > 0) {
				query += ` OFFSET ${page * pageSize}`
			}

			const startResult = await commands.startQuery(connectionId, query)

			if (startResult.status !== 'ok') {
				console.error('[TauriAdapter] Query failed to start:', startResult.error)
				return err(formatError(startResult.error))
			}

			// The Rust command returns Vec<usize>, effectively [query_id]
			if (!startResult.data || startResult.data.length === 0) {
				console.error('[TauriAdapter] Unexpected empty data from start_query:', startResult)
				return err('Backend returned no query ID')
			}

			const queryId = startResult.data[0]

			const poll = await pollQueryToCompletion(queryId)
			if (poll.kind === 'fetch-failed') {
				return err('Failed to fetch query results')
			}
			if (poll.kind === 'timeout') {
				return err(
					`Query is still running after ${QUERY_POLL_TIMEOUT_MS / 1000}s. The database may be slow to respond (a serverless cold start, a large table, or a dropped connection). Try again or reconnect.`
				)
			}
			if (poll.kind === 'error') {
				console.error('[TauriAdapter] Query execution error:', poll.message)
				return err(poll.message)
			}

			const pageInfo = poll.pageInfo

			const columnsResult = await commands.getColumns(queryId)
			if (columnsResult.status !== 'ok') {
				console.error(
					'[TauriAdapter] getColumns failed for query:',
					queryId,
					columnsResult.error
				)
				return err(formatError(columnsResult.error) || 'Failed to get columns')
			}

			const columns = parseColumns(columnsResult.data ?? [])
			// pageInfo.first_page contains the rows for the first page
			const rows = parseRows(pageInfo.first_page, columns)

			return ok({
				columns,
				rows,
				totalCount: pageInfo.affected_rows ?? 0,
				executionTime: Math.round(performance.now() - startTime)
			})
		},

		async executeQuery(
			connectionId: string,
			query: string
		): Promise<AdapterResult<QueryResult>> {
			const startTime = performance.now()

			const startResult = await commands.startQuery(connectionId, query)

			if (startResult.status !== 'ok') {
				console.error('[TauriAdapter] Query failed to start:', startResult.error)
				return err(formatError(startResult.error) || 'Failed to start query')
			}

			if (!startResult.data || startResult.data.length === 0) {
				console.error('[TauriAdapter] No query ID returned:', startResult)
				return err('Backend returned no query ID')
			}

			const queryId = startResult.data[0]

			const poll = await pollQueryToCompletion(queryId)
			if (poll.kind === 'fetch-failed') {
				return err('Failed to fetch query results')
			}
			if (poll.kind === 'timeout') {
				return err(
					`Query is still running after ${QUERY_POLL_TIMEOUT_MS / 1000}s. The database may be slow to respond (a serverless cold start, a large result, or a dropped connection). Try again or reconnect.`
				)
			}
			if (poll.kind === 'error') {
				if (poll.message === 'Query cancelled') return err('Query cancelled')
				console.error('[TauriAdapter] Query execution error:', poll.message)
				return err(poll.message)
			}

			const pageInfo = poll.pageInfo

			const columnsResult = await commands.getColumns(queryId)
			const columnDefs =
				columnsResult.status === 'ok' ? parseColumns(columnsResult.data ?? []) : []
			const rows = parseRows(pageInfo.first_page, columnDefs)

			return ok({
				rows,
				columns: columnDefs.map(function (col) {
					return col.name
				}),
				columnDefinitions: columnDefs,
				rowCount: pageInfo.affected_rows ?? rows.length,
				executionTime: Math.round(performance.now() - startTime)
			})
		},

		async cancelActiveQuery(_connectionId: string): Promise<void> {
			await commands.cancelQuery()
		},

		async updateCell(
			connectionId: string,
			tableName: string,
			primaryKeyColumn: string,
			primaryKeyValue: JsonValue,
			columnName: string,
			newValue: JsonValue
		): Promise<AdapterResult<MutationResult>> {
			const tableRef = getTableRefParts(tableName)
			const result = await commands.updateCell(
				connectionId,
				tableRef.tableName,
				tableRef.schemaName,
				primaryKeyColumn,
				primaryKeyValue,
				columnName,
				newValue
			)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async deleteRows(
			connectionId: string,
			tableName: string,
			primaryKeyColumn: string,
			primaryKeyValues: JsonValue[]
		): Promise<AdapterResult<MutationResult>> {
			const tableRef = getTableRefParts(tableName)
			const result = await commands.deleteRows(
				connectionId,
				tableRef.tableName,
				tableRef.schemaName,
				primaryKeyColumn,
				primaryKeyValues
			)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async insertRow(
			connectionId: string,
			tableName: string,
			rowData: Record<string, JsonValue>
		): Promise<AdapterResult<MutationResult>> {
			const tableRef = getTableRefParts(tableName)
			const result = await commands.insertRow(
				connectionId,
				tableRef.tableName,
				tableRef.schemaName,
				rowData
			)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async getQueryHistory(
			connectionId: string,
			limit?: number
		): Promise<AdapterResult<QueryHistoryEntry[]>> {
			const result = await commands.getQueryHistory(connectionId, limit ?? null)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async getScripts(connectionId: string | null): Promise<AdapterResult<SavedQuery[]>> {
			const result = await commands.getScripts(connectionId)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async saveScript(
			name: string,
			content: string,
			connectionId: string | null,
			description?: string | null,
			folderId?: number | null
		): Promise<AdapterResult<number>> {
			const result = await commands.saveSnippet(
				name,
				content,
				null,
				null,
				null,
				connectionId,
				description ?? null,
				folderId ?? null
			)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async updateScript(
			id: number,
			name: string,
			content: string,
			connectionId: string | null,
			description?: string | null,
			folderId?: number | null
		): Promise<AdapterResult<void>> {
			const result = await commands.updateSnippet(
				id,
				name,
				content,
				null,
				null,
				null,
				description ?? null,
				folderId ?? null,
				connectionId
			)
			if (result.status === 'ok') {
				return ok(undefined)
			}
			return err(formatError(result.error))
		},

		async deleteScript(id: number): Promise<AdapterResult<void>> {
			const result = await commands.deleteScript(id)
			if (result.status === 'ok') {
				return ok(undefined)
			}
			return err(formatError(result.error))
		},

		// Snippet Folder Management
		async getSnippetFolders() {
			const result = await commands.getSnippetFolders()
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async createSnippetFolder(name: string, parentId?: number | null) {
			const result = await commands.createSnippetFolder(name, parentId ?? null, null)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async updateSnippetFolder(id: number, name: string) {
			const result = await commands.updateSnippetFolder(id, name, null)
			if (result.status === 'ok') {
				return ok(undefined)
			}
			return err(formatError(result.error))
		},

		async deleteSnippetFolder(id: number) {
			const result = await commands.deleteSnippetFolder(id)
			if (result.status === 'ok') {
				return ok(undefined)
			}
			return err(formatError(result.error))
		}
	}
}

function delay(ms: number): Promise<void> {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms)
	})
}

function parseColumns(data: JsonValue): ColumnDefinition[] {
	if (!Array.isArray(data)) return []

	return data.map(function (col: JsonValue) {
		if (typeof col === 'string') {
			return { name: col, type: 'unknown', nullable: false, primaryKey: false }
		}
		if (!isRecord(col)) {
			return { name: String(col), type: 'unknown', nullable: false, primaryKey: false }
		}
		let foreignKey: ColumnDefinition['foreignKey'] = undefined
		const fk = col.foreign_key
		if (isRecord(fk) && typeof fk.referenced_table === 'string') {
			foreignKey = {
				referencedTable: fk.referenced_table as string,
				referencedColumn: typeof fk.referenced_column === 'string' ? fk.referenced_column as string : '',
				referencedSchema: typeof fk.referenced_schema === 'string' && fk.referenced_schema
					? fk.referenced_schema as string
					: undefined,
			}
		}
		return {
			name: typeof col.name === 'string' ? col.name : 'unknown',
			type:
				typeof col.data_type === 'string'
					? col.data_type
					: typeof col.type === 'string'
						? col.type
						: 'unknown',
			nullable:
				typeof col.is_nullable === 'boolean'
					? col.is_nullable
					: typeof col.nullable === 'boolean'
						? col.nullable
						: false,
			primaryKey:
				typeof col.is_primary_key === 'boolean'
					? col.is_primary_key
					: typeof col.primary_key === 'boolean'
						? col.primary_key
						: false,
			foreignKey
		}
	})
}

function parseRows(data: JsonValue, columns: ColumnDefinition[]): Record<string, unknown>[] {
	if (!Array.isArray(data)) return []

	return data.map(function (row: JsonValue) {
		if (isRecord(row) && !Array.isArray(row)) {
			return row
		}
		if (Array.isArray(row)) {
			const obj: Record<string, unknown> = {}
			columns.forEach(function (col, i) {
				obj[col.name] = row[i] !== undefined ? row[i] : null
			})
			return obj
		}
		return {}
	})
}
