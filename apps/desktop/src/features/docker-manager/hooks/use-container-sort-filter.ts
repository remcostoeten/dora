import { useMemo } from 'react'
import { useDockerManagerStore } from '../stores/docker-manager-store'
import { useContainerSizes } from '../api/queries/use-container-sizes'
import type { DockerContainer, ContainerSize } from '../types'

export function useContainerSortFilter(
	containers: DockerContainer[] | undefined,
	searchQuery: string
) {
	const sort = useDockerManagerStore(function (s) { return s.sort })
	const filter = useDockerManagerStore(function (s) { return s.filter })

	const { data: sizes } = useContainerSizes({
		enabled: sort.field === 'size'
	})

	const result = useMemo(function () {
		if (!containers) return []

		let filtered = containers

		// Text search
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase().trim()
			filtered = filtered.filter(function (c) {
				return (
					c.name.toLowerCase().includes(query) ||
					c.image.toLowerCase().includes(query) ||
					c.id.toLowerCase().startsWith(query)
				)
			})
		}

		// State filter
		if (filter.states.length > 0) {
			filtered = filtered.filter(function (c) {
				return filter.states.includes(c.state)
			})
		}

		// Health filter
		if (filter.healths.length > 0) {
			filtered = filtered.filter(function (c) {
				return filter.healths.includes(c.health)
			})
		}

		// Origin filter
		if (filter.origins.length > 0) {
			filtered = filtered.filter(function (c) {
				return filter.origins.includes(c.origin)
			})
		}

		// Sort
		const sorted = [...filtered].sort(function (a, b) {
			let comparison = 0

			switch (sort.field) {
				case 'name':
					comparison = a.name.localeCompare(b.name)
					break
				case 'createdAt':
					comparison = a.createdAt - b.createdAt
					break
				case 'state':
					comparison = a.state.localeCompare(b.state)
					break
				case 'origin':
					comparison = a.origin.localeCompare(b.origin)
					break
				case 'size':
					comparison = getSizeForContainer(a.id, sizes) - getSizeForContainer(b.id, sizes)
					break
			}

			return sort.direction === 'asc' ? comparison : -comparison
		})

		return sorted
	}, [containers, searchQuery, filter, sort, sizes])

	return result
}

function getSizeForContainer(containerId: string, sizes: ContainerSize[] | undefined): number {
	if (!sizes) return 0
	const entry = sizes.find(function (s) {
		return containerId.startsWith(s.containerId) || s.containerId.startsWith(containerId)
	})
	return entry ? entry.virtualSize : 0
}
