'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import type { TabState } from '@/types/database'
import type { ID } from '@/types/base'

type TabsContext = {
  tabs: TabState[]
  activeTabId: ID | null
  addTab: () => void
  removeTab: (id: ID) => void
  setActiveTab: (id: ID) => void
  updateTab: (id: ID, updates: Partial<TabState>) => void
  getActiveTab: () => TabState | null
}

const TabsContext = createContext<TabsContext | undefined>(undefined)

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<TabState[]>([
    {
      id: '1',
      query: '',
      results: null,
      status: 'Pending',
      columns: [],
      error: null,
      affectedRows: null,
    },
  ])
  const [activeTabId, setActiveTabId] = useState<ID>('1')

  const addTab = useCallback(() => {
    const newId = String(Date.now())
    const newTab: TabState = {
      id: newId,
      query: '',
      results: null,
      status: 'Pending',
      columns: [],
      error: null,
      affectedRows: null,
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newId)
  }, [])

  const removeTab = useCallback((id: ID) => {
    setTabs((prev) => {
      const filtered = prev.filter((tab) => tab.id !== id)
      if (filtered.length === 0) {
        const newTab: TabState = {
          id: String(Date.now()),
          query: '',
          results: null,
          status: 'Pending',
          columns: [],
          error: null,
          affectedRows: null,
        }
        setActiveTabId(newTab.id)
        return [newTab]
      }
      return filtered
    })
    setActiveTabId((prev) => {
      const remaining = tabs.filter((tab) => tab.id !== id)
      if (remaining.length === 0) return String(Date.now())
      if (prev === id) return remaining[0].id
      return prev
    })
  }, [tabs])

  const updateTab = useCallback((id: ID, updates: Partial<TabState>) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === id ? { ...tab, ...updates } : tab))
    )
  }, [])

  const getActiveTab = useCallback(() => {
    return tabs.find((tab) => tab.id === activeTabId) || null
  }, [tabs, activeTabId])

  return (
    <TabsContext.Provider
      value={{
        tabs,
        activeTabId,
        addTab,
        removeTab,
        setActiveTab: setActiveTabId,
        updateTab,
        getActiveTab,
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
