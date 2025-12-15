import type { UUID } from '@/shared/types/base'

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

export type SchemaVisualizationProps = {
  schema: DatabaseSchema | null
  connectionId: string | null
  connected: boolean
}

export type SchemaTableNodeProps = {
  data: {
    table: TableInfo
    onTableClick?: (tableName: string, schema: string) => void
  }
}
