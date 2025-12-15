'use client'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Plus, Settings, Trash2, Database } from 'lucide-react'
import type { ConnectionListProps } from '../types'

export function ConnectionList({
  connections,
  selectedConnection,
  establishingConnections,
  onSelectConnection,
  onConnectToDatabase,
  onEditConnection,
  onDeleteConnection,
  onUpdateConnectionColor,
  onDisconnectConnection,
  onShowConnectionForm,
}: ConnectionListProps) {
  const handleConnect = (id: string) => {
    const connection = connections.find(c => c.id === id)
    if (connection?.connected) {
      onDisconnectConnection(id)
    } else {
      onConnectToDatabase(id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Connections</h3>
        <Button size="sm" onClick={onShowConnectionForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No connections yet</p>
              <p className="text-sm">Create your first database connection</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {connections.map((connection) => (
            <Card
              key={connection.id}
              className={`cursor-pointer transition-colors ${
                selectedConnection === connection.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => onSelectConnection(connection.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: connection.color || '#6b7280' }}
                    />
                    <div>
                      <h4 className="font-medium">{connection.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {connection.connected ? 'Connected' : 'Disconnected'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={connection.connected ? 'destructive' : 'default'}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleConnect(connection.id)
                      }}
                      disabled={establishingConnections.has(connection.id)}
                    >
                      {establishingConnections.has(connection.id)
                        ? 'Connecting...'
                        : connection.connected
                        ? 'Disconnect'
                        : 'Connect'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditConnection(connection)
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteConnection(connection.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
