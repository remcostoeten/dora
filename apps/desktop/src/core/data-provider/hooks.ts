import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { SortDescriptor, FilterDescriptor } from '@/features/database-studio/types'
import { useAdapter } from './context'

export function useConnections() {
	const adapter = useAdapter()

	return useQuery({
		queryKey: ['connections'],
		queryFn: async () => {
			const res = await adapter.getConnections()
			if (!res.ok) throw new Error(res.error)
			return res.data
		}
	})
}

export function useConnectionMutations() {
	const adapter = useAdapter()
	const queryClient = useQueryClient()

	const addConnection = useMutation({
		mutationFn: async (params: { name: string; databaseType: any; sshConfig: any }) => {
			const res = await adapter.addConnection(
				params.name,
				params.databaseType,
				params.sshConfig
			)
			if (!res.ok) throw new Error(res.error)
			return res.data
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['connections'] })
		}
	})

	const updateConnection = useMutation({
		mutationFn: async (params: {
			id: string
			name: string
			databaseType: any
			sshConfig: any
		}) => {
			const res = await adapter.updateConnection(
				params.id,
				params.name,
				params.databaseType,
				params.sshConfig
			)
			if (!res.ok) throw new Error(res.error)
			return res.data
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['connections'] })
		}
	})

	const removeConnection = useMutation({
		mutationFn: async (id: string) => {
			const res = await adapter.removeConnection(id)
			if (!res.ok) throw new Error(res.error)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['connections'] })
		}
	})

	const connectToDatabase = useMutation({
		mutationFn: async (connectionId: string) => {
			const res = await adapter.connectToDatabase(connectionId)
			if (!res.ok) throw new Error(res.error)
			return res.data
		}
	})

	const disconnectFromDatabase = useMutation({
		mutationFn: async (connectionId: string) => {
			const res = await adapter.disconnectFromDatabase(connectionId)
			if (!res.ok) throw new Error(res.error)
		}
	})

	const testConnection = useMutation({
		mutationFn: async (connectionId: string) => {
			const res = await adapter.testConnection(connectionId)
			if (!res.ok) throw new Error(res.error)
			return res.data
		}
	})

	return {
		addConnection,
		updateConnection,
		removeConnection,
		connectToDatabase,
		disconnectFromDatabase,
		testConnection
	}
}

export function useSchema(connectionId: string | undefined) {
	const adapter = useAdapter()

	return useQuery({
		queryKey: ['schema', connectionId],
		queryFn: async () => {
			if (!connectionId) throw new Error('No connection ID')
			const res = await adapter.getSchema(connectionId)
			if (!res.ok) throw new Error(res.error)
			return res.data
		},
		enabled: !!connectionId
	})
}

export function useTableData(
	connectionId: string | undefined,
	tableName: string | undefined,
	page: number,
	pageSize: number,
	sort?: SortDescriptor,
	filters?: FilterDescriptor[]
) {
	const adapter = useAdapter()

	return useQuery({
		queryKey: ['tableData', connectionId, tableName, page, pageSize, sort, filters],
		queryFn: async () => {
			if (!connectionId || !tableName) throw new Error('Missing params')
			const res = await adapter.fetchTableData(
				connectionId,
				tableName,
				page,
				pageSize,
				sort,
				filters
			)
			if (!res.ok) throw new Error(res.error)
			return res.data
		},
		enabled: !!connectionId && !!tableName,
		placeholderData: keepPreviousData,
		staleTime: 10000, // 10 seconds
		gcTime: 5 * 60 * 1000 // 5 minutes
	})
}

export function useExecuteQuery() {
	const adapter = useAdapter()

	return useMutation({
		mutationFn: async (params: { connectionId: string; query: string }) => {
			const res = await adapter.executeQuery(params.connectionId, params.query)
			if (!res.ok) throw new Error(res.error)
			return res.data
		}
	})
}

