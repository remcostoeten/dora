import { useState, useEffect, useRef } from 'react'
import { useToast } from '@/shared/components/ui/toast'
import { useResizable } from '@/shared/hooks'
import { useTabs, useTheme } from '@/shared/state'
import { useCommands } from '@/shared/hooks/use-commands'
import { COMMAND_IDS } from '@/shared/lib/tauri/constants'
import { useMainViewMode } from '@/shared/components/layout/main-view-tabs'
import { useConnections } from '../../connections/hooks/use-connections'
import { useScripts } from '../../scripts/hooks/use-scripts'
import { useQueries } from './use-queries'
import { useSchema } from '../../schema/hooks/use-schema'
import type { ConnectionInfo } from '../../connections/types'
import type { DatabaseSchema } from '../../schema/types'
import type { QueryHistoryEntry } from '../types'
import type { Script } from '../../scripts/types'

type Props = 'connections' | 'items' | 'scripts' | 'history' | 'conn-history'

export function useAppState() {
  const { addToast } = useToast()
  const { mode: mainViewMode, setMode: setMainViewMode } = useMainViewMode()
  
  // UI State
  const [showConnectionForm, setShowConnectionForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<ConnectionInfo | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sidebarTabState, setSidebarTabState] = useState<Props>('connections')
  const [executing, setExecuting] = useState(false)
  const [lastLoadedSchemaConnectionId, setLastLoadedSchemaConnectionId] = useState<string | null>(null)

  // Resize logic
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
      if (isSidebarCollapsed && currentWidth > 150) {
        setIsSidebarCollapsed(false)
      }
    }
  })

  const { size: bottomHeight, isResizing: isBottomResizing, startResizing: startBottomResizing } = useResizable({
    direction: 'vertical',
    storageKey: 'bottom-pane-height',
    shouldInverse: true,
    defaultSize: 300,
    minSize: 100,
    maxSize: 800,
  })

  // Domain hooks
  const connections = useConnections()
  const scripts = useScripts()
  const queries = useQueries()
  const schema = useSchema()

  // Tabs and session management
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
    openTableExplorationTab,
    setTableData,
    setTableLoading,
    setTableError,
    closeTab,
  } = useTabs()

  // Derive active script ID from active tab
  const activeTab = getActiveTab()
  const activeScriptId = activeTab?.type === 'script' ? (activeTab as any).scriptId : null

  // Initialize application
  useEffect(() => {
    async function init() {
      try {
        await connections.loadConnections()
        await scripts.loadScripts()
        await queries.loadQueryHistory()
      } catch (error) {
        addToast({
          title: 'Initialization Error',
          description: 'Failed to initialize application',
          variant: 'error'
        })
      }
    }
    init()
  }, [])

  // Sync scripts with tabs
  useEffect(() => {
    setTabsScripts(scripts.scripts)
  }, [scripts.scripts, setTabsScripts])

  // Auto-collapse sidebar when schema view is active
  useEffect(() => {
    if (mainViewMode === 'schema-view') {
      setIsSidebarCollapsed(true)
    }
  }, [mainViewMode, setIsSidebarCollapsed])

  // Connection management handlers
  const handleEditConnection = (connection: ConnectionInfo) => {
    setEditingConnection(connection)
    setShowConnectionForm(true)
  }

  const handleShowConnectionForm = () => {
    setEditingConnection(null)
    setShowConnectionForm(true)
  }

  const handleConnectionFormSubmit = async (connection: Omit<ConnectionInfo, 'id'>) => {
    try {
      if (editingConnection) {
        await connections.updateConnection(editingConnection.id, connection)
        addToast({
          title: 'Connection Updated',
          description: 'Connection updated successfully'
        })
      } else {
        await connections.addConnection(connection)
        addToast({
          title: 'Connection Added',
          description: 'New connection added successfully'
        })
      }
      setShowConnectionForm(false)
      setEditingConnection(null)
    } catch (error) {
      addToast({
        title: 'Connection Error',
        description: 'Failed to save connection',
        variant: 'error'
      })
    }
  }

  const handleConnectionFormCancel = () => {
    setShowConnectionForm(false)
    setEditingConnection(null)
  }

  return {
    // UI State
    showConnectionForm,
    editingConnection,
    isSidebarCollapsed,
    sidebarTabState,
    executing,
    sidebarWidth,
    isSidebarResizing,
    bottomHeight,
    isBottomResizing,
    mainViewMode,
    
    // Domain data
    connections: connections.connections,
    selectedConnection: connections.selectedConnection,
    establishingConnections: connections.establishingConnections,
    scripts: scripts.scripts,
    activeScriptId,
    unsavedChanges: scripts.unsavedChanges,
    queryHistory: queries.queryHistory,
    databaseSchema: schema.databaseSchema,
    loadingSchema: schema.loading,
    
    // Tabs and editor
    allTabs,
    currentEditorContent,
    sqlEditorRef,
    
    // UI Actions
    setIsSidebarCollapsed,
    setSidebarTabState,
    setMainViewMode,
    startSidebarResizing,
    startBottomResizing,
    setShowConnectionForm,
    setEditingConnection,
    
    // Domain actions
    setSelectedConnection: connections.setSelectedConnection,
    connectToDatabase: connections.connectToDatabase,
    updateConnection: connections.updateConnection,
    removeConnection: connections.removeConnection,
    updateConnectionColor: connections.updateConnectionColor,
    disconnectFromDatabase: connections.disconnectFromDatabase,
    loadConnections: connections.loadConnections,
    loadConnectionHistory: connections.loadConnectionHistory,
    addConnection: connections.addConnection,
    openScript: scripts.openScript,
    handleEditorContentChange: scripts.handleEditorContentChange,
    markScriptSaved: scripts.markScriptSaved,
    createNewScript: scripts.createNewScript,
    loadScripts: scripts.loadScripts,
    addScript: scripts.addScript,
    updateScript: scripts.updateScript,
    deleteScript: scripts.deleteScript,
    loadQueryHistory: queries.loadQueryHistory,
    executeQuery: queries.executeQuery,
    loadFromHistory: queries.loadFromHistory,
    loadSchema: schema.loadSchema,
    clearSchema: schema.clearSchema,
    
    // Connection form handlers
    handleEditConnection,
    handleShowConnectionForm,
    handleConnectionFormSubmit,
    handleConnectionFormCancel,
    
    // Tabs actions
    closeTab,
  }
}
