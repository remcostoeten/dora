import { invoke } from '@tauri-apps/api/core'
import type {
  ConnectionInfo,
  DatabaseInfo,
  Schema,
  QueryHistoryEntry,
  Script,
  StatementInfo,
  QueryId,
  QueryStatus,
  Page,
} from '@/types/database'

export async function testConnection(databaseInfo: DatabaseInfo): Promise<boolean> {
  return await invoke('test_connection', { databaseInfo })
}

export async function addConnection(
  name: string,
  databaseInfo: DatabaseInfo
): Promise<ConnectionInfo> {
  return await invoke('add_connection', { name, databaseInfo })
}

export async function connectToDatabase(connectionId: string): Promise<boolean> {
  return await invoke('connect_to_database', { connectionId })
}

export async function disconnectFromDatabase(connectionId: string): Promise<void> {
  return await invoke('disconnect_from_database', { connectionId })
}

export async function getConnections(): Promise<ConnectionInfo[]> {
  return await invoke('get_connections')
}

export async function removeConnection(connectionId: string): Promise<void> {
  return await invoke('remove_connection', { connectionId })
}

export async function updateConnection(
  connectionId: string,
  name: string,
  databaseInfo: DatabaseInfo
): Promise<ConnectionInfo> {
  return await invoke('update_connection', { connId: connectionId, name, databaseInfo })
}

export async function initializeConnections(): Promise<void> {
  return await invoke('initialize_connections')
}

export async function saveQueryToHistory(
  connectionId: string,
  query: string,
  durationMs?: number,
  status: string = 'success',
  rowCount: number = 0,
  errorMessage?: string
): Promise<void> {
  await invoke('save_query_to_history', {
    connectionId,
    query,
    durationMs,
    status,
    rowCount,
    errorMessage,
  })
}

export async function getQueryHistory(
  connectionId: string,
  limit?: number
): Promise<QueryHistoryEntry[]> {
  return await invoke('get_query_history', { connectionId, limit })
}

export async function getDatabaseSchema(connectionId: string): Promise<Schema> {
  return await invoke('get_database_schema', { connectionId })
}

export async function getSchema(connectionId: string): Promise<Schema> {
  return await invoke('get_database_schema', { connectionId })
}

export async function refreshSchema(connectionId: string): Promise<Schema> {
  return await invoke('get_database_schema', { connectionId })
}

export async function saveScript(
  name: string,
  content: string,
  connectionId?: string,
  description?: string
): Promise<number> {
  return await invoke('save_script', {
    name,
    content,
    connectionId: connectionId || null,
    description: description || null,
  })
}

export async function updateScript(
  id: number,
  name: string,
  content: string,
  connectionId?: string,
  description?: string
): Promise<void> {
  return await invoke('update_script', {
    id,
    name,
    content,
    connectionId: connectionId || null,
    description: description || null,
  })
}

export async function getScripts(connectionId?: string): Promise<Script[]> {
  return await invoke('get_scripts', { connectionId: connectionId || null })
}

export async function deleteScript(id: number): Promise<void> {
  await invoke('delete_script', { id })
}

export async function minimizeWindow(): Promise<void> {
  await invoke('minimize_window')
}

export async function maximizeWindow(): Promise<void> {
  await invoke('maximize_window')
}

export async function closeWindow(): Promise<void> {
  await invoke('close_window')
}

export async function saveSessionState(sessionData: string): Promise<void> {
  return await invoke('save_session_state', { sessionData })
}

export async function getSessionState(): Promise<string | null> {
  return await invoke('get_session_state')
}

export async function getSetting<T = string>(key: string): Promise<T | null> {
  const value = await invoke<string | null>('get_setting', { key })
  if (value === null) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return value as unknown as T
  }
}

export async function setSetting(key: string, value: any): Promise<void> {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
  return await invoke('set_setting', { key, value: stringValue })
}

export async function pickSqliteDbDialog(): Promise<string | null> {
  return await invoke('open_sqlite_db')
}

export async function saveSqliteDbDialog(): Promise<string | null> {
  return await invoke('save_sqlite_db')
}

export async function startQuery(connectionId: string, query: string): Promise<QueryId[]> {
  return await invoke('start_query', { connectionId, query })
}

export async function fetchQuery(queryId: QueryId): Promise<StatementInfo> {
  return await invoke('fetch_query', { queryId })
}

export async function fetchPage(queryId: QueryId, pageIndex: number): Promise<Page | null> {
  return await invoke('fetch_page', { queryId, pageIndex })
}

