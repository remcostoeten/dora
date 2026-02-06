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
	TableInfo,
	ColumnInfo,
	DatabaseInfo,
	SavedQuery
} from '@/lib/bindings'
import { MOCK_CONNECTIONS, MOCK_SCHEMAS, MOCK_TABLE_DATA, MOCK_SCRIPTS } from '../mock-data'
import type { DataAdapter, AdapterResult, QueryResult } from '../types'

type InMemoryStore = {
	tables: Record<string, Record<string, unknown>[]>
	nextId: Record<string, number>
	connections: ConnectionInfo[]
	scripts: SavedQuery[]
}

let store: InMemoryStore = {
	tables: {},
	nextId: {},
	connections: [],
	scripts: []
}

const STORAGE_KEY = 'dora_demo_store'

function loadFromStorage(): InMemoryStore | null {
	try {
		if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
			return null
		}
		const data = localStorage.getItem(STORAGE_KEY)
		return data ? JSON.parse(data) : null
	} catch {
		return null
	}
}

function saveToStorage() {
	try {
		if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
			return
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
	} catch { }
}

function initializeStore() {
	const saved = loadFromStorage()
	if (saved && saved.tables && Object.keys(saved.tables).length > 0) {
		store = saved
		return
	}

	store = { tables: {}, nextId: {}, connections: [], scripts: [] }

	Object.keys(MOCK_TABLE_DATA).forEach(function (key) {
		const data = MOCK_TABLE_DATA[key as keyof typeof MOCK_TABLE_DATA]
		store.tables[key] = JSON.parse(JSON.stringify(data))
		store.nextId[key] = data.length + 1
	})

	store.scripts = JSON.parse(JSON.stringify(MOCK_SCRIPTS))
	saveToStorage()
}

initializeStore()

function ok<T>(data: T): AdapterResult<T> {
	return { ok: true, data }
}

function err<T>(error: string): AdapterResult<T> {
	return { ok: false, error }
}

function delay(ms: number): Promise<void> {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms)
	})
}

function randomDelay(): Promise<void> {
	return delay(50 + Math.random() * 100)
}

