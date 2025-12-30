import type { QueryHistoryEntry } from '../types'

export async function executeQuery(connectionId: string, query: string): Promise<any> {
  // This will be implemented with Tauri commands
  return { success: true, data: [] }
}

export async function getQueryHistory(connectionId?: string): Promise<QueryHistoryEntry[]> {
  // This will be implemented with Tauri commands
  return []
}

export async function saveQueryToHistory(connectionId: string, query: string, duration: number, status: string, rowCount: number, errorMessage: string | null): Promise<void> {
  // This will be implemented with Tauri commands
}
