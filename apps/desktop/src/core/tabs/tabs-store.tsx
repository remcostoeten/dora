import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

export type Tab = {
  id: string
  connectionId: string
  tableId: string
  tableName: string
  label: string
}

type OpenTabArgs = Omit<Tab, 'id'>

type TabsContextValue = {
  tabs: Tab[]
  activeTabId: string | null
  openTab: (args: OpenTabArgs) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  closeTabsForConnection: (connectionId: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

const MAX_TABS = 12

export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const openTab = useCallback(function (args: OpenTabArgs) {
    setTabs(function (prev) {
      const existing = prev.find(
        (t) => t.connectionId === args.connectionId && t.tableId === args.tableId
      )
      if (existing) {
        setActiveTabId(existing.id)
        return prev
      }
      const newTab: Tab = { ...args, id: crypto.randomUUID() }
      const next = prev.length >= MAX_TABS ? prev.slice(1) : prev
      setActiveTabId(newTab.id)
      return [...next, newTab]
    })
  }, [])

  const closeTab = useCallback(function (id: string) {
    setTabs(function (prev) {
      const idx = prev.findIndex((t) => t.id === id)
      if (idx === -1) return prev
      const next = prev.filter((t) => t.id !== id)
      setActiveTabId(function (current) {
        if (current !== id) return current
        if (next.length === 0) return null
        const newIdx = Math.min(idx, next.length - 1)
        return next[newIdx].id
      })
      return next
    })
  }, [])

  const setActiveTab = useCallback(function (id: string) {
    setActiveTabId(id)
  }, [])

  const closeTabsForConnection = useCallback(function (connectionId: string) {
    setTabs(function (prev) {
      const next = prev.filter((t) => t.connectionId !== connectionId)
      setActiveTabId(function (current) {
        const stillExists = next.find((t) => t.id === current)
        return stillExists ? current : next[next.length - 1]?.id ?? null
      })
      return next
    })
  }, [])

  return (
    <TabsContext.Provider value={{ tabs, activeTabId, openTab, closeTab, setActiveTab, closeTabsForConnection }}>
      {children}
    </TabsContext.Provider>
  )
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs must be used within TabsProvider')
  return ctx
}
