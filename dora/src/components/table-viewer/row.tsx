"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { Cell } from "./cell"
import { RowNumberCell } from "./row-number-cell"
import type { Column, CellChange } from "./types"

interface RowProps {
  rowIndex: number
  data: Record<string, unknown>
  columns: Column[]
  rowHeight: "compact" | "normal" | "comfortable"
  focusedCell: { row: number; colIndex: number } | null
  editingCell: { row: number; col: string } | null
  pendingChanges: Map<string, CellChange>
  isRowSelected: boolean
  selectedRowCount: number
  onRowSelect: (e: React.MouseEvent) => void
  onDeleteRow: () => void
  // Cell handlers
  onCellSelect: (rowIndex: number, colIndex: number, column: Column, value: unknown) => void
  onStartEdit: (rowIndex: number, column: Column) => void
  onEditComplete: (rowIndex: number, columnName: string, originalValue: unknown, newValue: string) => void
  onCancelEdit: () => void
  onCellChange: (rowIndex: number, columnName: string, originalValue: string, newValue: string) => void
  registerCellRef: (key: string, el: HTMLTableCellElement | null) => void
}

const heightClasses = {
  compact: "py-1",
  normal: "py-2",
  comfortable: "py-3",
}

export function Row({
  rowIndex,
  data,
  columns,
  rowHeight,
  focusedCell,
  editingCell,
  pendingChanges,
  isRowSelected,
  selectedRowCount,
  onRowSelect,
  onDeleteRow,
  onCellSelect,
  onStartEdit,
  onEditComplete,
  onCancelEdit,
  onCellChange,
  registerCellRef,
}: RowProps) {
  const getCurrentValue = (columnName: string, originalValue: unknown): string => {
    const key = `${rowIndex}:${columnName}`
    const change = pendingChanges.get(key)
    if (change) return change.newValue
    return originalValue === null ? "NULL" : String(originalValue)
  }

  const isCellDirty = (columnName: string): boolean => {
    return pendingChanges.has(`${rowIndex}:${columnName}`)
  }

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value === "NULL" ? "" : value)
  }

  const handlePaste = async (columnName: string, originalValue: unknown) => {
    const text = await navigator.clipboard.readText()
    const origStr = originalValue === null ? "NULL" : String(originalValue)
    onCellChange(rowIndex, columnName, origStr, text || "NULL")
  }

  const handleSetNull = (columnName: string, originalValue: unknown) => {
    const origStr = originalValue === null ? "NULL" : String(originalValue)
    onCellChange(rowIndex, columnName, origStr, "NULL")
  }

  const handleRevert = (columnName: string) => {
    const key = `${rowIndex}:${columnName}`
    const change = pendingChanges.get(key)
    if (change) {
      onCellChange(rowIndex, columnName, change.originalValue, change.originalValue)
    }
  }

  return (
    <tr
      className={cn(
        "group border-b border-border/20 transition-colors",
        isRowSelected ? "bg-primary/10" : "hover:bg-accent/30",
      )}
    >
      <RowNumberCell
        rowIndex={rowIndex}
        rowHeight={rowHeight}
        isSelected={isRowSelected}
        selectedCount={selectedRowCount}
        onSelect={onRowSelect}
        onDelete={onDeleteRow}
      />
      {columns.map((column, colIndex) => {
        const originalValue = data[column.name]
        const displayValue = getCurrentValue(column.name, originalValue)
        const isSelected = focusedCell?.row === rowIndex && focusedCell?.colIndex === colIndex
        const isEditing = editingCell?.row === rowIndex && editingCell?.col === column.name
        const isDirty = isCellDirty(column.name)

        return (
          <Cell
            key={column.name}
            ref={(el) => registerCellRef(`${rowIndex}:${colIndex}`, el)}
            rowIndex={rowIndex}
            column={column}
            value={originalValue}
            displayValue={displayValue}
            isSelected={isSelected}
            isDirty={isDirty}
            isEditing={isEditing}
            rowHeight={rowHeight}
            onSelect={() => onCellSelect(rowIndex, colIndex, column, originalValue)}
            onStartEdit={() => onStartEdit(rowIndex, column)}
            onEditComplete={(newValue) => onEditComplete(rowIndex, column.name, originalValue, newValue)}
            onCancelEdit={onCancelEdit}
            onCopy={() => handleCopy(displayValue)}
            onPaste={() => handlePaste(column.name, originalValue)}
            onSetNull={() => handleSetNull(column.name, originalValue)}
            onRevert={() => handleRevert(column.name)}
          />
        )
      })}
    </tr>
  )
}
