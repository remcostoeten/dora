import { useQuery } from "@tanstack/react-query";
import type { DockerContainer, ContainerHealth } from "../../types";
import { getContainer } from "../container-service";

type UseContainerHealthOptions = {
	enabled?: boolean
	refetchInterval?: number
}

export function useContainerHealth(
	containerId: string | null,
	options: UseContainerHealthOptions = {}
) {
	const { enabled = true, refetchInterval = 2000 } = options

	return useQuery<ContainerHealth, Error>({
		queryKey: ['docker-container-health', containerId],
		queryFn: async function () {
			if (!containerId) {
				return 'none'
			}
			const container = await getContainer(containerId)
			return container?.health ?? 'none'
		},
		enabled: enabled && Boolean(containerId),
		refetchInterval,
		staleTime: 1000
	})
}

export function useContainer(containerId: string | null, options: { enabled?: boolean } = {}) {
	const { enabled = true } = options

	return useQuery<DockerContainer | null, Error>({
		queryKey: ['docker-container', containerId],
		queryFn: function () {
			if (!containerId) {
				return Promise.resolve(null)
			}
			return getContainer(containerId)
		},
		enabled: enabled && Boolean(containerId),
		staleTime: 2000
	})
}
