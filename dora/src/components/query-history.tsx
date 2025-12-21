'use client'

import { useEffect, useState } from 'react'
import { Clock, Play } from 'lucide-react'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { getQueryHistory } from '@/lib/tauri-commands'
import type { QueryHistoryEntry } from '@/types/database'
import type { UUID } from '@/types/base'

type QueryHistoryProps = {
  connectionId: UUID
  onExecute?: (query: string) => void
}

export function QueryHistory({ connectionId, onExecute }: QueryHistoryProps) {
  const [history, setHistory] = useState<QueryHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  async function loadHistory() {
    try {
      const data = await getQueryHistory(connectionId, 50)
      setHistory(data)
    } catch (error) {
      console.error('Failed to load query history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [connectionId])

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString()
  }

  if (loading) {
    return (
      <div className="p-4 text-muted-foreground text-sm">Loading history...</div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm">No query history yet</div>
    )
  }

  return (
    <div className="space-y-2 p-4">
      {history.map((item) => (
        <Card key={item.id} className="p-3 hover:bg-accent/50 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono text-foreground truncate">
                {item.query_text}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(item.executed_at.toString())}
                </span>
                <span>{formatDuration(item.duration_ms || 0)}</span>
                {item.row_count > 0 && <span>{item.row_count} rows</span>}
                {item.status === 'error' && (
                  <span className="text-error">Error</span>
                )}
              </div>
              {item.error_message && (
                <div className="mt-2 text-xs text-error bg-error-light p-2 rounded">
                  {item.error_message}
                </div>
              )}
            </div>
            {onExecute && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onExecute(item.query_text)}
                className="h-8 w-8 shrink-0"
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
