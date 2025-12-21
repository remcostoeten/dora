'use client'

import { Cable, Plus, ChevronLeft, ChevronRight, FileJson, TableProperties, History, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConnectionsComplete } from '@/components/connections/connections-complete'
import { DatabaseSchemaItems } from './database-schema-items'
import { ScriptsComplete } from './scripts-complete'
import { QueryHistoryComplete } from './query-history-complete'
import { ConnectionHistoryPanel } from './connection-history-panel'
import { Logo } from '@/components/shared/logo'
import type { ConnectionInfo, Schema, Script, QueryHistoryEntry } from '@/types/database'

type SidebarTabState = 'connections' | 'items' | 'scripts' | 'history' | 'conn-history'

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

  return (
    <div className="flex h-full flex-col border-r border-border bg-background overflow-hidden">
      {/* Collapsed Sidebar - Icon Rail */}
      <div
        className={`absolute inset-0 flex flex-col bg-background transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        <div className="flex flex-col items-center gap-1 p-2 pt-3">
          <button
            className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${sidebarTabState === 'connections' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            onClick={() => switchTab('connections')}
            title="Connections"
          >
            <Cable className="h-4 w-4" />
          </button>

          <button
            className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${sidebarTabState === 'items' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            onClick={() => switchTab('items')}
            title="Tables"
          >
            <TableProperties className="h-4 w-4" />
          </button>

          <button
            className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${sidebarTabState === 'scripts' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            onClick={() => switchTab('scripts')}
            title="Scripts"
          >
            <FileJson className="h-4 w-4" />
          </button>

          <button
            className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${sidebarTabState === 'history' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            onClick={() => switchTab('history')}
            title="Query History"
          >
            <History className="h-4 w-4" />
          </button>

          <button
            className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${sidebarTabState === 'conn-history' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            onClick={() => switchTab('conn-history')}
            title="Connection History"
          >
            <Activity className="h-4 w-4" />
          </button>

          <div className="my-2 h-px w-6 bg-border" />

          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            onClick={onShowConnectionForm}
            title="Add Connection"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Sidebar */}
      <div
        className={`flex h-full flex-col transition-opacity duration-200 ${!isSidebarCollapsed ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        
        {/* Tab Bar */}
        <div className="border-b border-border px-3 py-3">
          <div className="flex gap-1.5 rounded-lg bg-muted/40 p-1.5">
            <button
              onClick={() => onSidebarTabChange?.('connections')}
              className={`flex flex-1 items-center justify-center rounded-md py-2 text-xs font-medium transition-all duration-200 ${sidebarTabState === 'connections'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              title="Connections"
            >
              <Cable className="h-4 w-4" />
            </button>
            <button
              onClick={() => onSidebarTabChange?.('items')}
              className={`flex flex-1 items-center justify-center rounded-md py-2 text-xs font-medium transition-all duration-200 ${sidebarTabState === 'items'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              title="Tables"
            >
              <TableProperties className="h-4 w-4" />
            </button>
            <button
              onClick={() => onSidebarTabChange?.('scripts')}
              className={`flex flex-1 items-center justify-center rounded-md py-2 text-xs font-medium transition-all duration-200 ${sidebarTabState === 'scripts'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              title="Scripts"
            >
              <FileJson className="h-4 w-4" />
            </button>
            <button
              onClick={() => onSidebarTabChange?.('history')}
              className={`flex flex-1 items-center justify-center rounded-md py-2 text-xs font-medium transition-all duration-200 ${sidebarTabState === 'history'
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              title="History"
            >
              <History className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto px-3 py-2">
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
            {sidebarTabState === 'conn-history' && (
              <ConnectionHistoryPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
