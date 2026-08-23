import type { Tab, TabsSlice } from '../types'

type OpenTabArgs = Omit<Tab, 'id'>

/**
 * Applied once the data needed to validate the restored session is available
 * (the user's "restore tabs" preference and the set of connections that still
 * exist). Pinned tabs always restore; unpinned tabs only when restoreUnpinned
 * is true. Tabs whose connection no longer exists are dropped.
 */
export type HydrateSessionArgs = {
	restoreUnpinned: boolean
	knownConnectionIds: ReadonlySet<string>
}

export type TabsAction =
	| { type: 'tabs/open'; args: OpenTabArgs }
	| { type: 'tabs/close'; id: string }
	| { type: 'tabs/closeOthers'; id: string }
	| { type: 'tabs/closeToLeft'; id: string }
	| { type: 'tabs/closeToRight'; id: string }
	| { type: 'tabs/setActive'; id: string }
	| { type: 'tabs/togglePin'; id: string }
	| { type: 'tabs/move'; fromId: string; toId: string }
	| { type: 'tabs/closeForConnection'; connectionId: string }
	| { type: 'tabs/hydrateSession'; args: HydrateSessionArgs }
	| { type: 'tabs/replace'; state: TabsSlice }
	| { type: 'tabs/setActiveConnection'; connectionId: string }
	| { type: 'tabs/openConnection'; connectionId: string }
	| { type: 'tabs/closeConnection'; connectionId: string }

const MAX_TABS = 12

export const initialTabsSlice: TabsSlice = {
	tabs: [],
	activeConnectionId: '',
	openConnectionIds: [],
	activeTabByConnection: {}
}

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
			...withoutTab.slice(firstUnpinnedIndex)
		]
	}
	const lastPinnedIndex = withoutTab.map((item) => Boolean(item.pinned)).lastIndexOf(true)
	return [
		...withoutTab.slice(0, lastPinnedIndex + 1),
		tab,
		...withoutTab.slice(lastPinnedIndex + 1)
	]
}

function appendWithTabLimit(tabs: Tab[], newTab: Tab): Tab[] {
	if (tabs.length < MAX_TABS) return [...tabs, newTab]
	const oldestUnpinnedIndex = tabs.findIndex((tab) => !tab.pinned)
	const removeIndex = oldestUnpinnedIndex === -1 ? 0 : oldestUnpinnedIndex
	return [...tabs.slice(0, removeIndex), ...tabs.slice(removeIndex + 1), newTab]
}

export function tabsForConnection(tabs: Tab[], connectionId: string): Tab[] {
	return tabs.filter((tab) => tab.connectionId === connectionId)
}

/**
 * Active tab id of the currently active connection (the "single" active tab the
 * rest of the UI cares about). Derived from the per-connection map.
 */
export function activeTabIdOf(slice: TabsSlice): string | null {
	return slice.activeTabByConnection[slice.activeConnectionId] ?? null
}

/**
 * Update the active-tab map for a single connection. Passing null removes the
 * entry so an orphaned id is never left behind.
 */
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

/**
 * Ensure a connection is registered as open and active. Used whenever a tab is
 * opened or selected so the connection tab bar always reflects reality.
 */
function ensureOpenAndActive(state: TabsSlice, connectionId: string): TabsSlice {
	const openConnectionIds = state.openConnectionIds.includes(connectionId)
		? state.openConnectionIds
		: [...state.openConnectionIds, connectionId]
	if (
		openConnectionIds === state.openConnectionIds &&
		state.activeConnectionId === connectionId
	) {
		return state
	}
	return { ...state, openConnectionIds, activeConnectionId: connectionId }
}

