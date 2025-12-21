'use client'

import { ChevronLeft, ChevronRight, Play, Save, Code2, Table2, Network, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

type MainViewMode = 'query-runner' | 'data-browser' | 'schema-view'

type UnifiedHeaderProps = {
  connectionName?: string
  connectionType?: string
  connected?: boolean
  isConnecting?: boolean
  isSidebarCollapsed: boolean
  sidebarWidth: number
  mainViewMode: MainViewMode
  onModeChange: (mode: MainViewMode) => void
  onToggleSidebar?: () => void
  onRunQuery?: () => void
  onSaveScript?: () => void
  hasUnsavedChanges?: boolean
  disabled?: boolean
}

export function UnifiedHeader({
  connectionName,
  connectionType,
  connected = false,
  isConnecting = false,
  isSidebarCollapsed,
  sidebarWidth,
  mainViewMode,
  onModeChange,
  onToggleSidebar,
  onRunQuery,
  onSaveScript,
  hasUnsavedChanges,
  disabled
}: UnifiedHeaderProps) {
  // Get database type icon/label
  const getDbIcon = () => {
    if (!connectionName) return { icon: 'Db', label: 'No Connection' }
    if (!connectionType) return { icon: 'Db', label: connectionName }
    const type = connectionType.toLowerCase()
    if (type.includes('postgres') || type.includes('pg')) return { icon: 'Pg', label: connectionName }
    if (type.includes('sqlite')) return { icon: 'Sq', label: connectionName }
    if (type.includes('turso')) return { icon: 'Tu', label: connectionName }
    if (type.includes('mysql')) return { icon: 'My', label: connectionName }
    return { icon: 'Db', label: connectionName }
  }

  const dbInfo = getDbIcon()

  return (
    <div className="flex h-11 items-stretch border-b border-border bg-background" data-tauri-drag-region>
      {/* Left Section - Connection Info (aligned with sidebar) */}
      <div 
        className="flex items-center border-r border-border bg-background flex-shrink-0"
        style={{ 
          width: isSidebarCollapsed ? 56 : sidebarWidth,
          transition: 'width 200ms ease-out'
        }}
      >
        <div className="flex items-center justify-between w-full px-3">
          {isSidebarCollapsed ? (
            <button
              className="flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors mx-auto"
              onClick={onToggleSidebar}
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex items-center justify-center w-6 h-6 bg-muted/80 rounded flex-shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground">{dbInfo.icon}</span>
                </div>
                <span className="text-sm font-medium text-foreground truncate">{dbInfo.label}</span>
                {connectionName && (
                  <div
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      isConnecting
                        ? 'bg-warning animate-pulse'
                        : connected
                          ? 'bg-success'
                          : 'bg-muted-foreground/50'
                    }`}
                    title={connected ? 'Connected' : 'Disconnected'}
                  />
                )}
              </div>
              <button
                className="flex items-center justify-center w-7 h-7 rounded hover:bg-muted transition-colors flex-shrink-0"
                onClick={onToggleSidebar}
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right Section - Tabs and Controls */}
      <div className="flex flex-1 items-center min-w-0">
        {/* Tab Navigation with + button */}
        <div className="flex items-center h-full">
          <button
            className="flex items-center justify-center h-full w-10 border-r border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="New Tab"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            className={`flex items-center gap-2 h-full px-4 text-sm font-medium border-r border-border transition-colors ${
              mainViewMode === 'query-runner' 
                ? 'text-foreground bg-muted/30' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
            onClick={() => onModeChange('query-runner')}
          >
            <Code2 className="h-4 w-4" />
            Query Runner
          </button>
          <button
            className={`flex items-center gap-2 h-full px-4 text-sm font-medium border-r border-border transition-colors ${
              mainViewMode === 'data-browser' 
                ? 'text-foreground bg-muted/30' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
            onClick={() => onModeChange('data-browser')}
          >
            <Table2 className="h-4 w-4" />
            Data Browser
          </button>
          <button
            className={`flex items-center gap-2 h-full px-4 text-sm font-medium border-r border-border transition-colors ${
              mainViewMode === 'schema-view' 
                ? 'text-foreground bg-muted/30' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
            onClick={() => onModeChange('schema-view')}
          >
            <Network className="h-4 w-4" />
            Schema View
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right Controls */}
        <div className="flex items-center gap-2 px-3">
          {mainViewMode === 'query-runner' && (
            <>
              {onRunQuery && (
                <Button size="sm" onClick={onRunQuery} className="h-7 gap-1.5 text-xs">
                  <Play className="h-3.5 w-3.5" />
                  Run
                </Button>
              )}
              {onSaveScript && (
                <Button size="sm" variant="ghost" onClick={onSaveScript} className="h-7 gap-1.5 text-xs">
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              )}
            </>
          )}
          {hasUnsavedChanges && (
            <span className="text-xs text-warning">●</span>
          )}
        </div>
      </div>
    </div>
  )
}
