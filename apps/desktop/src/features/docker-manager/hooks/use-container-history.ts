import { useMemo, useCallback } from 'react'
import { useDockerManagerStore } from '../stores/docker-manager-store'
import type { ContainerEvent, ContainerEventType } from '../types'

export function useContainerHistory(containerId: string | null) {
	const events = useDockerManagerStore(function (s) { return s.events })
	const addEvent = useDockerManagerStore(function (s) { return s.addEvent })
	const clearHistory = useDockerManagerStore(function (s) { return s.clearHistory })

	const containerEvents = useMemo(function () {
		if (!containerId) return []
		return events.filter(function (e) {
			return e.containerId === containerId
		})
	}, [events, containerId])

	const trackEvent = useCallback(function (
		type: ContainerEventType,
		containerName: string
	) {
		if (!containerId) return
		addEvent({
			containerId,
			containerName,
			type
		})
	}, [containerId, addEvent])

	const clearContainerHistory = useCallback(function () {
		if (containerId) {
			clearHistory(containerId)
		}
	}, [containerId, clearHistory])

	return {
		events: containerEvents,
		trackEvent,
		clearContainerHistory
	}
}
