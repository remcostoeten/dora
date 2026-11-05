import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAdapter } from '@studio/core/data-provider'
import { getAdapterError } from '@studio/core/data-provider/types'
import { useConnectionMutations } from '@studio/core/data-provider/hooks'
import type { Connection } from '@studio/features/connections/types'
import type {
	DataFileSourceEntry,
	DatabaseConnectResult
} from '@studio/features/connections/types/data-file-source'
import { describeConnectionSource } from '@studio/features/connections/resolve-source'
import { frontendToBackendDatabaseInfo } from '@studio/features/connections/utils/mapping'
import { commands } from '@studio/lib/bindings'
import { deriveDataFileName } from '@studio/features/connections/utils/data-files'

export const dataFileSourcesQueryKey = function (connectionId: string) {
	return ['dataFileSources', connectionId] as const
}

export function cacheDataFileSources(
	queryClient: ReturnType<typeof useQueryClient>,
	connectionId: string,
	entries: DataFileSourceEntry[] | null | undefined
) {
	if (!entries) return
	queryClient.setQueryData(dataFileSourcesQueryKey(connectionId), entries)
}

export function applyConnectResult(
	queryClient: ReturnType<typeof useQueryClient>,
	connectionId: string,
	result: DatabaseConnectResult
) {
	if (result.fileSources) {
		cacheDataFileSources(queryClient, connectionId, result.fileSources)
	}
	return result.connected
}

export function useDataFileSources(connection: Connection | undefined) {
	const adapter = useAdapter()
	const queryClient = useQueryClient()
	const { updateConnection, connectToDatabase, disconnectFromDatabase } = useConnectionMutations()
	const connectionId = connection?.id
	const isDataFileSession =
		connection != null && describeConnectionSource(connection).kind === 'data-file'

	const query = useQuery({
		queryKey: connectionId ? dataFileSourcesQueryKey(connectionId) : ['dataFileSources'],
		queryFn: async function () {
			if (!connectionId) return [] as DataFileSourceEntry[]
			const res = await adapter.getDataFileSourceStatus(connectionId)
			if (!res.ok) throw new Error(getAdapterError(res))
			return res.data
		},
		enabled: Boolean(connectionId && isDataFileSession)
	})

	const persistSources = useMutation({
		mutationFn: async function (fileSources: string[]) {
			if (!connection) throw new Error('No connection')
			const nextConnection: Connection = {
				...connection,
				name: deriveDataFileName(fileSources),
				fileSources
			}
			await updateConnection.mutateAsync({
				id: connection.id,
				name: nextConnection.name,
				databaseType: frontendToBackendDatabaseInfo(nextConnection)
			})
			await disconnectFromDatabase.mutateAsync(connection.id)
			const connectResult = await connectToDatabase.mutateAsync(connection.id)
			if (connectResult.fileSources) {
				cacheDataFileSources(queryClient, connection.id, connectResult.fileSources)
			}
			await queryClient.invalidateQueries({ queryKey: ['schema', connection.id] })
			await queryClient.invalidateQueries({ queryKey: ['connections'] })
			return connectResult
		}
	})

	const retryRegistration = useMutation({
		mutationFn: async function () {
			if (!connectionId) throw new Error('No connection')
			const res = await adapter.retryDataFileRegistration(connectionId)
			if (!res.ok) throw new Error(getAdapterError(res))
			if (res.data.fileSources) {
				cacheDataFileSources(queryClient, connectionId, res.data.fileSources)
			}
			await queryClient.invalidateQueries({ queryKey: ['schema', connectionId] })
			await queryClient.invalidateQueries({ queryKey: ['connections'] })
			return res.data
		}
	})

	const removeSource = useMutation({
		mutationFn: async function (path: string) {
			if (!connection?.fileSources) throw new Error('No file sources')
			const nextSources = connection.fileSources.filter(function (source) {
				return source !== path
			})
			if (nextSources.length === 0) {
				throw new Error('Cannot remove the last data file source')
			}
			return persistSources.mutateAsync(nextSources)
		}
	})

	const relocateSource = useMutation({
		mutationFn: async function (path: string) {
			if (!connection?.fileSources) throw new Error('No file sources')
			const picked = await commands.openDataFiles()
			if (picked.status !== 'ok' || picked.data.length === 0) {
				return null
			}
			const replacement = picked.data[0]
			const nextSources = connection.fileSources.map(function (source) {
				return source === path ? replacement : source
			})
			return persistSources.mutateAsync(nextSources)
		}
	})

	return {
		entries: query.data ?? [],
		isLoading: query.isLoading,
		isRecovering:
			persistSources.isPending ||
			retryRegistration.isPending ||
			removeSource.isPending ||
			relocateSource.isPending,
		retryRegistration,
		removeSource,
		relocateSource
	}
}
