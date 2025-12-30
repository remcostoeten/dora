'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { UnifiedHeader } from '@/components/layout/unified-header'
import { AppSidebarComplete } from '@/components/sidebar/app-sidebar-complete'
import { ResizeHandle } from '@/components/layout/resize-handle'
import { MainViewTabs, useMainViewMode } from '@/components/layout/main-view-tabs'
import { ScriptTabs } from '@/components/editor/script-tabs'
import { SwitchableSqlEditor } from '@/components/editor/switchable-sql-editor'
import { CommandPalette } from '@/components/ui/command-palette'
import { Table } from '@/components/data/table'
import { TableBrowser } from '@/components/data/table-browser'
import { DataBrowserView } from '@/components/data/data-browser-view'
import { SchemaVisualization } from '@/components/schema/schema-visualization'
import { useCommands } from '@/core/hooks/use-commands'
import { COMMAND_IDS } from '@/core/commands/constants'
import { DatabaseConnectionModal } from '@/components/connections/database-connection-modal'
import { useResizable } from '@/core/hooks'
import { useTabs, useTheme } from '@/core/state'
import { useToast } from '@/components/ui/toast'
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

type Props = 'connections' | 'items' | 'scripts' | 'history' | 'conn-history'

export default function Home() {
  const { addToast } = useToast()
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | null>(null)
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [establishingConnections, setEstablishingConnections] = useState<Set<string>>(new Set())
  const [databaseSchema, setDatabaseSchema] = useState<DatabaseSchema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  // activeScriptId is now derived from the active tab (see below)
  const [unsavedChanges, setUnsavedChanges] = useState<Set<number>>(new Set())
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sidebarTabState, setSidebarTabState] = useState<Props>('connections')
  const [executing, setExecuting] = useState(false)
  const [lastLoadedSchemaConnectionId, setLastLoadedSchemaConnectionId] = useState<string | null>(null)

  // Main view mode (Query Runner or Data Browser)
  const { mode: mainViewMode, setMode: setMainViewMode } = useMainViewMode()

  const { size: sidebarWidth, isResizing: isSidebarResizing, startResizing: startSidebarResizing } = useResizable({
    direction: 'horizontal',
    storageKey: 'sidebar-width',
    defaultSize: 340,
    minSize: 50,
    maxSize: 600,
    onResizeEnd: (finalWidth) => {
      if (finalWidth < 250) {
        setIsSidebarCollapsed(true)
      }
    },
    onResize: (currentWidth) => {
      // Auto-expand if dragging while collapsed
      if (isSidebarCollapsed && currentWidth > 150) {
        setIsSidebarCollapsed(false)
      }
    }
  })

  // Bottom pane resize logic (vertical, inverted because we pull up)
  const { size: bottomHeight, isResizing: isBottomResizing, startResizing: startBottomResizing } = useResizable({
    direction: 'vertical',
    storageKey: 'bottom-pane-height',
    shouldInverse: true,
    defaultSize: 300,
    minSize: 100,
    maxSize: 800,
  })

  const sqlEditorRef = useRef<any>(null)
  const sessionSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)

  // Function to focus the main content area
  const focusMainContent = useCallback(() => {
    if (mainContentRef.current) {
      mainContentRef.current.focus()
    }
  }, [])

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
    openTableExplorationTab,
    setTableData,
    setTableLoading,
    setTableError,
    closeTab,
  } = useTabs()

  // Derive activeScriptId from the active tab
  const activeTab = getActiveTab()
  const activeScriptId = activeTab?.type === 'script' ? (activeTab as any).scriptId : null

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
    // Auto-preview when schema loads for a connected database
    if (databaseSchema && selectedConnection) {
      const connection = connections.find((c) => c.id === selectedConnection)
      if (connection?.connected && databaseSchema.tables.length > 0) {
        autoPreviewFirstTable()
      }
    }
  }, [databaseSchema, selectedConnection, connections])

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

  async function autoPreviewFirstTable() {
    if (!databaseSchema || !databaseSchema.tables.length) return

    const firstTable = databaseSchema.tables[0]
    const query = `SELECT * FROM ${firstTable.schema ? `"${firstTable.schema}".` : ''}"${firstTable.name}" LIMIT 100;`

    const activeTab = getActiveTab()
    if (activeTab && activeTab.type === 'script') {
      handleEditorContentChange(query)
      // Auto-execute the preview query
      setTimeout(() => handleRunQuery(), 500)
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
          // Auto-preview first table after schema loads
          await autoPreviewFirstTable()
        }
        // Focus main content after successful connection
        focusMainContent()
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
      // Focus main content after disconnection
      focusMainContent()
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

  async function handleTableClick(tableName: string, schema: string) {
    if (!selectedConnection) return

    // Open the table exploration tab
    openTableExplorationTab(tableName, schema, selectedConnection)
    const tabId = `table-${selectedConnection}-${schema}-${tableName}`

    // Load table data
    try {
      const query = `SELECT * FROM ${schema ? `"${schema}".` : ''}"${tableName}" LIMIT 1000;`
      const results = await executeQuery(selectedConnection, query)

      if (results.length > 0) {
        const firstResult = results[0]
        if (firstResult.error) {
          setTableError(tabId, firstResult.error)
        } else {
          setTableData(tabId, {
            columns: firstResult.columns || [],
            rows: firstResult.first_page || [],
            totalRows: (firstResult.first_page || []).length,
          })
        }
      }
    } catch (error) {
      setTableError(tabId, error instanceof Error ? error.message : 'Failed to load table data')
    }
  }

  function handleLoadFromHistory(historyQuery: string) {
    const activeTab = getActiveTab()
    if (activeTab && activeTab.type === 'script') {
      handleEditorContentChange(historyQuery)
    }
  }

  async function handleSelectScript(script: Script) {
    // activeScriptId is now derived from active tab, no need to set it manually
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

      // activeScriptId is derived from active tab, no need to clear manually
    } catch (error) {
      console.error('Failed to delete script:', error)
    }
  }

  async function handleRunQuery() {
    console.log('[handleRunQuery] Called')
    const activeTab = getActiveTab()
    console.log('[handleRunQuery] activeTab:', activeTab?.type, 'selectedConnection:', selectedConnection)
    if (!activeTab || activeTab.type !== 'script' || !selectedConnection) {
      console.log('[handleRunQuery] Early return - missing activeTab, wrong type, or no connection')
      return
    }

    console.log('[handleRunQuery] Executing query:', currentEditorContent.substring(0, 100))
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
    console.log('[handleSaveScript] Called, activeScriptId:', activeScriptId)
    if (!activeScriptId) {
      console.log('[handleSaveScript] Early return - no activeScriptId')
      return
    }

    const activeTab = getActiveTab()
    console.log('[handleSaveScript] activeTab type:', activeTab?.type)
    if (!activeTab || activeTab.type !== 'script') {
      console.log('[handleSaveScript] Early return - no activeTab or wrong type')
      return
    }

    const script = scripts.find((s) => s.id === activeScriptId)
    console.log('[handleSaveScript] Found script:', script?.name)
    if (!script) {
      console.log('[handleSaveScript] Early return - script not found')
      return
    }

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
        // activeScriptId is auto-updated via updateScriptId
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
      addToast({
        title: 'Script saved',
        description: `Successfully saved "${script.name}"`,
        variant: 'success',
        duration: 2000,
      })
    } catch (error) {
      console.error('Failed to save script:', error)
      addToast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'error',
      })
    }
  }

  // Command System Integration
  const { registerHandler } = useCommands()
  const { theme, setTheme } = useTheme()

  // Stable references for command handlers to prevent infinite update loops
  const handleRunQueryRef = useRef(handleRunQuery)
  const handleSaveScriptRef = useRef(handleSaveScript)
  const handleCreateNewScriptRef = useRef(handleCreateNewScript)
  const themeRef = useRef(theme)
  const setThemeRef = useRef(setTheme)
  const setIsSidebarCollapsedRef = useRef(setIsSidebarCollapsed)
  const setShowConnectionFormRef = useRef(setShowConnectionForm)
  const setEditingConnectionRef = useRef(setEditingConnection)

  // Update refs on every render
  useEffect(() => {
    handleRunQueryRef.current = handleRunQuery
    handleSaveScriptRef.current = handleSaveScript
    handleCreateNewScriptRef.current = handleCreateNewScript
    themeRef.current = theme
    setThemeRef.current = setTheme
    setIsSidebarCollapsedRef.current = setIsSidebarCollapsed
    setShowConnectionFormRef.current = setShowConnectionForm
    setEditingConnectionRef.current = setEditingConnection
  })

  // Register command handlers - only runs once or when registerHandler changes
  useEffect(() => {
    const unregisterRun = registerHandler(COMMAND_IDS.QUERIES_RUN, () => handleRunQueryRef.current())
    const unregisterSave = registerHandler(COMMAND_IDS.QUERIES_SAVE, () => handleSaveScriptRef.current())

    const unregisterTheme = registerHandler(COMMAND_IDS.THEME_TOGGLE, () => {
      const currentTheme = themeRef.current
      setThemeRef.current(currentTheme === 'dark' ? 'light' : 'dark')
    })

    const unregisterNewConn = registerHandler(COMMAND_IDS.CONNECTIONS_NEW, () => {
      setShowConnectionFormRef.current(true)
      setEditingConnectionRef.current(null)
    })

    const unregisterSidebar = registerHandler(COMMAND_IDS.VIEW_SIDEBAR, () => {
      setIsSidebarCollapsedRef.current(prev => !prev)
    })

    const unregisterNewScript = registerHandler(COMMAND_IDS.SCRIPTS_NEW, () => handleCreateNewScriptRef.current())

    return () => {
      unregisterRun()
      unregisterSave()
      unregisterTheme()
      unregisterNewConn()
      unregisterSidebar()
      unregisterNewScript()
    }
  }, [registerHandler])
  // handleRunQuery and handleSaveScript use state, but are they stable?
  // They are defined within the component scope, so they change on every render if not memoized.
  // The implementations in original file are just functions, not wrapped in useCallback.
  // This means effect runs on every render, re-registering handlers. This is fine but slightly inefficient.
  // Ideally we should wrap handlers in useCallback or accept that they re-register.
  // Given `registerHandler` uses a ref for storage, re-registering is just updating a property, very cheap.

  /* Previous keydown listener removed */

  // Keyboard shortcuts for main view tabs (1, 2, 3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Don't trigger when typing in input fields, textareas, or contenteditable elements
      if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName) || target.isContentEditable) {
        return
      }

      // Only trigger when no modifier keys are pressed
      if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) {
        return
      }

      if (e.key === '1') {
        e.preventDefault()
        setMainViewMode('query-runner')
      } else if (e.key === '2') {
        e.preventDefault()
        setMainViewMode('data-browser')
      } else if (e.key === '3') {
        e.preventDefault()
        setMainViewMode('schema-view')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setMainViewMode])

  const currentConnection = connections.find((c) => c.id === selectedConnection)
  // activeTab is already defined above

  // Handle start resizing, accounting for collapsed state
  const handleResizeStart = (e: React.MouseEvent) => {
    if (isSidebarCollapsed) {
      startSidebarResizing(e, 80)
    } else {
      startSidebarResizing(e)
    }
  }

  return (
    <div id="app" className="flex h-screen w-screen flex-col bg-background">
      {/* Unified Header */}
      <UnifiedHeader
        connectionName={currentConnection?.name}
        connectionType={currentConnection?.database_type ? ('Postgres' in currentConnection.database_type ? 'postgres' : 'sqlite') : undefined}
        connected={currentConnection?.connected}
        isConnecting={establishingConnections.has(selectedConnection || '')}
        isSidebarCollapsed={isSidebarCollapsed}
        sidebarWidth={sidebarWidth}
        mainViewMode={mainViewMode}
        onModeChange={setMainViewMode}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onRunQuery={handleRunQuery}
        onSaveScript={handleSaveScript}
        hasUnsavedChanges={activeTab?.isDirty || false}
        disabled={!currentConnection?.connected}
      />

      <div className="flex flex-1 overflow-hidden">

        {/* Resizable Sidebar Container */}
        <div
          className="relative flex-shrink-0"
          style={{
            width: isSidebarResizing ? sidebarWidth : (isSidebarCollapsed ? 56 : sidebarWidth),
            transition: isSidebarResizing ? 'none' : 'width 200ms ease-out',
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
            onSelectConnection={(id) => {
              if (isSidebarCollapsed) setIsSidebarCollapsed(false)
              setSelectedConnection(id)
              // Focus main content after selecting connection
              focusMainContent()
            }}
            onConnectToDatabase={handleConnectToDatabase}
            onShowConnectionForm={() => {
              setIsSidebarCollapsed(false)
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
          {/* Resize Handle */}
          <ResizeHandle onMouseDown={handleResizeStart} isResizing={isSidebarResizing} />
        </div>

        <div 
          ref={mainContentRef}
          className="flex flex-1 flex-col overflow-hidden bg-card"
          tabIndex={-1}
          onKeyDown={(e) => {
            // This ensures the main content can receive keyboard events
            if (e.key === 'Tab') {
              e.preventDefault()
            }
          }}
        >
          {/* Content based on view mode */}
          {mainViewMode === 'data-browser' ? (
            /* Data Browser View - Show table picker or active table */
            activeTab?.type === 'table-view' ? (
              <TableBrowser
                tableName={(activeTab as any).tableName}
                schema={(activeTab as any).schema}
                connectionId={(activeTab as any).connectionId}
                columns={(activeTab as any).columns || []}
                data={(activeTab as any).data || []}
                primaryKeyColumn={(activeTab as any).primaryKeyColumn}
                loading={(activeTab as any).loading}
                totalRows={(activeTab as any).totalRows}
                onRefresh={() => {
                  handleTableClick((activeTab as any).tableName, (activeTab as any).schema)
                }}
                onBack={() => closeTab(activeTab.id)}
                onExecuteUpdate={async (sql: string) => {
                  if (!selectedConnection) return { success: false, error: 'No connection selected' }
                  try {
                    const results = await executeQuery(selectedConnection, sql)
                    if (results.length > 0 && results[0].error) {
                      return { success: false, error: results[0].error }
                    }
                    return { success: true }
                  } catch (error) {
                    return { success: false, error: error instanceof Error ? error.message : 'Update failed' }
                  }
                }}
              />
            ) : (
              <DataBrowserView
                schema={databaseSchema}
                connectionId={selectedConnection}
                connected={currentConnection?.connected || false}
                onTableSelect={handleTableClick}
              />
            )
          ) : mainViewMode === 'schema-view' ? (
            /* Schema Visualization View */
            <SchemaVisualization
              schema={databaseSchema}
              connectionId={selectedConnection}
              connected={currentConnection?.connected || false}
            />
          ) : (
            /* Query Runner View */
            <>
              <ScriptTabs />
              <div className="flex flex-1 flex-col overflow-hidden border-l border-border bg-card">
                {/* Render based on active tab type */}
                {activeTab?.type === 'table-view' ? (
                  /* Table Browser View - Full height */
                  <TableBrowser
                    tableName={(activeTab as any).tableName}
                    schema={(activeTab as any).schema}
                    connectionId={(activeTab as any).connectionId}
                    columns={(activeTab as any).columns || []}
                    data={(activeTab as any).data || []}
                    primaryKeyColumn={(activeTab as any).primaryKeyColumn}
                    loading={(activeTab as any).loading}
                    totalRows={(activeTab as any).totalRows}
                    onRefresh={() => {
                      // Reload the table data
                      handleTableClick((activeTab as any).tableName, (activeTab as any).schema)
                    }}
                    onExecuteUpdate={async (sql: string) => {
                      if (!selectedConnection) return { success: false, error: 'No connection selected' }
                      try {
                        const results = await executeQuery(selectedConnection, sql)
                        if (results.length > 0 && results[0].error) {
                          return { success: false, error: results[0].error }
                        }
                        return { success: true }
                      } catch (error) {
                        return { success: false, error: error instanceof Error ? error.message : 'Update failed' }
                      }
                    }}
                  />
                ) : (
                  /* SQL Editor View with Results Panel */
                  <>
                    {/* Top Pane (Editor) - Takes remaining space */}
                    <div className="flex flex-1 flex-col min-h-0 border-b border-border">
                      <div className="flex-1 p-4">
                        <SwitchableSqlEditor
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

                    {/* Bottom Pane (Results) - Resizable */}
                    <div
                      className="relative flex flex-col overflow-hidden bg-card border-t border-border"
                      style={{ height: bottomHeight }}
                    >
                      <ResizeHandle
                        orientation="horizontal"
                        isResizing={isBottomResizing}
                        onMouseDown={startBottomResizing}
                      />

                      <div className="flex-1 overflow-auto bg-card pt-1">
                        {/* pt-1 to avoid overlap with resize handle */}
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
                  </>
                )}
              </div>
            </>
          )}

          <DatabaseConnectionModal
            open={showConnectionForm}
            onOpenChange={(open) => {
              setShowConnectionForm(open)
              if (!open) setEditingConnection(null)
            }}
            onSubmit={handleConnectionSubmit}
            editingConnection={editingConnection}
          />
        </div>
      </div>
    </div>
  )
}
