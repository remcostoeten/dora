import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
	ContainerActionResult,
	ContainerActionType,
	RemoveContainerOptions
} from '../../types'
import { performContainerAction, deleteContainer } from '../container-service'

type ContainerActionParams = {
	containerId: string
	action: ContainerActionType
}

type UseContainerActionsOptions = {
	onSuccess?: (result: ContainerActionResult, params: ContainerActionParams) => void
	onError?: (error: Error, params: ContainerActionParams) => void
}

export function useContainerActions(options: UseContainerActionsOptions = {}) {
	const { onSuccess, onError } = options
	const queryClient = useQueryClient()

	return useMutation<ContainerActionResult, Error, ContainerActionParams>({
		mutationFn: function (params) {
			return performContainerAction(params.containerId, params.action)
		},
		onSuccess: function (result, params) {
			queryClient.invalidateQueries({ queryKey: ['docker-containers'] })
			queryClient.invalidateQueries({ queryKey: ['docker-container', params.containerId] })
			queryClient.invalidateQueries({
				queryKey: ['docker-container-health', params.containerId]
			})
			if (onSuccess) {
				onSuccess(result, params)
			}
		},
		onError: function (error, params) {
			if (onError) {
				onError(error, params)
			}
		}
	})
}

type RemoveContainerParams = {
	containerId: string
	options?: RemoveContainerOptions
}

type UseRemoveContainerOptions = {
	onSuccess?: (result: ContainerActionResult) => void
	onError?: (error: Error) => void
}

export function useRemoveContainer(options: UseRemoveContainerOptions = {}) {
	const { onSuccess, onError } = options
	const queryClient = useQueryClient()

	return useMutation<ContainerActionResult, Error, RemoveContainerParams>({
		mutationFn: function (params) {
			return deleteContainer(params.containerId, params.options)
		},
		onSuccess: function (result, params) {
			queryClient.invalidateQueries({ queryKey: ['docker-containers'] })
			queryClient.removeQueries({ queryKey: ['docker-container', params.containerId] })
			queryClient.removeQueries({ queryKey: ['docker-container-health', params.containerId] })
			queryClient.removeQueries({ queryKey: ['docker-container-logs', params.containerId] })
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
