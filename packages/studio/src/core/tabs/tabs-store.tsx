import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, ReactNode } from 'react'
import { readSession, writeSession } from './session-persistence'

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
  // All tabs across every open connection (flat). Most consumers want the tabs
  // scoped to the active connection — use `visibleTabs` for that.
  tabs: Tab[]
  // Tabs belonging to the active connection only (issue #96). The table TabBar
  // renders these so each connection keeps its own isolated tab group.
  visibleTabs: Tab[]
  activeTabId: string | null
  // The connection whose tab group is currently shown. Empty string means none.
  activeConnectionId: string
  // Connections the user has open (one connection tab each, in open order).
  openConnectionIds: string[]
  openTab: (args: OpenTabArgs) => void
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  closeTabsToLeft: (id: string) => void
  closeTabsToRight: (id: string) => void
  setActiveTab: (id: string) => void
  togglePinTab: (id: string) => void
  reorderTab: (fromId: string, toId: string) => void
  closeTabsForConnection: (connectionId: string) => void
  hydrateSession: (args: HydrateSessionArgs) => void
  // Multi-connection (issue #96).
  setActiveConnection: (connectionId: string) => void
  openConnection: (connectionId: string) => void
  closeConnection: (connectionId: string) => void
}

// Applied once the data needed to validate the restored session is available
// (the user's "restore tabs" preference and the set of connections that still
// exist). Pinned tabs always restore; unpinned tabs only when restoreUnpinned
// is true. Tabs whose connection no longer exists are dropped.
type HydrateSessionArgs = {
  restoreUnpinned: boolean
  knownConnectionIds: ReadonlySet<string>
}

const TabsContext = createContext<TabsContextValue | null>(null)

const MAX_TABS = 12

