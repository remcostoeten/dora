import { useQuery, type QueryClient } from '@tanstack/react-query'
import { CONTAINER_POLL_INTERVAL_MS } from '../../constants'
import type { DockerContainer, DockerAvailability } from '../../types'
import { getContainers, checkDockerAvailability } from '../container-service'

type UseContainersOptions = {
	showExternal?: boolean
	enabled?: boolean
}

function containersQueryOptions(showExternal: boolean) {
	return {
		queryKey: ['docker-containers', { showExternal }],
		queryFn: function () {
			return getContainers(true, showExternal)
		}
	}
}

const availabilityQueryOptions = {
	queryKey: ['docker-availability'],
	queryFn: checkDockerAvailability,
	staleTime: 60000
}

/**
 * @name prefetchDockerView
 * @description Warms the Docker view's lazy chunk, availability check and container list so the first visit paints from cache.
 * @example
 * onPointerEnter={function () { prefetchDockerView(queryClient) }}
 */
export function prefetchDockerView(queryClient: QueryClient) {
	void import('../../index')
	void queryClient.prefetchQuery(availabilityQueryOptions)
	void queryClient.prefetchQuery({
		...containersQueryOptions(true),
		staleTime: CONTAINER_POLL_INTERVAL_MS / 2
	})
}

export function useContainers(options: UseContainersOptions = {}) {
	const { showExternal = false, enabled = true } = options

	return useQuery<DockerContainer[], Error>({
		...containersQueryOptions(showExternal),
		enabled,
		refetchInterval: CONTAINER_POLL_INTERVAL_MS,
		staleTime: CONTAINER_POLL_INTERVAL_MS / 2
	})
}

export function useDockerAvailability() {
	return useQuery<DockerAvailability, Error>({
		...availabilityQueryOptions,
		refetchOnWindowFocus: false
	})
}

export function useContainerSearch(
	containers: DockerContainer[] | undefined,
	searchQuery: string
): DockerContainer[] {
	if (!containers) {
		return []
	}

	if (!searchQuery.trim()) {
		return containers
	}

	const query = searchQuery.toLowerCase().trim()

	return containers.filter(function (container) {
		return (
			container.name.toLowerCase().includes(query) ||
			container.image.toLowerCase().includes(query) ||
			container.id.toLowerCase().startsWith(query)
		)
	})
}
