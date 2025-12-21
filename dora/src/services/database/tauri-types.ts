export type DbInfo = { Postgres: { connection_string: string } } | { SQLite: { db_path: string } }

export type ConnInfo = {
  id: string
  name: string
  connected: boolean
  database_type: DbInfo
  last_connected_at?: number
  favorite?: boolean
  color?: string
  sort_order?: number
}

export type TableInfo = {
  name: string
  schema: string
  columns: ColumnInfo[]
}

export type ColumnInfo = {
  name: string
  data_type: string
  is_nullable: boolean
  default_value: string | null
}

export type DbSchema = {
  tables: TableInfo[]
  schemas: string[]
  unique_columns: string[]
}

export type QueryId = number

export type QueryStatus = "Pending" | "Running" | "Completed" | "Error"

export type StatementInfo = {
  returns_values: boolean
  status: QueryStatus
  first_page: Page | null
  affected_rows: number | null
  error: string | null
}

export type Page = Json[][]

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
