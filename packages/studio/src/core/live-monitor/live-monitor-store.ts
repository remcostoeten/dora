import { useSyncExternalStore } from 'react'
import { type ChangeEvent, type LiveMonitorConfig, DEFAULT_CONFIG } from './types'

export type LiveMonitorState = {
	config: LiveMonitorConfig
	isPolling: boolean
	monitorError: string | null
	recentEvents: ChangeEvent[]
	unreadCount: number
}

export type LiveMonitorSession = {
	connectionId: string | undefined
	activeTable: string | null
}

const MAX_EVENTS = 100
const NO_EVENTS: ChangeEvent[] = []

function createInitialState(): LiveMonitorState {
	return {
		config: DEFAULT_CONFIG,
		isPolling: false,
		monitorError: null,
		recentEvents: NO_EVENTS,
		unreadCount: 0
	}
}

let state = createInitialState()
let session: LiveMonitorSession = { connectionId: undefined, activeTable: null }
const stateListeners = new Set<() => void>()
const sessionListeners = new Set<() => void>()

function notify(listeners: Set<() => void>): void {
	for (const listener of listeners) listener()
}

/**
 * @name patchLiveMonitorState
 * @description Merges fields into the live monitor state and notifies
 * subscribers, unless every field already holds the given value.
 *
 * @example
 * patchLiveMonitorState({ isPolling: true })
 */
export function patchLiveMonitorState(patch: Partial<LiveMonitorState>): void {
	let changed = false
	for (const key of Object.keys(patch) as Array<keyof LiveMonitorState>) {
		if (!Object.is(state[key], patch[key])) changed = true
	}
	if (!changed) return
	state = { ...state, ...patch }
	notify(stateListeners)
}

/**
 * @name getLiveMonitorState
 * @description Returns the current live monitor state without subscribing.
 *
 * @example
 * const { recentEvents } = getLiveMonitorState()
 */
export function getLiveMonitorState(): LiveMonitorState {
	return state
}

/**
 * @name subscribeLiveMonitor
 * @description Calls `listener` whenever the live monitor state changes.
 * Returns the unsubscribe function.
 *
 * @example
 * const unsubscribe = subscribeLiveMonitor(() => console.log(getLiveMonitorState()))
 */
export function subscribeLiveMonitor(listener: () => void): () => void {
	stateListeners.add(listener)
	return function unsubscribe() {
		stateListeners.delete(listener)
	}
}

/**
 * @name useLiveMonitorSelector
 * @description Subscribes a component to one field of the live monitor state.
 * The selector must return a value kept by reference in the state (or a
 * primitive), so the component re-renders only when that value changes.
 *
 * @example
 * const unreadCount = useLiveMonitorSelector((state) => state.unreadCount)
 */
export function useLiveMonitorSelector<T>(selector: (state: LiveMonitorState) => T): T {
	return useSyncExternalStore(
		subscribeLiveMonitor,
		() => selector(state),
		() => selector(state)
	)
}

/**
 * @name setLiveMonitorConfig
 * @description Replaces the live monitor config, or derives it from the
 * previous one. The monitor session restarts when the config changes.
 *
 * @example
 * setLiveMonitorConfig((config) => ({ ...config, enabled: false }))
 */
export function setLiveMonitorConfig(
	next: LiveMonitorConfig | ((previous: LiveMonitorConfig) => LiveMonitorConfig)
): void {
	const config = typeof next === 'function' ? next(state.config) : next
	patchLiveMonitorState({ config })
	notify(sessionListeners)
}

/**
 * @name markLiveMonitorRead
 * @description Clears the unread change count.
 *
 * @example
 * markLiveMonitorRead()
 */
export function markLiveMonitorRead(): void {
	patchLiveMonitorState({ unreadCount: 0 })
}

/**
 * @name clearLiveMonitorEvents
 * @description Empties the change feed and the unread count.
 *
 * @example
 * clearLiveMonitorEvents()
 */
export function clearLiveMonitorEvents(): void {
	patchLiveMonitorState({ recentEvents: NO_EVENTS, unreadCount: 0 })
}

/**
 * @name pushLiveMonitorEvents
 * @description Prepends change events reported by the backend to the feed,
 * capped at the most recent 100, and counts them as unread.
 *
 * @example
 * pushLiveMonitorEvents(payload.events)
 */
export function pushLiveMonitorEvents(incoming: ChangeEvent[]): void {
	if (incoming.length === 0) return
	patchLiveMonitorState({
		recentEvents: [...incoming, ...state.recentEvents].slice(0, MAX_EVENTS),
		unreadCount: state.unreadCount + incoming.length
	})
}

/**
 * @name getLiveMonitorSession
 * @description Returns the connection and table the monitor is pointed at.
 *
 * @example
 * const { activeTable } = getLiveMonitorSession()
 */
export function getLiveMonitorSession(): LiveMonitorSession {
	return session
}

/**
 * @name subscribeLiveMonitorSession
 * @description Calls `listener` when the monitored connection, table or config
 * changes. Only the monitor runtime listens, so pointing the monitor at
 * another table re-renders nothing.
 *
 * @example
 * const unsubscribe = subscribeLiveMonitorSession(restartMonitor)
 */
export function subscribeLiveMonitorSession(listener: () => void): () => void {
	sessionListeners.add(listener)
	return function unsubscribe() {
		sessionListeners.delete(listener)
	}
}

/**
 * @name setLiveMonitorActiveTable
 * @description Points the monitor at the table on screen, or at nothing.
 *
 * @example
 * setLiveMonitorActiveTable('public.users')
 */
export function setLiveMonitorActiveTable(activeTable: string | null): void {
	if (session.activeTable === activeTable) return
	session = { ...session, activeTable }
	notify(sessionListeners)
}

/**
 * @name setLiveMonitorConnection
 * @description Points the monitor at a connection. Changing connection empties
 * the change feed, the unread count and the last error.
 *
 * @example
 * setLiveMonitorConnection(activeConnectionId)
 */
export function setLiveMonitorConnection(connectionId: string | undefined): void {
	if (session.connectionId === connectionId) return
	session = { ...session, connectionId }
	patchLiveMonitorState({ recentEvents: NO_EVENTS, unreadCount: 0, monitorError: null })
	notify(sessionListeners)
}

/**
 * @name resetLiveMonitorStore
 * @description Test-only: returns the store to its initial state.
 *
 * @example
 * beforeEach(resetLiveMonitorStore)
 */
export function resetLiveMonitorStore(): void {
	state = createInitialState()
	session = { connectionId: undefined, activeTable: null }
	notify(stateListeners)
	notify(sessionListeners)
}