export function reduceTabs(state: TabsSlice, action: TabsAction): TabsSlice {
	switch (action.type) {
		case 'tabs/open': {
			const connectionId = action.args.connectionId
			const base = ensureOpenAndActive(state, connectionId)
			const existing = state.tabs.find(
				(tab) => tab.connectionId === connectionId && tab.tableId === action.args.tableId
			)
			if (existing) {
				if (base === state && state.activeTabByConnection[connectionId] === existing.id) {
					return state
				}
				return {
					...base,
					activeTabByConnection: withActiveTab(
						base.activeTabByConnection,
						connectionId,
						existing.id
					)
				}
			}
			const newTab: Tab = { ...action.args, id: crypto.randomUUID() }
			// Apply the tab limit per-connection so one connection can't evict
			// another connection's tabs.
			const others = state.tabs.filter((tab) => tab.connectionId !== connectionId)
			const own = tabsForConnection(state.tabs, connectionId)
			const ownWithNew = appendWithTabLimit(own, newTab)
			return {
				...base,
				tabs: [...others, ...ownWithNew],
				activeTabByConnection: withActiveTab(
					base.activeTabByConnection,
					connectionId,
					newTab.id
				)
			}
		}
		case 'tabs/close': {
			const target = state.tabs.find((tab) => tab.id === action.id)
			if (!target) return state
			const connectionId = target.connectionId
			const own = tabsForConnection(state.tabs, connectionId)
			const idxInOwn = own.findIndex((tab) => tab.id === action.id)
			const tabs = state.tabs.filter((tab) => tab.id !== action.id)
			let activeTabByConnection = state.activeTabByConnection
			if (state.activeTabByConnection[connectionId] === action.id) {
				const ownAfter = own.filter((tab) => tab.id !== action.id)
				const nextActive =
					ownAfter.length === 0
						? null
						: ownAfter[Math.min(idxInOwn, ownAfter.length - 1)].id
				activeTabByConnection = withActiveTab(
					activeTabByConnection,
					connectionId,
					nextActive
				)
			}
			return { ...state, tabs, activeTabByConnection }
		}
		case 'tabs/closeOthers': {
			const current = state.tabs.find((tab) => tab.id === action.id)
			if (!current) return state
			const connectionId = current.connectionId
			const tabs = state.tabs.filter(
				(tab) => tab.connectionId !== connectionId || tab.id === action.id || tab.pinned
			)
			return {
				...state,
				tabs,
				activeTabByConnection: withActiveTab(
					state.activeTabByConnection,
					connectionId,
					action.id
				)
			}
		}
		case 'tabs/closeToLeft':
		case 'tabs/closeToRight': {
			const current = state.tabs.find((tab) => tab.id === action.id)
			if (!current) return state
			const connectionId = current.connectionId
			const own = tabsForConnection(state.tabs, connectionId)
			const idx = own.findIndex((tab) => tab.id === action.id)
			if (idx === -1) return state
			const keepsIndex =
				action.type === 'tabs/closeToLeft'
					? (index: number) => index >= idx
					: (index: number) => index <= idx
			const keepIds = new Set(
				own.filter((tab, index) => keepsIndex(index) || tab.pinned).map((tab) => tab.id)
			)
			const tabs = state.tabs.filter(
				(tab) => tab.connectionId !== connectionId || keepIds.has(tab.id)
			)
			const ownAfter = tabsForConnection(tabs, connectionId)
			const nextActive = resolveActiveTabId(
				ownAfter,
				state.activeTabByConnection[connectionId] ?? null,
				action.id
			)
			return {
				...state,
				tabs,
				activeTabByConnection: withActiveTab(
					state.activeTabByConnection,
					connectionId,
					nextActive
				)
			}
		}
		case 'tabs/setActive': {
			const target = state.tabs.find((tab) => tab.id === action.id)
			if (!target) return state
			const base = ensureOpenAndActive(state, target.connectionId)
			if (base === state && state.activeTabByConnection[target.connectionId] === action.id) {
				return state
			}
			return {
				...base,
				activeTabByConnection: withActiveTab(
					base.activeTabByConnection,
					target.connectionId,
					action.id
				)
			}
		}
		case 'tabs/togglePin': {
			const target = state.tabs.find((tab) => tab.id === action.id)
			if (!target) return state
			const connectionId = target.connectionId
			const own = tabsForConnection(state.tabs, connectionId).map((tab) =>
				tab.id === action.id ? { ...tab, pinned: !tab.pinned } : tab
			)
			const reordered = movePinnedTab(own, action.id)
			const others = state.tabs.filter((tab) => tab.connectionId !== connectionId)
			return { ...state, tabs: [...others, ...reordered] }
		}
		case 'tabs/move': {
			if (action.fromId === action.toId) return state
			const from = state.tabs.find((tab) => tab.id === action.fromId)
			const to = state.tabs.find((tab) => tab.id === action.toId)
			// Reorder only within a single connection's tab group.
			if (!from || !to || from.connectionId !== to.connectionId) return state
			const connectionId = from.connectionId
			const own = tabsForConnection(state.tabs, connectionId)
			const fromIdx = own.findIndex((tab) => tab.id === action.fromId)
			const toIdx = own.findIndex((tab) => tab.id === action.toId)
			if (fromIdx === -1 || toIdx === -1) return state

			const next = [...own]
			const [moved] = next.splice(fromIdx, 1)
			// Insert at the target's original index so the dragged tab takes the
			// target's slot (dropping after it when moving right, before it when
			// moving left).
			next.splice(toIdx, 0, moved)

			// Keep pinned tabs grouped ahead of unpinned ones (stable within
			// group), matching the invariant used elsewhere in the slice.
			const pinned = next.filter((tab) => tab.pinned)
			const unpinned = next.filter((tab) => !tab.pinned)
			const others = state.tabs.filter((tab) => tab.connectionId !== connectionId)
			return { ...state, tabs: [...others, ...pinned, ...unpinned] }
		}
		case 'tabs/closeForConnection': {
			const tabs = state.tabs.filter((tab) => tab.connectionId !== action.connectionId)
			if (
				tabs.length === state.tabs.length &&
				!(action.connectionId in state.activeTabByConnection)
			) {
				return state
			}
			return {
				...state,
				tabs,
				activeTabByConnection: withActiveTab(
					state.activeTabByConnection,
					action.connectionId,
					null
				)
			}
		}
		case 'tabs/hydrateSession': {
			const { restoreUnpinned, knownConnectionIds } = action.args
			const tabs = state.tabs.filter((tab) => {
				if (!knownConnectionIds.has(tab.connectionId)) return false
				return tab.pinned ? true : restoreUnpinned
			})
			// Prune open connections / active-tab map to those still backed by a
			// tab or a known connection.
			const survivingConnectionIds = new Set(tabs.map((tab) => tab.connectionId))
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
		case 'tabs/replace': {
			return action.state
		}
		case 'tabs/setActiveConnection': {
			if (action.connectionId === state.activeConnectionId) return state
			return ensureOpenAndActive(state, action.connectionId)
		}
		case 'tabs/openConnection': {
			return ensureOpenAndActive(state, action.connectionId)
		}
		case 'tabs/closeConnection': {
			const connectionId = action.connectionId
			const tabs = state.tabs.filter((tab) => tab.connectionId !== connectionId)
			const openConnectionIds = state.openConnectionIds.filter((id) => id !== connectionId)
			const activeTabByConnection = withActiveTab(
				state.activeTabByConnection,
				connectionId,
				null
			)
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
