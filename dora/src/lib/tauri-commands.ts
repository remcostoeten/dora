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
