"use client"

import type React from "react"
import { useState, useRef, useCallback, useMemo, memo, useEffect } from "react"
import { Header } from "./header"
import { Row } from "./row"
import { Toolbar } from "./toolbar"
import { Pagination } from "./pagination"
import { StatusBar } from "./status-bar"
import { TableViewerSkeleton } from "./skeletons"
import { useColumnResize } from "@/shared/hooks/use-column-resize"
import type { TableColumn, CellInfo, CellChange, SortConfig, FilterConfig, PageConfig, RowHeight } from "@/shared/types"

type Props = {
  columns: TableColumn[]
  data: Record<string, unknown>[]
  selectedCell?: CellInfo | null
  onCellSelect?: (cell: CellInfo | null) => void
  pendingChanges?: Map<string, CellChange>
  onCellChange?: (rowIndex: number, columnName: string, originalValue: string, newValue: string) => void
  onApplyChanges?: () => void
  onDiscardChanges?: () => void
  enableSorting?: boolean
  sortConfig?: SortConfig | null
  onSortChange?: (config: SortConfig | null) => void
  enableFiltering?: boolean
  filters?: FilterConfig[]
  onFiltersChange?: (filters: FilterConfig[]) => void
  enablePagination?: boolean
  pagination?: PageConfig
  onPaginationChange?: (config: PageConfig) => void
  rowHeight?: RowHeight
  totalRows?: number
  isLoading?: boolean
  lastQuery?: { sql: string; time: number } | null
}

const MemoizedHeader = memo(Header)
const MemoizedToolbar = memo(Toolbar)
const MemoizedPagination = memo(Pagination)
const MemoizedStatusBar = memo(StatusBar)

