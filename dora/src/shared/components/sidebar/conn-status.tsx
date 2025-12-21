"use client"

import { useState } from "react"
import { Database, ChevronDown, Check, Circle, Pencil, Trash2, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import type { DbConnection, DbType } from "@/shared/types"

type Props = {
  connections: DbConnection[]
  activeId: string | null
  onSetActive: (id: string) => void
  onAddConn?: () => void
  onEditConn?: (id: string) => void
  onDeleteConn?: (id: string) => void
}

const dbIcons: Record<DbType, string> = {
  postgresql: "PG",
  libsql: "LS",
  sqlite: "SQ",
}

export function ConnStatus({ connections, activeId, onSetActive, onAddConn, onEditConn, onDeleteConn }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const active = connections.find((c) => c.id === activeId)
  const targetConn = connections.find((c) => c.id === deleteTarget)

  return (
    <>
      <div className="border-b border-sidebar-border px-3 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent focus:outline-none">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-sidebar-accent text-[10px] font-medium text-sidebar-foreground">
              {active ? dbIcons[active.type] : <Database className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 truncate">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-sidebar-foreground">{active?.name || "No connection"}</span>
                {active && (
                  <Circle
                    className={`h-1.5 w-1.5 ${
                      active.status === "connected"
                        ? "fill-emerald-500 text-emerald-500"
                        : active.status === "connecting"
                          ? "fill-amber-500 text-amber-500"
                          : "fill-muted-foreground text-muted-foreground"
                    }`}
                  />
                )}
              </div>
              {active && <div className="text-[11px] text-muted-foreground truncate">{active.database}</div>}
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {connections.map((conn) => (
              <div key={conn.id}>
                <DropdownMenuItem onClick={() => onSetActive(conn.id)} className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-accent text-[9px] font-medium">
                    {dbIcons[conn.type]}
                  </div>
                  <div className="flex-1 truncate">
                    <div className="text-sm">{conn.name}</div>
                    <div className="text-[10px] text-muted-foreground">{conn.database}</div>
                  </div>
                  {conn.id === activeId && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
                <div className="flex items-center gap-0.5 px-2 pb-1">
                  {onEditConn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditConn(conn.id)
                      }}
                      className="flex h-6 flex-1 items-center justify-center gap-1.5 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                  {onDeleteConn && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(conn.id)
                      }}
                      className="flex h-6 flex-1 items-center justify-center gap-1.5 rounded text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  )}
                </div>
                <DropdownMenuSeparator />
              </div>
            ))}
            {onAddConn && (
              <DropdownMenuItem onClick={onAddConn} className="text-muted-foreground">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Add connection...
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDeleteConn?.(deleteTarget)
        }}
        title="Delete connection"
        desc={`Are you sure you want to delete connection "${targetConn?.name}"? This will remove the connection from your saved connections.`}
        variant="danger"
        confirmText="Delete"
      />
    </>
  )
}
