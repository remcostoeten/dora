import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode
} from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { commands } from '@/lib/bindings'
import { clearTableDataCache } from '@/core/table-cache'
import { type ChangeEvent, type ChangeType, type LiveMonitorConfig, DEFAULT_CONFIG } from './types'

// ── Tauri event payload shape ────────────────────────────────────────────────

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

const LIVE_MONITOR_EVENT = 'live-monitor-update'
const MAX_EVENTS = 100

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTauri(): boolean {
	return typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

function dispatchSchemaRefresh(connectionId: string) {
	window.dispatchEvent(
		new CustomEvent('dora-schema-refresh', { detail: { connectionId } })
	)
}

// ── Context shape ────────────────────────────────────────────────────────────

type LiveMonitorContextValue = {
	config: LiveMonitorConfig
	setConfig: (config: LiveMonitorConfig | ((prev: LiveMonitorConfig) => LiveMonitorConfig)) => void
	isPolling: boolean
	monitorError: string | null
	recentEvents: ChangeEvent[]
	unreadCount: number
	markRead: () => void
	clearEvents: () => void
	/** Set which table is currently visible — used to track unread counts per table */
	setActiveTable: (tableName: string | null) => void
	activeTable: string | null
}

const LiveMonitorContext = createContext<LiveMonitorContextValue | null>(null)

// ── Provider ─────────────────────────────────────────────────────────────────

type Props = {
	children: ReactNode
	activeConnectionId: string | undefined
}

export function LiveMonitorProvider({ children, activeConnectionId }: Props) {
	const [config, setConfig] = useState<LiveMonitorConfig>(DEFAULT_CONFIG)
	const [isPolling, setIsPolling] = useState(false)
	const [monitorError, setMonitorError] = useState<string | null>(null)
	const [recentEvents, setRecentEvents] = useState<ChangeEvent[]>([])
	const [unreadCount, setUnreadCount] = useState(0)
	const [activeTable, setActiveTable] = useState<string | null>(null)

	const monitorIdRef = useRef<string | null>(null)
	const runtimeAvailable = useMemo(() => isTauri(), [])
	const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// ── Debounced refresh: busts cache + fires schema-refresh event ──────────
	const scheduleRefresh = useCallback(
		function scheduleRefresh(connectionId: string) {
			if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current)
			refreshDebounceRef.current = setTimeout(function () {
				refreshDebounceRef.current = null
				clearTableDataCache()
				dispatchSchemaRefresh(connectionId)
			}, 150)
		},
		[]
	)

	// ── Stop current monitor ─────────────────────────────────────────────────
	const stopMonitor = useCallback(async function stopMonitor() {
		const id = monitorIdRef.current
		monitorIdRef.current = null
		setIsPolling(false)
		if (!id) return
		try {
			await commands.stopLiveMonitor(id)
		} catch (err) {
			console.error('[LiveMonitor] stop failed:', err)
		}
	}, [])

	// ── Listen for Tauri backend events (global, one listener for all tables) ─
	useEffect(
		function subscribeToTauriEvents() {
			if (!runtimeAvailable) return

			let disposed = false
			let unlisten: UnlistenFn | null = null

			void listen<BackendPayload>(LIVE_MONITOR_EVENT, function onEvent(event) {
				const payload = event.payload
				if (!payload || payload.monitorId !== monitorIdRef.current) return

				if (payload.error) {
					setMonitorError(payload.error)
					return
				}
				setMonitorError(null)

				if (!payload.events?.length) return

				const incoming: ChangeEvent[] = payload.events.map(function (e) {
					return {
						id: e.id,
						timestamp: e.timestamp,
						changeType: e.changeType,
						tableName: e.tableName,
						summary: e.summary,
						rowCount: e.rowCount
					}
				})

				setRecentEvents(function (prev) {
					return [...incoming, ...prev].slice(0, MAX_EVENTS)
				})
				setUnreadCount(function (prev) { return prev + incoming.length })

				scheduleRefresh(payload.connectionId)
			}).then(function (fn) {
				if (disposed) { fn(); return }
				unlisten = fn
			})

			return function cleanup() {
				disposed = true
				if (unlisten) unlisten()
			}
		},
		[runtimeAvailable, scheduleRefresh]
	)

	// ── Start/stop Tauri monitor when connection or config changes ───────────
	useEffect(
		function manageMonitorSession() {
			if (!runtimeAvailable) return

			let cancelled = false

			async function start() {
				await stopMonitor()

				const shouldRun = config.enabled && Boolean(activeConnectionId)
				if (!shouldRun) {
					setMonitorError(null)
					return
				}

				try {
					setMonitorError(null)
					// We monitor the special sentinel table name '*' which the backend
					// interprets as "all tables on this connection". If the backend
					// doesn't support it, we fall back to a known system table that
					// always exists and treat events globally.
					// For now the backend monitors a per-table, so we start one monitor
					// per active table. The context tracks the active table and restarts
					// when it changes — see the separate effect below.
					if (!activeTable) return

					const result = await commands.startLiveMonitor(
						activeConnectionId!,
						activeTable,
						config.intervalMs,
						config.changeTypes as any
					)

					if (result.status !== 'ok') throw new Error(String(result.error))
					if (cancelled) {
						await commands.stopLiveMonitor((result.data as any).monitorId)
						return
					}

					monitorIdRef.current = (result.data as any).monitorId
					setIsPolling(true)
				} catch (err) {
					console.error('[LiveMonitor] start failed:', err)
					setMonitorError(err instanceof Error ? err.message : String(err))
					setIsPolling(false)
				}
			}

			void start()
			return function cleanup() {
				cancelled = true
				void stopMonitor()
			}
		},
		[
			runtimeAvailable,
			config.enabled,
			config.intervalMs,
			// changeTypes as stable string key
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[...config.changeTypes].sort().join('|'),
			activeConnectionId,
			activeTable,
			stopMonitor
		]
	)

	// ── Fallback polling for web/mock mode ───────────────────────────────────
	const fallbackRef = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(
		function manageFallbackPolling() {
			if (runtimeAvailable) return

			if (fallbackRef.current) { clearInterval(fallbackRef.current); fallbackRef.current = null }

			const shouldPoll = config.enabled && Boolean(activeConnectionId) && Boolean(activeTable)
			if (!shouldPoll) { setIsPolling(false); return }

			setIsPolling(true)
			fallbackRef.current = setInterval(function () {
				if (activeConnectionId) scheduleRefresh(activeConnectionId)
			}, config.intervalMs)

			return function cleanup() {
				if (fallbackRef.current) { clearInterval(fallbackRef.current); fallbackRef.current = null }
				setIsPolling(false)
			}
		},
		[runtimeAvailable, config.enabled, config.intervalMs, activeConnectionId, activeTable, scheduleRefresh]
	)

	// ── Reset state when connection changes ──────────────────────────────────
	useEffect(
		function resetOnConnectionChange() {
			setRecentEvents([])
			setUnreadCount(0)
			setMonitorError(null)
		},
		[activeConnectionId]
	)

	const markRead = useCallback(function () { setUnreadCount(0) }, [])
	const clearEvents = useCallback(function () { setRecentEvents([]); setUnreadCount(0) }, [])

	const value = useMemo<LiveMonitorContextValue>(
		function () {
			return {
				config,
				setConfig,
				isPolling,
				monitorError,
				recentEvents,
				unreadCount,
				markRead,
				clearEvents,
				setActiveTable,
				activeTable
			}
		},
		[config, isPolling, monitorError, recentEvents, unreadCount, markRead, clearEvents, activeTable]
	)

	return <LiveMonitorContext.Provider value={value}>{children}</LiveMonitorContext.Provider>
}

export function useLiveMonitor(): LiveMonitorContextValue {
	const ctx = useContext(LiveMonitorContext)
	if (!ctx) throw new Error('useLiveMonitor must be used inside LiveMonitorProvider')
	return ctx
}
