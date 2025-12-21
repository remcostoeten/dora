import type { BaseEntity, DbStatus, DbType, ViewType } from "./base"

export type DbConnection = BaseEntity & {
  name: string
  type: DbType
  host?: string
  database: string
  status: DbStatus
}

export type TableInfo = {
  name: string
  schema?: string
  rowCount?: number
  type: ViewType
}

export type ColumnInfo = {
  name: string
  type: string
  isPrimary?: boolean
  isNullable?: boolean
  defaultValue?: string
  isForeignKey?: boolean
  references?: ColumnRef
}

export type ColumnRef = {
  table: string
  column: string
}

export type TableSchema = {
  name: string
  columns: ColumnInfo[]
  indexes?: IndexInfo[]
}

export type IndexInfo = {
  name: string
  columns: string[]
  isUnique: boolean
}
