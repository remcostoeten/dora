'use client'

import {
    Activity,
    Database,
    ExternalLink,
    HeartPulse,
    Play,
    Plus,
    RotateCcw,
    Search,
    Square
} from 'lucide-react'

import { FeatureShowcaseRail } from '@/components/feature-showcases/feature-showcase-rail'
import { useCycleIndex } from '@/components/feature-showcases/use-showcase-motion'

const CONTAINERS = [
    {
        name: 'dora-postgres-dev',
        image: 'postgres:16-alpine',
        status: 'running' as const,
        port: '5432',
        created: '2 hours ago',
        selected: true
    },
    {
        name: 'dora-mysql-staging',
        image: 'mysql:8.0',
        status: 'running' as const,
        port: '3306',
        created: '5 hours ago',
        selected: false
    },
    {
        name: 'dora-redis-cache',
        image: 'redis:7-alpine',
        status: 'stopped' as const,
        port: '6379',
        created: '1 day ago',
        selected: false
    }
]

function StatusBadge({ status }: { status: 'running' | 'stopped' }) {
    const running = status === 'running'
    return (
        <span
            className={
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                (running
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-muted text-muted-foreground')
            }
        >
            <span
                className={
                    'h-1.5 w-1.5 rounded-full ' +
                    (running ? 'bg-emerald-400' : 'bg-muted-foreground')
                }
            />
            {running ? 'Running' : 'Stopped'}
        </span>
    )
}

export function DockerContainersShowcase() {
    const activeIndex = useCycleIndex(CONTAINERS.length, 2400)
    const selected = CONTAINERS[activeIndex] ?? CONTAINERS[0]

    return (
        <>
            <FeatureShowcaseRail demo="docker-containers" />
            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_300px]">
                <div className="flex min-w-0 flex-col bg-background">
                    <div className="flex h-12 items-center gap-3 border-b border-sidebar-border px-4">
                        <h2 className="text-sm font-medium text-foreground">
                            Containers
                        </h2>
                        <div className="ml-auto flex items-center gap-2">
                            <div className="relative w-48">
                                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <div className="h-8 rounded-[2px] border border-input bg-background pl-8 text-xs leading-8 text-muted-foreground">
                                    Search containers…
                                </div>
                            </div>
                            <span className="inline-flex h-8 items-center gap-1.5 rounded-[2px] bg-primary px-3 text-xs text-primary-foreground">
                                <Plus className="h-3.5 w-3.5" />
                                Create
                            </span>
                        </div>
                    </div>
                    <div className="grid gap-3 p-4 sm:grid-cols-2">
                        {CONTAINERS.map(function (container, index) {
                            const isSelected = index === activeIndex
                            return (
                                <div
                                    key={container.name}
                                    className={
                                        'cursor-default rounded-md border p-3 transition-colors duration-500 ' +
                                        (isSelected
                                            ? 'border-primary/50 bg-sidebar-accent/30'
                                            : 'border-sidebar-border hover:border-sidebar-border/80 hover:bg-sidebar-accent/20')
                                    }
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-foreground">
                                                {container.name}
                                            </div>
                                            <div className="truncate text-[11px] text-muted-foreground">
                                                {container.image}
                                            </div>
                                        </div>
                                        <StatusBadge status={container.status} />
                                    </div>
                                    <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                                        <span>localhost:{container.port}</span>
                                        <span>•</span>
                                        <span>{container.created}</span>
                                    </div>
                                    <div className="mt-3 flex items-center gap-1">
                                        {container.status === 'running' ? (
                                            <>
                                                <span className="flex h-7 w-7 items-center justify-center rounded-[2px] border border-sidebar-border text-muted-foreground">
                                                    <Square className="h-3 w-3" />
                                                </span>
                                                <span className="flex h-7 w-7 items-center justify-center rounded-[2px] border border-sidebar-border text-muted-foreground">
                                                    <RotateCcw className="h-3 w-3" />
                                                </span>
                                            </>
                                        ) : (
                                            <span className="flex h-7 w-7 items-center justify-center rounded-[2px] border border-sidebar-border text-muted-foreground">
                                                <Play className="h-3 w-3" />
                                            </span>
                                        )}
                                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-brand-600">
                                            <Database className="h-3 w-3" />
                                            Open in viewer
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <div className="mt-auto border-t border-sidebar-border">
                        <div className="flex h-9 items-center gap-4 border-b border-sidebar-border px-4 text-[11px]">
                            <span className="text-foreground">Logs</span>
                            <span className="text-muted-foreground">
                                Terminal
                            </span>
                        </div>
                        <div className="h-[88px] overflow-hidden bg-surface-deeper p-3 font-mono text-[10px] leading-relaxed text-emerald-400/90">
                            <div className="feature-showcase__log-scroll">
                                <div>
                                    2026-06-07 14:02:11 UTC [1] LOG: database
                                    system is ready to accept connections
                                </div>
                                <div className="text-muted-foreground">
                                    2026-06-07 14:02:11 UTC [1] LOG: listening on
                                    IPv4 address &quot;0.0.0.0&quot;, port{' '}
                                    {selected.port}
                                </div>
                                <div className="text-muted-foreground">
                                    2026-06-07 14:02:12 UTC [32] LOG: checkpoint
                                    complete: wrote 42 buffers
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <aside className="flex flex-col border-l border-sidebar-border bg-sidebar">
                    <div className="border-b border-sidebar-border px-4 py-3">
                        <div className="text-sm font-medium text-foreground">
                            {selected.name}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                            {selected.image}
                        </div>
                    </div>
                    <div className="space-y-3 p-4">
                        <div className="rounded-[2px] border border-sidebar-border bg-background/40 p-2.5">
                            <div className="text-[10px] text-muted-foreground">
                                Host port
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-sm text-foreground">
                                localhost:{selected.port}
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-[2px] border border-sidebar-border bg-background/40 p-2.5">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Activity className="h-3 w-3" />
                                    CPU
                                </div>
                                <div className="mt-1 text-sm text-foreground">
                                    2.4%
                                </div>
                            </div>
                            <div className="rounded-[2px] border border-sidebar-border bg-background/40 p-2.5">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <HeartPulse className="h-3 w-3" />
                                    Memory
                                </div>
                                <div className="mt-1 text-sm text-foreground">
                                    128 MB
                                </div>
                            </div>
                        </div>
                        <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-[2px] border border-brand-600/40 px-3 py-2 text-xs text-brand-600">
                            <Database className="h-3.5 w-3.5" />
                            Connect as database
                        </span>
                    </div>
                </aside>
            </div>
        </>
    )
}
