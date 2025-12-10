'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import type { Script } from '@/types/database'

interface BaseTab {
  id: string
  type: TabType
  title: string
  isDirty: boolean
  canClose: boolean
  canRename: boolean
  isPinned: boolean
}

export interface ScriptTab extends BaseTab {
  type: 'script'
  scriptId: number
  script: Script
  content: string
  editorState?: any
  isNewScript: boolean
  results?: {
    columns: string[]
    rows: unknown[][]
    affectedRows?: number
  }
  error?: string | null
  queryStatus?: 'idle' | 'running' | 'completed' | 'error'
}

interface TableViewTab extends BaseTab {
  type: 'table-view'
  tableName: string
  schema: string
  connectionId: string
}

type TabType = 'script' | 'table-view'
type AnyTab = ScriptTab | TableViewTab

export type SidebarTabState = 'connections' | 'items' | 'scripts' | 'history'

interface SessionData {
  nextTempId?: number
  tempScripts?: Array<{
    id: number
    name: string
    content: string
  }>
  openScriptIds?: number[]
  activeScriptId?: number | null
  unsavedChanges?: Record<string, string>
}

type TabsContextType = {
  tabs: AnyTab[]
  activeTabId: string | null
  scripts: Script[]
  newScripts: Set<number>
  nextTempId: number
  currentEditorContent: string

  openScript: (script: Script) => void
  switchToTab: (tabId: string, skipSaveCurrentContent?: boolean) => void
  closeTab: (tabId: string) => void
  handleEditorContentChange: (newContent: string) => void
  markScriptSaved: (scriptId: number, newContent: string) => void
  updateScriptId: (oldScriptId: number, newScriptId: number, updatedScript: Script) => void
  createNewScript: () => void
  createScriptFromHistory: (historyQuery: string) => void
  renameScript: (tabId: string, newName: string) => void
  openTableExplorationTab: (tableName: string, schema: string, connectionId: string) => void
  saveSession: (saveCallback: (data: SessionData) => Promise<void>) => Promise<void>
  restoreSession: (sessionData: SessionData | null) => Promise<boolean>
  setScripts: (scripts: Script[]) => void
  setSqlEditorRef: (ref: any) => void
  onSessionSave: (callback: () => void) => void
  getActiveTab: () => AnyTab | null
  shouldSaveSession: boolean
  clearSessionDirty: () => void
  setQueryResults: (tabId: string, results: { columns: string[], rows: unknown[][], affectedRows?: number } | null) => void
  setQueryError: (tabId: string, error: string | null) => void
  setQueryStatus: (tabId: string, status: 'idle' | 'running' | 'completed' | 'error') => void
  // Tab management
  pinTab: (tabId: string) => void
  unpinTab: (tabId: string) => void
  closeTabsToLeft: (tabId: string) => void
  closeTabsToRight: (tabId: string) => void
  closeAllTabs: () => void
  closeOtherTabs: (tabId: string) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
}