export function createMockAdapter(): DataAdapter {
	return {
		async getConnections(): Promise<AdapterResult<ConnectionInfo[]>> {
			await randomDelay()
			// Use stored connections which might include added ones
			if (store.connections.length === 0 && MOCK_CONNECTIONS.length > 0) {
				store.connections = [...MOCK_CONNECTIONS]
			}
			return ok(store.connections)
		},

		async addConnection(
			name: string,
			databaseType: DatabaseInfo,
			sshConfig: JsonValue | null
		): Promise<AdapterResult<ConnectionInfo>> {
			await randomDelay()
			const newConn: ConnectionInfo = {
				id: 'mock-conn-' + Date.now(),
				name,
				database_type: databaseType,
				connected: false,
				last_connected_at: null,
				created_at: Date.now(),
				updated_at: Date.now(),
				pin_hash: null,
				favorite: false,
				color: null,
				sort_order: store.connections.length
			}
			store.connections.push(newConn)
			saveToStorage()
			return ok(newConn)
		},

		async updateConnection(
			id: string,
			name: string,
			databaseType: DatabaseInfo,
			sshConfig: JsonValue | null
		): Promise<AdapterResult<ConnectionInfo>> {
			await randomDelay()
			const idx = store.connections.findIndex(function (c) {
				return c.id === id
			})
			if (idx === -1) {
				return err('Connection not found')
			}
			const updated = {
				...store.connections[idx],
				name,
				database_type: databaseType,
				updated_at: Date.now()
			}
			store.connections[idx] = updated
			saveToStorage()
			return ok(updated)
		},

		async removeConnection(id: string): Promise<AdapterResult<void>> {
			await randomDelay()
			store.connections = store.connections.filter(function (c) {
				return c.id !== id
			})
			saveToStorage()
			return ok(undefined)
		},

		async connectToDatabase(connectionId: string): Promise<AdapterResult<boolean>> {
			await randomDelay()
			const conn = MOCK_CONNECTIONS.find(function (c) {
				return c.id === connectionId
			})
			if (!conn) {
				return err('Connection not found')
			}
			return ok(true)
		},

		async disconnectFromDatabase(connectionId: string): Promise<AdapterResult<void>> {
			await randomDelay()
			return ok(undefined)
		},

		async testConnection(connectionId: string): Promise<AdapterResult<boolean>> {
			await randomDelay()
			return ok(true)
		},

		async getSchema(connectionId: string): Promise<AdapterResult<DatabaseSchema>> {
			await randomDelay()
			const schema = MOCK_SCHEMAS[connectionId]
			if (!schema) {
				return err('Schema not found for connection')
			}
			return ok(schema)
		},

		async getDatabaseDDL(connectionId: string): Promise<AdapterResult<string>> {
			await randomDelay()
			return ok(`-- Mock DDL for connection ${connectionId}
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    content TEXT,
    user_id INTEGER REFERENCES users(id)
);`)
		},

		async fetchTableData(
			connectionId: string,
			tableName: string,
			page: number,
			pageSize: number,
			sort?: SortDescriptor,
			filters?: FilterDescriptor[]
		): Promise<AdapterResult<TableData>> {
			await randomDelay()

			const key = connectionId + ':' + tableName
			let rows = store.tables[key]

			if (!rows) {
				rows = MOCK_TABLE_DATA[key as keyof typeof MOCK_TABLE_DATA] || []
				store.tables[key] = JSON.parse(JSON.stringify(rows))
			}

			let filtered = rows.slice()

			if (filters && filters.length > 0) {
				filtered = filtered.filter(function (row) {
					return filters.every(function (f) {
						const val = row[f.column]
						const target = f.value

						switch (f.operator) {
							case 'eq':
								return val === target
							case 'neq':
								return val !== target
							case 'gt':
								return Number(val) > Number(target)
							case 'gte':
								return Number(val) >= Number(target)
							case 'lt':
								return Number(val) < Number(target)
							case 'lte':
								return Number(val) <= Number(target)
							case 'contains':
							case 'ilike':
								return String(val)
									.toLowerCase()
									.includes(String(target).toLowerCase())
							default:
								return true
						}
					})
				})
			}

			if (sort) {
				filtered.sort(function (a, b) {
					const aVal = a[sort.column]
					const bVal = b[sort.column]

					let cmp = 0
					if (typeof aVal === 'number' && typeof bVal === 'number') {
						cmp = aVal - bVal
					} else {
						cmp = String(aVal).localeCompare(String(bVal))
					}

					return sort.direction === 'desc' ? -cmp : cmp
				})
			}

			const start = page * pageSize
			const paged = filtered.slice(start, start + pageSize)

			const schema = MOCK_SCHEMAS[connectionId]
			const tableInfo = schema?.tables.find(function (t) {
				return t.name === tableName
			})

			const columns: ColumnDefinition[] = tableInfo
				? tableInfo.columns.map(function (c) {
					return {
						name: c.name,
						type: c.data_type,
						nullable: c.is_nullable,
						primaryKey: c.is_primary_key || false
					}
				})
				: Object.keys(paged[0] || {}).map(function (k) {
					return { name: k, type: 'unknown', nullable: true, primaryKey: k === 'id' }
				})

			return ok({
				columns,
				rows: paged,
				totalCount: filtered.length,
				executionTime: Math.floor(Math.random() * 50) + 10
			})
		},

		async executeQuery(
			connectionId: string,
			query: string
		): Promise<AdapterResult<QueryResult>> {
			const startTime = Date.now()
			await delay(100 + Math.random() * 200)

			const drizzleFromMatch = query.match(/\.from\(\s*(\w+)\s*\)/)
			const sqlFromMatch = query.match(/FROM\s+["']?(\w+)["']?/i)
			const tableName = drizzleFromMatch?.[1] || sqlFromMatch?.[1]

			if (!tableName) {
				if (!query.includes('db.') && !query.toUpperCase().includes('SELECT')) {
					return ok({
						rows: [],
						columns: [],
						rowCount: 0,
						executionTime: Date.now() - startTime,
						error: 'Invalid query syntax. Use Drizzle ORM or SQL syntax.'
					})
				}
				return ok({
					rows: [],
					columns: [],
					rowCount: 0,
					executionTime: Date.now() - startTime
				})
			}

			const key = connectionId + ':' + tableName
			let rows = store.tables[key] || []

			if (rows.length === 0) {
				const allKeys = Object.keys(store.tables)
				const matchingKey = allKeys.find(function (k) {
					return k.endsWith(':' + tableName)
				})
				if (matchingKey) {
					rows = store.tables[matchingKey]
				}
			}

			// Handle aggregate queries (COUNT, SUM, AVG, etc.)
			const countMatch = query.match(/SELECT\s+COUNT\s*\(\s*\*?\s*\)/i)
			if (countMatch) {
				return ok({
					rows: [{ count: rows.length }],
					columns: ['count'],
					rowCount: 1,
					executionTime: Date.now() - startTime
				})
			}

			// Parse LIMIT from SQL or Drizzle syntax
			const sqlLimitMatch = query.match(/LIMIT\s+(\d+)/i)
			const drizzleLimitMatch = query.match(/\.limit\(\s*(\d+)\s*\)/)
			const limit = sqlLimitMatch
				? parseInt(sqlLimitMatch[1], 10)
				: drizzleLimitMatch
					? parseInt(drizzleLimitMatch[1], 10)
					: 50

			// Parse OFFSET from SQL or Drizzle syntax
			const sqlOffsetMatch = query.match(/OFFSET\s+(\d+)/i)
			const drizzleOffsetMatch = query.match(/\.offset\(\s*(\d+)\s*\)/)
			const offset = sqlOffsetMatch
				? parseInt(sqlOffsetMatch[1], 10)
				: drizzleOffsetMatch
					? parseInt(drizzleOffsetMatch[1], 10)
					: 0

			const slicedRows = rows.slice(offset, offset + limit)
			const columns = Object.keys(slicedRows[0] || rows[0] || {})

			return ok({
				rows: slicedRows,
				columns: columns,
				rowCount: rows.length,
				executionTime: Date.now() - startTime
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
			await randomDelay()

			const key = connectionId + ':' + tableName
			const rows = store.tables[key]

			if (!rows) {
				return err('Table not found')
			}

			let updated = 0
			rows.forEach(function (row) {
				if (row[primaryKeyColumn] === primaryKeyValue) {
					row[columnName] = newValue
					updated++
				}
			})

			if (updated > 0) {
				saveToStorage()
			}

			return ok({
				success: updated > 0,
				affected_rows: updated,
				message: updated > 0 ? 'Cell updated' : 'No matching row found'
			})
		},

		async deleteRows(
			connectionId: string,
			tableName: string,
			primaryKeyColumn: string,
			primaryKeyValues: JsonValue[]
		): Promise<AdapterResult<MutationResult>> {
			await randomDelay()

			const key = connectionId + ':' + tableName
			const rows = store.tables[key]

			if (!rows) {
				return err('Table not found')
			}

			const before = rows.length
			store.tables[key] = rows.filter(function (row) {
				return !primaryKeyValues.includes(row[primaryKeyColumn] as JsonValue)
			})
			const deleted = before - store.tables[key].length

			if (deleted > 0) {
				saveToStorage()
			}

			return ok({
				success: deleted > 0,
				affected_rows: deleted,
				message: deleted + ' row(s) deleted'
			})
		},

		async insertRow(
			connectionId: string,
			tableName: string,
			rowData: Record<string, JsonValue>
		): Promise<AdapterResult<MutationResult>> {
			await randomDelay()

			const key = connectionId + ':' + tableName

			if (!store.tables[key]) {
				store.tables[key] = []
				store.nextId[key] = 1
			}

			const newRow = { ...rowData, id: store.nextId[key]++ }
			store.tables[key].push(newRow)
			saveToStorage()

			return ok({
				success: true,
				affected_rows: 1,
				message: 'Row inserted with id ' + newRow.id
			})
		},

		async getQueryHistory(
			connectionId: string,
			limit?: number
		): Promise<AdapterResult<QueryHistoryEntry[]>> {
			await randomDelay()

			const mockHistory: QueryHistoryEntry[] = [
				{
					id: 1,
					connection_id: connectionId,
					query_text: 'SELECT * FROM customers LIMIT 50',
					executed_at: Date.now() - 60000,
					duration_ms: 45,
					status: 'success',
					row_count: 50,
					error_message: null
				},
				{
					id: 2,
					connection_id: connectionId,
					query_text: "SELECT * FROM orders WHERE status = 'pending'",
					executed_at: Date.now() - 120000,
					duration_ms: 32,
					status: 'success',
					row_count: 15,
					error_message: null
				}
			]

			return ok(mockHistory.slice(0, limit || 10))
		},

		async getScripts(connectionId: string | null): Promise<AdapterResult<SavedQuery[]>> {
			await randomDelay()
			const filtered = connectionId
				? store.scripts.filter(function (s) {
					return s.connection_id === connectionId
				})
				: store.scripts
			return ok(filtered)
		},

		async saveScript(
			name: string,
			content: string,
			connectionId: string | null,
			description?: string | null,
			folderId?: number | null
		): Promise<AdapterResult<number>> {
			await randomDelay()
			const id = Math.max(...store.scripts.map((s) => s.id), 0) + 1
			const newScript: SavedQuery = {
				id,
				name,
				content: content,
				query_text: content,
				description: description || null,
				connection_id: connectionId,
				tags: null,
				category: null,
				created_at: Date.now(),
				updated_at: Date.now(),
				favorite: false,
				is_snippet: true,
				is_system: false,
				language: 'sql',
				folder_id: folderId ?? null
			}

			store.scripts.push(newScript)
			saveToStorage()
			return ok(id)
		},

		async updateScript(
			id: number,
			name: string,
			content: string,
			connectionId: string | null,
			description?: string | null,
			folderId?: number | null
		): Promise<AdapterResult<void>> {
			await randomDelay()
			const idx = store.scripts.findIndex(function (s) {
				return s.id === id
			})
			if (idx === -1) return err('Script not found')

			store.scripts[idx] = {
				...store.scripts[idx],
				name,
				query_text: content,
				description: description || store.scripts[idx].description,
				connection_id: connectionId,
				updated_at: Date.now(),
				folder_id: folderId ?? store.scripts[idx].folder_id
			}
			saveToStorage()
			return ok(undefined)
		},


		async deleteScript(id: number): Promise<AdapterResult<void>> {
			await randomDelay()
			store.scripts = store.scripts.filter(function (s) {
				return s.id !== id
			})
			saveToStorage()
			return ok(undefined)
		},

		// Snippet Folder Management
		async getSnippetFolders() {
			await randomDelay()
			return ok([])
		},

		async createSnippetFolder(name: string, parentId?: number | null) {
			await randomDelay()
			return ok(Math.floor(Math.random() * 1000))
		},

		async updateSnippetFolder(id: number, name: string) {
			await randomDelay()
			return ok(undefined)
		},

		async deleteSnippetFolder(id: number) {
			await randomDelay()
			return ok(undefined)
		}
	}
}


export function resetMockStore() {
	try {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(STORAGE_KEY)
		}
	} catch { }
	initializeStore()
}
