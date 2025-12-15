import { useState, useEffect } from 'react'
import type { ConnectionInfo, ConnectionHistoryEntry } from '../types'
import * as connectionCommands from '../api/connection-commands'

export function useConnections() {
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [establishingConnections, setEstablishingConnections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistoryEntry[]>([])

  const loadConnections = async () => {
    setLoading(true)
    try {
      const data = await connectionCommands.getConnections()
      setConnections(data)
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadConnectionHistory = async () => {
    try {
      const history = await connectionCommands.getConnectionHistory()
      setConnectionHistory(history)
    } catch (error) {
      console.error('Failed to load connection history:', error)
    }
  }

  const addConnection = async (connection: Omit<ConnectionInfo, 'id'>) => {
    try {
      const newConnection = await connectionCommands.addConnection(connection)
      setConnections(prev => [...prev, newConnection])
      return newConnection
    } catch (error) {
      console.error('Failed to add connection:', error)
      throw error
    }
  }

  const updateConnection = async (id: string, updates: Partial<ConnectionInfo>) => {
    try {
      const updated = await connectionCommands.updateConnection(id, updates)
      setConnections(prev => prev.map(conn => conn.id === id ? updated : conn))
      return updated
    } catch (error) {
      console.error('Failed to update connection:', error)
      throw error
    }
  }

  const removeConnection = async (id: string) => {
    try {
      await connectionCommands.removeConnection(id)
      setConnections(prev => prev.filter(conn => conn.id !== id))
      if (selectedConnection === id) {
        setSelectedConnection(null)
      }
    } catch (error) {
      console.error('Failed to remove connection:', error)
      throw error
    }
  }

  const connectToDatabase = async (id: string) => {
    setEstablishingConnections(prev => new Set(prev).add(id))
    try {
      await connectionCommands.connectToDatabase(id)
      setConnections(prev => prev.map(conn => 
        conn.id === id ? { ...conn, connected: true, last_connected_at: Date.now() / 1000 } : conn
      ))
    } catch (error) {
      console.error('Failed to connect to database:', error)
      throw error
    } finally {
      setEstablishingConnections(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const disconnectFromDatabase = async (id: string) => {
    try {
      await connectionCommands.disconnectFromDatabase(id)
      setConnections(prev => prev.map(conn => 
        conn.id === id ? { ...conn, connected: false } : conn
      ))
    } catch (error) {
      console.error('Failed to disconnect from database:', error)
      throw error
    }
  }

  const updateConnectionColor = async (id: string, color: number | null) => {
    try {
      await connectionCommands.updateConnectionColor(id, color)
      setConnections(prev => prev.map(conn => 
        conn.id === id ? { ...conn, color: color?.toString() } : conn
      ))
    } catch (error) {
      console.error('Failed to update connection color:', error)
      throw error
    }
  }

  useEffect(() => {
    loadConnections()
    loadConnectionHistory()
  }, [])

  return {
    connections,
    selectedConnection,
    establishingConnections,
    loading,
    connectionHistory,
    setSelectedConnection,
    loadConnections,
    loadConnectionHistory,
    addConnection,
    updateConnection,
    removeConnection,
    connectToDatabase,
    disconnectFromDatabase,
    updateConnectionColor,
  }
}
