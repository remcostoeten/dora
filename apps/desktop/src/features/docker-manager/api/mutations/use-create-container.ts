import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PostgresContainerConfig, CreateContainerResult } from '../../types'
import { createPostgresContainer, waitForHealthy } from '../container-service'

type UseCreateContainerOptions = {
	onSuccess?: (result: CreateContainerResult) => void
	onError?: (error: Error) => void
	waitForHealth?: boolean
}

export function useCreateContainer(options: UseCreateContainerOptions = {}) {
	const { onSuccess, onError, waitForHealth = true } = options
	const queryClient = useQueryClient()

	return useMutation<CreateContainerResult, Error, PostgresContainerConfig>({
		mutationFn: async function (config) {
			const result = await createPostgresContainer(config)

			if (result.success && result.containerId && waitForHealth) {
				const isHealthy = await waitForHealthy(result.containerId, 30000, 1000)
				if (!isHealthy) {
					throw new Error('Container created but failed to become healthy within 30s')
				}
			}

			if (!result.success) {
				throw new Error(result.error || 'Failed to create container')
			}

			return result
		},
		onSuccess: function (result) {
			queryClient.invalidateQueries({ queryKey: ['docker-containers'] })
			if (onSuccess) {
				onSuccess(result)
			}
		},
		onError: function (error) {
			if (onError) {
				onError(error)
			}
		}
	})
}
