import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type ChangeType = 'insert' | 'update' | 'delete'

export type ChangeEvent = {
	id: string
	timestamp: number
	changeType: ChangeType
	tableName: string
	summary: string
	rowCount: number
}

export type LiveMonitorSubscription = {
	changeTypes: ChangeType[]
}

export type LiveMonitorConfig = {
	enabled: boolean
	intervalMs: number
	subscription: LiveMonitorSubscription
}

export const DEFAULT_LIVE_MONITOR_CONFIG: LiveMonitorConfig = {
	enabled: false,
	intervalMs: 5000,
	subscription: {
		changeTypes: ['insert', 'update', 'delete']
	}
}

type LiveMonitorState = {
	config: LiveMonitorConfig
	setConfig: (
		config: LiveMonitorConfig | ((prev: LiveMonitorConfig) => LiveMonitorConfig)
	) => void
	isPolling: boolean
	monitorError: string | null
	changeEvents: ChangeEvent[]
	clearEvents: () => void
	lastPolledAt: number | null
	unreadCount: number
	markRead: () => void
}

type LiveMonitorParams = {
	connectionId: string | undefined
	tableName: string | null
	isPaused: boolean
	onDataChanged: () => void
}

type LiveMonitorSession = {
	monitorId: string
	eventName: string
}

type LiveMonitorBackendEvent = {
	monitorId: string
	connectionId: string
	tableName: string
	polledAt: number
	events: ChangeEvent[]
	error: string | null
}

const LIVE_MONITOR_EVENT_NAME = 'live-monitor-update'
const MAX_EVENTS = 50

function isTauriRuntime(): boolean {
	return (
		typeof window !== 'undefined' &&
		('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
	)
}

export function useLiveMonitor({
	connectionId,
	tableName,
	isPaused,
	onDataChanged
}: LiveMonitorParams): LiveMonitorState {
	const [config, setConfig] = useState<LiveMonitorConfig>(DEFAULT_LIVE_MONITOR_CONFIG)
	const [isPolling, setIsPolling] = useState(false)
	const [monitorError, setMonitorError] = useState<string | null>(null)
	const [changeEvents, setChangeEvents] = useState<ChangeEvent[]>([])
	const [lastPolledAt, setLastPolledAt] = useState<number | null>(null)
	const [unreadCount, setUnreadCount] = useState(0)

	const onDataChangedRef = useRef(onDataChanged)
	onDataChangedRef.current = onDataChanged

	const monitorIdRef = useRef<string | null>(null)
	const runtimeAvailable = useMemo(() => isTauriRuntime(), [])

	const stopMonitor = useCallback(async function stopCurrentMonitor() {
		const monitorId = monitorIdRef.current
		if (!monitorId) {
			setIsPolling(false)
			return
		}

		monitorIdRef.current = null
		try {
			await invoke('stop_live_monitor', { monitorId })
		} catch (error) {
			console.error('[LiveMonitor] Failed to stop monitor:', error)
		} finally {
			setIsPolling(false)
		}
	}, [])

	useEffect(
		function subscribeToBackendEvents() {
			if (!runtimeAvailable) return

			let disposed = false
			let unlisten: UnlistenFn | null = null

			void listen<LiveMonitorBackendEvent>(
				LIVE_MONITOR_EVENT_NAME,
				function onMonitorEvent(event) {
					const payload = event.payload
					if (!payload) return
					if (payload.monitorId !== monitorIdRef.current) return

					setLastPolledAt(payload.polledAt)

						if (payload.error) {
							console.error('[LiveMonitor] Backend monitor error:', payload.error)
							setMonitorError(payload.error)
							return
						}
						setMonitorError(null)

						if (!payload.events || payload.events.length === 0) {
							return
						}

					setChangeEvents(function (prev) {
						const combined = [...payload.events, ...prev]
						return combined.slice(0, MAX_EVENTS)
					})

					setUnreadCount(function (prev) {
						return prev + payload.events.length
					})

					onDataChangedRef.current()
				}
			).then(function (fn) {
				if (disposed) {
					fn()
					return
				}
				unlisten = fn
			})

			return function cleanup() {
				disposed = true
				if (unlisten) {
					unlisten()
				}
			}
		},
		[runtimeAvailable]
	)

	const changeTypesKey = useMemo(
		function () {
			return [...config.subscription.changeTypes].sort().join('|')
		},
		[config.subscription.changeTypes]
	)

	useEffect(
		function manageMonitorSession() {
			let cancelled = false

			async function startOrStopMonitor() {
				await stopMonitor()

				const shouldMonitor =
					runtimeAvailable &&
					config.enabled &&
					!isPaused &&
					Boolean(connectionId) &&
					Boolean(tableName)

				if (!shouldMonitor) {
					setMonitorError(null)
					return
				}

				try {
					setMonitorError(null)
					const session = await invoke<LiveMonitorSession>('start_live_monitor', {
						connectionId,
						tableName,
						intervalMs: config.intervalMs,
						changeTypes: config.subscription.changeTypes
					})

					if (cancelled) {
						await invoke('stop_live_monitor', { monitorId: session.monitorId })
						return
					}

					monitorIdRef.current = session.monitorId
					setIsPolling(true)
				} catch (error) {
					console.error('[LiveMonitor] Failed to start monitor:', error)
					setMonitorError(error instanceof Error ? error.message : String(error))
					setIsPolling(false)
				}
			}

			void startOrStopMonitor()

			return function cleanup() {
				cancelled = true
				void stopMonitor()
			}
		},
		[
			runtimeAvailable,
			config.enabled,
			config.intervalMs,
			changeTypesKey,
			connectionId,
			tableName,
			isPaused,
			stopMonitor
		]
	)

	const clearEvents = useCallback(function () {
		setChangeEvents([])
		setUnreadCount(0)
	}, [])

	const markRead = useCallback(function () {
		setUnreadCount(0)
	}, [])

	return {
		config,
		setConfig,
		isPolling,
		monitorError,
		changeEvents,
		clearEvents,
		lastPolledAt,
		unreadCount,
		markRead
	}
}
