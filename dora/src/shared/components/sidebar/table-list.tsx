"use client"

import { useState } from "react"
import {
  Table2,
  Eye,
  Search,
  ChevronRight,
  RefreshCw,
  Trash2,
  Copy,
  FileJson,
  FileCode,
  Edit3,
  CopyPlus,
} from "lucide-react"
import { Input } from "@/shared/ui/input"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/shared/ui/context-menu"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { cn } from "@/shared/utils"
import type { TableInfo } from "@/shared/types"

type DialogState = {
  type: "delete" | "duplicate" | "rename" | null
  tableName: string | null
}

type Props = {
  tables: TableInfo[]
  selectedTable: string | null
  onSelectTable: (name: string) => void
  onTableOpen: (name: string) => void
  onRefresh?: () => void
  onDeleteTable?: (name: string) => void
  onDuplicateTable?: (name: string, newName: string, includeData: boolean) => void
  onRenameTable?: (name: string, newName: string) => void
  onExportTable?: (name: string, format: "sql" | "json") => void
}

export function TableList({
  tables,
  selectedTable,
  onSelectTable,
  onTableOpen,
  onRefresh,
  onDeleteTable,
  onDuplicateTable,
  onRenameTable,
  onExportTable,
}: Props) {
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["public"]))
  const [dialog, setDialog] = useState<DialogState>({ type: null, tableName: null })
  const [newName, setNewName] = useState("")
  const [includeData, setIncludeData] = useState(true)

  const filteredTables = tables.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))

  const grouped = filteredTables.reduce(
    (acc, table) => {
      const schema = table.schema || "public"
      if (!acc[schema]) acc[schema] = []
      acc[schema].push(table)
      return acc
    },
    {} as Record<string, TableInfo[]>,
  )

  const toggleSchema = (schema: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(schema)) {
        next.delete(schema)
      } else {
        next.add(schema)
      }
      return next
    })
  }

  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name)
  }

  const openDuplicateDialog = (name: string) => {
    setDialog({ type: "duplicate", tableName: name })
    setNewName(`${name}_copy`)
    setIncludeData(true)
  }

  const openRenameDialog = (name: string) => {
    setDialog({ type: "rename", tableName: name })
    setNewName(name)
  }

  const handleConfirmDuplicate = () => {
    if (dialog.tableName && newName) {
      onDuplicateTable?.(dialog.tableName, newName, includeData)
    }
    setDialog({ type: null, tableName: null })
  }

  const handleConfirmRename = () => {
    if (dialog.tableName && newName && newName !== dialog.tableName) {
      onRenameTable?.(dialog.tableName, newName)
    }
    setDialog({ type: null, tableName: null })
  }

  const handleTableClick = (tableName: string) => {
    onSelectTable(tableName)
    onTableOpen(tableName)
  }

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-sidebar-border px-3 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tables..."
              className="h-7 bg-sidebar-accent border-0 pl-7 text-xs placeholder:text-muted-foreground"
            />
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {Object.entries(grouped).map(([schema, schemaTables]) => (
            <div key={schema}>
              <button
                onClick={() => toggleSchema(schema)}
                className="flex w-full items-center gap-1 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-sidebar-foreground"
              >
                <ChevronRight className={cn("h-3 w-3 transition-transform", expanded.has(schema) && "rotate-90")} />
                {schema}
                <span className="ml-auto font-normal tabular-nums">{schemaTables.length}</span>
              </button>
              {expanded.has(schema) && (
                <div className="pb-1">
                  {schemaTables.map((table) => (
                    <ContextMenu key={table.name}>
                      <ContextMenuTrigger asChild>
                        <button
                          onClick={() => handleTableClick(table.name)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-sidebar-accent",
                            selectedTable === table.name && "bg-sidebar-accent",
                          )}
                        >
                          {table.type === "view" ? (
                            <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="flex-1 truncate text-sidebar-foreground">{table.name}</span>
                          {table.rowCount !== undefined && (
                            <span className="text-[10px] tabular-nums text-muted-foreground">
                              {table.rowCount.toLocaleString()}
                            </span>
                          )}
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56">
                        <ContextMenuItem onClick={() => onTableOpen(table.name)}>
                          <Table2 className="mr-2 h-3.5 w-3.5" />
                          Open in new tab
                          <ContextMenuShortcut>Enter</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => handleCopyName(table.name)}>
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Copy name
                        </ContextMenuItem>
                        {onDuplicateTable && (
                          <ContextMenuItem onClick={() => openDuplicateDialog(table.name)}>
                            <CopyPlus className="mr-2 h-3.5 w-3.5" />
                            Duplicate table...
                          </ContextMenuItem>
                        )}
                        {onRenameTable && (
                          <ContextMenuItem onClick={() => openRenameDialog(table.name)}>
                            <Edit3 className="mr-2 h-3.5 w-3.5" />
                            Rename table...
                          </ContextMenuItem>
                        )}
                        {onExportTable && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuSub>
                              <ContextMenuSubTrigger>
                                <FileCode className="mr-2 h-3.5 w-3.5" />
                                Export data
                              </ContextMenuSubTrigger>
                              <ContextMenuSubContent className="w-44">
                                <ContextMenuItem onClick={() => onExportTable(table.name, "sql")}>
                                  <FileCode className="mr-2 h-3.5 w-3.5" />
                                  Export as SQL
                                  <ContextMenuShortcut>.sql</ContextMenuShortcut>
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => onExportTable(table.name, "json")}>
                                  <FileJson className="mr-2 h-3.5 w-3.5" />
                                  Export as JSON
                                  <ContextMenuShortcut>.json</ContextMenuShortcut>
                                </ContextMenuItem>
                              </ContextMenuSubContent>
                            </ContextMenuSub>
                          </>
                        )}
                        {onDeleteTable && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onClick={() => setDialog({ type: "delete", tableName: table.name })}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Drop table...
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={dialog.type === "delete"}
        onOpenChange={(open) => !open && setDialog({ type: null, tableName: null })}
        onConfirm={() => {
          if (dialog.tableName) onDeleteTable?.(dialog.tableName)
          setDialog({ type: null, tableName: null })
        }}
        title="Drop table"
        desc={`Are you sure you want to drop table "${dialog.tableName}"? This will permanently delete all data and cannot be undone.`}
        variant="danger"
        confirmText="Drop table"
      />

      <ConfirmDialog
        open={dialog.type === "duplicate"}
        onOpenChange={(open) => !open && setDialog({ type: null, tableName: null })}
        onConfirm={handleConfirmDuplicate}
        title="Duplicate table"
        desc={`Create a copy of "${dialog.tableName}"`}
        variant="default"
        confirmText="Duplicate"
      >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">New table name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new table name"
              className="h-9"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include-data"
              checked={includeData}
              onChange={(e) => setIncludeData(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-background"
            />
            <label htmlFor="include-data" className="text-sm text-muted-foreground">
              Include table data
            </label>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog.type === "rename"}
        onOpenChange={(open) => !open && setDialog({ type: null, tableName: null })}
        onConfirm={handleConfirmRename}
        title="Rename table"
        desc={`Rename "${dialog.tableName}" to a new name`}
        variant="default"
        confirmText="Rename"
      >
        <div className="space-y-2 py-2">
          <label className="text-sm font-medium text-foreground">New table name</label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter new table name"
            className="h-9"
            autoFocus
          />
        </div>
      </ConfirmDialog>
    </>
  )
}
