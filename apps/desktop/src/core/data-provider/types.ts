import type { TableData, SortDescriptor, FilterDescriptor } from '@/features/database-studio/types'
import {
	ConnectionInfo,
	DatabaseSchema,
	MutationResult,
	QueryHistoryEntry,
	JsonValue,
	DatabaseInfo,
	SavedQuery
} from '@/lib/bindings'

export type AdapterResult<T> =
	| {
			ok: true
			data: T
	  }
	| {
			ok: false
			error: string
	  }

export type QueryResult = {
	rows: Record<string, unknown>[]
	columns: string[]
	rowCount: number
	executionTime?: number
	error?: string
}

export type DataAdapter = {
	getConnections(): Promise<AdapterResult<ConnectionInfo[]>>
	addConnection(
		name: string,
		databaseType: DatabaseInfo,
		sshConfig: JsonValue | null
	): Promise<AdapterResult<ConnectionInfo>>
	updateConnection(
		id: string,
		name: string,
		databaseType: DatabaseInfo,
		sshConfig: JsonValue | null
	): Promise<AdapterResult<ConnectionInfo>>
	removeConnection(id: string): Promise<AdapterResult<void>>

	connectToDatabase(connectionId: string): Promise<AdapterResult<boolean>>
	disconnectFromDatabase(connectionId: string): Promise<AdapterResult<void>>
	testConnection(connectionId: string): Promise<AdapterResult<boolean>>

	getSchema(connectionId: string): Promise<AdapterResult<DatabaseSchema>>

	fetchTableData(
		connectionId: string,
		tableName: string,
		page: number,
		pageSize: number,
		sort?: SortDescriptor,
		filters?: FilterDescriptor[]
	): Promise<AdapterResult<TableData>>

	executeQuery(connectionId: string, query: string): Promise<AdapterResult<QueryResult>>

	updateCell(
		connectionId: string,
		tableName: string,
		primaryKeyColumn: string,
		primaryKeyValue: JsonValue,
		columnName: string,
		newValue: JsonValue
	): Promise<AdapterResult<MutationResult>>

	deleteRows(
		connectionId: string,
		tableName: string,
		primaryKeyColumn: string,
		primaryKeyValues: JsonValue[]
	): Promise<AdapterResult<MutationResult>>

	insertRow(
		connectionId: string,
		tableName: string,
		rowData: Record<string, JsonValue>
	): Promise<AdapterResult<MutationResult>>

	getQueryHistory(
		connectionId: string,
		limit?: number
	): Promise<AdapterResult<QueryHistoryEntry[]>>

	// Schema Management
	getDatabaseDDL(connectionId: string): Promise<AdapterResult<string>>

	// Script/Snippet management
	getScripts(connectionId: string | null): Promise<AdapterResult<SavedQuery[]>>
	saveScript(
		name: string,
		content: string,
		connectionId: string | null,
		description?: string | null
	): Promise<AdapterResult<number>>
	updateScript(
		id: number,
		name: string,
		content: string,
		connectionId: string | null,
		description?: string | null
	): Promise<AdapterResult<void>>
	deleteScript(id: number): Promise<AdapterResult<void>>
}

export type DataProviderContextValue = {
	adapter: DataAdapter
	isTauri: boolean
	isReady: boolean
}
