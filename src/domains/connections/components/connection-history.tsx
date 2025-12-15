'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { CheckCircle2, XCircle, Database, RefreshCw } from 'lucide-react'
import type { ConnectionHistoryProps } from '../types'
import * as connectionCommands from '../api/connection-commands'

export function ConnectionHistory({ connections }: ConnectionHistoryProps) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadHistory() {
    setLoading(true)
    try {
      const data = await connectionCommands.getConnectionHistory()
      setHistory(data)
    } catch (error) {
      console.error('Failed to load connection history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  function formatTime(timestamp: number) {
    return new Date(timestamp * 1000).toLocaleString()
  }

  return (
    <div className="flex h-full flex-col space-y-3 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Connection History</h3>
        <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {loading ? 'Loading...' : 'No connection history yet'}
          </div>
        ) : (
          <div className="space-y-1">
            {history.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center gap-2 rounded-sm bg-muted/30 p-2 ${
                  index < history.length - 1 ? 'border-b border-border/30' : ''
                }`}
              >
                {entry.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                )}
                <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{entry.connection_name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="uppercase">{entry.database_type}</span>
                    <span>•</span>
                    <span>{formatTime(entry.attempted_at)}</span>
                    {entry.duration_ms && (
                      <>
                        <span>•</span>
                        <span>{entry.duration_ms}ms</span>
                      </>
                    )}
                  </div>
                  {entry.error_message && (
                    <div className="mt-1 truncate text-xs text-red-400">{entry.error_message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