type State = {
  // Flat list of every tab across all open connections. Per-connection grouping
  // is derived by filtering on `Tab.connectionId` (issue #96) — keeping the list
  // flat preserves drag-reorder (#105) and session persistence (#98) unchanged.
  tabs: Tab[]
  // The connection whose tab group is visible. '' means none selected yet.
  activeConnectionId: string
  // Open connections in the order their connection tabs appear.
  openConnectionIds: string[]
  // Per-connection active tab id, so switching connections restores the tab the
  // user last had focused there. Keyed by connectionId.
  activeTabByConnection: Record<string, string>
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
  | { type: 'HYDRATE_SESSION'; args: HydrateSessionArgs }
  | { type: 'SET_ACTIVE_CONNECTION'; connectionId: string }
  | { type: 'OPEN_CONNECTION'; connectionId: string }
  | { type: 'CLOSE_CONNECTION'; connectionId: string }

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

// Active tab id of the currently active connection (the "single" active tab the
// rest of the UI cares about). Derived from the per-connection map.
function activeTabIdOf(state: State): string | null {
  return state.activeTabByConnection[state.activeConnectionId] ?? null
}

function tabsForConnection(tabs: Tab[], connectionId: string): Tab[] {
  return tabs.filter((t) => t.connectionId === connectionId)
}

// Update the active-tab map for a single connection. Passing null removes the
// entry so an orphaned id is never left behind.
function withActiveTab(
  map: Record<string, string>,
  connectionId: string,
  tabId: string | null
): Record<string, string> {
  const next = { ...map }
  if (tabId === null) delete next[connectionId]
  else next[connectionId] = tabId
  return next
}

// Ensure a connection is registered as open and active. Used whenever a tab is
// opened or selected so the connection tab bar always reflects reality.
function ensureOpenAndActive(state: State, connectionId: string): State {
  const openConnectionIds = state.openConnectionIds.includes(connectionId)
    ? state.openConnectionIds
    : [...state.openConnectionIds, connectionId]
  return { ...state, openConnectionIds, activeConnectionId: connectionId }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'OPEN_TAB': {
      const connectionId = action.args.connectionId
      const base = ensureOpenAndActive(state, connectionId)
      const existing = state.tabs.find(
        (t) => t.connectionId === connectionId && t.tableId === action.args.tableId
      )
      if (existing) {
        return {
          ...base,
          activeTabByConnection: withActiveTab(
            base.activeTabByConnection,
            connectionId,
            existing.id
          ),
        }
      }
      const newTab: Tab = { ...action.args, id: crypto.randomUUID() }
      // Apply the tab limit per-connection so one connection can't evict another
      // connection's tabs.
      const others = state.tabs.filter((t) => t.connectionId !== connectionId)
      const own = tabsForConnection(state.tabs, connectionId)
      const ownWithNew = appendWithTabLimit(own, newTab)
      const tabs = [...others, ...ownWithNew]
      return {
        ...base,
        tabs,
        activeTabByConnection: withActiveTab(
          base.activeTabByConnection,
          connectionId,
          newTab.id
        ),
      }
    }
    case 'CLOSE_TAB': {
      const target = state.tabs.find((t) => t.id === action.id)
      if (!target) return state
      const connectionId = target.connectionId
      const own = tabsForConnection(state.tabs, connectionId)
      const idxInOwn = own.findIndex((t) => t.id === action.id)
      const tabs = state.tabs.filter((t) => t.id !== action.id)
      let activeTabByConnection = state.activeTabByConnection
      if (state.activeTabByConnection[connectionId] === action.id) {
        const ownAfter = own.filter((t) => t.id !== action.id)
        const nextActive =
          ownAfter.length === 0 ? null : ownAfter[Math.min(idxInOwn, ownAfter.length - 1)].id
        activeTabByConnection = withActiveTab(activeTabByConnection, connectionId, nextActive)
      }
      return { ...state, tabs, activeTabByConnection }
    }
    case 'CLOSE_OTHER_TABS': {
      const current = state.tabs.find((t) => t.id === action.id)
      if (!current) return state
      const connectionId = current.connectionId
      const tabs = state.tabs.filter(
        (t) => t.connectionId !== connectionId || t.id === action.id || t.pinned
      )
      return {
        ...state,
        tabs,
        activeTabByConnection: withActiveTab(state.activeTabByConnection, connectionId, action.id),
      }
    }
    case 'CLOSE_TABS_TO_LEFT': {
      const current = state.tabs.find((t) => t.id === action.id)
      if (!current) return state
      const connectionId = current.connectionId
      const own = tabsForConnection(state.tabs, connectionId)
      const idx = own.findIndex((t) => t.id === action.id)
      if (idx === -1) return state
      const keepIds = new Set(own.filter((t, i) => i >= idx || t.pinned).map((t) => t.id))
      const tabs = state.tabs.filter((t) => t.connectionId !== connectionId || keepIds.has(t.id))
      const ownAfter = tabsForConnection(tabs, connectionId)
      const nextActive = resolveActiveTabId(
        ownAfter,
        state.activeTabByConnection[connectionId] ?? null,
        action.id
      )
      return {
        ...state,
        tabs,
        activeTabByConnection: withActiveTab(state.activeTabByConnection, connectionId, nextActive),
      }
    }
    case 'CLOSE_TABS_TO_RIGHT': {
      const current = state.tabs.find((t) => t.id === action.id)
      if (!current) return state
      const connectionId = current.connectionId
      const own = tabsForConnection(state.tabs, connectionId)
      const idx = own.findIndex((t) => t.id === action.id)
      if (idx === -1) return state
      const keepIds = new Set(own.filter((t, i) => i <= idx || t.pinned).map((t) => t.id))
      const tabs = state.tabs.filter((t) => t.connectionId !== connectionId || keepIds.has(t.id))
      const ownAfter = tabsForConnection(tabs, connectionId)
      const nextActive = resolveActiveTabId(
        ownAfter,
        state.activeTabByConnection[connectionId] ?? null,
        action.id
      )
      return {
        ...state,
        tabs,
        activeTabByConnection: withActiveTab(state.activeTabByConnection, connectionId, nextActive),
      }
    }
    case 'SET_ACTIVE': {
      const target = state.tabs.find((t) => t.id === action.id)
      if (!target) return state
      const base = ensureOpenAndActive(state, target.connectionId)
      return {
        ...base,
        activeTabByConnection: withActiveTab(
          base.activeTabByConnection,
          target.connectionId,
          action.id
        ),
      }
    }
    case 'TOGGLE_PIN_TAB': {
      const target = state.tabs.find((t) => t.id === action.id)
      if (!target) return state
      const connectionId = target.connectionId
      const own = tabsForConnection(state.tabs, connectionId).map((tab) =>
        tab.id === action.id ? { ...tab, pinned: !tab.pinned } : tab
      )
      const reordered = movePinnedTab(own, action.id)
      const others = state.tabs.filter((t) => t.connectionId !== connectionId)
      return { ...state, tabs: [...others, ...reordered] }
    }
    case 'MOVE_TAB': {
      if (action.fromId === action.toId) return state
      const from = state.tabs.find((t) => t.id === action.fromId)
      const to = state.tabs.find((t) => t.id === action.toId)
      // Reorder only within a single connection's tab group.
      if (!from || !to || from.connectionId !== to.connectionId) return state
      const connectionId = from.connectionId
      const own = tabsForConnection(state.tabs, connectionId)
      const fromIdx = own.findIndex((t) => t.id === action.fromId)
      const toIdx = own.findIndex((t) => t.id === action.toId)
      if (fromIdx === -1 || toIdx === -1) return state

      const next = [...own]
      const [moved] = next.splice(fromIdx, 1)
      // Insert at the target's original index so the dragged tab takes the
      // target's slot (dropping after it when moving right, before it when
      // moving left).
      next.splice(toIdx, 0, moved)

      // Keep pinned tabs grouped ahead of unpinned ones (stable within group),
      // matching the invariant used elsewhere in the store.
      const pinned = next.filter((t) => t.pinned)
      const unpinned = next.filter((t) => !t.pinned)
      const others = state.tabs.filter((t) => t.connectionId !== connectionId)
      return { ...state, tabs: [...others, ...pinned, ...unpinned] }
    }
    case 'CLOSE_FOR_CONNECTION': {
      const tabs = state.tabs.filter((t) => t.connectionId !== action.connectionId)
      return {
        ...state,
        tabs,
        activeTabByConnection: withActiveTab(state.activeTabByConnection, action.connectionId, null),
      }
    }
    case 'HYDRATE_SESSION': {
      const { restoreUnpinned, knownConnectionIds } = action.args
      const tabs = state.tabs.filter((tab) => {
        if (!knownConnectionIds.has(tab.connectionId)) return false
        return tab.pinned ? true : restoreUnpinned
      })
      // Prune open connections / active-tab map to those still backed by a tab
      // or a known connection.
      const survivingConnectionIds = new Set(tabs.map((t) => t.connectionId))
      const openConnectionIds = state.openConnectionIds.filter(
        (id) => knownConnectionIds.has(id) && survivingConnectionIds.has(id)
      )
      const activeTabByConnection: Record<string, string> = {}
      for (const id of openConnectionIds) {
        const own = tabsForConnection(tabs, id)
        const next = resolveActiveTabId(own, state.activeTabByConnection[id] ?? null)
        if (next) activeTabByConnection[id] = next
      }
      const activeConnectionId =
        state.activeConnectionId && openConnectionIds.includes(state.activeConnectionId)
          ? state.activeConnectionId
          : (openConnectionIds[openConnectionIds.length - 1] ?? '')
      if (
        tabs.length === state.tabs.length &&
        openConnectionIds.length === state.openConnectionIds.length
      ) {
        return { ...state, activeConnectionId, activeTabByConnection }
      }
      return { ...state, tabs, openConnectionIds, activeConnectionId, activeTabByConnection }
    }
    case 'SET_ACTIVE_CONNECTION': {
      if (action.connectionId === state.activeConnectionId) return state
      return ensureOpenAndActive(state, action.connectionId)
    }
    case 'OPEN_CONNECTION': {
      return ensureOpenAndActive(state, action.connectionId)
    }
    case 'CLOSE_CONNECTION': {
      const connectionId = action.connectionId
      const tabs = state.tabs.filter((t) => t.connectionId !== connectionId)
      const openConnectionIds = state.openConnectionIds.filter((id) => id !== connectionId)
      const activeTabByConnection = withActiveTab(state.activeTabByConnection, connectionId, null)
      let activeConnectionId = state.activeConnectionId
      if (state.activeConnectionId === connectionId) {
        // Switch to the connection nearest the one being closed.
        const closedIdx = state.openConnectionIds.indexOf(connectionId)
        activeConnectionId =
          openConnectionIds[Math.min(closedIdx, openConnectionIds.length - 1)] ?? ''
      }
      return { tabs, openConnectionIds, activeConnectionId, activeTabByConnection }
    }
    default:
      return state
  }
}

