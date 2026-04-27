import { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react'
import { QueryTab, SqlQueryResult, ResultViewMode } from '../types'
import { DEFAULT_SQL } from '../data'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'dora-query-tabs'
const MAX_TABS = 20

function generateTabId(): string {
	return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
}

function createDefaultTab(connectionId: string | null): QueryTab {
	return {
		id: generateTabId(),
		title: 'Query 1',
		mode: 'sql',
		sqlContent: DEFAULT_SQL,
		drizzleContent: '',
		result: null,
		isExecuting: false,
		isDirty: false,
		viewMode: 'table',
		connectionId,
		createdAt: Date.now(),
		lastExecutedAt: null
	}
}

function getNextTitle(tabs: QueryTab[]): string {
	const existing = tabs
		.map(function (t) {
			const match = t.title.match(/^Query (\d+)$/)
			return match ? parseInt(match[1], 10) : 0
		})
		.filter(function (n) {
			return n > 0
		})

	const max = existing.length > 0 ? Math.max(...existing) : 0
	return `Query ${max + 1}`
}

/**
 * Auto-generate a tab title from a SQL query.
 * e.g. "SELECT * FROM customers WHERE …" → "SELECT customers"
 */
function inferTitleFromQuery(query: string): string {
	const trimmed = query.trim()
	if (!trimmed || trimmed.startsWith('--')) return ''

	const upperTrimmed = trimmed.toUpperCase()

	// Try to extract table name for SELECT queries
	const fromMatch = trimmed.match(/\bFROM\s+["'`]?(\w+)["'`]?/i)
	if (fromMatch) {
		const table = fromMatch[1]
		if (upperTrimmed.startsWith('SELECT')) return `SELECT ${table}`
		if (upperTrimmed.startsWith('INSERT')) return `INSERT ${table}`
		if (upperTrimmed.startsWith('UPDATE')) return `UPDATE ${table}`
		if (upperTrimmed.startsWith('DELETE')) return `DELETE ${table}`
	}

	// Fallback: first 30 chars
	const firstLine = trimmed.split('\n')[0].replace(/^--\s*/, '').trim()
	if (firstLine.length > 30) return firstLine.substring(0, 27) + '...'
	return firstLine || 'Untitled'
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type TabState = {
	tabs: QueryTab[]
	activeTabId: string
}

type TabAction =
	| { type: 'ADD_TAB'; connectionId: string | null }
	| { type: 'CLOSE_TAB'; tabId: string }
	| { type: 'SET_ACTIVE_TAB'; tabId: string }
	| { type: 'RENAME_TAB'; tabId: string; title: string }
	| { type: 'UPDATE_TAB_CONTENT'; tabId: string; field: 'sqlContent' | 'drizzleContent'; value: string }
	| { type: 'SET_TAB_MODE'; tabId: string; mode: 'sql' | 'drizzle' }
	| { type: 'SET_TAB_RESULT'; tabId: string; result: SqlQueryResult | null }
	| { type: 'SET_TAB_EXECUTING'; tabId: string; isExecuting: boolean }
	| { type: 'SET_TAB_VIEW_MODE'; tabId: string; viewMode: ResultViewMode }
	| { type: 'AUTO_TITLE'; tabId: string; query: string }
	| { type: 'REORDER_TABS'; fromIndex: number; toIndex: number }
	| { type: 'DUPLICATE_TAB'; tabId: string }
	| { type: 'LOAD_TABS'; tabs: QueryTab[]; activeTabId: string }

function tabReducer(state: TabState, action: TabAction): TabState {
	switch (action.type) {
		case 'ADD_TAB': {
			if (state.tabs.length >= MAX_TABS) return state
			const newTab = createDefaultTab(action.connectionId)
			newTab.title = getNextTitle(state.tabs)
			return {
				tabs: [...state.tabs, newTab],
				activeTabId: newTab.id
			}
		}

		case 'CLOSE_TAB': {
			if (state.tabs.length <= 1) return state
			const idx = state.tabs.findIndex(function (t) { return t.id === action.tabId })
			const newTabs = state.tabs.filter(function (t) { return t.id !== action.tabId })
			let newActiveId = state.activeTabId

			if (state.activeTabId === action.tabId) {
				// Activate the tab to the left, or the first one
				const newIdx = Math.max(0, idx - 1)
				newActiveId = newTabs[newIdx].id
			}

			return { tabs: newTabs, activeTabId: newActiveId }
		}

		case 'SET_ACTIVE_TAB':
			return { ...state, activeTabId: action.tabId }

		case 'RENAME_TAB':
			return {
				...state,
				tabs: state.tabs.map(function (t) {
					if (t.id !== action.tabId) return t
					return { ...t, title: action.title }
				})
			}

		case 'UPDATE_TAB_CONTENT':
			return {
				...state,
				tabs: state.tabs.map(function (t) {
					if (t.id !== action.tabId) return t
					return { ...t, [action.field]: action.value, isDirty: true }
				})
			}

		case 'SET_TAB_MODE':
			return {
				...state,
				tabs: state.tabs.map(function (t) {
					if (t.id !== action.tabId) return t
					return { ...t, mode: action.mode }
				})
			}

		case 'SET_TAB_RESULT':
			return {
				...state,
				tabs: state.tabs.map(function (t) {
					if (t.id !== action.tabId) return t
					return {
						...t,
						result: action.result,
						isDirty: false,
						lastExecutedAt: action.result ? Date.now() : t.lastExecutedAt
					}
				})
			}

		case 'SET_TAB_EXECUTING':
			return {
				...state,
				tabs: state.tabs.map(function (t) {
					if (t.id !== action.tabId) return t
					return { ...t, isExecuting: action.isExecuting }
				})
			}

		case 'SET_TAB_VIEW_MODE':
			return {
				...state,
				tabs: state.tabs.map(function (t) {
					if (t.id !== action.tabId) return t
					return { ...t, viewMode: action.viewMode }
				})
			}

		case 'AUTO_TITLE': {
			return {
				...state,
				tabs: state.tabs.map(function (t) {
					if (t.id !== action.tabId) return t
					// Only auto-title if still has default name
					if (!/^Query \d+$/.test(t.title) && t.title !== 'Untitled') return t
					const inferred = inferTitleFromQuery(action.query)
					if (!inferred) return t
					return { ...t, title: inferred }
				})
			}
		}

		case 'REORDER_TABS': {
			const newTabs = [...state.tabs]
			const [moved] = newTabs.splice(action.fromIndex, 1)
			newTabs.splice(action.toIndex, 0, moved)
			return { ...state, tabs: newTabs }
		}

		case 'DUPLICATE_TAB': {
			if (state.tabs.length >= MAX_TABS) return state
			const source = state.tabs.find(function (t) { return t.id === action.tabId })
			if (!source) return state

			const dup: QueryTab = {
				...source,
				id: generateTabId(),
				title: source.title + ' (copy)',
				result: null,
				isExecuting: false,
				createdAt: Date.now(),
				lastExecutedAt: null
			}

			const srcIdx = state.tabs.findIndex(function (t) { return t.id === action.tabId })
			const newTabs = [...state.tabs]
			newTabs.splice(srcIdx + 1, 0, dup)

			return { tabs: newTabs, activeTabId: dup.id }
		}

		case 'LOAD_TABS':
			return { tabs: action.tabs, activeTabId: action.activeTabId }

		default:
			return state
	}
}

// ─── Context ──────────────────────────────────────────────────────────────────

type TabContextValue = {
	tabs: QueryTab[]
	activeTabId: string
	activeTab: QueryTab
	addTab: () => void
	closeTab: (tabId: string) => void
	setActiveTab: (tabId: string) => void
	renameTab: (tabId: string, title: string) => void
	updateTabContent: (tabId: string, field: 'sqlContent' | 'drizzleContent', value: string) => void
	setTabMode: (tabId: string, mode: 'sql' | 'drizzle') => void
	setTabResult: (tabId: string, result: SqlQueryResult | null) => void
	setTabExecuting: (tabId: string, isExecuting: boolean) => void
	setTabViewMode: (tabId: string, viewMode: ResultViewMode) => void
	autoTitleTab: (tabId: string, query: string) => void
	reorderTabs: (fromIndex: number, toIndex: number) => void
	duplicateTab: (tabId: string) => void
	nextTab: () => void
	prevTab: () => void
	goToTab: (index: number) => void
}

const TabContext = createContext<TabContextValue | null>(null)

// ─── Persistence ──────────────────────────────────────────────────────────────

function getStorageKey(connectionId: string | null): string {
	return `${STORAGE_KEY_PREFIX}-${connectionId || 'global'}`
}

function loadTabsFromStorage(connectionId: string | null): TabState | null {
	try {
		const raw = localStorage.getItem(getStorageKey(connectionId))
		if (!raw) return null
		const parsed = JSON.parse(raw)
		if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0 && parsed.activeTabId) {
			// Strip non-serializable data (results, executing state)
			const sanitized = parsed.tabs.map(function (t: QueryTab) {
				return {
					...t,
					result: null,
					isExecuting: false
				}
			})
			return { tabs: sanitized, activeTabId: parsed.activeTabId }
		}
	} catch (e) {
		console.warn('[TabStore] Failed to load tabs:', e)
	}
	return null
}

function saveTabsToStorage(connectionId: string | null, state: TabState): void {
	try {
		// Don't persist results or executing state
		const toSave = {
			tabs: state.tabs.map(function (t) {
				return {
					...t,
					result: null,
					isExecuting: false
				}
			}),
			activeTabId: state.activeTabId
		}
		localStorage.setItem(getStorageKey(connectionId), JSON.stringify(toSave))
	} catch (e) {
		console.warn('[TabStore] Failed to save tabs:', e)
	}
}

// ─── Provider ─────────────────────────────────────────────────────────────────

type TProps = {
	children: ReactNode
	connectionId: string | null
}

export function QueryTabProvider({ children, connectionId }: TProps) {
	const initialState = function (): TabState {
		const loaded = loadTabsFromStorage(connectionId)
		if (loaded) return loaded

		const defaultTab = createDefaultTab(connectionId)
		return { tabs: [defaultTab], activeTabId: defaultTab.id }
	}

	const [state, dispatch] = useReducer(tabReducer, undefined, initialState)

	// Persist whenever state changes
	useEffect(function () {
		saveTabsToStorage(connectionId, state)
	}, [state, connectionId])

	// When connectionId changes, load or create fresh tabs
	useEffect(function () {
		const loaded = loadTabsFromStorage(connectionId)
		if (loaded) {
			dispatch({ type: 'LOAD_TABS', tabs: loaded.tabs, activeTabId: loaded.activeTabId })
		} else {
			const defaultTab = createDefaultTab(connectionId)
			dispatch({ type: 'LOAD_TABS', tabs: [defaultTab], activeTabId: defaultTab.id })
		}
	}, [connectionId])

	const activeTab = state.tabs.find(function (t) { return t.id === state.activeTabId }) || state.tabs[0]

	const addTab = useCallback(function () {
		dispatch({ type: 'ADD_TAB', connectionId })
	}, [connectionId])

	const closeTab = useCallback(function (tabId: string) {
		dispatch({ type: 'CLOSE_TAB', tabId })
	}, [])

	const setActiveTab = useCallback(function (tabId: string) {
		dispatch({ type: 'SET_ACTIVE_TAB', tabId })
	}, [])

	const renameTab = useCallback(function (tabId: string, title: string) {
		dispatch({ type: 'RENAME_TAB', tabId, title })
	}, [])

	const updateTabContent = useCallback(function (tabId: string, field: 'sqlContent' | 'drizzleContent', value: string) {
		dispatch({ type: 'UPDATE_TAB_CONTENT', tabId, field, value })
	}, [])

	const setTabMode = useCallback(function (tabId: string, mode: 'sql' | 'drizzle') {
		dispatch({ type: 'SET_TAB_MODE', tabId, mode })
	}, [])

	const setTabResult = useCallback(function (tabId: string, result: SqlQueryResult | null) {
		dispatch({ type: 'SET_TAB_RESULT', tabId, result })
	}, [])

	const setTabExecuting = useCallback(function (tabId: string, isExecuting: boolean) {
		dispatch({ type: 'SET_TAB_EXECUTING', tabId, isExecuting })
	}, [])

	const setTabViewMode = useCallback(function (tabId: string, viewMode: ResultViewMode) {
		dispatch({ type: 'SET_TAB_VIEW_MODE', tabId, viewMode })
	}, [])

	const autoTitleTab = useCallback(function (tabId: string, query: string) {
		dispatch({ type: 'AUTO_TITLE', tabId, query })
	}, [])

	const reorderTabs = useCallback(function (fromIndex: number, toIndex: number) {
		dispatch({ type: 'REORDER_TABS', fromIndex, toIndex })
	}, [])

	const duplicateTab = useCallback(function (tabId: string) {
		dispatch({ type: 'DUPLICATE_TAB', tabId })
	}, [])

	const nextTab = useCallback(function () {
		const idx = state.tabs.findIndex(function (t) { return t.id === state.activeTabId })
		const nextIdx = (idx + 1) % state.tabs.length
		dispatch({ type: 'SET_ACTIVE_TAB', tabId: state.tabs[nextIdx].id })
	}, [state.tabs, state.activeTabId])

	const prevTab = useCallback(function () {
		const idx = state.tabs.findIndex(function (t) { return t.id === state.activeTabId })
		const prevIdx = (idx - 1 + state.tabs.length) % state.tabs.length
		dispatch({ type: 'SET_ACTIVE_TAB', tabId: state.tabs[prevIdx].id })
	}, [state.tabs, state.activeTabId])

	const goToTab = useCallback(function (index: number) {
		if (index >= 0 && index < state.tabs.length) {
			dispatch({ type: 'SET_ACTIVE_TAB', tabId: state.tabs[index].id })
		}
	}, [state.tabs])

	const value: TabContextValue = {
		tabs: state.tabs,
		activeTabId: state.activeTabId,
		activeTab,
		addTab,
		closeTab,
		setActiveTab,
		renameTab,
		updateTabContent,
		setTabMode,
		setTabResult,
		setTabExecuting,
		setTabViewMode,
		autoTitleTab,
		reorderTabs,
		duplicateTab,
		nextTab,
		prevTab,
		goToTab
	}

	return (
		<TabContext.Provider value={value}>
			{children}
		</TabContext.Provider>
	)
}

export function useQueryTabs(): TabContextValue {
	const context = useContext(TabContext)
	if (!context) {
		throw new Error('useQueryTabs must be used within a QueryTabProvider')
	}
	return context
}
