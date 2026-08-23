import type { Tab } from './tabs-store'

// Tab session persistence (issue #98).
//
// We persist the open tabs so Dora reopens where you left off. localStorage is
// reused here because it already backs tab state in this codebase, works in
// both the Tauri webview and the web build, and needs no async plumbing — so
// hydration is synchronous and never blocks cold start. Only serializable tab
// identity is stored; live result data lives outside the Tab and repopulates
// lazily on reconnect.

export const SESSION_STORAGE_KEY = 'dora-session'

// v2 adds multi-connection session state (issue #96): the active connection and
// the set of open connections. v1 payloads (tabs only) are tolerated and
// upgraded on read by deriving the connection fields from the tabs.
const SESSION_VERSION = 2

// A Tab today carries only serializable identity (connection + table + label +
// pinned). If richer kinds (sql-console query text, filter/sort config) are
// added to Tab later, list them here so they round-trip through persistence.
export type SerializedTab = {
	id: string
	connectionId: string
	tableId: string
	tableName: string
	label: string
	pinned: boolean
}

export type SerializedSession = {
	version: number
	tabs: SerializedTab[]
	activeTabId: string | null
	// Multi-connection session (issue #96).
	activeConnectionId: string
	openConnectionIds: string[]
	// Per-connection active tab id so each connection restores its focused tab.
	activeTabByConnection: Record<string, string>
}

export type SessionInput = {
	tabs: Tab[]
	activeConnectionId: string
	openConnectionIds: string[]
	activeTabByConnection: Record<string, string>
}

function toSerializedTab(tab: Tab): SerializedTab {
	return {
		id: tab.id,
		connectionId: tab.connectionId,
		tableId: tab.tableId,
		tableName: tab.tableName,
		label: tab.label,
		pinned: Boolean(tab.pinned)
	}
}

export function serializeTabs(input: SessionInput): SerializedSession {
	const activeTabId = input.activeTabByConnection[input.activeConnectionId] ?? null
	return {
		version: SESSION_VERSION,
		tabs: input.tabs.map(toSerializedTab),
		activeTabId,
		activeConnectionId: input.activeConnectionId,
		openConnectionIds: input.openConnectionIds,
		activeTabByConnection: input.activeTabByConnection
	}
}

function isSerializedTab(value: unknown): value is SerializedTab {
	if (!value || typeof value !== 'object') return false
	const tab = value as Record<string, unknown>
	return (
		typeof tab.id === 'string' &&
		typeof tab.connectionId === 'string' &&
		typeof tab.tableId === 'string' &&
		typeof tab.tableName === 'string' &&
		typeof tab.label === 'string'
	)
}

function emptySession(): SerializedSession {
	return {
		version: SESSION_VERSION,
		tabs: [],
		activeTabId: null,
		activeConnectionId: '',
		openConnectionIds: [],
		activeTabByConnection: {}
	}
}

// Validate a raw persisted payload. Tolerates v1 (tabs-only) payloads by
// deriving the multi-connection fields from the tabs. Returns an empty session
// on any unknown version or shape error so a stale/corrupt blob can never break
// startup.
export function deserializeTabs(raw: unknown): SerializedSession {
	if (!raw || typeof raw !== 'object') return emptySession()
	const parsed = raw as Record<string, unknown>
	// Accept v1 and v2; anything else is treated as unknown/corrupt.
	if (parsed.version !== 1 && parsed.version !== SESSION_VERSION) return emptySession()
	if (!Array.isArray(parsed.tabs)) return emptySession()

	const tabs: SerializedTab[] = parsed.tabs.filter(isSerializedTab).map((tab) => ({
		id: tab.id,
		connectionId: tab.connectionId,
		tableId: tab.tableId,
		tableName: tab.tableName,
		label: tab.label,
		pinned: Boolean(tab.pinned)
	}))

	const activeTabId =
		typeof parsed.activeTabId === 'string' && tabs.some((t) => t.id === parsed.activeTabId)
			? parsed.activeTabId
			: (tabs[tabs.length - 1]?.id ?? null)

	// Open connections: from payload (v2), filtered to those still referenced by
	// a tab; otherwise derived from the tabs in first-seen order (v1 upgrade).
	const tabConnectionIds: string[] = []
	for (const tab of tabs) {
		if (!tabConnectionIds.includes(tab.connectionId)) tabConnectionIds.push(tab.connectionId)
	}

	const rawOpen = Array.isArray(parsed.openConnectionIds)
		? (parsed.openConnectionIds.filter((id) => typeof id === 'string') as string[])
		: null
	const openConnectionIds = (rawOpen ?? tabConnectionIds).filter((id) =>
		tabConnectionIds.includes(id)
	)

	// Per-connection active tab: from payload (v2) validated against surviving
	// tabs; otherwise derive each connection's last tab (or the global active
	// tab) for v1 upgrade.
	const activeTabByConnection: Record<string, string> = {}
	const rawMap =
		parsed.activeTabByConnection && typeof parsed.activeTabByConnection === 'object'
			? (parsed.activeTabByConnection as Record<string, unknown>)
			: {}
	for (const connectionId of openConnectionIds) {
		const own = tabs.filter((t) => t.connectionId === connectionId)
		if (own.length === 0) continue
		const candidate = rawMap[connectionId]
		const valid = typeof candidate === 'string' && own.some((t) => t.id === candidate)
		if (valid) {
			activeTabByConnection[connectionId] = candidate as string
		} else if (activeTabId && own.some((t) => t.id === activeTabId)) {
			activeTabByConnection[connectionId] = activeTabId
		} else {
			activeTabByConnection[connectionId] = own[own.length - 1].id
		}
	}

	const rawActiveConnection =
		typeof parsed.activeConnectionId === 'string' ? parsed.activeConnectionId : ''
	const activeConnectionId = openConnectionIds.includes(rawActiveConnection)
		? rawActiveConnection
		: (openConnectionIds[openConnectionIds.length - 1] ?? '')

	return {
		version: SESSION_VERSION,
		tabs,
		activeTabId,
		activeConnectionId,
		openConnectionIds,
		activeTabByConnection
	}
}

export function readSession(): SerializedSession {
	if (typeof window === 'undefined') {
		return emptySession()
	}
	try {
		const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
		if (!raw) return emptySession()
		return deserializeTabs(JSON.parse(raw))
	} catch {
		return emptySession()
	}
}

export function writeSession(input: SessionInput): void {
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializeTabs(input)))
	} catch {
		// Best-effort: ignore quota/serialization errors.
	}
}
