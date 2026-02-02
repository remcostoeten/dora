import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

type QueryHistoryItem = {
    id: string
    query: string
    connectionId: string | null
    timestamp: number
    executionTimeMs: number
    success: boolean
    error?: string
    rowCount?: number
}

type QueryHistoryState = {
    items: QueryHistoryItem[]
    maxItems: number
}

type QueryHistoryContextValue = {
    history: QueryHistoryItem[]
    addToHistory: (entry: Omit<QueryHistoryItem, 'id' | 'timestamp'>) => void
    clearHistory: () => void
    removeFromHistory: (id: string) => void
}

const STORAGE_KEY = 'dora-query-history'
const MAX_HISTORY_ITEMS = 50

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

    const addToHistory = useCallback(function (entry: Omit<QueryHistoryItem, 'id' | 'timestamp'>) {
        setHistory(function (prev) {
            const newItem: QueryHistoryItem = {
                ...entry,
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now()
            }

            const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS)
            saveHistoryToStorage(updated)
            return updated
        })
    }, [])

    const clearHistory = useCallback(function () {
        setHistory([])
        saveHistoryToStorage([])
    }, [])

    const removeFromHistory = useCallback(function (id: string) {
        setHistory(function (prev) {
            const updated = prev.filter(function (item) { return item.id !== id })
            saveHistoryToStorage(updated)
            return updated
        })
    }, [])

    return (
        <QueryHistoryContext.Provider value={{ history, addToHistory, clearHistory, removeFromHistory }}>
            {children}
        </QueryHistoryContext.Provider>
    )
}

export function useQueryHistory(): QueryHistoryContextValue {
    const context = useContext(QueryHistoryContext)
    if (!context) {
        throw new Error('useQueryHistory must be used within a QueryHistoryProvider')
    }
    return context
}
