import type { CellType, ColConstraints } from "@/shared/types/validation"

export interface Column {
  name: string
  type: string
  isPrimary?: boolean
  isNullable?: boolean
  cellType?: CellType
  constraints?: ColConstraints
  width?: number
}

export interface CellInfo {
  rowIndex: number
  columnName: string
  value: string
  originalValue: string
  type: string
}

export interface CellChange {
  rowIndex: number
  columnName: string
  originalValue: string
  newValue: string
}

export interface SortConfig {
  column: string
  direction: "asc" | "desc"
}

export interface FilterConfig {
  column: string
  operator: "equals" | "contains" | "starts_with" | "ends_with" | "is_null" | "is_not_null"
  value: string
}

export interface PaginationConfig {
  page: number
  pageSize: number
  total: number
}

export interface TableViewerProps {
  columns: Column[]
  data: Record<string, unknown>[]
  // Selection
  selectedCell?: CellInfo | null
  onCellSelect?: (cell: CellInfo | null) => void
  // Row selection props
  selectedRows?: Set<number>
  onRowSelect?: (rowIndex: number) => void
  onRowToggle?: (rowIndex: number) => void
  onRowRangeSelect?: (startRow: number, endRow: number) => void
  onClearRowSelection?: () => void
  // Row operations
  onDeleteRows?: (rowIndices: number[]) => void
  // Editing
  pendingChanges?: Map<string, CellChange>
  onCellChange?: (rowIndex: number, columnName: string, originalValue: string, newValue: string) => void
  onApplyChanges?: () => void
  onDiscardChanges?: () => void
  // Sorting
  enableSorting?: boolean
  sortConfig?: SortConfig | null
  onSortChange?: (config: SortConfig | null) => void
  // Filtering
  enableFiltering?: boolean
  filters?: FilterConfig[]
  onFiltersChange?: (filters: FilterConfig[]) => void
  // Sidebar toggle
  sidebarVisible?: boolean
  onToggleSidebar?: () => void
  rightSidebarVisible?: boolean
  onToggleRightSidebar?: () => void
  // Pagination
  enablePagination?: boolean
  pagination?: PaginationConfig
  onPaginationChange?: (config: PaginationConfig) => void
  // Display
  rowHeight?: "compact" | "normal" | "comfortable"
  tableName?: string
  onColumnWidthChange?: (columnName: string, width: number) => void
}
