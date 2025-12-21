'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppSidebarComplete } from './app-sidebar-complete'
import { SqlEditor } from './sql-editor'
import { Table } from './table'
import { ConnectionForm } from './connection-form'
import { ScriptTabs } from './script-tabs'
import { useTabs } from '@/lib/tabs-store-complete'
import { 
  getConnections, 
  connectToDatabase, 
  disconnectFromDatabase,
  getSchema,
  refreshSchema,
  executeQuery,
  getScripts,
  saveScript,
  updateScript,
  deleteScript,
  getQueryHistory,
  addConnection,
  updateConnection,
  removeConnection,
  initializeConnections,
  saveSessionState,
  getSessionState
} from '@/lib/tauri-commands'
import type { ConnectionInfo, Schema, Script, QueryHistoryEntry } from '@/types/database'
import { Plus, X } from 'lucide-react'
import { Button } from './ui/button'

type SidebarTabState = 'connections' | 'items' | 'scripts' | 'history'

export function MainContent() {
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | null>(null)
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [establishingConnections, setEstablishingConnections] = useState<Set<string>>(new Set())
  const [databaseSchema, setDatabaseSchema] = useState<Schema | null>(null)
  const [loadingSchema, setLoadingSchema] = useState(false)
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [activeScriptId, setActiveScriptId] = useState<number | null>(null)
  const [unsavedChanges, setUnsavedChanges] = useState<Set<number>>(new Set())
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sidebarTabState, setSidebarTabState] = useState<SidebarTabState>('connections')
  const [executing, setExecuting] = useState(false)

  // TODO: Update to use complete store API
  // const { tabs, activeTabId, addTab, removeTab, setActiveTab, updateTab, getActiveTab } = useTabs()
  const tabs: any[] = []
  const activeTabId: string | null = null
  const addTab = () => {}
  const removeTab = (id: any) => {}
  const setActiveTab = (id: any) => {}
  const updateTab = (id: any, updates: any) => {}
  const getActiveTab = () => ({ id: '1', query: '', status: 'Pending' } as any)
  const sqlEditorRef = useRef<any>(null)

  // Load connections on mount
  useEffect(() => {
    async function init() {
      try {
        await initializeConnections()
        await loadConnections()
        await loadScripts()
        await restoreSession()
      } catch (error) {
        console.error('Failed to initialize:', error)
      }
    }
    init()
  }, [])

  // Load schema when connection changes
  useEffect(() => {
    if (selectedConnection) {
      const connection = connections.find(c => c.id === selectedConnection)
      if (connection?.connected) {
        loadDatabaseSchema()
      }
    }
  }, [selectedConnection, connections])

  // Load query history when connection changes
  useEffect(() => {
    if (selectedConnection) {
      loadQueryHistory()
    }
  }, [selectedConnection])

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

  async function loadDatabaseSchema() {
    if (!selectedConnection || loadingSchema) return
    
    setLoadingSchema(true)
    try {
      const schema = await getSchema(selectedConnection)
      setDatabaseSchema(schema)
    } catch (error) {
      console.error('Failed to load schema:', error)
      setDatabaseSchema(null)
    } finally {
      setLoadingSchema(false)
    }
  }

  async function handleRefreshSchema() {
    if (!selectedConnection) return
    setLoadingSchema(true)
    try {
      const schema = await refreshSchema(selectedConnection)
      setDatabaseSchema(schema)
    } catch (error) {
      console.error('Failed to refresh schema:', error)
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

  async function handleConnect(connectionId: string) {
    setEstablishingConnections(prev => new Set(prev).add(connectionId))
    
    try {
      const success = await connectToDatabase(connectionId)
      if (success) {
        await loadConnections()
        setSelectedConnection(connectionId)
      }
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setEstablishingConnections(prev => {
        const next = new Set(prev)
        next.delete(connectionId)
        return next
      })
    }
  }

  async function handleDisconnect(connectionId: string) {
    try {
      await disconnectFromDatabase(connectionId)
      await loadConnections()
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  async function handleConnectionSubmit(name: string, databaseInfo: any) {
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

  async function handleRunQuery() {
    const activeTab = getActiveTab()
    if (!activeTab || !selectedConnection) return

    setExecuting(true)
    updateTab(activeTab.id, { status: 'Running', error: null })

    try {
      const results = await executeQuery(selectedConnection, activeTab.query)
      if (results.length > 0) {
        const firstResult = results[0]
        if (firstResult.error) {
          updateTab(activeTab.id, {
            status: 'Error',
            error: firstResult.error,
            results: null,
          })
        } else {
          updateTab(activeTab.id, {
            status: 'Completed',
            results: firstResult.first_page,
            affectedRows: firstResult.affected_rows,
            columns: firstResult.columns || [],
            error: null,
          })
        }
      }
    } catch (error) {
      updateTab(activeTab.id, {
        status: 'Error',
        error: error instanceof Error ? error.message : 'Query execution failed',
        results: null,
      })
    } finally {
      setExecuting(false)
    }
  }

  function handleQueryChange(value: string) {
    const activeTab = getActiveTab()
    if (activeTab) {
      updateTab(activeTab.id, { query: value })
    }
  }

  function handleTableClick(tableName: string, schema: string) {
    const query = `SELECT * FROM ${schema ? `"${schema}".` : ''}"${tableName}" LIMIT 100;`
    const activeTab = getActiveTab()
    if (activeTab) {
      updateTab(activeTab.id, { query })
    }
  }

  function handleLoadFromHistory(historyQuery: string) {
    const activeTab = getActiveTab()
    if (activeTab) {
      updateTab(activeTab.id, { query: historyQuery })
    }
  }

  async function handleSelectScript(script: Script) {
    setActiveScriptId(script.id)
    const activeTab = getActiveTab()
    if (activeTab) {
      updateTab(activeTab.id, { query: script.query_text })
    }
  }

  async function handleCreateNewScript() {
    const newScript: Script = {
      id: Date.now(), // Temporary ID
      name: 'Untitled Script',
      query_text: '',
      connection_id: selectedConnection,
      description: null,
      tags: null,
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
    }
    setScripts(prev => [...prev, newScript])
    setActiveScriptId(newScript.id)
    const activeTab = getActiveTab()
    if (activeTab) {
      updateTab(activeTab.id, { query: '' })
    }
  }

  async function handleDeleteScript(script: Script) {
    try {
      await deleteScript(script.id)
      setScripts(prev => prev.filter(s => s.id !== script.id))
      if (activeScriptId === script.id) {
        setActiveScriptId(null)
      }
    } catch (error) {
      console.error('Failed to delete script:', error)
    }
  }

  async function handleSaveScript() {
    if (!activeScriptId) return

    const activeTab = getActiveTab()
    if (!activeTab) return

    const script = scripts.find(s => s.id === activeScriptId)
    if (!script) return

    try {
      if (script.id < 0) {
        // New script
        const scriptId = await saveScript(
          script.name,
          activeTab.query,
          selectedConnection || undefined,
          script.description || undefined
        )
        setScripts(prev => prev.map(s => 
          s.id === activeScriptId ? { ...s, id: scriptId, query_text: activeTab.query } : s
        ))
        setActiveScriptId(scriptId)
      } else {
        // Update existing
        await updateScript(
          script.id,
          script.name,
          activeTab.query,
          selectedConnection || undefined,
          script.description || undefined
        )
        setScripts(prev => prev.map(s => 
          s.id === activeScriptId ? { ...s, query_text: activeTab.query } : s
        ))
      }
      setUnsavedChanges(prev => {
        const next = new Set(prev)
        next.delete(activeScriptId)
        return next
      })
    } catch (error) {
      console.error('Failed to save script:', error)
    }
  }

  async function saveSession() {
    try {
      const sessionData = {
        selectedConnection,
        isSidebarCollapsed,
        sidebarTabState,
        tabs: tabs.map(tab => ({
          id: tab.id,
          query: tab.query,
        })),
        activeTabId,
      }
      await saveSessionState(JSON.stringify(sessionData))
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  async function restoreSession() {
    try {
      const raw = await getSessionState()
      if (!raw) return

      const saved = JSON.parse(raw)
      if (saved.selectedConnection) setSelectedConnection(saved.selectedConnection)
      if (saved.isSidebarCollapsed !== undefined) setIsSidebarCollapsed(saved.isSidebarCollapsed)
      if (saved.sidebarTabState) setSidebarTabState(saved.sidebarTabState)
    } catch (error) {
      console.error('Failed to restore session:', error)
    }
  }

  // Auto-save session periodically
  useEffect(() => {
    const interval = setInterval(() => {
      saveSession()
    }, 20000)
    return () => clearInterval(interval)
  }, [selectedConnection, isSidebarCollapsed, sidebarTabState, tabs, activeTabId])

  const activeTab = getActiveTab()
  const currentConnection = connections.find(c => c.id === selectedConnection)

  return (
    <div className="flex h-full bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex-1 flex overflow-hidden">
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
          onSelectConnection={setSelectedConnection}
          onConnectToDatabase={handleConnect}
          onShowConnectionForm={() => {
            setEditingConnection(null)
            setShowConnectionForm(true)
          }}
          onEditConnection={(conn) => {
            setEditingConnection(conn)
            setShowConnectionForm(true)
          }}
          onDeleteConnection={handleDeleteConnection}
          onDisconnectConnection={handleDisconnect}
          onSelectScript={handleSelectScript}
          onCreateNewScript={handleCreateNewScript}
          onDeleteScript={handleDeleteScript}
          onTableClick={handleTableClick}
          onLoadFromHistory={handleLoadFromHistory}
          onSidebarTabChange={setSidebarTabState}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <ScriptTabs />

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-1/2 border-b border-border p-4">
              <SqlEditor
                value={activeTab?.query || ''}
                onChange={handleQueryChange}
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

            <div className="h-1/2 overflow-auto">
              {executing && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">Executing query...</div>
                </div>
              )}
              {!executing && activeTab?.error && (
                <div className="p-4">
                  <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md">
                    {String(activeTab.error)}
                  </div>
                </div>
              )}
              {!executing && activeTab?.results && Array.isArray(activeTab.results) && (
                <Table
                  columns={activeTab.columns}
                  data={activeTab.results as unknown[][]}
                />
              )}
              {!executing && !activeTab?.results && !activeTab?.error && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Run a query to see results
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showConnectionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl">
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
