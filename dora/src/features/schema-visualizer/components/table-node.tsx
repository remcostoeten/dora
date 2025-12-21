"use client"

import { memo, type MouseEvent } from "react"
import { Key, Link2, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SchemaNode, VisualizerConfig } from "../types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

type TableNodeProps = {
  node: SchemaNode
  config: VisualizerConfig
  isSelected: boolean
  isDragging: boolean
  onSelect: (id: string) => void
  onDragStart: (e: MouseEvent, id: string) => void
  onOpenInDataView?: (tableName: string) => void
}

export const TableNode = memo(function TableNode({
  node,
  config,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
  onOpenInDataView,
}: TableNodeProps) {
  return (
    <div
      className={cn(
        "absolute min-w-[200px] max-w-[280px] rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm shadow-xl transition-all",
        isSelected && "ring-2 ring-primary/60 shadow-2xl",
        isDragging && "cursor-grabbing shadow-2xl opacity-90 scale-105",
      )}
      style={{
        left: node.position.x,
        top: node.position.y,
      }}
      onClick={() => onSelect(node.id)}
      onMouseDown={(e) => onDragStart(e, node.id)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-secondary/30 px-3 py-2 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground/60 text-xs font-mono">/</span>
          <span className="font-semibold text-sm truncate text-foreground">{node.name}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 hover:bg-accent/80"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
              <span className="sr-only">Table options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenInDataView?.(node.name)}>Open in Data View</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(node.name)}>Copy name</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Columns */}
      <div className="py-0.5">
        {node.columns.map((col) => (
          <div
            key={col.name}
            className="flex items-center justify-between gap-3 px-3 py-1.5 hover:bg-accent/40 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              {/* Connection point for foreign keys */}
              {col.isForeignKey && (
                <div className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-primary/80 bg-card shadow-sm" />
              )}

              {/* Icons */}
              {col.isPrimary && config.highlightPrimaryKeys && <Key className="h-3 w-3 text-amber-400 shrink-0" />}
              {col.isForeignKey && config.highlightForeignKeys && <Link2 className="h-3 w-3 text-primary shrink-0" />}

              <span
                className={cn("text-sm truncate", col.isPrimary ? "font-medium text-foreground" : "text-foreground/90")}
              >
                {col.name}
              </span>
            </div>

            {config.showTypes && (
              <span className="text-xs text-muted-foreground/80 font-mono shrink-0">
                {col.type}
                {config.showNullable && col.isNullable && "?"}
              </span>
            )}

            {/* Connection point on right for primary keys */}
            {col.isPrimary && (
              <div className="absolute -right-1.5 w-3 h-3 rounded-full border-2 border-amber-400/80 bg-card shadow-sm" />
            )}
          </div>
        ))}
      </div>

      {/* Composite key indicator */}
      {node.columns.filter((c) => c.isPrimary).length > 1 && (
        <div className="border-t border-border/40 px-3 py-1.5 text-xs text-muted-foreground/70 bg-secondary/20">
          {node.columns
            .filter((c) => c.isPrimary)
            .map((c) => c.name)
            .join(",")}
        </div>
      )}
    </div>
  )
})
