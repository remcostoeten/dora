import { Clock, Trash2, Play, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useQueryHistory } from '../stores/query-history-store'
import { cn } from '@/shared/utils/cn'

type Props = {
    onSelectQuery: (query: string) => void
    currentConnectionId?: string
}

export function QueryHistoryPanel({ onSelectQuery, currentConnectionId }: Props) {
    const { history, clearHistory, removeFromHistory } = useQueryHistory()

    function formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    function formatDuration(ms: number): string {
        if (ms < 1000) return `${ms}ms`
        return `${(ms / 1000).toFixed(2)}s`
    }

    function truncateQuery(query: string, maxLength: number = 80): string {
        const singleLine = query.replace(/\s+/g, ' ').trim()
        if (singleLine.length <= maxLength) return singleLine
        return singleLine.substring(0, maxLength) + '...'
    }

    const filteredHistory = currentConnectionId
        ? history.filter(function (item) { return item.connectionId === currentConnectionId })
        : history

    return (
        <div className='flex flex-col h-full bg-sidebar border-r border-sidebar-border'>
            <div className='flex items-center justify-between px-3 py-2 border-b border-sidebar-border'>
                <div className='flex items-center gap-2'>
                    <Clock className='h-4 w-4 text-muted-foreground' />
                    <span className='text-xs font-medium'>History</span>
                </div>
                {filteredHistory.length > 0 && (
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={clearHistory}
                        className='h-6 px-2 text-xs text-muted-foreground hover:text-destructive'
                    >
                        Clear
                    </Button>
                )}
            </div>

            <ScrollArea className='flex-1'>
                {filteredHistory.length === 0 ? (
                    <div className='flex flex-col items-center justify-center h-32 text-muted-foreground'>
                        <Clock className='h-8 w-8 mb-2 opacity-50' />
                        <span className='text-xs'>No query history</span>
                    </div>
                ) : (
                    <div className='flex flex-col'>
                        {filteredHistory.map(function (item) {
                            return (
                                <div
                                    key={item.id}
                                    className='group flex flex-col px-3 py-2 border-b border-sidebar-border/50 hover:bg-sidebar-accent/50 cursor-pointer transition-colors'
                                    onClick={function () { onSelectQuery(item.query) }}
                                >
                                    <div className='flex items-start gap-2'>
                                        {item.success ? (
                                            <CheckCircle className='h-3 w-3 text-green-500 mt-0.5 shrink-0' />
                                        ) : (
                                            <XCircle className='h-3 w-3 text-red-500 mt-0.5 shrink-0' />
                                        )}
                                        <span className='text-xs font-mono text-sidebar-foreground flex-1 break-all'>
                                            {truncateQuery(item.query)}
                                        </span>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            className='h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity'
                                            onClick={function (e) {
                                                e.stopPropagation()
                                                removeFromHistory(item.id)
                                            }}
                                        >
                                            <Trash2 className='h-3 w-3 text-muted-foreground hover:text-destructive' />
                                        </Button>
                                    </div>
                                    <div className='flex items-center gap-2 mt-1 ml-5'>
                                        <span className='text-[10px] text-muted-foreground'>
                                            {formatTimestamp(item.timestamp)}
                                        </span>
                                        <span className='text-[10px] text-muted-foreground'>•</span>
                                        <span className='text-[10px] text-muted-foreground'>
                                            {formatDuration(item.executionTimeMs)}
                                        </span>
                                        {item.rowCount !== undefined && (
                                            <>
                                                <span className='text-[10px] text-muted-foreground'>•</span>
                                                <span className='text-[10px] text-muted-foreground'>
                                                    {item.rowCount} rows
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}
