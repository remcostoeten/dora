"use client"

import type React from "react"

import { useCallback, useRef, memo } from "react"
import { cn } from "@/shared/utils"
import { Key, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import type { TableColumn, SortConfig } from "@/shared/types"

type Props = {
  columns: TableColumn[]
  enableSorting?: boolean
  sortConfig?: SortConfig | null
  onSortChange?: (config: SortConfig | null) => void
  columnWidths?: Record<string, number>
  resizingColumn?: string | null
  onResizeStart?: (e: React.MouseEvent, columnName: string) => void
  onAutoFit?: (columnName: string, contentWidths: number[]) => void
}

function HeaderComponent({
  columns,
  enableSorting,
  sortConfig,
  onSortChange,
  columnWidths = {},
  resizingColumn,
  onResizeStart,
  onAutoFit,
}: Props) {
  const headerRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())

  const handleSort = useCallback(
    (column: TableColumn) => {
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
    },
    [enableSorting, sortConfig, onSortChange],
  )

  const getSortIcon = useCallback(
    (columnName: string) => {
      if (sortConfig?.column !== columnName) {
        return <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
      }
      return sortConfig.direction === "asc" ? (
        <ArrowUp className="h-3 w-3 text-foreground" />
      ) : (
        <ArrowDown className="h-3 w-3 text-foreground" />
      )
    },
    [sortConfig],
  )

  const handleResizeDoubleClick = useCallback(
    (e: React.MouseEvent, columnName: string) => {
      e.preventDefault()
      e.stopPropagation()

      // Calculate optimal width based on header content
      const headerEl = headerRefs.current.get(columnName)
      if (headerEl && onAutoFit) {
        // Get content width from the header cell
        const contentEl = headerEl.querySelector(".header-content")
        const headerWidth = contentEl?.scrollWidth ?? 100

        // Dispatch custom event to collect cell content widths
        const event = new CustomEvent("measure-column", {
          detail: { columnName, headerWidth },
          bubbles: true,
        })
        headerEl.dispatchEvent(event)
      }
    },
    [onAutoFit],
  )

  const getColumnWidth = useCallback(
    (column: TableColumn): number | undefined => {
      if (columnWidths[column.name] !== undefined) {
        return columnWidths[column.name]
      }
      return undefined
    },
    [columnWidths],
  )

  return (
    <thead className="sticky top-0 z-10">
      <tr className="bg-card">
        <th className="w-12 border-b border-r border-border/50 bg-card px-3 py-2.5 text-right font-normal text-muted-foreground/50">
          #
        </th>
        {columns.map((column) => {
          const width = getColumnWidth(column)
          return (
            <th
              key={column.name}
              ref={(el) => {
                if (el) headerRefs.current.set(column.name, el)
              }}
              onClick={() => handleSort(column)}
              style={{
                width: width,
                minWidth: width ?? (column.isPrimary ? 80 : 120),
                maxWidth: width,
              }}
              className={cn(
                "group relative border-b border-r border-border/50 bg-card px-3 py-2.5 text-left",
                enableSorting && "cursor-pointer select-none hover:bg-accent/30",
                resizingColumn === column.name && "bg-accent/30",
              )}
            >
              <div className="header-content flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {column.isPrimary && <Key className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                  <span className="truncate font-medium text-foreground/90">{column.name}</span>
                  <span className="shrink-0 text-[10px] font-normal text-muted-foreground/40">{column.type}</span>
                </div>
                {enableSorting && getSortIcon(column.name)}
              </div>
              {onResizeStart && (
                <div
                  onMouseDown={(e) => onResizeStart(e, column.name)}
                  onDoubleClick={(e) => handleResizeDoubleClick(e, column.name)}
                  className={cn(
                    "absolute right-0 top-0 h-full w-2 -mr-1 cursor-col-resize",
                    "hover:bg-primary/40 active:bg-primary/60",
                    resizingColumn === column.name && "bg-primary/60",
                  )}
                />
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}

export const Header = memo(HeaderComponent)
