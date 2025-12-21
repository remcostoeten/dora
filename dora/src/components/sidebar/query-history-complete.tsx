'use client'

import { History } from 'lucide-react'
import type { QueryHistoryEntry } from '@/types/database'

type Props = {
  queryHistory: QueryHistoryEntry[]
  onLoadFromHistory?: (historyQuery: string) => void
}

export function QueryHistoryComplete({
  queryHistory,
  onLoadFromHistory,
}: Props) {
  function formatDuration(durationMs: number | null): string {
    if (durationMs === null) return 'N/A'
    if (durationMs < 1000) return `${durationMs}ms`
    return `${(durationMs / 1000).toFixed(2)}s`
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return `${seconds}s ago`
  }

  return (
    <div className="scrollable-container h-full space-y-1 overflow-y-auto">
      {queryHistory.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="mb-3 inline-flex rounded-lg border border-border/50 bg-muted/30 p-3">
            <History className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">No query history yet</p>
          <p className="text-xs text-muted-foreground/70">
            Execute queries to see them appear here
          </p>
        </div>
      ) : (
        queryHistory.map((entry) => (
          <button
            key={entry.id}
            className="group w-full rounded-sm p-2 text-left transition-all duration-200 hover:bg-primary/10"
            onClick={() => onLoadFromHistory?.(entry.query_text)}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(entry.executed_at)}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDuration(entry.duration_ms)}
              </span>
            </div>
            <div className="truncate font-mono text-xs text-foreground">
              {entry.query_text}
            </div>
            {entry.error_message && (
              <div className="mt-1 truncate text-xs text-red-500">
                Error: {entry.error_message}
              </div>
            )}
            {!entry.error_message && entry.row_count > 0 && (
              <div className="mt-1 text-xs text-muted-foreground/70">
                {entry.row_count} row{entry.row_count !== 1 ? 's' : ''}
              </div>
            )}
          </button>
        ))
      )}
    </div>
  )
}
