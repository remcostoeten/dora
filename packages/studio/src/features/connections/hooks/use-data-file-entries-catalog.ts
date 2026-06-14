import { useMemo } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import type { Connection } from '@studio/features/connections/types'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import { isDataFileConnection } from '@studio/features/connections/data-file-health'
import { useAdapter } from '@studio/core/data-provider'
import { getAdapterError } from '@studio/core/data-provider/types'
import { dataFileSourcesQueryKey } from '@studio/features/database-studio/hooks/use-data-file-sources'

export function useDataFileEntriesCatalog(
	connections: Connection[],
	enabled: boolean
): Map<string, DataFileSourceEntry[]> {
	const adapter = useAdapter()
	const queryClient = useQueryClient()

	const dataFileConnections = useMemo(
		function () {
			return connections.filter(isDataFileConnection)
		},
		[connections]
	)

	const queries = useQueries({
		queries: dataFileConnections.map(function (connection) {
			return {
				queryKey: dataFileSourcesQueryKey(connection.id),
				queryFn: async function () {
					const cached = queryClient.getQueryData<DataFileSourceEntry[]>(
						dataFileSourcesQueryKey(connection.id)
					)
					if (cached) {
						return cached
					}
					const result = await adapter.getDataFileSourceStatus(connection.id)
					if (!result.ok) {
						throw new Error(getAdapterError(result))
					}
					return result.data
				},
				enabled: enabled && connection.status === 'connected',
				staleTime: 30_000,
			}
		}),
	})

	return useMemo(
		function () {
			const map = new Map<string, DataFileSourceEntry[]>()
			dataFileConnections.forEach(function (connection, index) {
				const data = queries[index]?.data
				if (data) {
					map.set(connection.id, data)
				}
			})
			return map
		},
		[dataFileConnections, queries]
	)
}
