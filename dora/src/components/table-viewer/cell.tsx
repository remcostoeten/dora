"use client"

import type React from "react"

import { forwardRef, useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Column } from "./types"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, ClipboardPaste, Trash2, RotateCcw, Pencil, Check, X } from "lucide-react"

interface CellProps {
  rowIndex: number
  column: Column
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
}

const heightClasses = {
  compact: "py-1",
  normal: "py-2",
  comfortable: "py-3",
}

function isRestrictedInput(column: Column): boolean {
  const cellType = column.cellType || inferCellType(column.type)
  return cellType === "boolean" || cellType === "enum" || !!column.constraints?.enum
}

function inferCellType(type: string): string {
  const lower = type.toLowerCase()
  if (lower.includes("bool")) return "boolean"
  if (lower.includes("enum")) return "enum"
  return "text"
}

function getEnumOptions(column: Column): string[] | null {
  if (column.constraints?.enum) return column.constraints.enum
  const cellType = column.cellType || inferCellType(column.type)
  if (cellType === "boolean") return ["true", "false"]
  return null
}

export const Cell = forwardRef<HTMLTableCellElement, CellProps>(function Cell(
  {
    column,
    value,
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
  },
  ref,
) {
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const enumOptions = getEnumOptions(column)
  const isRestricted = isRestrictedInput(column)
  const cellType = column.cellType || inferCellType(column.type)
  const isBoolean = cellType === "boolean"

  useEffect(() => {
    if (isEditing && inputRef.current && !isRestricted) {
      setEditValue(displayValue === "NULL" ? "" : displayValue)
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing, displayValue, isRestricted])

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  }

  const handleBooleanCycle = () => {
    if (displayValue === "NULL") {
      onEditComplete("true")
    } else if (displayValue === "true") {
      onEditComplete("false")
    } else {
      onEditComplete("NULL")
    }
  }

  const renderValue = () => {
    if (displayValue === "NULL") {
      return <span className="text-muted-foreground/40 italic">NULL</span>
    }
    if (isBoolean) {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1",
            displayValue === "true" && "text-emerald-400/80",
            displayValue === "false" && "text-muted-foreground",
          )}
        >
          {displayValue === "true" && <Check className="h-3 w-3" />}
          {displayValue === "false" && <X className="h-3 w-3" />}
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
    if (enumOptions && enumOptions.includes(displayValue)) {
      return (
        <span className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
          {displayValue}
        </span>
      )
    }
    return <span className="block truncate">{displayValue}</span>
  }

  const renderEditor = () => {
    if (isRestricted && enumOptions) {
      return (
        <Select
          defaultOpen
          value={displayValue === "NULL" ? "" : displayValue}
          onValueChange={(val) => {
            onEditComplete(val || "NULL")
          }}
          onOpenChange={(open) => {
            if (!open) onCancelEdit()
          }}
        >
          <SelectTrigger className="h-auto w-full border-0 bg-transparent p-0 text-sm shadow-none focus:ring-0">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-[140px]">
            {column.isNullable !== false && (
              <SelectItem value="" className="text-muted-foreground italic">
                NULL
              </SelectItem>
            )}
            {enumOptions.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {isBoolean ? (
                  <span className="flex items-center gap-2">
                    {opt === "true" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {opt}
                  </span>
                ) : (
                  opt
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => onEditComplete(editValue === "" ? "NULL" : editValue)}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent outline-none"
      />
    )
  }

  const isReadOnly = column.isPrimary

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <td
          ref={ref}
          onClick={onSelect}
          onDoubleClick={() => !isReadOnly && onStartEdit()}
          style={{ width: column.width, maxWidth: column.width }}
          className={cn(
            "cursor-pointer overflow-hidden border-r border-border/30 px-3 transition-colors",
            heightClasses[rowHeight],
            column.isPrimary && "w-20",
            !column.isPrimary && "min-w-[120px]",
            isSelected && !isEditing && "bg-primary/10 outline outline-1 outline-primary/40",
            isDirty && "bg-amber-500/5",
          )}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
            {isEditing ? renderEditor() : renderValue()}
          </div>
        </td>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onStartEdit} disabled={isReadOnly}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit cell
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        {isBoolean && !isReadOnly && (
          <ContextMenuItem onClick={handleBooleanCycle}>
            {displayValue === "true" ? <X className="mr-2 h-3.5 w-3.5" /> : <Check className="mr-2 h-3.5 w-3.5" />}
            Toggle value
            <ContextMenuShortcut>Space</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCopy}>
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy value
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={onPaste} disabled={isReadOnly || isRestricted}>
          <ClipboardPaste className="mr-2 h-3.5 w-3.5" />
          Paste value
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onSetNull} disabled={isReadOnly || column.isNullable === false}>
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
})