export async function getQueryStatus(queryId: QueryId): Promise<QueryStatus> {
  return await invoke('get_query_status', { queryId })
}

export async function getPageCount(queryId: QueryId): Promise<number> {
  return await invoke('get_page_count', { queryId })
}

export async function getColumns(queryId: QueryId): Promise<string[] | null> {
  return await invoke('get_columns', { queryId })
}

export async function executeQuery(
  connectionId: string,
  query: string
): Promise<StatementInfo[]> {
  const queryIds = await startQuery(connectionId, query)
  const results: StatementInfo[] = []

  for (const queryId of queryIds) {
    const result = await fetchQuery(queryId)
    results.push(result)
  }

  return results
}

export async function getConnectionHistory(
  dbTypeFilter?: string,
  successFilter?: boolean,
  limit?: number
): Promise<import('@/types/database').ConnectionHistoryEntry[]> {
  return await invoke('get_connection_history', {
    dbTypeFilter: dbTypeFilter || null,
    successFilter: successFilter ?? null,
    limit: limit || null,
  })
}

export async function populateTestQueries(): Promise<string> {
  return await invoke('populate_test_queries_command')
}

// =============================================================================
// Mutation API Commands
// =============================================================================
// These commands provide structured data manipulation for spreadsheet-style UIs

/** Export format options for table data */
export type ExportFormat = 'json' | 'sql_insert' | 'csv'

/** Result of a mutation operation */
export type MutationResult = {
  success: boolean
  affected_rows: number
  message: string | null
}

/**
 * Update a single cell value in a table
 * @param connectionId - UUID of the database connection
 * @param tableName - Name of the table to update
 * @param schemaName - Schema name (optional, for PostgreSQL)
 * @param primaryKeyColumn - Name of the primary key column
 * @param primaryKeyValue - Value of the primary key for the row to update
 * @param columnName - Name of the column to update
 * @param newValue - New value to set
 */
export async function updateCell(
  connectionId: string,
  tableName: string,
  schemaName: string | null,
  primaryKeyColumn: string,
  primaryKeyValue: unknown,
  columnName: string,
  newValue: unknown
): Promise<MutationResult> {
  return await invoke('update_cell', {
    connectionId,
    tableName,
    schemaName,
    primaryKeyColumn,
    primaryKeyValue,
    columnName,
    newValue,
  })
}

/**
 * Delete one or more rows from a table
 * @param connectionId - UUID of the database connection
 * @param tableName - Name of the table
 * @param schemaName - Schema name (optional, for PostgreSQL)
 * @param primaryKeyColumn - Name of the primary key column
 * @param primaryKeyValues - Array of primary key values for rows to delete
 */
export async function deleteRows(
  connectionId: string,
  tableName: string,
  schemaName: string | null,
  primaryKeyColumn: string,
  primaryKeyValues: unknown[]
): Promise<MutationResult> {
  return await invoke('delete_rows', {
    connectionId,
    tableName,
    schemaName,
    primaryKeyColumn,
    primaryKeyValues,
  })
}

/**
 * Export table data to a specific format
 * @param connectionId - UUID of the database connection
 * @param tableName - Name of the table to export
 * @param schemaName - Schema name (optional, for PostgreSQL)
 * @param format - Export format: 'json', 'sql_insert', or 'csv'
 * @param limit - Optional row limit
 */
export async function exportTable(
  connectionId: string,
  tableName: string,
  schemaName: string | null,
  format: ExportFormat,
  limit?: number
): Promise<string> {
  return await invoke('export_table', {
    connectionId,
    tableName,
    schemaName,
    format,
    limit: limit ?? null,
  })
}

// =============================================================================
// Database Metadata Types & Commands
// =============================================================================

/** Database-level metadata information */
export type DatabaseMetadata = {
  size_bytes: number
  created_at: number | null
  last_updated: number | null
  row_count_total: number
  table_count: number
  host: string
  database_name: string | null
}

/**
 * Get database-level metadata (size, row counts, dates, etc.)
 * @param connectionId - UUID of the database connection
 */
export async function getDatabaseMetadata(connectionId: string): Promise<DatabaseMetadata> {
  return await invoke('get_database_metadata', { connectionId })
}

// =============================================================================
// Soft Delete Types & Commands
// =============================================================================

/** Result of a soft delete operation */
export type SoftDeleteResult = {
  success: boolean
  affected_rows: number
  message: string | null
  deleted_at: number
  undo_window_seconds: number
}

