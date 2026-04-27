import { useState, useEffect, useCallback, useRef } from 'react'
import { useAdapter } from '@/core/data-provider/context'

type AsyncRowCountState = {
	count: number | null
	isLoading: boolean
	error: string | null
}

/**
 * Fires a background `SELECT COUNT(*)` for a given table and caches the result.
 * Listens for `dora-schema-refresh` events to auto-invalidate.
 *
 * @param connectionId  Active database connection
 * @param tableName     Source table name (extracted from the query)
 * @param enabled       Only fetch when true (e.g. after a successful SELECT)
 */
export function useAsyncRowCount(
	connectionId: string | undefined,
	tableName: string | undefined,
	enabled: boolean
): AsyncRowCountState & { refresh: () => void } {
	const adapter = useAdapter()
	const [state, setState] = useState<AsyncRowCountState>({
		count: null,
		isLoading: false,
		error: null
	})

	const cacheRef = useRef<Map<string, { count: number; fetchedAt: number }>>(new Map())
	const abortRef = useRef<boolean>(false)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const CACHE_TTL_MS = 30_000

	function getCacheKey(connId: string, table: string): string {
		return `${connId}:${table}`
	}

	const fetchCount = useCallback(
		function fetchCount() {
			if (!connectionId || !tableName || !enabled) {
				setState({ count: null, isLoading: false, error: null })
				return
			}

			const key = getCacheKey(connectionId, tableName)
			const cached = cacheRef.current.get(key)

			if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
				setState({ count: cached.count, isLoading: false, error: null })
				return
			}

			// Debounce to avoid spamming on rapid switches
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}

			abortRef.current = false
			setState(function (prev) {
				return { ...prev, isLoading: true, error: null }
			})

			debounceRef.current = setTimeout(function () {
				const query = `SELECT COUNT(*) AS total FROM ${tableName}`

				adapter.executeQuery(connectionId, query).then(function (res) {
					if (abortRef.current) return

					if (res.ok && res.data.rows.length > 0) {
						const row = res.data.rows[0]
						const rawCount = row.total ?? row.count ?? row['COUNT(*)'] ?? row['count(*)']
						const count = typeof rawCount === 'number' ? rawCount : parseInt(String(rawCount), 10)

						if (!isNaN(count)) {
							cacheRef.current.set(key, { count, fetchedAt: Date.now() })
							setState({ count, isLoading: false, error: null })
						} else {
							setState({ count: null, isLoading: false, error: 'Unexpected count format' })
						}
					} else {
						const errorMsg = !res.ok ? res.error : 'No rows returned'
						setState({ count: null, isLoading: false, error: errorMsg })
					}
				}).catch(function (err) {
					if (abortRef.current) return
					setState({
						count: null,
						isLoading: false,
						error: err instanceof Error ? err.message : 'Unknown error'
					})
				})
			}, 150)
		},
		[connectionId, tableName, enabled, adapter]
	)

	// Fetch on mount / dependency change
	useEffect(function () {
		fetchCount()

		return function () {
			abortRef.current = true
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
		}
	}, [fetchCount])

	// Invalidate cache on schema refresh events
	useEffect(function () {
		function onSchemaRefresh(event: Event) {
			const customEvent = event as CustomEvent<{ connectionId?: string }>
			const targetConnectionId = customEvent.detail?.connectionId

			if (!targetConnectionId || targetConnectionId === connectionId) {
				// Clear all cached counts for this connection
				const keysToDelete: string[] = []
				cacheRef.current.forEach(function (_value, cacheKey) {
					if (!targetConnectionId || cacheKey.startsWith(targetConnectionId + ':')) {
						keysToDelete.push(cacheKey)
					}
				})
				keysToDelete.forEach(function (k) {
					cacheRef.current.delete(k)
				})

				// Re-fetch
				fetchCount()
			}
		}

		window.addEventListener('dora-schema-refresh', onSchemaRefresh as EventListener)
		return function () {
			window.removeEventListener('dora-schema-refresh', onSchemaRefresh as EventListener)
		}
	}, [connectionId, fetchCount])

	return {
		count: state.count,
		isLoading: state.isLoading,
		error: state.error,
		refresh: fetchCount
	}
}
