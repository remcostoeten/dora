'use client'

import { useEffect, useState } from 'react'
import { getConnectionHistory } from '@/core/tauri'
import type { ConnectionHistoryEntry } from '@/types/database'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Database, RefreshCw } from 'lucide-react'

type FilterState = {
    dbType: string | null
    success: boolean | null
}

export function ConnectionHistoryPanel() {
    const [history, setHistory] = useState<ConnectionHistoryEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterState>({ dbType: null, success: null })

    async function loadHistory() {
        setLoading(true)
        try {
            const data = await getConnectionHistory(
                filter.dbType || undefined,
                filter.success ?? undefined,
                50
            )
            setHistory(data)
        } catch (error) {
            console.error('Failed to load connection history:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadHistory()
    }, [filter])

    function formatTime(timestamp: number) {
        return new Date(timestamp * 1000).toLocaleString()
    }

    return (
        <div className="flex h-full flex-col space-y-3 p-2">
            {/* Filters */}
            <div className="flex items-center gap-2">
                <select
                    className="rounded border bg-background px-2 py-1 text-sm"
                    value={filter.dbType || ''}
                    onChange={(e) => setFilter({ ...filter, dbType: e.target.value || null })}
                >
                    <option value="">All Types</option>
                    <option value="postgres">PostgreSQL</option>
                    <option value="sqlite">SQLite</option>
                </select>
                <select
                    className="rounded border bg-background px-2 py-1 text-sm"
                    value={filter.success === null ? '' : String(filter.success)}
                    onChange={(e) =>
                        setFilter({
                            ...filter,
                            success: e.target.value === '' ? null : e.target.value === 'true',
                        })
                    }
                >
                    <option value="">All Status</option>
                    <option value="true">Success</option>
                    <option value="false">Failed</option>
                </select>
                <Button variant="ghost" size="sm" onClick={loadHistory} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* History List */}
            <div className="flex-1 space-y-1 overflow-y-auto">
                {history.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                        {loading ? 'Loading...' : 'No connection history yet'}
                    </div>
                ) : (
                    history.map((entry) => (
                        <div
                            key={entry.id}
                            className="flex items-center gap-2 rounded-sm border border-border/50 bg-muted/30 p-2"
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
                    ))
                )}
            </div>
        </div>
    )
}