const initialState: State = {
  tabs: [],
  activeConnectionId: '',
  openConnectionIds: [],
  activeTabByConnection: {},
}

// Hydrate synchronously from the persisted session so restored tabs render on
// the very first paint — cold start is never blocked. Tabs whose connection no
// longer exists, and unpinned tabs when "restore on launch" is off, are pruned
// later via HYDRATE_SESSION once that data is available (see Index.tsx).
function loadInitialState(): State {
  const session = readSession()
  return {
    tabs: session.tabs,
    activeConnectionId: session.activeConnectionId,
    openConnectionIds: session.openConnectionIds,
    activeTabByConnection: session.activeTabByConnection,
  }
}

export function TabsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  useEffect(
    function persistTabs() {
      writeSession({
        tabs: state.tabs,
        activeConnectionId: state.activeConnectionId,
        openConnectionIds: state.openConnectionIds,
        activeTabByConnection: state.activeTabByConnection,
      })
    },
    [state.tabs, state.activeConnectionId, state.openConnectionIds, state.activeTabByConnection]
  )

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
  const hydrateSession = useCallback(
    (args: HydrateSessionArgs) => dispatch({ type: 'HYDRATE_SESSION', args }),
    []
  )
  const setActiveConnection = useCallback(
    (connectionId: string) => dispatch({ type: 'SET_ACTIVE_CONNECTION', connectionId }),
    []
  )
  const openConnection = useCallback(
    (connectionId: string) => dispatch({ type: 'OPEN_CONNECTION', connectionId }),
    []
  )
  const closeConnection = useCallback(
    (connectionId: string) => dispatch({ type: 'CLOSE_CONNECTION', connectionId }),
    []
  )

  const visibleTabs = useMemo(
    () => state.tabs.filter((t) => t.connectionId === state.activeConnectionId),
    [state.tabs, state.activeConnectionId]
  )
  const activeTabId = activeTabIdOf(state)

  const value: TabsContextValue = useMemo(
    () => ({
      tabs: state.tabs,
      visibleTabs,
      activeTabId,
      activeConnectionId: state.activeConnectionId,
      openConnectionIds: state.openConnectionIds,
      openTab,
      closeTab,
      closeOtherTabs,
      closeTabsToLeft,
      closeTabsToRight,
      setActiveTab,
      togglePinTab,
      reorderTab,
      closeTabsForConnection,
      hydrateSession,
      setActiveConnection,
      openConnection,
      closeConnection,
    }),
    [
      state.tabs,
      visibleTabs,
      activeTabId,
      state.activeConnectionId,
      state.openConnectionIds,
      openTab,
      closeTab,
      closeOtherTabs,
      closeTabsToLeft,
      closeTabsToRight,
      setActiveTab,
      togglePinTab,
      reorderTab,
      closeTabsForConnection,
      hydrateSession,
      setActiveConnection,
      openConnection,
      closeConnection,
    ]
  )

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error('useTabs must be used within TabsProvider')
  return ctx
}
