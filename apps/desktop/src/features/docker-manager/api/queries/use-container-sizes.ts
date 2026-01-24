import { useQuery } from '@tanstack/react-query'
import type { ContainerSize } from '../../types'
import { getContainerSizes } from '../docker-client'

type UseContainerSizesOptions = {
	enabled?: boolean
}

export function useContainerSizes(options: UseContainerSizesOptions = {}) {
	const { enabled = false } = options

	return useQuery<ContainerSize[], Error>({
		queryKey: ['docker-container-sizes'],
		queryFn: getContainerSizes,
		enabled,
		staleTime: 30000,
		refetchOnWindowFocus: false
	})
}
