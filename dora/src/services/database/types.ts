import type { ColMeta, SchemaData, ValidateResult } from "@/shared/types"

export type DbClient = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>
  updateCell: (req: UpdateReq) => Promise<MutateRes>
  batchUpdate: (req: BatchReq) => Promise<BatchRes>
  insertRow: (req: InsertReq) => Promise<MutateRes>
  deleteRow: (req: DeleteReq) => Promise<MutateRes>
  duplicateRow: (req: DuplicateReq) => Promise<MutateRes>
  fetchSchema: (table: string) => Promise<SchemaData>
  validateCell: (req: ValidateReq) => Promise<ValidateResult>
  bulkDelete: (req: BulkDeleteReq) => Promise<BulkDeleteRes>
  exportTable: (req: ExportTableReq) => Promise<ExportTableRes>
  duplicateTable: (req: DuplicateTableReq) => Promise<DuplicateTableRes>
  renameTable: (req: RenameTableReq) => Promise<RenameTableRes>
  dropTable: (table: string, schema?: string) => Promise<MutateRes>
}

export type QueryResult = {
  columns: ColMeta[]
  rows: Record<string, unknown>[]
  total: number
  time: number
}

export type UpdateReq = {
  table: string
  primaryKey: Record<string, unknown>
  column: string
  value: unknown
}

export type MutateRes = {
  success: boolean
  error?: string
}

export type BatchReq = {
  table: string
  changes: Array<{
    primaryKey: Record<string, unknown>
    column: string
    oldValue: unknown
    newValue: unknown
  }>
}

export type BatchRes = {
  success: boolean
  applied: number
  failed: number
  errors?: Array<{ change: number; message: string }>
}

export type InsertReq = {
  table: string
  values?: Record<string, unknown>
}

export type DeleteReq = {
  table: string
  primaryKey: Record<string, unknown>
}

export type DuplicateReq = {
  table: string
  primaryKey: Record<string, unknown>
}

export type ValidateReq = {
  table: string
  column: string
  value: unknown
}

export type BulkDeleteReq = {
  table: string
  primaryKeys: Record<string, unknown>[]
}

export type BulkDeleteRes = {
  success: boolean
  deleted: number
  failed: number
  errors?: Array<{ index: number; message: string }>
}

export type ExportFormat = "sql" | "json"

export type ExportTableReq = {
  table: string
  format: ExportFormat
  includeSchema?: boolean // Include CREATE TABLE statement for SQL
  where?: string // Optional WHERE clause to filter rows
}

export type ExportTableRes = {
  success: boolean
  data: string // The exported content
  rowCount: number
  error?: string
}

export type DuplicateTableReq = {
  sourceTable: string
  newTableName: string
  includeData?: boolean // Copy data or just structure
  schema?: string
}

export type DuplicateTableRes = {
  success: boolean
  tableName?: string
  error?: string
}

export type RenameTableReq = {
  table: string
  newName: string
  schema?: string
}

export type RenameTableRes = {
  success: boolean
  error?: string
}
