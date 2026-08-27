import type { QueryClient } from '@tanstack/react-query'
import { applyConnectResult } from '@studio/features/database-studio/hooks/use-data-file-sources'
import { setSchema } from '@studio/core/workspace-store'
import type { DatabaseSchema } from '@studio/lib/bindings'
import { setConnectionPhase } from './connection-phase'
import type { DataAdapter } from './types'
import { getAdapterError } from './types'

export const SCHEMA_STALE_TIME_MS = 5 * 60 * 1000

/**
 * The one schema query. `useSchema` consumes it, and every imperative caller
 * goes through `queryClient.fetchQuery(schemaQueryOptions(...))` so concurrent
 * schema needs collapse into a single connect + introspection instead of
 * racing their own adapter calls. `staleTime` lives here because `fetchQuery`
 * without it would silently refetch on every call.
 *
 * On success the schema is mirrored into the workspace store with a real
 * `fetchedAt`, which is what lets the next webview reload seed instantly from
 * the bootstrap payload.
 */
export function schemaQueryOptions(
	adapter: DataAdapter,
	queryClient: QueryClient,
	connectionId: string
) {
	return {
		queryKey: ['schema', connectionId] as const,
		staleTime: SCHEMA_STALE_TIME_MS,
		retry: false as const,
		queryFn: async function (): Promise<DatabaseSchema> {
			setConnectionPhase(connectionId, 'connecting')
			try {
				const connectResult = await adapter.connectToDatabase(connectionId)
				if (!connectResult.ok) {
					throw new Error(getAdapterError(connectResult))
				}
				applyConnectResult(queryClient, connectionId, connectResult.data)

				if (!connectResult.data.connected) {
					throw new Error('Could not connect to this database')
				}

				setConnectionPhase(connectionId, 'introspecting')
				const res = await adapter.getSchema(connectionId)
				if (!res.ok) throw new Error(getAdapterError(res))
				setSchema(connectionId, res.data, Date.now())
				return res.data
			} finally {
				setConnectionPhase(connectionId, null)
			}
		}
	}
}
