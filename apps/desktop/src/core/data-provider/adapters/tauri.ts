import type {
	TableData,
	SortDescriptor,
	FilterDescriptor,
	ColumnDefinition
} from '@/features/database-studio/types'
import type {
	ConnectionInfo,
	DatabaseSchema,
	MutationResult,
	QueryHistoryEntry,
	JsonValue,
	DatabaseInfo,
	SavedQuery
} from '@/lib/bindings'
import { commands } from '@/lib/bindings'
import type { DataAdapter, AdapterResult, QueryResult } from '../types'

function ok<T>(data: T): AdapterResult<T> {
	return { ok: true, data }
}

function err<T>(error: string): AdapterResult<T> {
	return { ok: false, error }
}

function formatError(error: unknown): string {
	if (typeof error === 'string') return error
	if (error instanceof Error) return error.message
	if (error && typeof error === 'object') {
		if ('message' in error && typeof (error as any).message === 'string') {
			return (error as any).message
		}
		return JSON.stringify(error)
	}
	return String(error)
}

export function createTauriAdapter(): DataAdapter {
	return {
		async getConnections(): Promise<AdapterResult<ConnectionInfo[]>> {
			const result = await commands.getConnections()
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async addConnection(
			name: string,
			databaseType: DatabaseInfo,
			sshConfig: JsonValue | null
		): Promise<AdapterResult<ConnectionInfo>> {
			const result = await commands.addConnection(name, databaseType, sshConfig)
			if (result.status === 'ok') {
				return ok(result.data)
			}
			return err(formatError(result.error))
		},

		async updateConnection(
			id: string,
			name: string,
			databaseType: DatabaseInfo,
			sshConfig: JsonValue | null
		): Promise<AdapterResult<ConnectionInfo>> {
			const result = await commands.updateConnection(id, name, databaseType, sshConfig)
			if (result.status === 'ok') {
				return ok(result.data)
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

		async connectToDatabase(connectionId: string): Promise<AdapterResult<boolean>> {
			const result = await commands.connectToDatabase(connectionId)
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
			const testResult = await commands.testConnection(conn.database_type)
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
			const sql = `DROP TABLE IF EXISTS "${tableName}"`
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
			filters?: FilterDescriptor[]
		): Promise<AdapterResult<TableData>> {
			const startTime = performance.now()
			let query = `SELECT * FROM "${tableName}"`

			if (filters && filters.length > 0) {
				const conditions = filters.map(function (f) {
					const sqlOp = operatorToSql(f.operator)
					const escapedValue = String(f.value).replace(/'/g, "''")
					if (f.operator === 'contains' || f.operator === 'ilike') {
						return `"${f.column}" ${sqlOp} '%${escapedValue}%'`
					}
					return `"${f.column}" ${sqlOp} '${escapedValue}'`
				})
				query += ' WHERE ' + conditions.join(' AND ')
			}

			if (sort) {
				query += ` ORDER BY "${sort.column}" ${sort.direction.toUpperCase()}`
			}

			query += ` LIMIT ${pageSize} OFFSET ${page * pageSize}`

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

			let pageInfo
			let attempts = 0
			const maxAttempts = 50

			while (attempts < maxAttempts) {
				// Poll for results
				const fetchResult = await commands.fetchQuery(queryId)
				if (fetchResult.status !== 'ok') {
					console.error(
						'[TauriAdapter] Failed to fetch query status for ID:',
						queryId,
						fetchResult
					)
					return err('Failed to fetch query results')
				}

				pageInfo = fetchResult.data

				if (pageInfo.status === 'Completed' || pageInfo.status === 'Error') {
					break
				}

				await delay(100)
				attempts++
			}

			if (!pageInfo) {
				return err('Query timed out')
			}

			if (pageInfo.status === 'Error') {
				console.error('[TauriAdapter] Query execution error:', pageInfo.error)
				return err(pageInfo.error || 'Query failed')
			}

			const columnsResult = await commands.getColumns(queryId)
			if (columnsResult.status !== 'ok' || !columnsResult.data) {
				console.error(
					'[TauriAdapter] Failed to get columns for query:',
					queryId,
					columnsResult
				)
				return err('Failed to get columns')
			}

			const columns = parseColumns(columnsResult.data)
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

			// Poll for query completion (same as fetchTableData)
			let pageInfo
			let attempts = 0
			const maxAttempts = 50

			while (attempts < maxAttempts) {
				const fetchResult = await commands.fetchQuery(queryId)
				if (fetchResult.status !== 'ok') {
					console.error('[TauriAdapter] Failed to fetch query status:', fetchResult)
					return err('Failed to fetch query results')
				}

				pageInfo = fetchResult.data

				if (pageInfo.status === 'Completed' || pageInfo.status === 'Error') {
					break
				}

				await delay(100)
				attempts++
			}

			if (!pageInfo) {
				return err('Query timed out')
			}

			if (pageInfo.status === 'Error') {
				console.error('[TauriAdapter] Query execution error:', pageInfo.error)
				return err(pageInfo.error || 'Query execution failed')
			}

			const columnsResult = await commands.getColumns(queryId)

			const rows = Array.isArray(pageInfo.first_page) ? pageInfo.first_page : []

			return ok({
				rows,
				columns: columnsResult.status === 'ok' ? (columnsResult.data ?? []) : [],
				rowCount: pageInfo.affected_rows ?? rows.length,
				executionTime: Math.round(performance.now() - startTime)
			})
		},

		async updateCell(
			connectionId: string,
			tableName: string,
			primaryKeyColumn: string,
			primaryKeyValue: JsonValue,
			columnName: string,
			newValue: JsonValue
		): Promise<AdapterResult<MutationResult>> {
			const result = await commands.updateCell(
				connectionId,
				tableName,
				null,
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
			const result = await commands.deleteRows(
				connectionId,
				tableName,
				null,
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
			const result = await commands.insertRow(connectionId, tableName, null, rowData)
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


function operatorToSql(op: string): string {
	const map: Record<string, string> = {
		eq: '=',
		neq: '!=',
		gt: '>',
		gte: '>=',
		lt: '<',
		lte: '<=',
		ilike: 'ILIKE',
		contains: 'LIKE'
	}
	return map[op] || '='
}

function delay(ms: number): Promise<void> {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms)
	})
}

function parseColumns(data: JsonValue): ColumnDefinition[] {
	if (!Array.isArray(data)) return []

	return data.map(function (col: any) {
		if (typeof col === 'string') {
			return { name: col, type: 'unknown', nullable: false, primaryKey: false }
		}
		return {
			name: col.name,
			type: col.data_type || col.type || 'unknown',
			nullable: col.is_nullable ?? col.nullable ?? false,
			primaryKey: col.is_primary_key ?? col.primary_key ?? false
		}
	})
}

function parseRows(data: JsonValue, columns: ColumnDefinition[]): Record<string, unknown>[] {
	if (!Array.isArray(data)) return []

	return data.map(function (row: any) {
		if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
			return row as Record<string, unknown>
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
