import { UUID, ID, Entity } from './base'

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export type Row = Json[]

export type QueryId = number

export type Page = Json[][]

export type QueryStatus = 'Pending' | 'Running' | 'Completed' | 'Error'

export type StatementInfo = {
  returns_values: boolean
  status: QueryStatus
  first_page: Page | null
  affected_rows: number | null
  error: string | null
  columns?: string[]
}

export type DatabaseType = 'postgres' | 'sqlite' | 'cockroach'

export type DatabaseInfo =
  | { Postgres: { connection_string: string } }
  | { SQLite: { db_path: string } }

export type ConnectionInfo = {
  id: string
  name: string
  connected: boolean
  database_type: DatabaseInfo
}

export type Connection = Entity & {
  name: string
  connected: boolean
  databaseType: DatabaseInfo
}

export type ColumnInfo = {
  name: string
  data_type: string
  is_nullable: boolean
  default_value: string | null
}

export type TableInfo = {
  name: string
  schema: string
  columns: ColumnInfo[]
}

export type DatabaseSchema = {
  tables: TableInfo[]
  schemas: string[]
  unique_columns: string[]
}

// Alias for compatibility
export type Schema = DatabaseSchema
export type Column = ColumnInfo
export type Table = TableInfo

export type QueryExecEvent =
  | {
    type: 'types-resolved'
    columns: string[]
  }
  | {
    type: 'page'
    pageAmount: number
    page: Page
  }
  | {
    type: 'finished'
    elapsedMs: number
    affectedRows: number
    error: string | null
  }

export type QueryHistory = Entity & {
  query: string
  connectionId: UUID
  duration: number
  status: QueryStatus
  rowCount: number
  errorMessage: string | null
}

export type QueryHistoryEntry = {
  id: number
  connection_id: string
  query_text: string
  executed_at: number
  duration_ms: number | null
  status: string
  row_count: number
  error_message: string | null
}

export type ConnectionHistoryEntry = {
  id: number
  connection_id: string
  connection_name: string
  database_type: string
  attempted_at: number
  success: boolean
  error_message: string | null
  duration_ms: number | null
}

export type Script = {
  id: number
  name: string
  description: string | null
  query_text: string
  connection_id: string | null
  tags: string | null
  created_at: number
  updated_at: number
  favorite?: boolean
}

export type TabState = {
  id: ID
  query: string
  results: Page | null
  status: QueryStatus
  columns: string[]
  error: string | null
  affectedRows: number | null
}
