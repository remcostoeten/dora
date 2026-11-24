import { describeConnectionSource } from '@studio/features/connections/resolve-source'
import {
	resolveProviderLabel,
	resolveSourceKindBadge,
	shouldShowSourceKindBadge
} from '@studio/features/connections/source-labels'
import { writeStorageItem } from '@studio/shared/lib/safe-storage'
import { noop } from '@studio/shared/utils/noop'
import { getTableRefParts } from '@studio/shared/utils/table-ref'
import { selectActiveTab, selectTableSnapshot } from './selectors'
import { tabsForConnection } from './slices/tabs'
import { workspaceStore } from './store'
import type { WorkspaceState } from './types'

export const SPLASH_STORAGE_KEY = 'dora.splash.v1'

const MAX_TABLES = 16
const MAX_TABS = 6
const MAX_COLUMNS = 12
const WRITE_DEBOUNCE_MS = 500

const COLOR_TOKENS = {
	background: '--background',
	foreground: '--foreground',
	card: '--card',
	muted: '--muted',
	mutedForeground: '--muted-foreground',
	border: '--border',
	primary: '--primary',
	primaryForeground: '--primary-foreground',
	sidebarAccent: '--sidebar-accent',
	sidebarForeground: '--sidebar-foreground'
} as const

export type SplashColors = Record<keyof typeof COLOR_TOKENS, string>

export type SplashSnapshot = {
	v: 1
	view: string
	colors: SplashColors
	connection: { name: string; provider: string; kind: string | null }
	tables: { name: string; count: number | null }[]
	activeTable: string
	tabs: { label: string; active: boolean }[]
	columns: { name: string; type: string; primaryKey: boolean }[]
}

let enabled = false
let unsubscribe: (() => void) | null = null
let writeTimer: ReturnType<typeof setTimeout> | null = null
let lastWritten: string | null = null
let themeColors: { theme: string; colors: SplashColors } | null = null

function storage(): Storage | null {
	try {
		return typeof window === 'undefined' ? null : window.localStorage
	} catch {
		return null
	}
}

/**
 * @name readSplashColors
 * @description Resolves the active theme's tokens to concrete rgb strings by
 * asking the browser to compute `hsl(var(--token))`, so custom and hue-shifted
 * themes are captured exactly as they render. Returns null when any token does
 * not resolve to an rgb color.
 *
 * @example
 * const colors = readSplashColors()
 * if (colors) buildSplashSnapshot(state, colors)
 */
