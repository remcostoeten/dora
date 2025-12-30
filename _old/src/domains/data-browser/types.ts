import type { Json } from '@/shared/types/base'

export type Row = Json[]

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

export type DataBrowserViewProps = {
  schema: any
  connectionId: string | null
  connected: boolean
  onTableSelect: (tableName: string, schema: string) => void
}

export type TableBrowserProps = {
  connectionId: string | null
  connected: boolean
  onTableSelect: (tableName: string, schema: string) => void
}

export type TableProps = {
  data: Page
  columns: string[]
  loading?: boolean
  error?: string | null
}
