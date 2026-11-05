import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Connection } from '@studio/features/connections/types'
import type { SaveDataFileSessionResult } from '@studio/lib/bindings'
import { useAdapter } from '@studio/core/data-provider'
import { useConnectionMutations } from '@studio/core/data-provider/hooks'
import { getAdapterError } from '@studio/core/data-provider/types'
import {
	buildSavedDuckDbConnectionPayload,
	findExistingDuckDbFileConnection
} from '../utils/save-data-file-session'

type SaveParams = {
	connectionId: string
	destinationPath: string
	overwrite: boolean
}

type OpenSavedConnectionParams = {
	result: SaveDataFileSessionResult
	connections: Connection[]
}

export function useSaveDataFileSession() {
	const adapter = useAdapter()
	const queryClient = useQueryClient()
	const { addConnection, connectToDatabase } = useConnectionMutations()

	const saveSession = useMutation({
		mutationFn: async function (params: SaveParams) {
			const res = await adapter.saveDataFileSessionAsDuckdb(
				params.connectionId,
				params.destinationPath,
				params.overwrite
			)
			if (!res.ok) {
				throw new Error(getAdapterError(res))
			}
			return res.data
		}
	})

	const openSavedConnection = useMutation({
		mutationFn: async function ({ result, connections }: OpenSavedConnectionParams) {
			const existing = findExistingDuckDbFileConnection(connections, result.path)
			const savedConnection =
				existing ??
				(await addConnection.mutateAsync(buildSavedDuckDbConnectionPayload(result.path)))

			const connectResult = await connectToDatabase.mutateAsync(savedConnection.id)
			if (!connectResult.connected) {
				throw new Error('Saved DuckDB file was created but could not be opened')
			}

			await queryClient.invalidateQueries({ queryKey: ['connections'] })
			await queryClient.invalidateQueries({ queryKey: ['schema', savedConnection.id] })

			return savedConnection
		}
	})

	return {
		saveSession,
		openSavedConnection
	}
}
