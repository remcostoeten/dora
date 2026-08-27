import {
	DEFAULT_QUERY_SIGNATURE,
	snapshotQuerySignature
} from '@studio/features/database-studio/utils/table-snapshot'
import { noop } from '@studio/shared/utils/noop'
import { putTableSnapshot } from './actions'
import { workspaceStore } from './store'
import { readBootstrappedSettings } from './bootstrap'
import type { TableSnapshot } from './types'

/**
 * Disk mirror for default-page table snapshots.
 *
 * The in-memory snapshot slice is what makes a table switch paint instantly;
 * this module extends that across app restarts by mirroring the default-page
 * snapshots (first page, no sort, no filters) to localStorage and hydrating
 * them back at boot. Because it mirrors the store, every existing
 * `dropTableSnapshot` / `clearTableSnapshots` propagates to disk for free.
 *
 * Privacy: row values land on disk in plaintext, so the mirror is a settings
 * toggle (`persistTableSnapshots`, default on) and is force-disabled — with
 * the stored key cleared — whenever `privacyMaskData` is on.
 */
const STORAGE_KEY = 'dora.table-snapshots.v1'
const MAX_ENTRIES = 20
const MAX_BYTES = 2_000_000
const WRITE_DEBOUNCE_MS = 500

let enabled = false
let unsubscribe: (() => void) | null = null
let writeTimer: ReturnType<typeof setTimeout> | null = null
let lastWritten: string | null = null

function storage(): Storage | null {
	try {
		return typeof window === 'undefined' ? null : window.localStorage
	} catch {
		return null
	}
}

function isDefaultPageSnapshot(snapshot: TableSnapshot): boolean {
	return snapshotQuerySignature(snapshot) === DEFAULT_QUERY_SIGNATURE
}

function serializeSnapshots(): string | null {
	const byKey = workspaceStore.getState().tableSnapshots.byKey
	const entries = Object.values(byKey)
		.filter(isDefaultPageSnapshot)
		.sort((a, b) => b.fetchedAt - a.fetchedAt)
		.slice(0, MAX_ENTRIES)

	let serialized = JSON.stringify(entries)
	let kept = entries.length
	while (serialized.length > MAX_BYTES && kept > 0) {
		kept -= 1
		serialized = JSON.stringify(entries.slice(0, kept))
	}
	return serialized.length > MAX_BYTES ? null : serialized
}

function writeNow(): void {
	const store = storage()
	if (!store) return
	const serialized = serializeSnapshots()
	if (serialized === null || serialized === lastWritten) return
	try {
		store.setItem(STORAGE_KEY, serialized)
		lastWritten = serialized
	} catch {
		noop()
	}
}

function scheduleWrite(): void {
	if (writeTimer) clearTimeout(writeTimer)
	writeTimer = setTimeout(function flushSnapshotMirror() {
		writeTimer = null
		writeNow()
	}, WRITE_DEBOUNCE_MS)
}

function isPersistedSnapshot(value: unknown): value is TableSnapshot {
	if (typeof value !== 'object' || value === null) return false
	const snapshot = value as Record<string, unknown>
	return (
		typeof snapshot.connectionId === 'string' &&
		typeof snapshot.tableId === 'string' &&
		Array.isArray(snapshot.columns) &&
		Array.isArray(snapshot.rows) &&
		typeof snapshot.totalCount === 'number' &&
		Array.isArray(snapshot.visibleColumns) &&
		typeof snapshot.offset === 'number' &&
		typeof snapshot.limit === 'number' &&
		typeof snapshot.fetchedAt === 'number'
	)
}

function hydrate(): void {
	const store = storage()
	if (!store) return
	try {
		const raw = store.getItem(STORAGE_KEY)
		if (!raw) return
		const parsed: unknown = JSON.parse(raw)
		if (!Array.isArray(parsed)) return
		for (const entry of parsed) {
			if (isPersistedSnapshot(entry) && isDefaultPageSnapshot(entry)) {
				putTableSnapshot(entry)
			}
		}
		lastWritten = raw
	} catch {
		noop()
	}
}

function clearStored(): void {
	const store = storage()
	if (!store) return
	try {
		store.removeItem(STORAGE_KEY)
	} catch {
		noop()
	}
	lastWritten = null
}

/**
 * Turns the mirror on or off. Idempotent; safe to call from a settings effect
 * on every change. Turning it off removes the stored data.
 */
export function configureTableSnapshotPersistence(nextEnabled: boolean): void {
	if (nextEnabled === enabled) return
	enabled = nextEnabled

	if (!enabled) {
		unsubscribe?.()
		unsubscribe = null
		if (writeTimer) {
			clearTimeout(writeTimer)
			writeTimer = null
		}
		clearStored()
		return
	}

	// Hydrate before subscribing so the initial (possibly empty) store state
	// cannot clobber what the last session persisted.
	hydrate()
	unsubscribe = workspaceStore.subscribe(scheduleWrite)
}

/**
 * Boot-path entry: resolves the two gating settings from the bootstrapped
 * settings document (or the browser-mode localStorage fallback) without
 * waiting for React. The settings provider re-configures on live toggles.
 */
export function initTableSnapshotPersistence(): void {
	let persist = true
	let mask = false
	try {
		const doc = readBootstrappedSettings() ?? storage()?.getItem('ui_settings') ?? null
		if (doc) {
			const parsed: unknown = JSON.parse(doc)
			if (typeof parsed === 'object' && parsed !== null) {
				const settings = parsed as Record<string, unknown>
				if (typeof settings.persistTableSnapshots === 'boolean') {
					persist = settings.persistTableSnapshots
				}
				if (typeof settings.privacyMaskData === 'boolean') {
					mask = settings.privacyMaskData
				}
			}
		}
	} catch {
		noop()
	}
	configureTableSnapshotPersistence(persist && !mask)
}
