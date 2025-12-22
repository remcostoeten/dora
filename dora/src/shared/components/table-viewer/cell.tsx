"use client"

import type React from "react"
import { forwardRef, useState, useRef, useEffect, useCallback, memo } from "react"
import { cn } from "@/shared/utils"
import type { TableColumn } from "@/shared/types"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Copy, ClipboardPaste, Trash2, RotateCcw, Pencil } from "lucide-react"

type Props = {
  rowIndex: number
  column: TableColumn
  value: unknown
  displayValue: string
  isSelected: boolean
  isDirty: boolean
  isEditing: boolean
  rowHeight: "compact" | "normal" | "comfortable"
  onSelect: () => void
  onStartEdit: () => void
  onEditComplete: (newValue: string) => void
  onCancelEdit: () => void
  onCopy: () => void
  onPaste: () => void
  onSetNull: () => void
  onRevert: () => void
  columnWidth?: number
}

const heightClasses = {
  compact: "py-1",
  normal: "py-2",
  comfortable: "py-3",
}

const CellInner = memo(
  forwardRef<HTMLTableCellElement, Props>(function CellInner(
    {
      column,
      displayValue,
      isSelected,
      isDirty,
      isEditing,
      rowHeight,
      onSelect,
      onStartEdit,
      onEditComplete,
      onCancelEdit,
      onCopy,
      onPaste,
      onSetNull,
      onRevert,
      columnWidth,
    },
    ref,
  ) {
    const [editValue, setEditValue] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const contentRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
      if (isEditing && inputRef.current) {
        setEditValue(displayValue === "NULL" ? "" : displayValue)
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, [isEditing, displayValue])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault()
          onEditComplete(editValue === "" ? "NULL" : editValue)
        } else if (e.key === "Escape") {
          e.preventDefault()
          onCancelEdit()
        } else if (e.key === "Tab") {
          e.preventDefault()
          onEditComplete(editValue === "" ? "NULL" : editValue)
        }
      },
      [editValue, onEditComplete, onCancelEdit],
    )

    const renderValue = useCallback(() => {
      if (displayValue === "NULL") {
        return <span className="text-muted-foreground/40 italic">NULL</span>
      }
      if (column.type === "bool") {
        return (
          <span className={displayValue === "true" ? "text-emerald-400/80" : "text-muted-foreground"}>
            {displayValue}
          </span>
        )
      }
      if (column.type === "timestamptz" || column.type === "timestamp") {
        return <span className="text-muted-foreground tabular-nums">{displayValue}</span>
      }
      if (column.type === "int4" || column.type === "int8" || column.type === "integer") {
        return <span className="text-blue-400/80 tabular-nums">{displayValue}</span>
      }
      return (
        <span ref={contentRef} className="truncate block">
          {displayValue}
        </span>
      )
    }, [displayValue, column.type])

    const isReadOnly = column.isPrimary

    const handleDoubleClick = useCallback(() => {
      if (!isReadOnly) onStartEdit()
    }, [isReadOnly, onStartEdit])

    const widthStyles = columnWidth
      ? { width: columnWidth, minWidth: columnWidth, maxWidth: columnWidth }
      : { minWidth: column.isPrimary ? 80 : 120 }

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <td
            ref={ref}
            onClick={onSelect}
            onDoubleClick={handleDoubleClick}
            style={widthStyles}
            className={cn(
              "cursor-pointer border-r border-border/30 px-3 transition-colors overflow-hidden",
              heightClasses[rowHeight],
              isSelected && !isEditing && "bg-primary/10 outline outline-1 outline-primary/40",
              isDirty && "bg-amber-500/5",
            )}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => onEditComplete(editValue === "" ? "NULL" : editValue)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent outline-none"
                />
              ) : (
                <span className="truncate">{renderValue()}</span>
              )}
            </div>
          </td>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={onStartEdit} disabled={isReadOnly}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit cell
            <ContextMenuShortcut>Enter</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onCopy}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy value
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={onPaste} disabled={isReadOnly}>
            <ClipboardPaste className="mr-2 h-3.5 w-3.5" />
            Paste value
            <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onSetNull} disabled={isReadOnly}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Set to NULL
          </ContextMenuItem>
          {isDirty && (
            <ContextMenuItem onClick={onRevert}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Revert changes
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    )
  }),
)

export const Cell = forwardRef<HTMLTableCellElement, Props>(function Cell(props, ref) {
  return <CellInner {...props} ref={ref} />
})