export function TableViewer({
  columns,
  data,
  selectedCell,
  onCellSelect,
  pendingChanges = new Map(),
  onCellChange,
  onApplyChanges,
  onDiscardChanges,
  enableSorting = false,
  sortConfig,
  onSortChange,
  enableFiltering = false,
  filters = [],
  onFiltersChange,
  enablePagination = false,
  pagination,
  onPaginationChange,
  rowHeight = "normal",
  totalRows,
  isLoading = false,
  lastQuery,
}: Props) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const [focusedCell, setFocusedCell] = useState<{ row: number; colIndex: number }>({ row: 0, colIndex: 0 })

  const tableRef = useRef<HTMLTableElement>(null)
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())

  const { columnWidths, resizing, getColumnWidth, handleResizeStart, handleAutoFit } = useColumnResize({
    minWidth: 60,
    maxWidth: 600,
    defaultWidth: 150,
  })

  useEffect(() => {
    const tableEl = tableRef.current
    if (!tableEl) return

    const handleMeasureColumn = (e: Event) => {
      const customEvent = e as CustomEvent<{ columnName: string; headerWidth: number }>
      const { columnName, headerWidth } = customEvent.detail

      // Collect all cell widths for this column
      const contentWidths: number[] = [headerWidth]

      // Measure cells in the current data
      data.forEach((row, rowIndex) => {
        const cellKey = `${rowIndex}:${columns.findIndex((c) => c.name === columnName)}`
        const cellEl = cellRefs.current.get(cellKey)
        if (cellEl) {
          const contentEl = cellEl.querySelector("span")
          if (contentEl) {
            contentWidths.push(contentEl.scrollWidth)
          }
        }
      })

      handleAutoFit(columnName, contentWidths)
    }

    tableEl.addEventListener("measure-column", handleMeasureColumn)
    return () => tableEl.removeEventListener("measure-column", handleMeasureColumn)
  }, [data, columns, handleAutoFit])

  const sortedData = useMemo(() => {
    if (!sortConfig) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.column]
      const bVal = b[sortConfig.column]
      if (aVal === null) return 1
      if (bVal === null) return -1
      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
      return sortConfig.direction === "asc" ? comparison : -comparison
    })
  }, [data, sortConfig])

  const filteredData = useMemo(() => {
    if (filters.length === 0) return sortedData
    return sortedData.filter((row) => {
      return filters.every((filter) => {
        const value = row[filter.column]
        const strValue = value === null ? "" : String(value).toLowerCase()
        const filterValue = filter.value.toLowerCase()
        switch (filter.operator) {
          case "equals":
            return strValue === filterValue
          case "contains":
            return strValue.includes(filterValue)
          case "starts_with":
            return strValue.startsWith(filterValue)
          case "ends_with":
            return strValue.endsWith(filterValue)
          case "is_null":
            return value === null
          case "is_not_null":
            return value !== null
          default:
            return true
        }
      })
    })
  }, [sortedData, filters])

  const paginatedData = useMemo(() => {
    // If onPaginationChange is provided, we assume the data is already paginated by the caller/store
    if (!enablePagination || !pagination || onPaginationChange) return filteredData
    const start = pagination.page * pagination.pageSize
    return filteredData.slice(start, start + pagination.pageSize)
  }, [filteredData, enablePagination, pagination, onPaginationChange])

  const getCurrentValue = useCallback(
    (rowIndex: number, columnName: string, originalValue: unknown): string => {
      const key = `${rowIndex}:${columnName}`
      const change = pendingChanges.get(key)
      if (change) return change.newValue
      return originalValue === null ? "NULL" : String(originalValue)
    },
    [pendingChanges],
  )

  const handleCellSelect = useCallback(
    (rowIndex: number, colIndex: number, column: TableColumn, value: unknown) => {
      setFocusedCell({ row: rowIndex, colIndex })
      const currentValue = getCurrentValue(rowIndex, column.name, value)
      const origStr = value === null ? "NULL" : String(value)
      onCellSelect?.({
        rowIndex,
        columnName: column.name,
        value: currentValue,
        originalValue: origStr,
        type: column.type,
      })
      tableRef.current?.focus()
    },
    [getCurrentValue, onCellSelect],
  )

  const handleStartEdit = useCallback((rowIndex: number, column: TableColumn) => {
    if (column.isPrimary) return
    setEditingCell({ row: rowIndex, col: column.name })
  }, [])

  const handleEditComplete = useCallback(
    (rowIndex: number, columnName: string, originalValue: unknown, newValue: string) => {
      const origStr = originalValue === null ? "NULL" : String(originalValue)
      onCellChange?.(rowIndex, columnName, origStr, newValue)

      if (selectedCell && selectedCell.rowIndex === rowIndex && selectedCell.columnName === columnName) {
        onCellSelect?.({ ...selectedCell, value: newValue })
      }
      setEditingCell(null)
      tableRef.current?.focus()
    },
    [onCellChange, selectedCell, onCellSelect],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null)
    tableRef.current?.focus()
  }, [])

  const handleCellChange = useCallback(
    (ri: number, cn: string, ov: string, nv: string) => {
      onCellChange?.(ri, cn, ov, nv)
    },
    [onCellChange],
  )

  const handleTableKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) return

      const { row, colIndex } = focusedCell
      const displayData = paginatedData
      let newRow = row
      let newColIndex = colIndex

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault()
          newRow = Math.max(0, row - 1)
          break
        case "ArrowDown":
          e.preventDefault()
          newRow = Math.min(displayData.length - 1, row + 1)
          break
        case "ArrowLeft":
          e.preventDefault()
          newColIndex = Math.max(0, colIndex - 1)
          break
        case "ArrowRight":
          e.preventDefault()
          newColIndex = Math.min(columns.length - 1, colIndex + 1)
          break
        case "Tab":
          e.preventDefault()
          if (e.shiftKey) {
            if (colIndex > 0) {
              newColIndex = colIndex - 1
            } else if (row > 0) {
              newRow = row - 1
              newColIndex = columns.length - 1
            }
          } else {
            if (colIndex < columns.length - 1) {
              newColIndex = colIndex + 1
            } else if (row < displayData.length - 1) {
              newRow = row + 1
              newColIndex = 0
            }
          }
          break
        case "Enter":
          e.preventDefault()
          const col = columns[colIndex]
          if (col && !col.isPrimary) {
            setEditingCell({ row, col: col.name })
          }
          return
        case "Escape":
          onCellSelect?.(null)
          return
        default:
          return
      }

      if (newRow !== row || newColIndex !== colIndex) {
        setFocusedCell({ row: newRow, colIndex: newColIndex })
        const column = columns[newColIndex]
        const rowData = displayData[newRow]
        const value = rowData[column.name]
        const currentValue = getCurrentValue(newRow, column.name, value)
        const origStr = value === null ? "NULL" : String(value)
        onCellSelect?.({
          rowIndex: newRow,
          columnName: column.name,
          value: currentValue,
          originalValue: origStr,
          type: column.type,
        })

        const cellKey = `${newRow}:${newColIndex}`
        const cellEl = cellRefs.current.get(cellKey)
        cellEl?.scrollIntoView({ block: "nearest", inline: "nearest" })
      }
    },
    [editingCell, focusedCell, paginatedData, columns, getCurrentValue, onCellSelect],
  )

  const registerCellRef = useCallback((key: string, el: HTMLTableCellElement | null) => {
    if (el) {
      cellRefs.current.set(key, el)
    } else {
      cellRefs.current.delete(key)
    }
  }, [])

  if (isLoading && data.length === 0) {
    return (
      <TableViewerSkeleton
        columnCount={columns.length || 5}
        rowCount={pagination?.pageSize || 10}
        rowHeight={rowHeight}
        showToolbar={enableFiltering}
        showPagination={enablePagination}
        showStatusBar={true}
      />
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {enableFiltering && onFiltersChange && (
        <MemoizedToolbar columns={columns} filters={filters} onFiltersChange={onFiltersChange} />
      )}
      <div className="relative flex-1 overflow-auto">
        {isLoading && data.length > 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/30 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-md bg-card px-3 py-2 shadow-lg border border-border/50">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          </div>
        )}
        <table
          ref={tableRef}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          className="w-full border-collapse font-mono text-xs outline-none"
        >
          <MemoizedHeader
            columns={columns}
            enableSorting={enableSorting}
            sortConfig={sortConfig}
            onSortChange={onSortChange}
            columnWidths={columnWidths}
            resizingColumn={resizing}
            onResizeStart={handleResizeStart}
            onAutoFit={handleAutoFit}
          />
          <tbody>
            {paginatedData.map((row, rowIndex) => (
              <Row
                key={rowIndex}
                rowIndex={rowIndex}
                data={row}
                columns={columns}
                rowHeight={rowHeight}
                focusedCell={focusedCell}
                editingCell={editingCell}
                pendingChanges={pendingChanges}
                onCellSelect={handleCellSelect}
                onStartEdit={handleStartEdit}
                onEditComplete={handleEditComplete}
                onCancelEdit={handleCancelEdit}
                onCellChange={handleCellChange}
                registerCellRef={registerCellRef}
                columnWidths={columnWidths}
              />
            ))}
          </tbody>
        </table>
      </div>
      {enablePagination && pagination && onPaginationChange && (
        <MemoizedPagination config={pagination} onChange={onPaginationChange} />
      )}
      <MemoizedStatusBar
        totalRows={totalRows || filteredData.length}
        pendingChanges={pendingChanges}
        pagination={pagination}
        onApplyChanges={onApplyChanges}
        onDiscardChanges={onDiscardChanges}
        lastQuerySql={lastQuery?.sql}
        lastQueryTime={lastQuery?.time}
      />
    </div>
  )
}