export function useDataMutation() {
	const adapter = useAdapter()
	const queryClient = useQueryClient()

	const updateCell = useMutation({
		mutationFn: async (params: {
			connectionId: string
			tableName: string
			primaryKeyColumn: string
			primaryKeyValue: any
			columnName: string
			newValue: any
		}) => {
			const res = await adapter.updateCell(
				params.connectionId,
				params.tableName,
				params.primaryKeyColumn,
				params.primaryKeyValue,
				params.columnName,
				params.newValue
			)
			if (!res.ok) throw new Error(res.error)
			return res.data
		},
		onMutate: async (newEdit) => {
			// Cancel any outgoing refetches (so they don't overwrite our optimistic update)
			await queryClient.cancelQueries({ queryKey: ['tableData', newEdit.connectionId, newEdit.tableName] })

			// Snapshot the previous value
			const previousTableData = queryClient.getQueriesData({ queryKey: ['tableData', newEdit.connectionId, newEdit.tableName] })

			// Optimistically update to the new value
			queryClient.setQueriesData({ queryKey: ['tableData', newEdit.connectionId, newEdit.tableName] }, (old: any) => {
				if (!old) return old
				return {
					...old,
					rows: old.rows.map((row: any) => {
						if (row[newEdit.primaryKeyColumn] === newEdit.primaryKeyValue) {
							return {
								...row,
								[newEdit.columnName]: newEdit.newValue
							}
						}
						return row
					})
				}
			})

			// Return a context object with the snapshotted value
			return { previousTableData }
		},
		onError: (_err, _newEdit, context) => {
			// If the mutation fails, use the context returned from onMutate to roll back
			if (context?.previousTableData) {
				context.previousTableData.forEach(([key, data]) => {
					queryClient.setQueryData(key, data)
				})
			}
		},
		onSettled: (_data, _error, variables) => {
			// Always refetch after error or success:
			queryClient.invalidateQueries({
				queryKey: ['tableData', variables.connectionId, variables.tableName]
			})
		}
	})

	const deleteRows = useMutation({
		mutationFn: async (params: {
			connectionId: string
			tableName: string
			primaryKeyColumn: string
			primaryKeyValues: any[]
		}) => {
			const res = await adapter.deleteRows(
				params.connectionId,
				params.tableName,
				params.primaryKeyColumn,
				params.primaryKeyValues
			)
			if (!res.ok) throw new Error(res.error)
			return res.data
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ['tableData', variables.connectionId, variables.tableName]
			})
		}
	})

	const insertRow = useMutation({
		mutationFn: async (params: {
			connectionId: string
			tableName: string
			rowData: Record<string, any>
		}) => {
			const res = await adapter.insertRow(
				params.connectionId,
				params.tableName,
				params.rowData
			)
			if (!res.ok) throw new Error(res.error)
			return res.data
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({
				queryKey: ['tableData', variables.connectionId, variables.tableName]
			})
		}
	})

	return {
		updateCell,
		deleteRows,
		insertRow
	}
}

export function useQueryHistory(connectionId: string | undefined, limit?: number) {
	const adapter = useAdapter()

	return useQuery({
		queryKey: ['queryHistory', connectionId, limit],
		queryFn: async () => {
			if (!connectionId) throw new Error('No connection ID')
			const res = await adapter.getQueryHistory(connectionId, limit)
			if (!res.ok) throw new Error(res.error)
			return res.data
		},
		enabled: !!connectionId
	})
}

export function useScripts(connectionId: string | null) {
	const adapter = useAdapter()

	return useQuery({
		queryKey: ['scripts', connectionId],
		queryFn: async () => {
			const res = await adapter.getScripts(connectionId)
			if (!res.ok) throw new Error(res.error)
			return res.data
		}
	})
}

export function useScriptMutations() {
	const adapter = useAdapter()
	const queryClient = useQueryClient()

	const saveScript = useMutation({
		mutationFn: async (params: {
			name: string
			content: string
			connectionId: string | null
			description?: string | null
		}) => {
			const res = await adapter.saveScript(
				params.name,
				params.content,
				params.connectionId,
				params.description
			)
			if (!res.ok) throw new Error(res.error)
			return res.data
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ['scripts', variables.connectionId] })
		}
	})

	const updateScript = useMutation({
		mutationFn: async (params: {
			id: number
			name: string
			content: string
			connectionId: string | null
			description?: string | null
		}) => {
			const res = await adapter.updateScript(
				params.id,
				params.name,
				params.content,
				params.connectionId,
				params.description
			)
			if (!res.ok) throw new Error(res.error)
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ['scripts', variables.connectionId] })
		}
	})

	const deleteScript = useMutation({
		mutationFn: async (id: number) => {
			const res = await adapter.deleteScript(id)
			if (!res.ok) throw new Error(res.error)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['scripts'] })
		}
	})

	return {
		saveScript,
		updateScript,
		deleteScript
	}
}
