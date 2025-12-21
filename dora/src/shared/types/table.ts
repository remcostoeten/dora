import type { ColConstraints, CellType } from "./validation"

export type TableColumn = {
  name: string
  type: string
  cellType?: CellType
  isPrimary?: boolean
  isNullable?: boolean
  constraints?: ColConstraints
}

export type CellInfo = {
  rowIndex: number
  columnName: string
  value: string
  originalValue: string
  type: string
}

export type CellChange = {
  rowIndex: number
  columnName: string
  originalValue: string
  newValue: string
}

export type SortConfig = {
  column: string
  direction: SortDir
}

export type SortDir = "asc" | "desc"

export type FilterConfig = {
  column: string
  operator: FilterOp
  value: string
}

export type FilterOp = "equals" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null"

export type PageConfig = {
  page: number
  pageSize: number
  total: number
}
