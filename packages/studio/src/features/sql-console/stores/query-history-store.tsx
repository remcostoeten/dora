import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import type { ResultChartConfig } from '@studio/features/result-charts/types'

export type QueryHistoryItem = {
	id: string
	query: string
	connectionId: string | null
	timestamp: number
	executionTimeMs: number
	success: boolean
	error?: string
	rowCount?: number
	pinned?: boolean
	chartConfig?: ResultChartConfig | null
}

type QueryHistoryContextValue = {
	history: QueryHistoryItem[]
	addToHistory: (entry: Omit<QueryHistoryItem, 'id' | 'timestamp' | 'pinned'>) => string
	clearHistory: () => void
	removeFromHistory: (id: string) => void
	pinItem: (id: string) => void
	unpinItem: (id: string) => void
	updateChartConfig: (id: string, chartConfig: ResultChartConfig | null) => void
}

const STORAGE_KEY = 'dora-query-history'
const MAX_HISTORY_ITEMS = 200

const QueryHistoryContext = createContext<QueryHistoryContextValue | null>(null)

function loadHistoryFromStorage(): QueryHistoryItem[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (stored) {
			const parsed = JSON.parse(stored)
			return Array.isArray(parsed) ? parsed : []
		}
	} catch (e) {
		console.warn('Failed to load query history:', e)
	}
	return []
}

function saveHistoryToStorage(items: QueryHistoryItem[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
	} catch (e) {
		console.warn('Failed to save query history:', e)
	}
}

type Props = {
	children: ReactNode
}

export function QueryHistoryProvider({ children }: Props) {
	const [history, setHistory] = useState<QueryHistoryItem[]>([])

	useEffect(function loadHistory() {
		const loaded = loadHistoryFromStorage()
		setHistory(loaded)
	}, [])

	const addToHistory = useCallback(function (entry: Omit<QueryHistoryItem, 'id' | 'timestamp' | 'pinned'>) {
		const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
		setHistory(function (prev) {
			const newItem: QueryHistoryItem = {
				...entry,
				id,
				timestamp: Date.now(),
				pinned: false,
			}

			const pinned = prev.filter((item) => item.pinned)
			const unpinned = prev.filter((item) => !item.pinned)
			const trimmedUnpinned = [newItem, ...unpinned].slice(0, MAX_HISTORY_ITEMS)
			const updated = [...pinned, ...trimmedUnpinned]
			saveHistoryToStorage(updated)
			return updated
		})
		return id
	}, [])

	const clearHistory = useCallback(function () {
		setHistory(function (prev) {
			// keep pinned items on clear
			const pinned = prev.filter((item) => item.pinned)
			saveHistoryToStorage(pinned)
			return pinned
		})
	}, [])

	const removeFromHistory = useCallback(function (id: string) {
		setHistory(function (prev) {
			const updated = prev.filter((item) => item.id !== id)
			saveHistoryToStorage(updated)
			return updated
		})
	}, [])

	const pinItem = useCallback(function (id: string) {
		setHistory(function (prev) {
			const updated = prev.map((item) => item.id === id ? { ...item, pinned: true } : item)
			saveHistoryToStorage(updated)
			return updated
		})
	}, [])

	const unpinItem = useCallback(function (id: string) {
		setHistory(function (prev) {
			const updated = prev.map((item) => item.id === id ? { ...item, pinned: false } : item)
			saveHistoryToStorage(updated)
			return updated
		})
	}, [])

	const updateChartConfig = useCallback(function (
		id: string,
		chartConfig: ResultChartConfig | null
	) {
		setHistory(function (prev) {
			const updated = prev.map(function (item) {
				if (item.id !== id) return item
				return { ...item, chartConfig }
			})
			saveHistoryToStorage(updated)
			return updated
		})
	}, [])

	const value = useMemo(
		() => ({
			history,
			addToHistory,
			clearHistory,
			removeFromHistory,
			pinItem,
			unpinItem,
			updateChartConfig
		}),
		[history, addToHistory, clearHistory, removeFromHistory, pinItem, unpinItem, updateChartConfig]
	)

	return <QueryHistoryContext.Provider value={value}>{children}</QueryHistoryContext.Provider>
}

export function useQueryHistory(): QueryHistoryContextValue {
	const context = useContext(QueryHistoryContext)
	if (!context) {
		throw new Error('useQueryHistory must be used within a QueryHistoryProvider')
	}
	return context
}
