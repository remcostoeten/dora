import { Bell, Trash2, ArrowDownRight, ArrowUpRight, Pencil } from 'lucide-react'
import { useRef, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { cn } from '@/shared/utils/cn'
import type { ChangeEvent, ChangeType } from '../hooks/use-live-monitor'

type TProps = {
    events: ChangeEvent[]
    unreadCount: number
    onClear: () => void
    onMarkRead: () => void
}

const CHANGE_ICONS: Record<ChangeType, typeof ArrowDownRight> = {
    insert: ArrowDownRight,
    update: Pencil,
    delete: Trash2
}

const CHANGE_COLORS: Record<ChangeType, string> = {
    insert: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    update: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    delete: 'bg-red-500/15 text-red-400 border-red-500/30'
}

const CHANGE_DOT_COLORS: Record<ChangeType, string> = {
    insert: 'bg-emerald-400',
    update: 'bg-amber-400',
    delete: 'bg-red-400'
}

function formatTimestamp(ts: number): string {
    const date = new Date(ts)
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${hours}:${minutes}:${seconds}`
}

function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return `${Math.floor(diff / 3600000)}h ago`
}

export function ChangeFeed({ events, unreadCount, onClear, onMarkRead }: TProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(function scrollToTop() {
        if (scrollRef.current && events.length > 0) {
            scrollRef.current.scrollTop = 0
        }
    }, [events.length])

    return (
        <Popover onOpenChange={function (open) {
            if (open) onMarkRead()
        }}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 relative"
                    title={unreadCount > 0 ? `${unreadCount} unread changes` : 'Change feed'}
                >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-emerald-500 text-[10px] font-medium text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0"
                align="end"
                sideOffset={8}
            >
                <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
                    <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Changes</span>
                        {events.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                {events.length}
                            </Badge>
                        )}
                    </div>
                    {events.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground"
                            onClick={onClear}
                        >
                            Clear all
                        </Button>
                    )}
                </div>

                <div
                    ref={scrollRef}
                    className="max-h-80 overflow-y-auto"
                >
                    {events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Bell className="h-8 w-8 mb-2 opacity-40" />
                            <span className="text-sm">No changes detected</span>
                            <span className="text-xs mt-1 opacity-60">
                                Enable live monitor to start tracking
                            </span>
                        </div>
                    ) : (
                        <div className="divide-y divide-sidebar-border">
                            {events.map(function (event) {
                                const Icon = CHANGE_ICONS[event.changeType]
                                return (
                                    <div
                                        key={event.id}
                                        className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className={cn(
                                            'flex items-center justify-center h-7 w-7 rounded-md border shrink-0 mt-0.5',
                                            CHANGE_COLORS[event.changeType]
                                        )}>
                                            <Icon className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className={cn(
                                                    'h-1.5 w-1.5 rounded-full shrink-0',
                                                    CHANGE_DOT_COLORS[event.changeType]
                                                )} />
                                                <span className="text-xs font-medium text-foreground truncate">
                                                    {event.tableName}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                {event.summary}
                                            </p>
                                            <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                                                {formatTimestamp(event.timestamp)} · {formatRelativeTime(event.timestamp)}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
