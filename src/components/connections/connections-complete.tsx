'use client'

import { Cable, Plus, Settings2, Unplug, Edit, Copy, Trash2, Star, StarOff, Clock, Link } from 'lucide-react'
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

  function formatLastConnected(timestamp?: number): string {
    if (!timestamp) return 'Never connected'

    const now = Date.now()
    const diff = now - timestamp * 1000 // Convert from seconds to milliseconds

    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`

    return new Date(timestamp * 1000).toLocaleDateString()
  }

  function getConnectionDetails(conn: ConnectionInfo): string {
    if ('Postgres' in conn.database_type) {
      return conn.database_type.Postgres.connection_string
    } else if ('SQLite' in conn.database_type) {
      return conn.database_type.SQLite.db_path
    }
    return ''
  }

  return (
    <div className="flex h-full flex-col">
      {/* Actions */}
      <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-border/50">
        <button
          title="Add Connection"
          className="h-8 w-8 rounded-md p-1.5 hover:bg-accent transition-colors flex items-center justify-center"
          onClick={onShowConnectionForm}
        >
          <Plus size={18} strokeWidth={1.5} />
        </button>
        <button
          disabled={!selectedConnectionInfo}
          title="Edit Connection"
          className="h-8 w-8 rounded-md p-1.5 disabled:opacity-30 enabled:hover:bg-accent transition-colors flex items-center justify-center"
          onClick={() => selectedConnectionInfo && onEditConnection?.(selectedConnectionInfo)}
        >
          <Settings2 size={18} strokeWidth={1.5} />
        </button>
        <button
          disabled={!selectedConnectionInfo?.connected}
          title="Disconnect"
          className="h-8 w-8 rounded-md p-1.5 disabled:opacity-30 enabled:hover:bg-error/20 enabled:text-error transition-colors flex items-center justify-center"
          onClick={() => selectedConnectionInfo && onDisconnectConnection?.(selectedConnectionInfo.id)}
        >
          <Unplug size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* List */}
      <div className="scrollable-container flex-1 space-y-2 overflow-y-auto">
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
                <button
                  className={`group w-full text-left rounded-lg border transition-all duration-200 p-3 ${selectedConnection === connection.id
                    ? 'bg-primary/10 border-primary/30 shadow-sm'
                    : 'bg-card/50 border-border/50 hover:bg-muted/50 hover:border-border'
                    }`}
                  onClick={() => onSelectConnection?.(connection.id)}
                  onDoubleClick={() => onConnectToDatabase?.(connection.id)}
                >
                  <div className="flex w-full items-start gap-3">
                    {/* Status & Icon */}
                    <div className="flex shrink-0 items-center gap-2 pt-0.5">
                      {/* Connection status dot */}
                      {connection.connected ? (
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
                      ) : establishingConnections.has(connection.id) ? (
                        <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      )}
                      <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {getDatabaseIcon(connection)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-sm text-foreground truncate">
                        {connection.name}
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        {getDatabaseDisplay(connection)}
                      </div>
                      {connection.last_connected_at && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 pt-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatLastConnected(connection.last_connected_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-56">
                {/* Connection Status */}
                <div className="px-2 py-1.5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{connection.name}</span>
                    <div className="flex items-center gap-1">
                      {connection.connected ? (
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-gray-400" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {connection.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                  {connection.last_connected_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Last connected: {formatLastConnected(connection.last_connected_at)}
                    </div>
                  )}
                </div>

                {/* Primary Actions */}
                <ContextMenuItem
                  onClick={() => {
                    if (connection.connected) {
                      onDisconnectConnection?.(connection.id)
                    } else {
                      onConnectToDatabase?.(connection.id)
                    }
                  }}
                  className="py-2"
                >
                  {connection.connected ? (
                    <>
                      <Unplug className="h-4 w-4 mr-2 text-error" />
                      Disconnect
                    </>
                  ) : (
                    <>
                      <Cable className="h-4 w-4 mr-2 text-success" />
                      Connect
                    </>
                  )}
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={() => onEditConnection?.(connection)}
                  className="py-2"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Connection
                </ContextMenuItem>

                {/* Favorite Toggle */}
                <ContextMenuItem className="py-2" disabled>
                  {connection.favorite ? (
                    <>
                      <StarOff className="h-4 w-4 mr-2" />
                      Remove from Favorites
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4 mr-2" />
                      Add to Favorites
                    </>
                  )}
                </ContextMenuItem>

                <ContextMenuSeparator />

                {/* Copy Actions */}
                <ContextMenuItem
                  onClick={async () => {
                    const str = getDatabaseDisplay(connection)
                    if (str) {
                      try {
                        await navigator.clipboard.writeText(str)
                      } catch (err) {
                        console.error('Failed to copy to clipboard', err)
                      }
                    }
                  }}
                  className="py-2"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Display Address
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={async () => {
                    const details = getConnectionDetails(connection)
                    if (details) {
                      try {
                        await navigator.clipboard.writeText(details)
                      } catch (err) {
                        console.error('Failed to copy to clipboard', err)
                      }
                    }
                  }}
                  className="py-2"
                >
                  <Link className="h-4 w-4 mr-2" />
                  Copy Full Connection String
                </ContextMenuItem>

                <ContextMenuSeparator />

                {/* Danger Zone */}
                <ContextMenuItem
                  className="py-2 text-error focus:text-error"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${connection.name}"? This action cannot be undone.`)) {
                      onDeleteConnection?.(connection.id)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
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
