import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { commands } from '@studio/lib/bindings'
import { clearTableSnapshots } from '@studio/core/workspace-store'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import {
	clearLiveMonitorEvents,
	getLiveMonitorSession,
	getLiveMonitorState,
	markLiveMonitorRead,
	patchLiveMonitorState,
	pushLiveMonitorEvents,
	setLiveMonitorActiveTable,
	setLiveMonitorConfig,
	setLiveMonitorConnection,
	subscribeLiveMonitor,
	subscribeLiveMonitorSession
} from './live-monitor-store'
import { type ChangeEvent, type ChangeType, type LiveMonitorConfig } from './types'

type BackendChangeEvent = {
	id: string
	timestamp: number
	changeType: ChangeType
	tableName: string
	summary: string
	rowCount: number
}

type BackendPayload = {
	monitorId: string
	connectionId: string
	tableName: string
	polledAt: number
	events: BackendChangeEvent[]
	error: string | null
}

type LiveMonitorContextValue = {
	config: LiveMonitorConfig
	setConfig: (
		config: LiveMonitorConfig | ((prev: LiveMonitorConfig) => LiveMonitorConfig)
	) => void
	isPolling: boolean
	monitorError: string | null
	recentEvents: ChangeEvent[]
	unreadCount: number
	markRead: () => void
	clearEvents: () => void
	/** Set which table is currently visible — used to track unread counts per table */
	setActiveTable: (tableName: string | null) => void
}

type Props = {
	children: ReactNode
	activeConnectionId: string | undefined
}

const LIVE_MONITOR_EVENT = 'live-monitor-update'
const REFRESH_DEBOUNCE_MS = 150

function isTauri(): boolean {
	return (
		typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
	)
}

function dispatchSchemaRefresh(connectionId: string) {
	window.dispatchEvent(new CustomEvent('dora-schema-refresh', { detail: { connectionId } }))
}

function sessionKey(): string {
	const { config } = getLiveMonitorState()
	const { connectionId, activeTable } = getLiveMonitorSession()
	return JSON.stringify([
		config.enabled,
		config.intervalMs,
		[...config.changeTypes].sort(),
		connectionId ?? null,
		activeTable
	])
}

function startLiveMonitorRuntime(): () => void {
	const runtimeAvailable = isTauri()
	let disposed = false
	let unlisten: UnlistenFn | null = null
	let monitorId: string | null = null
	let currentKey: string | null = null
	let generation = 0
	let reconcileQueued = false
	let refreshTimer: ReturnType<typeof setTimeout> | null = null

	function scheduleRefresh(connectionId: string) {
		if (refreshTimer) clearTimeout(refreshTimer)
		refreshTimer = setTimeout(function () {
			refreshTimer = null
			clearTableSnapshots()
			dispatchSchemaRefresh(connectionId)
		}, REFRESH_DEBOUNCE_MS)
	}

	async function stopMonitor() {
		const id = monitorId
		monitorId = null
		if (!id) return
		try {
			await commands.stopLiveMonitor(id)
		} catch (err) {
			console.error('[LiveMonitor] stop failed:', err)
		}
	}

	async function startSession(token: number) {
		await stopMonitor()
		if (token !== generation) return

		const { config } = getLiveMonitorState()
		const { connectionId, activeTable } = getLiveMonitorSession()
		if (!config.enabled || !connectionId || !activeTable) {
			patchLiveMonitorState({ isPolling: false, monitorError: null })
			return
		}

		try {
			const result = await commands.startLiveMonitor(
				connectionId,
				activeTable,
				config.intervalMs,
				config.changeTypes
			)
			if (result.status !== 'ok') throw new Error(formatBackendError(result.error))
			if (token !== generation) {
				await commands.stopLiveMonitor(result.data.monitorId)
				return
			}
			monitorId = result.data.monitorId
			patchLiveMonitorState({ isPolling: true, monitorError: null })
		} catch (err) {
			if (token !== generation) return
			const message = err instanceof Error ? err.message : String(err)
			if (message.includes('connection not found')) {
				console.warn('[LiveMonitor] Skipped: the connection is no longer open.')
			} else {
				console.error('[LiveMonitor] start failed:', err)
			}
			patchLiveMonitorState({ isPolling: false, monitorError: message })
		}
	}

	function reconcile() {
		reconcileQueued = false
		if (disposed) return
		const key = sessionKey()
		if (key === currentKey) return
		currentKey = key
		generation += 1

		if (runtimeAvailable) {
			void startSession(generation)
			return
		}

		const { config } = getLiveMonitorState()
		const { connectionId, activeTable } = getLiveMonitorSession()
		patchLiveMonitorState({
			isPolling: config.enabled && Boolean(connectionId) && Boolean(activeTable)
		})
	}

	// Coalesces the clear-then-set a table switch makes into one restart.
	function queueReconcile() {
		if (reconcileQueued) return
		reconcileQueued = true
		queueMicrotask(reconcile)
	}

	const unsubscribe = subscribeLiveMonitorSession(queueReconcile)
	reconcile()

	if (runtimeAvailable) {
		void listen<BackendPayload>(LIVE_MONITOR_EVENT, function onEvent(event) {
			const payload = event.payload
			if (!payload || payload.monitorId !== monitorId) return

			if (payload.error) {
				patchLiveMonitorState({ monitorError: payload.error })
				return
			}
			patchLiveMonitorState({ monitorError: null })

			if (!payload.events?.length) return

			pushLiveMonitorEvents(
				payload.events.map(function (e) {
					return {
						id: e.id,
						timestamp: e.timestamp,
						changeType: e.changeType,
						tableName: e.tableName,
						summary: e.summary,
						rowCount: e.rowCount
					}
				})
			)
			scheduleRefresh(payload.connectionId)
		}).then(function (fn) {
			if (disposed) {
				fn()
				return
			}
			unlisten = fn
		})
	}

	return function stopLiveMonitorRuntime() {
		disposed = true
		generation += 1
		unsubscribe()
		if (unlisten) unlisten()
		if (refreshTimer) clearTimeout(refreshTimer)
		void stopMonitor()
		patchLiveMonitorState({ isPolling: false })
	}
}

export function LiveMonitorProvider({ children, activeConnectionId }: Props) {
	useEffect(
		function trackConnection() {
			setLiveMonitorConnection(activeConnectionId)
		},
		[activeConnectionId]
	)

	useEffect(function runMonitor() {
		return startLiveMonitorRuntime()
	}, [])

	return <>{children}</>
}

export function useLiveMonitor(): LiveMonitorContextValue {
	const state = useSyncExternalStore(
		subscribeLiveMonitor,
		getLiveMonitorState,
		getLiveMonitorState
	)

	return useMemo(
		function () {
			return {
				config: state.config,
				setConfig: setLiveMonitorConfig,
				isPolling: state.isPolling,
				monitorError: state.monitorError,
				recentEvents: state.recentEvents,
				unreadCount: state.unreadCount,
				markRead: markLiveMonitorRead,
				clearEvents: clearLiveMonitorEvents,
				setActiveTable: setLiveMonitorActiveTable
			}
		},
		[state]
	)
}
