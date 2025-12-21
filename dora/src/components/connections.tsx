'use client'

import { useEffect, useState } from 'react'
import { Database, Trash2, Plus } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { getConnections, connectToDatabase, removeConnection } from '@/lib/tauri-commands'
import type { ConnectionInfo } from '@/types/database'

type ConnectionsProps = {
  onConnect?: (connection: ConnectionInfo) => void
  onNewConnection?: () => void
}

export function Connections({ onConnect, onNewConnection }: ConnectionsProps) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [connectingId, setConnectingId] = useState<string | null>(null)

  async function loadConnections() {
    try {
      const list = await getConnections()
      setConnections(list)
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConnections()
  }, [])

  async function handleConnect(connection: ConnectionInfo) {
    setConnectingId(connection.id)
    try {
      await connectToDatabase(connection.id)
      onConnect?.(connection)
    } catch (error) {
      console.error('Failed to connect:', error)
      alert('Failed to connect: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setConnectingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this connection?')) return
    try {
      await removeConnection(id)
      await loadConnections()
    } catch (error) {
      console.error('Failed to delete connection:', error)
    }
  }

  function getDatabaseType(info: ConnectionInfo): string {
    const dbType = info.database_type
    if ('Postgres' in dbType) {
      return 'postgres'
    } else if ('SQLite' in dbType) {
      return 'sqlite'
    }
    return 'unknown'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading connections...</div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Connections</h2>
        <Button size="sm" onClick={onNewConnection}>
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No connections yet</p>
            <Button onClick={onNewConnection}>
              <Plus className="h-4 w-4 mr-1" />
              Create Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {connections.map((connection) => (
            <Card
              key={connection.id}
              className="hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-base">{connection.name}</CardTitle>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getDatabaseType(connection)}
                        {connection.connected && (
                          <span className="ml-2 text-success">● Connected</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => handleConnect(connection)}
                      disabled={connectingId === connection.id}
                    >
                      {connectingId === connection.id ? 'Connecting...' : 'Connect'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(connection.id)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
