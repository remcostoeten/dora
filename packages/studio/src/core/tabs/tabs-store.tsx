import { createContext, useCallback, useContext, useReducer, ReactNode } from 'react'

export type Tab = {
  id: string
  connectionId: string
  tableId: string
  tableName: string
  label: string
  pinned?: boolean
}

type OpenTabArgs = Omit<Tab, 'id'>

type TabsContextValue = {
  tabs: Tab[]
  activeTabId: string | null
  openTab: (args: OpenTabArgs) => void
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  closeTabsToLeft: (id: string) => void
  closeTabsToRight: (id: string) => void
  setActiveTab: (id: string) => void
  togglePinTab: (id: string) => void
  reorderTab: (fromId: string, toId: string) => void
  closeTabsForConnection: (connectionId: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

const MAX_TABS = 12

type State = {
  tabs: Tab[]
  activeTabId: string | null
}

type Action =
  | { type: 'OPEN_TAB'; args: OpenTabArgs }
  | { type: 'CLOSE_TAB'; id: string }
  | { type: 'CLOSE_OTHER_TABS'; id: string }
  | { type: 'CLOSE_TABS_TO_LEFT'; id: string }
  | { type: 'CLOSE_TABS_TO_RIGHT'; id: string }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'TOGGLE_PIN_TAB'; id: string }
  | { type: 'MOVE_TAB'; fromId: string; toId: string }
  | { type: 'CLOSE_FOR_CONNECTION'; connectionId: string }

function resolveActiveTabId(
  tabs: Tab[],
  requestedId: string | null,
  fallbackId?: string
): string | null {
  if (requestedId && tabs.some((tab) => tab.id === requestedId)) return requestedId
  if (fallbackId && tabs.some((tab) => tab.id === fallbackId)) return fallbackId
  return tabs[tabs.length - 1]?.id ?? null
}

function movePinnedTab(tabs: Tab[], id: string): Tab[] {
  const tab = tabs.find((item) => item.id === id)
  if (!tab) return tabs
  const withoutTab = tabs.filter((item) => item.id !== id)
  if (!tab.pinned) {
    const firstUnpinnedIndex = withoutTab.findIndex((item) => !item.pinned)
    if (firstUnpinnedIndex === -1) return [...withoutTab, tab]
    return [
      ...withoutTab.slice(0, firstUnpinnedIndex),
      tab,
      ...withoutTab.slice(firstUnpinnedIndex),
    ]
  }
  const lastPinnedIndex = withoutTab.map((item) => Boolean(item.pinned)).lastIndexOf(true)
  return [
    ...withoutTab.slice(0, lastPinnedIndex + 1),
    tab,
    ...withoutTab.slice(lastPinnedIndex + 1),
  ]
}

function appendWithTabLimit(tabs: Tab[], newTab: Tab): Tab[] {
  if (tabs.length < MAX_TABS) return [...tabs, newTab]
  const oldestUnpinnedIndex = tabs.findIndex((tab) => !tab.pinned)
  const removeIndex = oldestUnpinnedIndex === -1 ? 0 : oldestUnpinnedIndex
  return [...tabs.slice(0, removeIndex), ...tabs.slice(removeIndex + 1), newTab]
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'OPEN_TAB': {
      const existing = state.tabs.find(
        (t) => t.connectionId === action.args.connectionId && t.tableId === action.args.tableId
      )
      if (existing) {
        return { ...state, activeTabId: existing.id }
      }
      const newTab: Tab = { ...action.args, id: crypto.randomUUID() }
      const tabs = appendWithTabLimit(state.tabs, newTab)
      return { tabs, activeTabId: newTab.id }
    }
    case 'CLOSE_TAB': {
      const idx = state.tabs.findIndex((t) => t.id === action.id)
      if (idx === -1) return state
      const tabs = state.tabs.filter((t) => t.id !== action.id)
      let activeTabId = state.activeTabId
      if (state.activeTabId === action.id) {
        activeTabId = tabs.length === 0 ? null : tabs[Math.min(idx, tabs.length - 1)].id
      }
      return { tabs, activeTabId }
    }
    case 'CLOSE_OTHER_TABS': {
      const current = state.tabs.find((t) => t.id === action.id)
      if (!current) return state
      const tabs = state.tabs.filter((t) => t.id === action.id || t.pinned)
      return { tabs, activeTabId: action.id }
    }
    case 'CLOSE_TABS_TO_LEFT': {
      const idx = state.tabs.findIndex((t) => t.id === action.id)
      if (idx === -1) return state
      const tabs = state.tabs.filter((t, index) => index >= idx || t.pinned)
      return { tabs, activeTabId: resolveActiveTabId(tabs, state.activeTabId, action.id) }
    }
    case 'CLOSE_TABS_TO_RIGHT': {
      const idx = state.tabs.findIndex((t) => t.id === action.id)
      if (idx === -1) return state
      const tabs = state.tabs.filter((t, index) => index <= idx || t.pinned)
      return { tabs, activeTabId: resolveActiveTabId(tabs, state.activeTabId, action.id) }
    }
    case 'SET_ACTIVE': {
      return { ...state, activeTabId: action.id }
    }
    case 'TOGGLE_PIN_TAB': {
      const tabs = state.tabs.map((tab) =>
        tab.id === action.id ? { ...tab, pinned: !tab.pinned } : tab
      )
      return { ...state, tabs: movePinnedTab(tabs, action.id) }
    }
    case 'MOVE_TAB': {
      if (action.fromId === action.toId) return state
      const fromIdx = state.tabs.findIndex((t) => t.id === action.fromId)
      const toIdx = state.tabs.findIndex((t) => t.id === action.toId)
      if (fromIdx === -1 || toIdx === -1) return state

      const next = [...state.tabs]
      const [moved] = next.splice(fromIdx, 1)
      // Insert at the target's original index so the dragged tab takes the
      // target's slot (dropping after it when moving right, before it when
      // moving left).
      next.splice(toIdx, 0, moved)

      // Keep pinned tabs grouped ahead of unpinned ones (stable within group),
      // matching the invariant used elsewhere in the store.
      const pinned = next.filter((t) => t.pinned)
      const unpinned = next.filter((t) => !t.pinned)
      return { ...state, tabs: [...pinned, ...unpinned] }
    }
    case 'CLOSE_FOR_CONNECTION': {
      const tabs = state.tabs.filter((t) => t.connectionId !== action.connectionId)
      const stillExists = tabs.find((t) => t.id === state.activeTabId)
      const activeTabId = stillExists ? state.activeTabId : (tabs[tabs.length - 1]?.id ?? null)
      return { tabs, activeTabId }
    }
    default:
      return state
  }
}

