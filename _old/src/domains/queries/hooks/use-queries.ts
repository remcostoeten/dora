import { useState, useEffect } from 'react'
import { useToast } from '@/shared/components/ui/toast'
import type { QueryHistoryEntry } from '../types'
import * as queryCommands from '../api/query-commands'

export function useQueries() {
  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()

  const loadQueryHistory = async (connectionId?: string) => {
    setLoading(true)
    try {
      const history = await queryCommands.getQueryHistory(connectionId)
      setQueryHistory(history)
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to load query history',
        variant: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const executeQuery = async (connectionId: string, query: string) => {
    try {
      const startTime = Date.now()
      const result = await queryCommands.executeQuery(connectionId, query)
      const duration = Date.now() - startTime
      
      // Save to history
      await queryCommands.saveQueryToHistory(
        connectionId,
        query,
        duration,
        result.success ? 'Completed' : 'Error',
        result.rowCount || 0,
        result.error || null
      )
      
      // Refresh history
      await loadQueryHistory(connectionId)
      
      return result
    } catch (error) {
      addToast({
        title: 'Query Error',
        description: 'Failed to execute query',
        variant: 'error'
      })
      throw error
    }
  }

  const loadFromHistory = (query: string) => {
    // This would be handled by the editor component
    return query
  }

  useEffect(() => {
    loadQueryHistory()
  }, [])

  return {
    queryHistory,
    loading,
    loadQueryHistory,
    executeQuery,
    loadFromHistory,
  }
}
