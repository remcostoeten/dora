"use client"

import type React from "react"

import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { Header } from "./header"
import { Row } from "./row"
import { Toolbar } from "./toolbar"
import { Pagination } from "./pagination"
import { StatusBar } from "./status-bar"
import type {
  TableViewerProps,
  Column,
  CellInfo,
  CellChange,
  SortConfig,
  FilterConfig,
  PaginationConfig,
} from "./types"

export type { TableViewerProps, Column, CellInfo, CellChange, SortConfig, FilterConfig, PaginationConfig }

export function TableViewer({
  columns: initialColumns,
  data,
  selectedCell,
  onCellSelect,
  selectedRows = new Set(),
  onRowSelect,
  onRowToggle,
  onRowRangeSelect,
  onClearRowSelection,
  onDeleteRows,
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
  tableName,
  sidebarVisible,
  onToggleSidebar,
  rightSidebarVisible,
  onToggleRightSidebar,
  enablePagination = false,
  pagination,
  onPaginationChange,
  rowHeight = "normal",
  onColumnWidthChange,
}: TableViewerProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const [focusedCell, setFocusedCell] = useState<{ row: number; colIndex: number }>({ row: 0, colIndex: 0 })
  const [lastClickedRow, setLastClickedRow] = useState<number | null>(null)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})

  const tableRef = useRef<HTMLTableElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())

  const columns = useMemo(() => {
    return initialColumns.map((col) => ({
      ...col,
      width: columnWidths[col.name] || col.width,
    }))
  }, [initialColumns, columnWidths])

  const handleColumnWidthChange = useCallback(
    (columnName: string, width: number) => {
      setColumnWidths((prev) => ({ ...prev, [columnName]: width }))
      onColumnWidthChange?.(columnName, width)
    },
    [onColumnWidthChange],
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Don't deselect if clicking inside the table
      if (containerRef.current?.contains(target)) return

      // Don't deselect if clicking inside the info panel (right sidebar)
      if (target.closest("[data-info-panel]")) return

      // Don't deselect if clicking interactive elements
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("[role='menu']") ||
        target.closest("[role='dialog']")
      ) {
        return
      }

      // Deselect the cell
      onCellSelect?.(null)
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [onCellSelect])

  // ... existing code for sorting, filtering, pagination ...

  // Apply sorting
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
    if (!enablePagination || !pagination) return filteredData
    const start = pagination.page * pagination.pageSize
    return filteredData.slice(start, start + pagination.pageSize)
  }, [filteredData, enablePagination, pagination])

  const getCurrentValue = useCallback(
    (rowIndex: number, columnName: string, originalValue: unknown): string => {
      const key = `${rowIndex}:${columnName}`
      const change = pendingChanges.get(key)
      if (change) return change.newValue
      return originalValue === null ? "NULL" : String(originalValue)
    },
    [pendingChanges],
  )

  const handleCellSelect = (rowIndex: number, colIndex: number, column: Column, value: unknown) => {
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
  }

  const handleRowSelect = (rowIndex: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRow !== null && onRowRangeSelect) {
      onRowRangeSelect(lastClickedRow, rowIndex)
    } else if (e.ctrlKey || e.metaKey) {
      onRowToggle?.(rowIndex)
      setLastClickedRow(rowIndex)
    } else {
      onRowSelect?.(rowIndex)
      setLastClickedRow(rowIndex)
    }
  }

  const handleDeleteRows = (clickedRowIndex: number) => {
    if (!onDeleteRows) return
    if (selectedRows.has(clickedRowIndex) && selectedRows.size > 0) {
      onDeleteRows(Array.from(selectedRows))
    } else {
      onDeleteRows([clickedRowIndex])
    }
  }

  const handleStartEdit = (rowIndex: number, column: Column) => {
    if (column.isPrimary) return
    setEditingCell({ row: rowIndex, col: column.name })
  }

  const handleEditComplete = (rowIndex: number, columnName: string, originalValue: unknown, newValue: string) => {
    const origStr = originalValue === null ? "NULL" : String(originalValue)
    onCellChange?.(rowIndex, columnName, origStr, newValue)

    if (selectedCell && selectedCell.rowIndex === rowIndex && selectedCell.columnName === columnName) {
      onCellSelect?.({ ...selectedCell, value: newValue })
    }
    setEditingCell(null)
    tableRef.current?.focus()
  }

  const handleCancelEdit = () => {
    setEditingCell(null)
    tableRef.current?.focus()
  }

  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (selectedRows.size > 0) {
        onClearRowSelection?.()
        return
      }
      if (!editingCell && selectedCell) {
        onCellSelect?.(null)
        return
      }
    }

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
  }

  const registerCellRef = (key: string, el: HTMLTableCellElement | null) => {
    if (el) {
      cellRefs.current.set(key, el)
    } else {
      cellRefs.current.delete(key)
    }
  }

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">
      {enableFiltering && onFiltersChange && (
        <Toolbar
          columns={columns}
          filters={filters}
          onFiltersChange={onFiltersChange}
          sidebarVisible={sidebarVisible}
          onToggleSidebar={onToggleSidebar}
          tableName={tableName}
          rightSidebarVisible={rightSidebarVisible}
          onToggleRightSidebar={onToggleRightSidebar}
        />
      )}
      <div className="flex-1 overflow-auto">
        <table
          ref={tableRef}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          className="w-full table-fixed border-collapse font-mono text-xs outline-none"
        >
          <Header
            columns={columns}
            enableSorting={enableSorting}
            sortConfig={sortConfig}
            onSortChange={onSortChange}
            onColumnWidthChange={handleColumnWidthChange}
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
                isRowSelected={selectedRows.has(rowIndex)}
                selectedRowCount={selectedRows.size}
                onRowSelect={(e) => handleRowSelect(rowIndex, e)}
                onDeleteRow={() => handleDeleteRows(rowIndex)}
                onCellSelect={handleCellSelect}
                onStartEdit={handleStartEdit}
                onEditComplete={handleEditComplete}
                onCancelEdit={handleCancelEdit}
                onCellChange={(ri, cn, ov, nv) => onCellChange?.(ri, cn, ov, nv)}
                registerCellRef={registerCellRef}
              />
            ))}
          </tbody>
        </table>
      </div>
      {enablePagination && pagination && onPaginationChange && (
        <Pagination config={{ ...pagination, total: filteredData.length }} onChange={onPaginationChange} />
      )}
      <StatusBar
        totalRows={filteredData.length}
        pendingChanges={pendingChanges}
        onApplyChanges={onApplyChanges}
        onDiscardChanges={onDiscardChanges}
      />
    </div>
  )
}
