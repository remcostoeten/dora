'use client'

import { useState, useEffect, useRef } from 'react'
import { TitleBar } from '@/components/title-bar'
import { AppSidebarComplete } from '@/components/app-sidebar-complete'
import { ResizeHandle } from '@/components/resize-handle'
import { ScriptTabs } from '@/components/script-tabs'
import { SqlEditor } from '@/components/sql-editor'
import { Table } from '@/components/table'
import { ConnectionForm } from '@/components/connection-form'
import { useResizable } from '@/core/hooks'
import { useTabs } from '@/core/state'
import {
  getConnections,
  initializeConnections,
  connectToDatabase,
  disconnectFromDatabase,
  addConnection,
  updateConnection,
  removeConnection,
  getDatabaseSchema,
  getQueryHistory,
  getScripts,
  saveScript,
  updateScript,
  deleteScript,
  executeQuery,
  saveSessionState
} from '@/core/tauri'
import type { ConnectionInfo, DatabaseSchema, QueryHistoryEntry, Script, DatabaseInfo } from '@/types/database'

type SidebarTabState = 'connections' | 'items' | 'scripts' | 'history'

export default function Home() {
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | null>(null)
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [establishingConnections, setEstablishingConnections] = useState<Set<string>>(new Set())
  const [databaseSchema, setDatabaseSchema] = useState<DatabaseSchema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [activeScriptId, setActiveScriptId] = useState<number | null>(null)
  const [unsavedChanges, setUnsavedChanges] = useState<Set<number>>(new Set())
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sidebarTabState, setSidebarTabState] = useState<SidebarTabState>('connections')
  const [executing, setExecuting] = useState(false)
  const [lastLoadedSchemaConnectionId, setLastLoadedSchemaConnectionId] = useState<string | null>(null)

  const { width: sidebarWidth, isResizing, startResizing } = useResizable()

  const sqlEditorRef = useRef<any>(null)
  const sessionSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  const {
    openScript,
    handleEditorContentChange,
    markScriptSaved,
    updateScriptId,
    createNewScript,
    setScripts: setTabsScripts,
    setSqlEditorRef,
    onSessionSave,
    saveSession,
    restoreSession,
    getActiveTab,
    tabs: allTabs,
    scripts: tabsScripts,
    newScripts,
    currentEditorContent,
    setQueryResults,
    setQueryError,
    setQueryStatus,
  } = useTabs()

  useEffect(() => {
    setTabsScripts(scripts)
  }, [scripts, setTabsScripts])

  useEffect(() => {
    const dirtyScriptIds = new Set(
      allTabs
        .filter((t) => t.type === 'script' && t.isDirty)
        .map((t) => (t as any).scriptId)
    )
    setUnsavedChanges(dirtyScriptIds)
  }, [allTabs])

  useEffect(() => {
    async function init() {
      try {
        await initializeConnections()
        await loadConnections()
        await loadScripts()

        onSessionSave(() => {
        })

        const restored = await restoreSession(null)
        if (!restored && allTabs.length === 0) {
          const existingUntitled = scripts.find((s) => s.name === 'Untitled Script')
          if (existingUntitled) {
            openScript(existingUntitled)
          } else {
            createNewScript()
          }
        }
      } catch (error) {
        console.error('Failed to initialize:', error)
      }
    }

    init()

    sessionSaveTimerRef.current = setInterval(() => {
      checkAndSaveSession()
    }, 20000)

    return () => {
      if (sessionSaveTimerRef.current) {
        clearInterval(sessionSaveTimerRef.current)
      }
      checkAndSaveSession()
    }
  }, [])

  useEffect(() => {
    if (selectedConnection) {
      const connection = connections.find((c) => c.id === selectedConnection)
      if (connection?.connected) {
        loadDatabaseSchemaIfNeeded(selectedConnection)
      } else {
        setDatabaseSchema(null)
        setLastLoadedSchemaConnectionId(null)
      }
    } else {
      setDatabaseSchema(null)
      setLastLoadedSchemaConnectionId(null)
    }
  }, [selectedConnection, connections])

  useEffect(() => {
    if (selectedConnection) {
      loadQueryHistory()
    } else {
      setQueryHistory([])
    }
  }, [selectedConnection])

  useEffect(() => {
    if (sqlEditorRef.current) {
      setSqlEditorRef(sqlEditorRef.current)
    }
  }, [setSqlEditorRef])

  async function checkAndSaveSession() {
    try {
      await saveSession(async (tabSessionData) => {
        const fullSessionData = {
          ...tabSessionData,
          selectedConnection,
          isSidebarCollapsed,
          sidebarTabState,
        }
        await saveSessionState(JSON.stringify(fullSessionData))
      })
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  async function loadConnections() {
    try {
      const conns = await getConnections()
      setConnections(conns)
    } catch (error) {
      console.error('Failed to load connections:', error)
    }
  }

  async function loadScripts() {
    try {
      const loadedScripts = await getScripts()
      setScripts(loadedScripts)
    } catch (error) {
      console.error('Failed to load scripts:', error)
    }
  }

  async function loadDatabaseSchemaIfNeeded(connectionId: string) {
    if (lastLoadedSchemaConnectionId === connectionId || loadingSchema) {
      return
    }

    try {
      setLoadingSchema(true)
      const schema = await getDatabaseSchema(connectionId)
      setDatabaseSchema(schema)
      setLastLoadedSchemaConnectionId(connectionId)
    } catch (error) {
      console.error('Failed to load database schema:', error)
      setDatabaseSchema(null)
      setLastLoadedSchemaConnectionId(null)
    } finally {
      setLoadingSchema(false)
    }
  }

  async function loadQueryHistory() {
    if (!selectedConnection) {
      setQueryHistory([])
      return
    }

    try {
      const history = await getQueryHistory(selectedConnection, 50)
      setQueryHistory(history)
    } catch (error) {
      console.error('Failed to load query history:', error)
      setQueryHistory([])
    }
  }

  function handleSelectConnection(connectionId: string) {
    setSelectedConnection(connectionId)
  }

  async function handleConnectToDatabase(connectionId: string) {
    setEstablishingConnections((prev) => new Set(prev).add(connectionId))

    try {
      const success = await connectToDatabase(connectionId)
      if (success) {
        await loadConnections()
        if (selectedConnection === connectionId) {
          await loadDatabaseSchemaIfNeeded(connectionId)
        }
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setEstablishingConnections((prev) => {
        const next = new Set(prev)
        next.delete(connectionId)
        return next
      })
    }
  }

  async function handleDisconnectConnection(connectionId: string) {
    try {
      await disconnectFromDatabase(connectionId)
      await loadConnections()
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  async function handleConnectionSubmit(name: string, databaseInfo: DatabaseInfo) {
    try {
      if (editingConnection) {
        await updateConnection(editingConnection.id, name, databaseInfo)
      } else {
        await addConnection(name, databaseInfo)
      }
      await loadConnections()
      setShowConnectionForm(false)
      setEditingConnection(null)
    } catch (error) {
      console.error('Failed to save connection:', error)
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    try {
      await removeConnection(connectionId)
      await loadConnections()
      if (selectedConnection === connectionId) {
        setSelectedConnection(null)
      }
    } catch (error) {
      console.error('Failed to delete connection:', error)
    }
  }

  function handleTableClick(tableName: string, schema: string) {
    const query = `SELECT * FROM ${schema ? `"${schema}".` : ''}"${tableName}" LIMIT 100;`
    const activeTab = getActiveTab()
    if (activeTab && activeTab.type === 'script') {
      handleEditorContentChange(query)
    }
  }

  function handleLoadFromHistory(historyQuery: string) {
    const activeTab = getActiveTab()
    if (activeTab && activeTab.type === 'script') {
      handleEditorContentChange(historyQuery)
    }
  }

  async function handleSelectScript(script: Script) {
    setActiveScriptId(script.id)
    openScript(script)
  }

  async function handleCreateNewScript() {
    createNewScript()
  }

  async function handleDeleteScript(script: Script) {
    try {
      const isNewScript = newScripts.has(script.id)

      if (!isNewScript) {
        await deleteScript(script.id)
      }

      setScripts((prev) => prev.filter((s) => s.id !== script.id))

      if (activeScriptId === script.id) {
        setActiveScriptId(null)
      }
    } catch (error) {
      console.error('Failed to delete script:', error)
    }
  }

  async function handleRunQuery() {
    const activeTab = getActiveTab()
    if (!activeTab || activeTab.type !== 'script' || !selectedConnection) return

    setExecuting(true)
    setQueryStatus(activeTab.id, 'running')

    try {
      const results = await executeQuery(selectedConnection, currentEditorContent)

      if (results.length > 0) {
        const firstResult = results[0]
        if (firstResult.error) {
          setQueryError(activeTab.id, firstResult.error)
          console.error('Query error:', firstResult.error)
        } else {
          const formattedResults = {
            columns: firstResult.columns || [],
            rows: firstResult.first_page || [],
            affectedRows: firstResult.affected_rows || undefined,
          }
          setQueryResults(activeTab.id, formattedResults)
          console.log('Query executed successfully')
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Query execution failed'
      setQueryError(activeTab.id, errorMessage)
      console.error('Failed to execute query:', error)
    } finally {
      setExecuting(false)
    }
  }

  async function handleSaveScript() {
    if (!activeScriptId) return

    const activeTab = getActiveTab()
    if (!activeTab || activeTab.type !== 'script') return

    const script = scripts.find((s) => s.id === activeScriptId)
    if (!script) return

    try {
      const isNewScript = newScripts.has(activeScriptId)

      if (isNewScript) {
        const scriptId = await saveScript(
          script.name,
          currentEditorContent,
          selectedConnection || undefined,
          script.description || undefined
        )

        const updatedScript = {
          ...script,
          id: scriptId,
          query_text: currentEditorContent,
          updated_at: Date.now() / 1000,
        }

        setScripts((prev) =>
          prev.map((s) => (s.id === activeScriptId ? updatedScript : s))
        )

        updateScriptId(activeScriptId, scriptId, updatedScript)
        markScriptSaved(scriptId, currentEditorContent)
        setActiveScriptId(scriptId)
      } else {
        await updateScript(
          activeScriptId,
          script.name,
          currentEditorContent,
          selectedConnection || undefined,
          script.description || undefined
        )

        setScripts((prev) =>
          prev.map((s) =>
            s.id === activeScriptId
              ? { ...s, query_text: currentEditorContent, updated_at: Date.now() / 1000 }
              : s
          )
        )

        markScriptSaved(activeScriptId, currentEditorContent)
      }
    } catch (error) {
      console.error('Failed to save script:', error)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        handleSaveScript()
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        handleRunQuery()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [activeScriptId, currentEditorContent, scripts, selectedConnection])

  const currentConnection = connections.find((c) => c.id === selectedConnection)
  const activeTab = getActiveTab()

  return (
    <div id="app" className="flex h-screen w-screen flex-col bg-background">
      <TitleBar
        connectionName={currentConnection?.name}
        connected={currentConnection?.connected}
        isConnecting={establishingConnections.has(selectedConnection || '')}
        hasUnsavedChanges={activeTab?.isDirty || false}
        onRunQuery={handleRunQuery}
        onSaveScript={handleSaveScript}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Resizable Sidebar Container */}
        <div
          className="relative flex-shrink-0"
          style={{
            width: isSidebarCollapsed ? 'auto' : sidebarWidth,
            transition: isResizing ? 'none' : 'width 0.2s ease-out'
          }}
        >
          <AppSidebarComplete
            connections={connections}
            selectedConnection={selectedConnection}
            establishingConnections={establishingConnections}
            scripts={scripts}
            activeScriptId={activeScriptId}
            unsavedChanges={unsavedChanges}
            databaseSchema={databaseSchema}
            loadingSchema={loadingSchema}
            queryHistory={queryHistory}
            isSidebarCollapsed={isSidebarCollapsed}
            sidebarTabState={sidebarTabState}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            onSelectConnection={handleSelectConnection}
            onConnectToDatabase={handleConnectToDatabase}
            onShowConnectionForm={() => {
              setEditingConnection(null)
              setShowConnectionForm(true)
            }}
            onEditConnection={(conn) => {
              setEditingConnection(conn)
              setShowConnectionForm(true)
            }}
            onDeleteConnection={handleDeleteConnection}
            onDisconnectConnection={handleDisconnectConnection}
            onSelectScript={handleSelectScript}
            onCreateNewScript={handleCreateNewScript}
            onDeleteScript={handleDeleteScript}
            onTableClick={handleTableClick}
            onLoadFromHistory={handleLoadFromHistory}
            onSidebarTabChange={setSidebarTabState}
          />
          {/* Resize Handle - only show when sidebar is expanded */}
          {!isSidebarCollapsed && (
            <ResizeHandle onMouseDown={startResizing} isResizing={isResizing} />
          )}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden bg-card">
          <ScriptTabs />

          <div className="flex flex-1 flex-col overflow-hidden border-l border-border bg-card">
            <div className="flex flex-1 flex-col border-b border-border">
              <div className="flex-1 p-4">
                <SqlEditor
                  value={currentEditorContent}
                  onChange={handleEditorContentChange}
                  schema={
                    databaseSchema
                      ? {
                        tables: databaseSchema.tables.map((t) => t.name),
                        columns: databaseSchema.unique_columns,
                        schemas: databaseSchema.schemas,
                      }
                      : undefined
                  }
                />
              </div>

              {/* Status Bar */}
              <div className="border-t border-border bg-muted/50 px-4 py-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">Connection: {currentConnection?.name || 'None'}</span>
                    {selectedConnection && (
                      <span className="flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${currentConnection?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className={currentConnection?.connected ? 'text-success' : 'text-error'}>
                          {currentConnection?.connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Lines: {currentEditorContent.split('\n').length}</span>
                    <span>Length: {currentEditorContent.length}</span>
                    {activeTab?.isDirty && (
                      <span className="text-warning font-medium">● Modified</span>
                    )}
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Enter</kbd> to execute query • Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+S</kbd> to save script
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-card">
              {executing && (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <div className="font-medium">Executing query...</div>
                  </div>
                </div>
              )}

              {!executing && activeTab?.type === 'script' && activeTab.error && (
                <div className="p-4">
                  <div className="bg-error/10 border border-error/30 text-error p-4 rounded-lg">
                    <div className="font-semibold mb-2 flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-error" />
                      Query Error
                    </div>
                    <div className="text-sm font-mono">{String(activeTab.error)}</div>
                  </div>
                </div>
              )}

              {!executing && activeTab?.type === 'script' && activeTab.results && (
                <div className="h-full flex flex-col">
                  <div className="border-b border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-foreground">Query Results</span>
                        {activeTab.results.affectedRows !== undefined && (
                          <span className="text-success bg-success/10 px-2 py-1 rounded text-xs font-medium">
                            {activeTab.results.affectedRows} rows affected
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground bg-muted px-2 py-1 rounded text-xs">
                        {activeTab.results.rows.length} rows returned
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <Table
                      columns={activeTab.results.columns}
                      data={activeTab.results.rows}
                    />
                  </div>
                </div>
              )}

              {!executing && activeTab?.type === 'script' && !activeTab.results && !activeTab.error && (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="text-center max-w-md">
                    <div className="text-2xl font-medium mb-3 text-foreground">Ready to run queries</div>
                    <div className="text-sm mb-4">Execute a query to see results here</div>
                    <div className="flex items-center justify-center gap-2 text-xs bg-muted px-3 py-2 rounded-full">
                      <kbd className="px-1 py-0.5 bg-background rounded border border-border">Ctrl</kbd>
                      <span>+</span>
                      <kbd className="px-1 py-0.5 bg-background rounded border border-border">Enter</kbd>
                      <span className="mx-1">to run</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showConnectionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl border border-border">
            <ConnectionForm
              onSuccess={handleConnectionSubmit}
              onCancel={() => {
                setShowConnectionForm(false)
                setEditingConnection(null)
              }}
              editingConnection={editingConnection}
            />
          </div>
        </div>
      )}
    </div>
  )
}
