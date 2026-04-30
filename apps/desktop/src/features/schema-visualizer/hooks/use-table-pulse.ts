import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveMonitor } from '@/core/live-monitor'
import type { ChangeType } from '@/core/live-monitor'
import type { PulseState } from './use-schema-graph'

const PULSE_DURATION_MS = 2500

type PulseMap = Map<string, PulseState>

/**
 * Listens to the LiveMonitor's recent change events and produces a Map
 * of tableName → PulseState. Each pulse auto-clears after PULSE_DURATION_MS
 * so the glow animation fades naturally.
 */
export function useTablePulse(): PulseMap {
	const { recentEvents } = useLiveMonitor()
	const [pulseMap, setPulseMap] = useState<PulseMap>(function () {
		return new Map()
	})
	const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
	const processedIdsRef = useRef<Set<string>>(new Set())

	function changeTypeToPulse(changeType: ChangeType): PulseState {
		switch (changeType) {
			case 'insert': return 'insert'
			case 'update': return 'update'
			case 'delete': return 'delete'
			default: return 'idle'
		}
	}

	const clearPulse = useCallback(function clearPulse(tableName: string) {
		setPulseMap(function (prev) {
			const next = new Map(prev)
			next.delete(tableName)
			return next
		})
		timeoutsRef.current.delete(tableName)
	}, [])

	useEffect(function processEvents() {
		if (!recentEvents.length) return

		const newPulses = new Map<string, PulseState>()

		recentEvents.forEach(function (event) {
			// Skip already-processed events
			if (processedIdsRef.current.has(event.id)) return
			processedIdsRef.current.add(event.id)

			const pulse = changeTypeToPulse(event.changeType)
			if (pulse !== 'idle') {
				newPulses.set(event.tableName, pulse)
			}
		})

		// Cap the processed IDs set so it doesn't grow forever
		if (processedIdsRef.current.size > 500) {
			const arr = Array.from(processedIdsRef.current)
			processedIdsRef.current = new Set(arr.slice(arr.length - 200))
		}

		if (newPulses.size === 0) return

		setPulseMap(function (prev) {
			const next = new Map(prev)
			newPulses.forEach(function (pulse, tableName) {
				next.set(tableName, pulse)
			})
			return next
		})

		// Schedule auto-clear for each pulsing table
		newPulses.forEach(function (_pulse, tableName) {
			// Clear any existing timeout for this table
			const existing = timeoutsRef.current.get(tableName)
			if (existing) clearTimeout(existing)

			const timeout = setTimeout(function () {
				clearPulse(tableName)
			}, PULSE_DURATION_MS)
			timeoutsRef.current.set(tableName, timeout)
		})
	}, [recentEvents, clearPulse])

	// Cleanup all timeouts on unmount
	useEffect(function cleanupTimeouts() {
		return function () {
			timeoutsRef.current.forEach(function (timeout) {
				clearTimeout(timeout)
			})
		}
	}, [])

	return pulseMap
}
