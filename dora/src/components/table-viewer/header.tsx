"use client"

import type React from "react"
import { useState, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Key, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import type { Column, SortConfig } from "./types"

interface HeaderProps {
  columns: Column[]
  enableSorting?: boolean
  sortConfig?: SortConfig | null
  onSortChange?: (config: SortConfig | null) => void
  onColumnWidthChange?: (columnName: string, width: number) => void
}

const MIN_COLUMN_WIDTH = 80
const DEFAULT_COLUMN_WIDTH = 150

export function Header({ columns, enableSorting, sortConfig, onSortChange, onColumnWidthChange }: HeaderProps) {
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)

  const handleSort = (column: Column) => {
    if (!enableSorting || !onSortChange) return

    if (sortConfig?.column === column.name) {
      if (sortConfig.direction === "asc") {
        onSortChange({ column: column.name, direction: "desc" })
      } else {
        onSortChange(null)
      }
    } else {
      onSortChange({ column: column.name, direction: "asc" })
    }
  }

  const getSortIcon = (columnName: string) => {
    if (sortConfig?.column !== columnName) {
      return <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-3 w-3 text-foreground" />
    ) : (
      <ArrowDown className="h-3 w-3 text-foreground" />
    )
  }

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, column: Column) => {
      e.preventDefault()
      e.stopPropagation()
      setResizingColumn(column.name)
      resizeStartX.current = e.clientX
      resizeStartWidth.current = column.width || DEFAULT_COLUMN_WIDTH

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - resizeStartX.current
        const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeStartWidth.current + delta)
        onColumnWidthChange?.(column.name, newWidth)
      }

      const handleMouseUp = () => {
        setResizingColumn(null)
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    },
    [onColumnWidthChange],
  )

  return (
    <thead className="sticky top-0 z-10">
      <tr className="bg-card">
        <th className="w-12 border-b border-r border-border/50 bg-card px-3 py-2.5 text-right font-normal text-muted-foreground/50">
          #
        </th>
        {columns.map((column) => (
          <th
            key={column.name}
            onClick={() => handleSort(column)}
            style={{ width: column.width || (column.isPrimary ? 80 : DEFAULT_COLUMN_WIDTH) }}
            className={cn(
              "group relative border-b border-r border-border/50 bg-card px-3 py-2.5 text-left",
              enableSorting && "cursor-pointer select-none hover:bg-accent/30",
              resizingColumn === column.name && "bg-accent/30",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 overflow-hidden">
                {column.isPrimary && <Key className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                <span className="truncate font-medium text-foreground/90">{column.name}</span>
                <span className="shrink-0 text-[10px] font-normal text-muted-foreground/40">{column.type}</span>
              </div>
              {enableSorting && getSortIcon(column.name)}
            </div>
            <div
              onMouseDown={(e) => handleResizeStart(e, column)}
              className={cn(
                "absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors",
                "hover:bg-primary/50",
                resizingColumn === column.name && "bg-primary",
              )}
            />
          </th>
        ))}
      </tr>
    </thead>
  )
}
