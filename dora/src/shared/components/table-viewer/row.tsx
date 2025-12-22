"use client"

import { useState, useCallback, memo } from "react"
import { Trash2, Copy } from "lucide-react"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { cn } from "@/shared/utils"
import { Cell } from "./cell"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import type { TableColumn, CellChange } from "@/shared/types"

type Props = {
  rowIndex: number
  data: Record<string, unknown>
  columns: TableColumn[]
  rowHeight: "compact" | "normal" | "comfortable"
  focusedCell: { row: number; colIndex: number } | null
  editingCell: { row: number; col: string } | null
  pendingChanges: Map<string, CellChange>
  onCellSelect: (rowIndex: number, colIndex: number, column: TableColumn, value: unknown) => void
  onStartEdit: (rowIndex: number, column: TableColumn) => void
  onEditComplete: (rowIndex: number, columnName: string, originalValue: unknown, newValue: string) => void
  onCancelEdit: () => void
  onCellChange: (rowIndex: number, columnName: string, originalValue: string, newValue: string) => void
  registerCellRef: (key: string, el: HTMLTableCellElement | null) => void
  onDeleteRow?: (rowIndex: number) => void
  onDuplicateRow?: (rowIndex: number) => void
  columnWidths?: Record<string, number>
}

const heightClasses = {
  compact: "py-1",
  normal: "py-2",
  comfortable: "py-3",
}

export const Row = memo(function Row({
  rowIndex,
  data,
  columns,
  rowHeight,
  focusedCell,
  editingCell,
  pendingChanges,
  onCellSelect,
  onStartEdit,
  onEditComplete,
  onCancelEdit,
  onCellChange,
  registerCellRef,
  onDeleteRow,
  onDuplicateRow,
  columnWidths = {},
}: Props) {
  const [showDelete, setShowDelete] = useState(false)

  const getCurrentValue = useCallback(
    (columnName: string, originalValue: unknown): string => {
      const key = `${rowIndex}:${columnName}`
      const change = pendingChanges.get(key)
      if (change) return change.newValue
      return originalValue === null ? "NULL" : String(originalValue)
    },
    [rowIndex, pendingChanges],
  )

  const isCellDirty = useCallback(
    (columnName: string): boolean => {
      return pendingChanges.has(`${rowIndex}:${columnName}`)
    },
    [rowIndex, pendingChanges],
  )

  const handleCopy = useCallback((value: string) => {
    navigator.clipboard.writeText(value === "NULL" ? "" : value)
  }, [])

  const handlePaste = useCallback(
    async (columnName: string, originalValue: unknown) => {
      const text = await navigator.clipboard.readText()
      const origStr = originalValue === null ? "NULL" : String(originalValue)
      onCellChange(rowIndex, columnName, origStr, text || "NULL")
    },
    [rowIndex, onCellChange],
  )

  const handleSetNull = useCallback(
    (columnName: string, originalValue: unknown) => {
      const origStr = originalValue === null ? "NULL" : String(originalValue)
      onCellChange(rowIndex, columnName, origStr, "NULL")
    },
    [rowIndex, onCellChange],
  )

  const handleRevert = useCallback(
    (columnName: string) => {
      const key = `${rowIndex}:${columnName}`
      const change = pendingChanges.get(key)
      if (change) {
        onCellChange(rowIndex, columnName, change.originalValue, change.originalValue)
      }
    },
    [rowIndex, pendingChanges, onCellChange],
  )

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <tr className="group border-b border-border/20 transition-colors hover:bg-accent/30">
            <td
              className={cn(
                "border-r border-border/30 bg-card/50 px-3 text-right tabular-nums text-muted-foreground/50",
                heightClasses[rowHeight],
              )}
            >
              {rowIndex + 1}
            </td>
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
                  columnWidth={columnWidths[column.name]}
                />
              )
            })}
          </tr>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {onDuplicateRow && (
            <>
              <ContextMenuItem onClick={() => onDuplicateRow(rowIndex)}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Duplicate row
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          {onDeleteRow && (
            <ContextMenuItem onClick={() => setShowDelete(true)} className="text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete row
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        onConfirm={() => onDeleteRow?.(rowIndex)}
        title="Delete row"
        desc={`Are you sure you want to delete row ${rowIndex + 1}? This action cannot be undone.`}
        variant="danger"
        confirmText="Delete"
      />
    </>
  )
})