/**
 * Soft delete rows (set deleted_at timestamp instead of hard delete)
 * @param connectionId - UUID of the database connection
 * @param tableName - Name of the table
 * @param schemaName - Schema name (optional)
 * @param primaryKeyColumn - Name of the primary key column
 * @param primaryKeyValues - Array of primary key values for rows to soft delete
 * @param softDeleteColumn - Name of the soft delete column (auto-detected if not provided)
 */
export async function softDeleteRows(
  connectionId: string,
  tableName: string,
  schemaName: string | null,
  primaryKeyColumn: string,
  primaryKeyValues: unknown[],
  softDeleteColumn?: string
): Promise<SoftDeleteResult> {
  return await invoke('soft_delete_rows', {
    connectionId,
    tableName,
    schemaName,
    primaryKeyColumn,
    primaryKeyValues,
    softDeleteColumn: softDeleteColumn ?? null,
  })
}

/**
 * Undo a soft delete (restore rows)
 * @param connectionId - UUID of the database connection
 * @param tableName - Name of the table
 * @param schemaName - Schema name (optional)
 * @param primaryKeyColumn - Name of the primary key column
 * @param primaryKeyValues - Array of primary key values for rows to restore
 * @param softDeleteColumn - Name of the soft delete column
 */
export async function undoSoftDelete(
  connectionId: string,
  tableName: string,
  schemaName: string | null,
  primaryKeyColumn: string,
  primaryKeyValues: unknown[],
  softDeleteColumn: string
): Promise<MutationResult> {
  return await invoke('undo_soft_delete', {
    connectionId,
    tableName,
    schemaName,
    primaryKeyColumn,
    primaryKeyValues,
    softDeleteColumn,
  })
}

// =============================================================================
// Truncate Types & Commands
// =============================================================================

/** Result of a truncate operation */
export type TruncateResult = {
  success: boolean
  affected_rows: number
  tables_truncated: string[]
  message: string | null
}

/**
 * Truncate a single table
 * @param connectionId - UUID of the database connection
 * @param tableName - Name of the table to truncate
 * @param schemaName - Schema name (optional)
 * @param cascade - Whether to cascade truncate to related tables (PostgreSQL only)
 */
export async function truncateTable(
  connectionId: string,
  tableName: string,
  schemaName: string | null,
  cascade?: boolean
): Promise<TruncateResult> {
  return await invoke('truncate_table', {
    connectionId,
    tableName,
    schemaName,
    cascade: cascade ?? false,
  })
}

/**
 * Truncate all tables in the database (DANGEROUS - requires confirmation)
 * @param connectionId - UUID of the database connection
 * @param schemaName - Schema name (optional, defaults to 'public' for PostgreSQL)
 * @param confirm - Must be true to execute (safety check)
 */
export async function truncateDatabase(
  connectionId: string,
  schemaName: string | null,
  confirm: boolean
): Promise<TruncateResult> {
  return await invoke('truncate_database', {
    connectionId,
    schemaName,
    confirm,
  })
}

// =============================================================================
// Database Dump Types & Commands
// =============================================================================

/** Result of a database dump operation */
export type DumpResult = {
  success: boolean
  file_path: string
  size_bytes: number
  tables_dumped: number
  rows_dumped: number
  message: string | null
}

/**
 * Dump database to a SQL file
 * @param connectionId - UUID of the database connection
 * @param outputPath - Path where to save the dump file
 */
export async function dumpDatabase(
  connectionId: string,
  outputPath: string
): Promise<DumpResult> {
  return await invoke('dump_database', {
    connectionId,
    outputPath,
  })
}

// =============================================================================
// Recent Queries & Connections Commands
// =============================================================================

/**
 * Get recent queries with enhanced filtering
 * @param connectionId - Optional connection ID to filter by
 * @param limit - Maximum number of results
 * @param statusFilter - Optional status filter ('success', 'error', etc.)
 */
export async function getRecentQueries(
  connectionId?: string,
  limit?: number,
  statusFilter?: string
): Promise<QueryHistoryEntry[]> {
  return await invoke('get_recent_queries', {
    connectionId: connectionId ?? null,
    limit: limit ?? null,
    statusFilter: statusFilter ?? null,
  })
}

/**
 * Get recent connections (last connected databases)
 * @param limit - Maximum number of results
 */
export async function getRecentConnections(
  limit?: number
): Promise<ConnectionInfo[]> {
  return await invoke('get_recent_connections', {
    limit: limit ?? null,
  })
}