const initialState: State = { tabs: [], activeTabId: null }

export function TabsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const openTab = useCallback((args: OpenTabArgs) => dispatch({ type: 'OPEN_TAB', args }), [])
  const closeTab = useCallback((id: string) => dispatch({ type: 'CLOSE_TAB', id }), [])
  const closeOtherTabs = useCallback((id: string) => dispatch({ type: 'CLOSE_OTHER_TABS', id }), [])
  const closeTabsToLeft = useCallback((id: string) => dispatch({ type: 'CLOSE_TABS_TO_LEFT', id }), [])
  const closeTabsToRight = useCallback((id: string) => dispatch({ type: 'CLOSE_TABS_TO_RIGHT', id }), [])
  const setActiveTab = useCallback((id: string) => dispatch({ type: 'SET_ACTIVE', id }), [])
  const togglePinTab = useCallback((id: string) => dispatch({ type: 'TOGGLE_PIN_TAB', id }), [])
  const reorderTab = useCallback(
    (fromId: string, toId: string) => dispatch({ type: 'MOVE_TAB', fromId, toId }),
    []
  )
  const closeTabsForConnection = useCallback(
    (connectionId: string) => dispatch({ type: 'CLOSE_FOR_CONNECTION', connectionId }),
    []
  )

  const value: TabsContextValue = {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    openTab,
    closeTab,
    closeOtherTabs,
    closeTabsToLeft,
    closeTabsToRight,
    setActiveTab,
    togglePinTab,
    reorderTab,
    closeTabsForConnection,
  }

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs must be used within TabsProvider')
  return ctx
}
