"use client"

import { cn } from "@/shared/utils"
import { ConnStatus } from "./conn-status"
import { TableList } from "./table-list"
import { TableSchemaView } from "./table-schema"
import { useResize } from "@/shared/hooks"
import type { DbConnection, TableInfo, TableSchema } from "@/shared/types"

type Props = {
  connections: DbConnection[]
  activeId: string | null
  onSetActive: (id: string) => void
  onAddConn?: () => void
  onEditConn?: (id: string) => void
  onDeleteConn?: (id: string) => void
  tables: TableInfo[]
  selectedTable: string | null
  onSelectTable: (name: string) => void
  onTableOpen: (name: string) => void
  onRefresh?: () => void
  tableSchema: TableSchema | null
  className?: string
  onDeleteTable?: (name: string) => void
  onDuplicateTable?: (name: string, newName: string, includeData: boolean) => void
  onRenameTable?: (name: string, newName: string) => void
  onExportTable?: (name: string, format: "sql" | "json") => void
}

export function Sidebar({
  connections,
  activeId,
  onSetActive,
  onAddConn,
  onEditConn,
  onDeleteConn,
  tables,
  selectedTable,
  onSelectTable,
  onTableOpen,
  onRefresh,
  tableSchema,
  className,
  onDeleteTable,
  onDuplicateTable,
  onRenameTable,
  onExportTable,
}: Props) {
  const { size, isDragging, handleStart } = useResize({
    min: 180,
    max: 480,
    initial: 240,
  })

  return (
    <div
      className={cn("relative flex h-full flex-col border-r border-border bg-background", className)}
      style={{ width: size }}
    >
      <ConnStatus
        connections={connections}
        activeId={activeId}
        onSetActive={onSetActive}
        onAddConn={onAddConn}
        onEditConn={onEditConn}
        onDeleteConn={onDeleteConn}
      />
      <TableList
        tables={tables}
        selectedTable={selectedTable}
        onSelectTable={onSelectTable}
        onTableOpen={onTableOpen}
        onRefresh={onRefresh}
        onDeleteTable={onDeleteTable}
        onDuplicateTable={onDuplicateTable}
        onRenameTable={onRenameTable}
        onExportTable={onExportTable}
      />
      <TableSchemaView schema={tableSchema} />

      <div
        onMouseDown={handleStart}
        className={cn(
          "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20",
          isDragging && "bg-primary/30",
        )}
      />
    </div>
  )
}
