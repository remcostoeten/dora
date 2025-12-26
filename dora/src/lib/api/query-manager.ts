import { v4 as uuidv4 } from "uuid"
import type { QueryId, StatementInfo } from "./types"

type QueryCache = {
  queryId: QueryId
  statement: StatementInfo
  tableName: string
  columns: string[]
  data: unknown[][]
  totalRows: number
  createdAt: number
}

// In-memory cache for query results
const queryCache = new Map<QueryId, QueryCache>()

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000

export function createQuery(tableName: string, columns: string[], data: unknown[][]): QueryCache {
  const queryId = uuidv4()
  const now = Date.now()

  const statement: StatementInfo = {
    queryId,
    sql: `SELECT * FROM ${tableName}`,
    executedAt: new Date(now).toISOString(),
    rowsAffected: data.length,
  }

  const cache: QueryCache = {
    queryId,
    statement,
    tableName,
    columns,
    data,
    totalRows: data.length,
    createdAt: now,
  }

  queryCache.set(queryId, cache)

  // Start cleanup interval lazily when first query is created
  startCleanupInterval()

  return cache
}

export function getQuery(queryId: QueryId): QueryCache | null {
  const cache = queryCache.get(queryId)
  if (!cache) return null

  // Check if expired
  const now = Date.now()
  if (now - cache.createdAt > CACHE_TTL) {
    queryCache.delete(queryId)
    return null
  }

  return cache
}

export function deleteQuery(queryId: QueryId): boolean {
  return queryCache.delete(queryId)
}

// Cleanup expired queries periodically - lazy start to avoid running when not needed
let cleanupInterval: ReturnType<typeof setInterval> | null = null

function startCleanupInterval() {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [queryId, cache] of queryCache.entries()) {
      if (now - cache.createdAt > CACHE_TTL) {
        queryCache.delete(queryId)
      }
    }
    // Auto-stop if cache is empty
    if (queryCache.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
  }, 60 * 1000) // Run every minute
}

// Export cleanup for testing and unmount scenarios
export function stopCleanupInterval() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}