export function readSplashColors(): SplashColors | null {
	if (typeof document === 'undefined') return null
	const probe = document.createElement('div')
	probe.style.display = 'none'
	document.documentElement.appendChild(probe)
	try {
		const colors: Partial<SplashColors> = {}
		for (const key of Object.keys(COLOR_TOKENS) as (keyof typeof COLOR_TOKENS)[]) {
			probe.style.color = ''
			probe.style.color = `hsl(var(${COLOR_TOKENS[key]}))`
			const resolved = getComputedStyle(probe).color
			if (!/^rgba?\(/.test(resolved)) return null
			colors[key] = resolved
		}
		return colors as SplashColors
	} finally {
		probe.remove()
	}
}

/**
 * @name buildSplashSnapshot
 * @description Reduces the workspace store to the payload the boot splash
 * renders: the active connection, its tables in the active table's schema, the
 * open tabs, and the active table's column headers. Returns null when there is
 * no active connection, which makes the next launch fall back to the logo.
 *
 * @example
 * const snapshot = buildSplashSnapshot(workspaceStore.getState(), colors)
 */
export function buildSplashSnapshot(
	state: WorkspaceState,
	colors: SplashColors
): SplashSnapshot | null {
	const connectionId = state.tabs.activeConnectionId
	const connection = state.connections.byId[connectionId]
	if (!connection) return null

	const activeTab = selectActiveTab(state)
	const activeSchema = activeTab ? getTableRefParts(activeTab.tableId).schemaName : null
	const schema = state.schemas.byConnectionId[connectionId]?.schema
	const schemaTables = schema?.tables ?? []
	const scopedTables = activeSchema
		? schemaTables.filter((table) => table.schema === activeSchema)
		: schemaTables
	const listedTables = scopedTables.length > 0 ? scopedTables : schemaTables

	const snapshot = activeTab
		? selectTableSnapshot(state, connectionId, activeTab.tableId)
		: undefined
	const schemaTable = activeTab
		? schemaTables.find(
				(table) =>
					table.name === activeTab.tableName &&
					(!activeSchema || table.schema === activeSchema)
			)
		: undefined
	const columns = snapshot
		? snapshot.columns.map((column) => ({
				name: column.name,
				type: column.type,
				primaryKey: column.primaryKey
			}))
		: (schemaTable?.columns ?? []).map((column) => ({
				name: column.name,
				type: column.data_type,
				primaryKey: column.is_primary_key === true
			}))

	const meta = describeConnectionSource(connection)
	const activeTabId = activeTab?.id ?? null

	return {
		v: 1,
		view: state.uiChrome.activeNavId,
		colors,
		connection: {
			name: connection.name,
			provider: resolveProviderLabel(meta),
			kind: shouldShowSourceKindBadge(meta) ? resolveSourceKindBadge(meta) : null
		},
		tables: listedTables.slice(0, MAX_TABLES).map((table) => ({
			name: table.name,
			count: typeof table.row_count_estimate === 'number' ? table.row_count_estimate : null
		})),
		activeTable: activeTab?.tableName ?? '',
		tabs: tabsForConnection(state.tabs.tabs, connectionId)
			.slice(0, MAX_TABS)
			.map((tab) => ({ label: tab.label, active: tab.id === activeTabId })),
		columns: columns.slice(0, MAX_COLUMNS)
	}
}

function themeSignature(): string {
	const root = document.documentElement
	return `${root.className}|${root.getAttribute('style') ?? ''}`
}

function readThemeColors(): SplashColors | null {
	if (typeof document === 'undefined') return null
	const theme = themeSignature()
	if (themeColors?.theme === theme) return themeColors.colors
	const colors = readSplashColors()
	themeColors = colors ? { theme, colors } : null
	return colors
}

function clearStored(): void {
	const store = storage()
	if (!store) return
	try {
		store.removeItem(SPLASH_STORAGE_KEY)
	} catch {
		noop()
	}
	lastWritten = null
}

function writeNow(): void {
	if (!storage()) return
	const colors = readThemeColors()
	const snapshot = colors ? buildSplashSnapshot(workspaceStore.getState(), colors) : null
	if (!snapshot) {
		if (lastWritten !== null) clearStored()
		return
	}
	const serialized = JSON.stringify(snapshot)
	if (serialized === lastWritten) return
	if (writeStorageItem(SPLASH_STORAGE_KEY, serialized, { label: 'launch splash' }) === 'ok') {
		lastWritten = serialized
	}
}

function scheduleWrite(): void {
	if (writeTimer) clearTimeout(writeTimer)
	writeTimer = setTimeout(function flushSplashMirror() {
		writeTimer = null
		writeNow()
	}, WRITE_DEBOUNCE_MS)
}

function flushPendingWrite(): void {
	if (writeTimer) {
		clearTimeout(writeTimer)
		writeTimer = null
	}
	writeNow()
}

function onVisibilityChange(): void {
	if (document.visibilityState === 'hidden') flushPendingWrite()
}

function addFlushListeners(): void {
	if (typeof window === 'undefined') return
	window.addEventListener('pagehide', flushPendingWrite)
	document.addEventListener('visibilitychange', onVisibilityChange)
}

function removeFlushListeners(): void {
	if (typeof window === 'undefined') return
	window.removeEventListener('pagehide', flushPendingWrite)
	document.removeEventListener('visibilitychange', onVisibilityChange)
}

/**
 * @name configureSplashSnapshot
 * @description Turns the splash mirror on or off. Idempotent. Turning it off
 * stops writes and removes the stored payload.
 *
 * @example
 * configureSplashSnapshot(settings.persistTableSnapshots && !settings.privacyMaskData)
 */
export function configureSplashSnapshot(nextEnabled: boolean): void {
	if (nextEnabled === enabled) return
	enabled = nextEnabled

	if (!enabled) {
		unsubscribe?.()
		unsubscribe = null
		if (writeTimer) {
			clearTimeout(writeTimer)
			writeTimer = null
		}
		removeFlushListeners()
		clearStored()
		themeColors = null
		return
	}

	unsubscribe = workspaceStore.subscribe(scheduleWrite)
	addFlushListeners()
	scheduleWrite()
}
