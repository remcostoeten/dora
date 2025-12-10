'use client'

import { useState } from 'react'
import { Cable, Plus, ChevronLeft, ChevronRight, FileJson, TableProperties, History } from 'lucide-react'
import { Button } from './ui/button'
import { ConnectionsComplete } from './connections-complete'
import { DatabaseSchemaItems } from './database-schema-items'
import { ScriptsComplete } from './scripts-complete'
import { QueryHistoryComplete } from './query-history-complete'
import { Logo } from './logo'
import type { ConnectionInfo, Schema, Script, QueryHistoryEntry } from '@/types/database'

type SidebarTabState = 'connections' | 'items' | 'scripts' | 'history'

type AppSidebarProps = {
  connections: ConnectionInfo[]
  selectedConnection: string | null
  establishingConnections: Set<string>
  scripts: Script[]
  activeScriptId: number | null
  unsavedChanges: Set<number>
  databaseSchema: Schema | null
  loadingSchema: boolean
  queryHistory: QueryHistoryEntry[]
  isSidebarCollapsed: boolean
  sidebarTabState: SidebarTabState
  onToggleSidebar?: () => void
  onSelectConnection?: (connectionId: string) => void
  onConnectToDatabase?: (connectionId: string) => void
  onShowConnectionForm?: () => void
  onEditConnection?: (connection: ConnectionInfo) => void
  onDeleteConnection?: (connectionId: string) => void
  onDisconnectConnection?: (connectionId: string) => void
  onSelectScript?: (script: Script) => void
  onCreateNewScript?: () => void
  onDeleteScript?: (script: Script) => void
  onTableClick?: (tableName: string, schema: string) => void
  onLoadFromHistory?: (historyQuery: string) => void
  onSidebarTabChange?: (state: SidebarTabState) => void
}

