import { useQuery } from "@tanstack/react-query";
import { CONTAINER_POLL_INTERVAL_MS } from "../../constants";
import type { DockerContainer, DockerAvailability } from "../../types";
import { getContainers, checkDockerAvailability } from "../container-service";

type UseContainersOptions = {
	showExternal?: boolean
	enabled?: boolean
}

export function useContainers(options: UseContainersOptions = {}) {
	const { showExternal = false, enabled = true } = options

	return useQuery<DockerContainer[], Error>({
		queryKey: ['docker-containers', { showExternal }],
		queryFn: function () {
			return getContainers(true, showExternal)
		},
		enabled,
		refetchInterval: CONTAINER_POLL_INTERVAL_MS,
		staleTime: CONTAINER_POLL_INTERVAL_MS / 2
	})
}

export function useDockerAvailability() {
	return useQuery<DockerAvailability, Error>({
		queryKey: ['docker-availability'],
		queryFn: checkDockerAvailability,
		staleTime: 60000,
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
