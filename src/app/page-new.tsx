'use client'

export const dynamic = 'force-dynamic'

import { TitleBar } from '@/shared/components/layout/title-bar'
import { AppSidebarComplete } from '@/shared/components/layout/app-sidebar-complete'
import { ResizeHandle } from '@/shared/components/layout/resize-handle'
import { MainViewTabs } from '@/shared/components/layout/main-view-tabs'
import { ScriptTabs } from '@/domains/queries/components/script-tabs'
import { SqlEditor } from '@/domains/queries/components/sql-editor'
import { CommandPalette } from '@/shared/components/ui/command-palette'
import { Table } from '@/domains/data-browser/components/table'
import { TableBrowser } from '@/domains/data-browser/components/table-browser'
import { DataBrowserView } from '@/domains/data-browser/components/data-browser-view'
import { SchemaVisualization } from '@/domains/schema/components/schema-visualization'
import { ConnectionForm } from '@/domains/connections/components/connection-form'
import { useAppState } from '@/domains/queries/hooks/use-app-state'
import { useCommands } from '@/shared/hooks/use-commands'
import { COMMAND_IDS } from '@/shared/lib/tauri/constants'

export default function Home() {
  const appState = useAppState()

  // Command palette setup
  useCommands()

  return (
    <div className="flex h-screen flex-col bg-background">
      <TitleBar />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={`flex flex-col bg-muted/30 border-r border-border/50 ${
            appState.isSidebarCollapsed ? 'w-0' : ''
          }`}
          style={{
            width: appState.isSidebarCollapsed ? 0 : appState.sidebarWidth,
          }}
        >
          {!appState.isSidebarCollapsed && (
            <AppSidebarComplete
              connections={appState.connections}
              selectedConnection={appState.selectedConnection}
              establishingConnections={appState.establishingConnections}
              scripts={appState.scripts}
              activeScriptId={appState.activeScriptId}
              unsavedChanges={appState.unsavedChanges}
              databaseSchema={appState.databaseSchema}
              loadingSchema={appState.loadingSchema}
              queryHistory={appState.queryHistory}
              isSidebarCollapsed={appState.isSidebarCollapsed}
              sidebarTabState={appState.sidebarTabState}
              onToggleSidebar={() => appState.setIsSidebarCollapsed(!appState.isSidebarCollapsed)}
              onSelectConnection={appState.setSelectedConnection}
              onConnectToDatabase={appState.connectToDatabase}
              onShowConnectionForm={appState.handleShowConnectionForm}
            />
          )}
        </div>

        {/* Resize Handle */}
        <ResizeHandle
          isResizing={appState.isSidebarResizing}
          onMouseDown={() => {}}
          orientation="vertical"
        />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <MainViewTabs mode={appState.mainViewMode} onModeChange={appState.setMainViewMode} />
          
          <div className="flex flex-1 overflow-hidden">
            {/* Main View Area */}
            <div className="flex-1 flex flex-col">
              {appState.mainViewMode === 'schema-view' ? (
                <SchemaVisualization
                  schema={appState.databaseSchema}
                  connectionId={appState.selectedConnection}
                  connected={appState.connections.find((c: any) => c.id === appState.selectedConnection)?.connected || false}
                />
              ) : (
                <div className="flex flex-1 flex-col">
                  {/* Editor */}
                  <div className="flex-1 flex flex-col">
                    <SqlEditor
                      value={appState.currentEditorContent || ''}
                      onChange={appState.handleEditorContentChange}
                    />
                  </div>

                  {/* Bottom Panel */}
                  <div className="border-t border-border/50">
                    <ResizeHandle
                      isResizing={appState.isBottomResizing}
                      onMouseDown={() => {}}
                      orientation="horizontal"
                    />
                    <div style={{ height: appState.bottomHeight }}>
                      <ScriptTabs />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {appState.showConnectionForm && (
        <ConnectionForm
          connection={appState.editingConnection || undefined}
          onSubmit={appState.handleConnectionFormSubmit}
          onCancel={appState.handleConnectionFormCancel}
          loading={false}
        />
      )}

      {/* Command Palette */}
      <CommandPalette />
    </div>
  )
}
