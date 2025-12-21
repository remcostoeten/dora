"use client"

import type React from "react"
import { Key, Link2, Hash, Type, Calendar, ToggleLeft, ChevronDown } from "lucide-react"
import { cn } from "@/shared/utils"
import type { TableSchema, ColumnInfo } from "@/shared/types"
import { useState } from "react"

type Props = {
  schema: TableSchema | null
  className?: string
}

const typeIcons: Record<string, React.ReactNode> = {
  int: <Hash className="h-3 w-3" />,
  int4: <Hash className="h-3 w-3" />,
  int8: <Hash className="h-3 w-3" />,
  serial: <Hash className="h-3 w-3" />,
  bigserial: <Hash className="h-3 w-3" />,
  float: <Hash className="h-3 w-3" />,
  numeric: <Hash className="h-3 w-3" />,
  varchar: <Type className="h-3 w-3" />,
  text: <Type className="h-3 w-3" />,
  char: <Type className="h-3 w-3" />,
  bool: <ToggleLeft className="h-3 w-3" />,
  boolean: <ToggleLeft className="h-3 w-3" />,
  timestamp: <Calendar className="h-3 w-3" />,
  timestamptz: <Calendar className="h-3 w-3" />,
  date: <Calendar className="h-3 w-3" />,
  time: <Calendar className="h-3 w-3" />,
}

function getIcon(type: string) {
  const baseType = type
    .toLowerCase()
    .replace(/$$.*$$/, "")
    .trim()
  return typeIcons[baseType] || <Type className="h-3 w-3" />
}

function ColumnRow({ column }: { column: ColumnInfo }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-sidebar-accent">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
        {column.isPrimary ? (
          <Key className="h-3 w-3 text-amber-500" />
        ) : column.isForeignKey ? (
          <Link2 className="h-3 w-3 text-blue-400" />
        ) : (
          getIcon(column.type)
        )}
      </span>
      <span className={cn("flex-1 truncate", column.isPrimary && "font-medium")}>{column.name}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground font-mono">{column.type}</span>
      {column.isNullable && <span className="text-[9px] text-muted-foreground">?</span>}
    </div>
  )
}

export function TableSchemaView({ schema, className }: Props) {
  const [showIndexes, setShowIndexes] = useState(false)

  if (!schema) {
    return (
      <div className={cn("border-t border-sidebar-border px-3 py-4", className)}>
        <p className="text-xs text-muted-foreground text-center">Select a table to view schema</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col border-t border-sidebar-border", className)}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Structure</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">{schema.columns.length} columns</span>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {schema.columns.map((col) => (
          <ColumnRow key={col.name} column={col} />
        ))}
      </div>
      {schema.indexes && schema.indexes.length > 0 && (
        <>
          <button
            onClick={() => setShowIndexes(!showIndexes)}
            className="flex items-center gap-1 border-t border-sidebar-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", !showIndexes && "-rotate-90")} />
            Indexes
            <span className="ml-auto font-normal tabular-nums">{schema.indexes.length}</span>
          </button>
          {showIndexes && (
            <div className="max-h-32 overflow-y-auto pb-1">
              {schema.indexes.map((idx) => (
                <div key={idx.name} className="flex items-center gap-2 px-3 py-1 text-xs">
                  <span className="truncate flex-1 text-sidebar-foreground">{idx.name}</span>
                  {idx.isUnique && <span className="text-[9px] uppercase text-muted-foreground">unique</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