const TabsContext = createContext<TabsContextType | undefined>(undefined)

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<AnyTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [scripts, setScriptsState] = useState<Script[]>([])
  const [newScripts, setNewScripts] = useState<Set<number>>(new Set())
  const [nextTempId, setNextTempId] = useState(-1)
  const [currentEditorContent, setCurrentEditorContent] = useState('')
  const [shouldSaveSessionState, setShouldSaveSession] = useState(false)

  const sqlEditorRef = useRef<any>(null)
  const sessionSaveCallbacks = useRef<(() => void)[]>([])

  const markSessionDirty = useCallback(() => {
    setShouldSaveSession(true)
    sessionSaveCallbacks.current.forEach((callback) => callback())
  }, [])

  const findScriptTab = useCallback((scriptId: number): ScriptTab | undefined => {
    return tabs.find(
      (tab) => tab.type === 'script' && (tab as ScriptTab).scriptId === scriptId
    ) as ScriptTab | undefined
  }, [tabs])

  const openScript = useCallback((script: Script) => {
    const tabId = `script-${script.id}`

    setTabs((prevTabs) => {
      let existingTab = prevTabs.find((t) => t.id === tabId) as ScriptTab | undefined

      if (!existingTab) {
        const scriptTab: ScriptTab = {
          id: tabId,
          type: 'script',
          scriptId: script.id,
          title: script.name,
          isDirty: false,
          canClose: true,
          canRename: true,
          isPinned: false,
          script: script,
          content: script.query_text,
          isNewScript: newScripts.has(script.id),
        }
        return [...prevTabs, scriptTab]
      }

      existingTab.content = script.query_text
      return prevTabs
    })

    setActiveTabId(tabId)
    setCurrentEditorContent(script.query_text)
    markSessionDirty()
  }, [newScripts, markSessionDirty])

  const switchToTab = useCallback((tabId: string, skipSaveCurrentContent = false) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return

    const currentTab = tabs.find((t) => t.id === activeTabId) as ScriptTab | undefined

    if (currentTab?.type === 'script' && sqlEditorRef.current && !skipSaveCurrentContent) {
      setTabs((prevTabs) =>
        prevTabs.map((t) => {
          if (t.id === currentTab.id && t.type === 'script') {
            const scriptTab = t as ScriptTab
            return {
              ...scriptTab,
              content: currentEditorContent,
            }
          }
          return t
        })
      )
    }

    setActiveTabId(tabId)

    if (tab.type === 'script') {
      const scriptTab = tab as ScriptTab
      const content = scriptTab.content || scriptTab.script.query_text
      setCurrentEditorContent(content)
    }

    markSessionDirty()
  }, [tabs, activeTabId, currentEditorContent, markSessionDirty])

  const closeTab = useCallback((tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return

    setTabs((prevTabs) => prevTabs.filter((t) => t.id !== tabId))

    if (tab.type === 'script') {
      const scriptTab = tab as ScriptTab
      setNewScripts((prev) => {
        const next = new Set(prev)
        next.delete(scriptTab.scriptId)
        return next
      })
    }

    if (activeTabId === tabId) {
      setTabs((prevTabs) => {
        if (prevTabs.length > 0) {
          const lastTab = prevTabs[prevTabs.length - 1]
          setActiveTabId(lastTab.id)
        } else {
          setActiveTabId(null)
          setCurrentEditorContent('')
        }
        return prevTabs
      })
    }

    markSessionDirty()
  }, [tabs, activeTabId, markSessionDirty])

  const handleEditorContentChange = useCallback((newContent: string) => {
    setCurrentEditorContent(newContent)

    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === activeTabId && tab.type === 'script') {
          const scriptTab = tab as ScriptTab
          const originalContent = scriptTab.script.query_text
          const shouldShowUnsaved = scriptTab.isNewScript
            ? newContent.length > 0
            : newContent !== originalContent

          return {
            ...scriptTab,
            content: newContent,
            isDirty: shouldShowUnsaved,
          }
        }
        return tab
      })
    )
  }, [activeTabId])

  const markScriptSaved = useCallback((scriptId: number, newContent: string) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.type === 'script' && (tab as ScriptTab).scriptId === scriptId) {
          const scriptTab = tab as ScriptTab
          return {
            ...scriptTab,
            script: { ...scriptTab.script, query_text: newContent },
            content: newContent,
            isNewScript: false,
            isDirty: false,
          }
        }
        return tab
      })
    )

    setNewScripts((prev) => {
      const next = new Set(prev)
      next.delete(scriptId)
      return next
    })
  }, [])

  const updateScriptId = useCallback((oldScriptId: number, newScriptId: number, updatedScript: Script) => {
    const oldTabId = `script-${oldScriptId}`
    const newTabId = `script-${newScriptId}`

    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.type === 'script' && tab.id === oldTabId) {
          return {
            ...tab,
            id: newTabId,
            scriptId: newScriptId,
            script: updatedScript,
            isNewScript: false,
          } as ScriptTab
        }
        return tab
      })
    )

    if (activeTabId === oldTabId) {
      setActiveTabId(newTabId)
    }
  }, [activeTabId])

  const createScriptFromHistory = useCallback((historyQuery: string) => {
    const tempId = nextTempId
    setNextTempId((prev) => prev - 1)

    const existingUntitled = scripts.filter((s) =>
      s.name.startsWith('Untitled Script')
    ).length
    const name = existingUntitled === 0 ? 'Untitled Script' : `Untitled Script ${existingUntitled + 1}`

    const newScript: Script = {
      id: tempId,
      name,
      description: null,
      query_text: historyQuery,
      connection_id: null,
      tags: null,
      created_at: Date.now() / 1000,
      updated_at: Date.now() / 1000,
      favorite: false,
    }

    setScriptsState((prev) => [...prev, newScript])
    setNewScripts((prev) => new Set(prev).add(tempId))
    openScript(newScript)
    markSessionDirty()
  }, [nextTempId, scripts, openScript, markSessionDirty])

  const createNewScript = useCallback(() => {
    createScriptFromHistory('')
  }, [createScriptFromHistory])

  const renameScript = useCallback((tabId: string, newName: string) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === tabId && tab.type === 'script') {
          const scriptTab = tab as ScriptTab
          return {
            ...scriptTab,
            title: newName,
            script: { ...scriptTab.script, name: newName },
          }
        }
        return tab
      })
    )

    setScriptsState((prevScripts) =>
      prevScripts.map((s) => {
        const scriptTab = tabs.find((t) => t.id === tabId && t.type === 'script') as ScriptTab | undefined
        if (scriptTab && s.id === scriptTab.scriptId) {
          return { ...s, name: newName }
        }
        return s
      })
    )

    markSessionDirty()
  }, [tabs, markSessionDirty])

  const openTableExplorationTab = useCallback((tableName: string, schema: string, connectionId: string) => {
    const tabId = `table-${connectionId}-${schema}-${tableName}`

    if (tabs.find((t) => t.id === tabId)) {
      switchToTab(tabId)
      return
    }

    const tableTab: TableViewTab = {
      id: tabId,
      type: 'table-view',
      title: `${schema}.${tableName}`,
      isDirty: false,
      canClose: true,
      canRename: false,
      isPinned: false,
      tableName,
      schema,
      connectionId,
    }

    setTabs((prev) => [...prev, tableTab])
    setActiveTabId(tabId)
    markSessionDirty()
  }, [tabs, switchToTab, markSessionDirty])

  const saveSession = useCallback(async (saveCallback: (data: SessionData) => Promise<void>) => {
    const scriptTabs = tabs.filter((t) => t.type === 'script') as ScriptTab[]

    const sessionData: SessionData = {
      openScriptIds: scriptTabs.map((t) => t.scriptId),
      activeScriptId: scriptTabs.find((t) => t.id === activeTabId)?.scriptId || null,
      unsavedChanges: Object.fromEntries(
        scriptTabs
          .filter((t) => !t.isNewScript && t.content !== t.script.query_text)
          .map((t) => [t.scriptId.toString(), t.content])
      ),
      tempScripts: scriptTabs
        .filter((t) => t.isNewScript)
        .map((t) => ({
          id: t.scriptId,
          name: t.script.name,
          content: t.content,
        })),
      nextTempId,
    }

    await saveCallback(sessionData)
    setShouldSaveSession(false)
  }, [tabs, activeTabId, nextTempId])

  const restoreSession = useCallback(async (sessionData: SessionData | null): Promise<boolean> => {
    if (!sessionData) return false

    if (sessionData.nextTempId !== undefined) {
      setNextTempId((prev) => Math.min(prev, sessionData.nextTempId!))
    }

    for (const temp of sessionData.tempScripts ?? []) {
      if (!scripts.find((s) => s.id === temp.id)) {
        const newScript: Script = {
          id: temp.id,
          name: temp.name,
          description: null,
          query_text: temp.content,
          connection_id: null,
          tags: null,
          created_at: Date.now() / 1000,
          updated_at: Date.now() / 1000,
          favorite: false,
        }
        setScriptsState((prev) => [...prev, newScript])
      }
      setNewScripts((prev) => new Set(prev).add(temp.id))
    }

    for (const scriptId of sessionData.openScriptIds ?? []) {
      const script = scripts.find((s) => s.id === scriptId)
      if (script) {
        openScript(script)

        if (sessionData.unsavedChanges?.[scriptId]) {
          setTabs((prevTabs) =>
            prevTabs.map((tab) => {
              if (tab.type === 'script' && (tab as ScriptTab).scriptId === scriptId) {
                return {
                  ...tab,
                  content: sessionData.unsavedChanges![scriptId],
                  isDirty: true,
                } as ScriptTab
              }
              return tab
            })
          )
        }
      }
    }

    if (sessionData.activeScriptId != null) {
      const tabId = `script-${sessionData.activeScriptId}`
      if (tabs.find((t) => t.id === tabId)) {
        switchToTab(tabId, true)
      }
    }

    return (sessionData.openScriptIds?.length ?? 0) > 0
  }, [scripts, openScript, switchToTab, tabs])

  const setScripts = useCallback((newScripts: Script[]) => {
    setScriptsState(newScripts)
  }, [])

  const setSqlEditorRef = useCallback((ref: any) => {
    sqlEditorRef.current = ref
  }, [])

  const onSessionSave = useCallback((callback: () => void) => {
    sessionSaveCallbacks.current.push(callback)
  }, [])

  const getActiveTab = useCallback(() => {
    return tabs.find((t) => t.id === activeTabId) || null
  }, [tabs, activeTabId])

  const clearSessionDirty = useCallback(() => {
    setShouldSaveSession(false)
  }, [])

  const setQueryResults = useCallback((tabId: string, results: { columns: string[], rows: unknown[][], affectedRows?: number } | null) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === tabId && tab.type === 'script') {
          return {
            ...tab,
            results,
            error: null,
            queryStatus: 'completed',
          } as ScriptTab
        }
        return tab
      })
    )
  }, [])

  const setQueryError = useCallback((tabId: string, error: string | null) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === tabId && tab.type === 'script') {
          return {
            ...tab,
            error,
            results: undefined,
            queryStatus: 'error',
          } as ScriptTab
        }
        return tab
      })
    )
  }, [])

  const setQueryStatus = useCallback((tabId: string, status: 'idle' | 'running' | 'completed' | 'error') => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === tabId && tab.type === 'script') {
          return {
            ...tab,
            queryStatus: status,
          } as ScriptTab
        }
        return tab
      })
    )
  }, [])

  // Pin a tab (moves it to the left with other pinned tabs)
  const pinTab = useCallback((tabId: string) => {
    setTabs((prevTabs) => {
      const tabIndex = prevTabs.findIndex((t) => t.id === tabId)
      if (tabIndex === -1) return prevTabs

      const tab = prevTabs[tabIndex]
      if (tab.isPinned) return prevTabs

      const pinnedTab = { ...tab, isPinned: true }
      const newTabs = prevTabs.filter((t) => t.id !== tabId)
      const lastPinnedIndex = newTabs.findIndex((t) => !t.isPinned)
      const insertIndex = lastPinnedIndex === -1 ? newTabs.length : lastPinnedIndex

      newTabs.splice(insertIndex, 0, pinnedTab as AnyTab)
      return newTabs
    })
    markSessionDirty()
  }, [markSessionDirty])

  // Unpin a tab
  const unpinTab = useCallback((tabId: string) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId ? { ...tab, isPinned: false } : tab
      ) as AnyTab[]
    )
    markSessionDirty()
  }, [markSessionDirty])

  // Close all tabs to the left of a given tab (except pinned)
  const closeTabsToLeft = useCallback((tabId: string) => {
    setTabs((prevTabs) => {
      const tabIndex = prevTabs.findIndex((t) => t.id === tabId)
      if (tabIndex === -1) return prevTabs

      return prevTabs.filter((tab, index) => {
        if (index >= tabIndex) return true
        if (tab.isPinned) return true
        return false
      })
    })
    markSessionDirty()
  }, [markSessionDirty])

  // Close all tabs to the right of a given tab
  const closeTabsToRight = useCallback((tabId: string) => {
    setTabs((prevTabs) => {
      const tabIndex = prevTabs.findIndex((t) => t.id === tabId)
      if (tabIndex === -1) return prevTabs

      return prevTabs.filter((_, index) => index <= tabIndex)
    })
    markSessionDirty()
  }, [markSessionDirty])

  // Close all tabs (except pinned)
  const closeAllTabs = useCallback(() => {
    setTabs((prevTabs) => prevTabs.filter((tab) => tab.isPinned))
    setActiveTabId(null)
    setCurrentEditorContent('')
    markSessionDirty()
  }, [markSessionDirty])

  // Close all other tabs (except the current one and pinned)
  const closeOtherTabs = useCallback((tabId: string) => {
    setTabs((prevTabs) =>
      prevTabs.filter((tab) => tab.id === tabId || tab.isPinned)
    )
    markSessionDirty()
  }, [markSessionDirty])

  // Reorder tabs via drag and drop
  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setTabs((prevTabs) => {
      if (fromIndex === toIndex) return prevTabs
      if (fromIndex < 0 || fromIndex >= prevTabs.length) return prevTabs
      if (toIndex < 0 || toIndex >= prevTabs.length) return prevTabs

      const movingTab = prevTabs[fromIndex]
      const targetTab = prevTabs[toIndex]

      // Prevent moving unpinned tabs before pinned tabs
      if (!movingTab.isPinned && targetTab.isPinned && toIndex < fromIndex) {
        return prevTabs
      }

      // Prevent moving pinned tabs after unpinned tabs
      if (movingTab.isPinned && !targetTab.isPinned && toIndex > fromIndex) {
        return prevTabs
      }

      const newTabs = [...prevTabs]
      newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, movingTab)
      return newTabs
    })
    markSessionDirty()
  }, [markSessionDirty])

  return (
    <TabsContext.Provider
      value={{
        tabs,
        activeTabId,
        scripts,
        newScripts,
        nextTempId,
        currentEditorContent,
        openScript,
        switchToTab,
        closeTab,
        handleEditorContentChange,
        markScriptSaved,
        updateScriptId,
        createNewScript,
        createScriptFromHistory,
        renameScript,
        openTableExplorationTab,
        saveSession,
        restoreSession,
        setScripts,
        setSqlEditorRef,
        onSessionSave,
        getActiveTab,
        shouldSaveSession: shouldSaveSessionState,
        clearSessionDirty,
        setQueryResults,
        setQueryError,
        setQueryStatus,
        pinTab,
        unpinTab,
        closeTabsToLeft,
        closeTabsToRight,
        closeAllTabs,
        closeOtherTabs,
        reorderTabs,
      }}
    >
      {children}
    </TabsContext.Provider>
  )
}

export function useTabs() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('useTabs must be used within TabsProvider')
  }
  return context
}