export function AppSidebarComplete({
  connections,
  selectedConnection,
  establishingConnections,
  scripts,
  activeScriptId,
  unsavedChanges,
  databaseSchema,
  loadingSchema,
  queryHistory,
  isSidebarCollapsed,
  sidebarTabState,
  onToggleSidebar,
  onSelectConnection,
  onConnectToDatabase,
  onShowConnectionForm,
  onEditConnection,
  onDeleteConnection,
  onDisconnectConnection,
  onSelectScript,
  onCreateNewScript,
  onDeleteScript,
  onTableClick,
  onLoadFromHistory,
  onSidebarTabChange,
}: AppSidebarProps) {
  function switchTab(state: SidebarTabState) {
    onToggleSidebar?.()
    onSidebarTabChange?.(state)
  }

  if (isSidebarCollapsed) {
    return (
      <div className="flex h-full flex-col border-r border-sidebar-border bg-card">
        <div className="border-b border-sidebar-border/50 p-3">
          <div className="flex flex-col items-center gap-3">
            <button
              className="rounded-lg p-2 transition-all duration-200 hover:bg-accent hover:shadow-md"
              onClick={onToggleSidebar}
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4 text-sidebar-foreground/70" />
            </button>
            <Button
              size="sm"
              variant="outline"
              className="shadow-md hover:shadow-lg"
              onClick={onShowConnectionForm}
              title="Add Connection"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-start space-y-4 p-4">
          <button
            className="group flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200 ease-out hover:bg-white/3 dark:hover:bg-white/5"
            onClick={() => switchTab('connections')}
            title="Connections"
          >
            <Cable className="h-5 w-5 text-sidebar-foreground/70 transition-colors duration-200 group-hover:text-primary/90" />
          </button>

          <button
            className="group flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200 ease-out hover:bg-white/3 dark:hover:bg-white/5"
            onClick={() => switchTab('items')}
            title="Database Items"
          >
            <TableProperties className="h-5 w-5 text-sidebar-foreground/70 transition-colors duration-200 group-hover:text-primary/90" />
          </button>

          <button
            className="group flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200 ease-out hover:bg-white/3 dark:hover:bg-white/5"
            onClick={() => switchTab('scripts')}
            title="Scripts"
          >
            <FileJson className="h-5 w-5 text-sidebar-foreground/70 transition-colors duration-200 group-hover:text-primary/90" />
          </button>

          <button
            className="group flex h-12 w-12 items-center justify-center rounded-lg transition-all duration-200 ease-out hover:bg-white/3 dark:hover:bg-white/5"
            onClick={() => switchTab('history')}
            title="Query History"
          >
            <History className="h-5 w-5 text-sidebar-foreground/70 transition-colors duration-200 group-hover:text-primary/90" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-card">
      <div className="flex justify-between border-b border-sidebar-border/50 p-6">
        <div className="flex items-center gap-4">
          <Logo className="text-primary/90 drop-shadow-lg transition-all duration-300 hover:scale-105 hover:text-primary" size="md" />
          <h1 className="text-xl font-bold text-foreground">Dora</h1>
        </div>
        <button
          className="rounded-lg p-2 transition-all duration-200 hover:bg-accent hover:shadow-md"
          onClick={onToggleSidebar}
          title="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4 text-sidebar-foreground/70" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <div className="flex h-full flex-col">
          {/* Tab Triggers */}
          <div className="border-b p-2">
            <div className="flex h-9 w-full flex-row justify-evenly gap-1 rounded-sm p-1.5 bg-muted/30 text-sm font-semibold leading-[0.01em] shadow-inner dark:border dark:border-neutral-600/30">
              <button
                onClick={() => onSidebarTabChange?.('connections')}
                className={`flex w-20 items-center justify-center rounded-[7px] bg-transparent ${sidebarTabState === 'connections'
                  ? 'bg-card shadow dark:bg-muted'
                  : ''
                  }`}
                title="Connections"
              >
                <Cable className="w-4 text-sidebar-foreground/70" />
              </button>
              <button
                onClick={() => onSidebarTabChange?.('items')}
                className={`flex w-20 items-center justify-center rounded-[7px] bg-transparent ${sidebarTabState === 'items'
                  ? 'bg-card shadow dark:bg-muted'
                  : ''
                  }`}
                title="Items"
              >
                <TableProperties className="w-4 text-sidebar-foreground/70" />
              </button>
              <button
                onClick={() => onSidebarTabChange?.('scripts')}
                className={`flex w-20 items-center justify-center rounded-[7px] bg-transparent ${sidebarTabState === 'scripts'
                  ? 'bg-card shadow dark:bg-muted'
                  : ''
                  }`}
                title="Scripts"
              >
                <FileJson className="w-4 text-sidebar-foreground/70" />
              </button>
              <button
                onClick={() => onSidebarTabChange?.('history')}
                className={`flex w-20 items-center justify-center rounded-[7px] bg-transparent ${sidebarTabState === 'history'
                  ? 'bg-card shadow dark:bg-muted'
                  : ''
                  }`}
                title="History"
              >
                <History className="w-4 text-sidebar-foreground/70" />
              </button>
            </div>
          </div>

          {/* Tab Contents */}
          <div className="min-h-0 flex-1 p-2">
            {sidebarTabState === 'connections' && (
              <ConnectionsComplete
                connections={connections}
                selectedConnection={selectedConnection}
                establishingConnections={establishingConnections}
                onSelectConnection={onSelectConnection}
                onConnectToDatabase={onConnectToDatabase}
                onShowConnectionForm={onShowConnectionForm}
                onEditConnection={onEditConnection}
                onDeleteConnection={onDeleteConnection}
                onDisconnectConnection={onDisconnectConnection}
              />
            )}
            {sidebarTabState === 'items' && (
              <DatabaseSchemaItems
                databaseSchema={databaseSchema}
                loadingSchema={loadingSchema}
                selectedConnection={selectedConnection}
                onTableClick={onTableClick}
              />
            )}
            {sidebarTabState === 'scripts' && (
              <ScriptsComplete
                scripts={scripts}
                activeScriptId={activeScriptId}
                unsavedChanges={unsavedChanges}
                onSelectScript={onSelectScript}
                onCreateNewScript={onCreateNewScript}
                onDeleteScript={onDeleteScript}
              />
            )}
            {sidebarTabState === 'history' && (
              <QueryHistoryComplete
                queryHistory={queryHistory}
                onLoadFromHistory={onLoadFromHistory}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
