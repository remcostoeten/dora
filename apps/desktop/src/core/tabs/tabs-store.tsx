import { createContext, useCallback, useContext, useReducer, ReactNode } from 'react'

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

type State = {
  tabs: Tab[]
  activeTabId: string | null
}

type Action =
  | { type: 'OPEN_TAB'; args: OpenTabArgs }
  | { type: 'CLOSE_TAB'; id: string }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'CLOSE_FOR_CONNECTION'; connectionId: string }

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
      const tabs = state.tabs.length >= MAX_TABS
        ? [...state.tabs.slice(1), newTab]
        : [...state.tabs, newTab]
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
    case 'SET_ACTIVE': {
      return { ...state, activeTabId: action.id }
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
  const setActiveTab = useCallback((id: string) => dispatch({ type: 'SET_ACTIVE', id }), [])
  const closeTabsForConnection = useCallback(
    (connectionId: string) => dispatch({ type: 'CLOSE_FOR_CONNECTION', connectionId }),
    []
  )

  const value: TabsContextValue = {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    openTab,
    closeTab,
    setActiveTab,
    closeTabsForConnection,
  }

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs must be used within TabsProvider')
  return ctx
}
