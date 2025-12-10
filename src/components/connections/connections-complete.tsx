'use client'

import { Cable, Plus, Settings2, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import type { ConnectionInfo } from '@/types/database'

type ConnectionsCompleteProps = {
  connections: ConnectionInfo[]
  selectedConnection: string | null
  establishingConnections: Set<string>
  onSelectConnection?: (connectionId: string) => void
  onConnectToDatabase?: (connectionId: string) => void
  onShowConnectionForm?: () => void
  onEditConnection?: (connection: ConnectionInfo) => void
  onDeleteConnection?: (connectionId: string) => void
  onDisconnectConnection?: (connectionId: string) => void
}

export function ConnectionsComplete({
  connections,
  selectedConnection,
  establishingConnections,
  onSelectConnection,
  onConnectToDatabase,
  onShowConnectionForm,
  onEditConnection,
  onDeleteConnection,
  onDisconnectConnection,
}: ConnectionsCompleteProps) {
  const selectedConnectionInfo = connections.find(conn => conn.id === selectedConnection)

  function getDatabaseDisplay(conn: ConnectionInfo): string {
    const dbType = conn.database_type
    if ('Postgres' in dbType) {
      return dbType.Postgres.connection_string
        .replace(/^postgresql?:\/\/[^@]*@/, '')
        .replace(/\/[^?]*/, '')
    } else if ('SQLite' in dbType) {
      return dbType.SQLite.db_path.split('/').pop() || dbType.SQLite.db_path
    }
    return ''
  }

  function getDatabaseIcon(conn: ConnectionInfo) {
    if ('Postgres' in conn.database_type) {
      return <Cable className="h-4 w-4" />
    } else if ('SQLite' in conn.database_type) {
      return <Cable className="h-4 w-4" />
    }
    return <Cable className="h-4 w-4" />
  }

  return (
    <div className="flex h-full flex-col space-y-2">
      {/* Actions */}
      <div className="flex gap-1">
        <button
          title="Add"
          className="h-7 w-7 rounded-xs p-1 hover:bg-accent"
          onClick={onShowConnectionForm}
        >
          <Plus size={20} strokeWidth={1} />
        </button>
        <button
          disabled={!selectedConnectionInfo}
          title="Edit"
          className="h-7 w-7 rounded-xs p-1 disabled:opacity-40 enabled:hover:bg-accent"
          onClick={() => selectedConnectionInfo && onEditConnection?.(selectedConnectionInfo)}
        >
          <Settings2 size={20} strokeWidth={1} />
        </button>
        <button
          disabled={!selectedConnectionInfo?.connected}
          title="Disconnect"
          className="h-7 w-7 rounded-xs p-1 disabled:opacity-40 enabled:hover:bg-error/20 enabled:text-error"
          onClick={() => selectedConnectionInfo && onDisconnectConnection?.(selectedConnectionInfo.id)}
        >
          <Unplug size={20} strokeWidth={1} />
        </button>
      </div>

      {/* List */}
      <div className="scrollable-container flex-1 space-y-1 overflow-y-auto">
        {connections.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="mb-3 inline-flex rounded-lg border border-border/50 bg-muted/30 p-3">
              <Cable className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">No connections yet</p>
            <p className="text-xs text-muted-foreground/70">Add your first connection to get started</p>
          </div>
        ) : (
          connections.map((connection) => (
            <ContextMenu key={connection.id}>
              <ContextMenuTrigger>
                <Button
                  variant="ghost"
                  className={`w-full justify-start rounded-sm p-1 transition-all duration-200 ${selectedConnection === connection.id
                    ? 'bg-primary/20'
                    : 'hover:bg-background hover:bg-primary/20'
                    }`}
                  onClick={() => onSelectConnection?.(connection.id)}
                  onDoubleClick={() => onConnectToDatabase?.(connection.id)}
                >
                  <div className="flex w-full items-center gap-2.5">
                    <div className="flex shrink-0 items-center gap-2 pl-1">
                      {/* Connection status dot */}
                      {connection.connected ? (
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-sm" />
                      ) : establishingConnections.has(connection.id) ? (
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500 shadow-sm" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      )}

                      {getDatabaseIcon(connection)}
                    </div>
                    <div className="truncate text-sm font-medium text-foreground">
                      <div className="min-w-0 flex-1 text-left">{connection.name}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {getDatabaseDisplay(connection)}
                      </div>
                    </div>
                  </div>
                </Button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => {
                    if (connection.connected) {
                      onDisconnectConnection?.(connection.id)
                    } else {
                      onConnectToDatabase?.(connection.id)
                    }
                  }}
                >
                  {connection.connected ? 'Disconnect' : 'Connect'}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onEditConnection?.(connection)}>
                  Edit Connection
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    const str = getDatabaseDisplay(connection)
                    if (str) navigator.clipboard.writeText(str)
                  }}
                >
                  Copy Connection String
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-error focus:text-error"
                  onClick={() => onDeleteConnection?.(connection.id)}
                >
                  Delete Connection
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))
        )}
      </div>
    </div>
  )
}
