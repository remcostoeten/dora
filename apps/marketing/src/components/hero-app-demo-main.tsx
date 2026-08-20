'use client'

import { Minus, Plus, Sparkles, Square, X } from 'lucide-react'
import { useState } from 'react'
import { DatabaseTypeIcon } from '@studio/features/connections/components/database-type-icon'
import { AiAssistantPanel } from '@/components/hero-app-demo-ai-panel'
import {
    connectionStatusColor,
    findConnection
} from '@/components/hero-app-demo-connections'
import { SchemaView } from '@/components/hero-app-demo-schema'
import { SqlConsole } from '@/components/hero-app-demo-sql-console'
import { findTable } from '@/components/hero-app-demo-tables'
import { TableWorkspace } from '@/components/hero-app-demo-workspace'
import type { TDemoView } from '@/components/hero-app-demo-views'

/**
 * Replica of the real /app main panel chrome: connection tabs with window
 * controls, table tabs, then the active view — data workspace, SQL console
 * or schema visualizer — plus the floating AI assistant.
 */

function WindowControls() {
    return (
        <div className="flex h-full shrink-0 items-center border-l border-border px-1">
            <div className="flex items-center gap-0.5 text-sidebar-foreground/75">
                <span className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted">
                    <Minus className="h-3.5 w-3.5" />
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted">
                    <Square className="h-3 w-3" />
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-destructive/90 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                </span>
            </div>
        </div>
    )
}

/** Replica of the real ConnectionTabBar: one h-8 tab per open connection, a
 *  status dot, a close affordance and a trailing add button. It stacks above
 *  the table tab bar and owns the window controls, exactly like /app. */
function ConnectionTabBar({
    openConnectionIds,
    activeConnectionId,
    onSelectConnection,
    onCloseConnection,
    onAddConnection
}: {
    openConnectionIds: string[]
    activeConnectionId: string
    onSelectConnection: (id: string) => void
    onCloseConnection: (id: string) => void
    onAddConnection: () => void
}) {
    return (
        <div className="flex items-center h-8 border-b border-border bg-sidebar shrink-0 select-none">
            <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto hero-tab-scroll">
                {openConnectionIds.map(function renderConnectionTab(id) {
                    const connection = findConnection(id)
                    const isActive = id === activeConnectionId

                    return (
                        <div
                            key={id}
                            className={
                                'relative flex items-center h-full shrink-0 border-r border-border transition-colors ' +
                                (isActive
                                    ? 'bg-background text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50')
                            }
                        >
                            <button
                                type="button"
                                onClick={() => onSelectConnection(id)}
                                className="flex items-center gap-1.5 h-full px-2 pl-3 text-xs font-medium"
                            >
                                <span
                                    aria-hidden="true"
                                    className={
                                        'h-2 w-2 shrink-0 rounded-full ' +
                                        connectionStatusColor(connection.status)
                                    }
                                />
                                <DatabaseTypeIcon
                                    type={connection.type}
                                    className="h-3.5 w-3.5 shrink-0"
                                />
                                <span className="max-w-[140px] truncate">
                                    {connection.name}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onCloseConnection(id)
                                }}
                                aria-label={`Close ${connection.name}`}
                                className="h-full px-1 pr-2 rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )
                })}
                <button
                    type="button"
                    onClick={onAddConnection}
                    aria-label="Add connection"
                    className="flex items-center justify-center h-full px-2 text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>
            <WindowControls />
        </div>
    )
}

/** One h-9 tab per open table, mirroring the real app's table tab strip. */
function TableTabBar({
    openTables,
    activeTable,
    onSelectTable,
    onCloseTable
}: {
    openTables: string[]
    activeTable: string
    onSelectTable: (name: string) => void
    onCloseTable: (name: string) => void
}) {
    return (
        <div className="flex items-center h-9 border-b border-border bg-sidebar shrink-0 select-none">
            <div className="flex h-full min-w-0 flex-1 items-center overflow-x-auto hero-tab-scroll">
                {openTables.map(function renderTableTab(name) {
                    const isActive = name === activeTable

                    return (
                        <div
                            key={name}
                            className={
                                'relative flex items-center h-full shrink-0 border-r border-border transition-colors ' +
                                (isActive
                                    ? 'bg-background text-foreground'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50')
                            }
                        >
                            <button
                                type="button"
                                onClick={() => onSelectTable(name)}
                                className="flex items-center h-full px-2 pl-3 text-xs font-medium"
                            >
                                <span className="max-w-[120px] truncate">
                                    {name}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation()
                                    onCloseTable(name)
                                }}
                                aria-label={`Close ${name}`}
                                className="h-full flex items-center px-1 pr-2 text-muted-foreground transition-colors hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

type Props = {
    activeTable: string
    openTables: string[]
    openConnectionIds: string[]
    activeConnectionId: string
    activeView: TDemoView
    onSelectView: (view: TDemoView) => void
    onSelectTable: (name: string) => void
    onCloseTable: (name: string) => void
    onSelectConnection: (id: string) => void
    onCloseConnection: (id: string) => void
    onAddConnection: () => void
}

export function DemoMain({
    activeTable,
    openTables,
    openConnectionIds,
    activeConnectionId,
    activeView,
    onSelectView,
    onSelectTable,
    onCloseTable,
    onSelectConnection,
    onCloseConnection,
    onAddConnection
}: Props) {
    const table = findTable(activeTable, activeConnectionId)
    const [aiOpen, setAiOpen] = useState(false)

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
            <div
                className="hero-app-demo__fade hero-app-demo__fade--main"
                aria-hidden="true"
            />
            <ConnectionTabBar
                openConnectionIds={openConnectionIds}
                activeConnectionId={activeConnectionId}
                onSelectConnection={onSelectConnection}
                onCloseConnection={onCloseConnection}
                onAddConnection={onAddConnection}
            />

            {activeView === 'data' && (
                <TableTabBar
                    openTables={openTables}
                    activeTable={activeTable}
                    onSelectTable={onSelectTable}
                    onCloseTable={onCloseTable}
                />
            )}

            {activeView === 'data' ? (
                <TableWorkspace
                    key={`${activeConnectionId}:${table.name}`}
                    table={table}
                />
            ) : activeView === 'sql' ? (
                <SqlConsole connection={findConnection(activeConnectionId)} />
            ) : (
                <SchemaView />
            )}

            <AiAssistantPanel
                open={aiOpen}
                tableName={activeTable}
                onClose={() => setAiOpen(false)}
                onOpenConsole={() => onSelectView('sql')}
            />

            {!aiOpen && (
                <button
                    type="button"
                    aria-label="Open AI assistant"
                    onClick={() => setAiOpen(true)}
                    className="absolute bottom-14 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow-lg transition-colors hover:bg-sidebar-accent"
                >
                    <Sparkles className="h-4 w-4 text-foreground" />
                </button>
            )}
        </main>
    )
}
