/**
 * localStorage access that never throws and never spams.
 *
 * Browsers surface a full storage quota as a thrown `QuotaExceededError` on
 * every single write. Stores that persist on each keystroke (query tabs, chat
 * threads, history) therefore turned one full disk into hundreds of identical
 * stack traces, and any store that persisted inside a React event handler took
 * the whole interaction down with it.
 *
 * These helpers swallow the throw, report a given key at most once per session,
 * and give callers a way to shrink their payload and retry instead of silently
 * dropping the write.
 */

export type WriteOutcome = 'ok' | 'compacted' | 'failed'

type WriteOptions = {
	/**
	 * Produces a smaller payload after a quota failure. Called with a 1-based
	 * attempt number and retried until it returns null (nothing left to drop).
	 */
	compact?: (attempt: number) => string | null
	/** Human-readable name for the data, used in the one-time report. */
	label?: string
}

type QuotaListener = (info: { key: string; label: string; recovered: boolean }) => void

const MAX_COMPACT_ATTEMPTS = 3

const reportedKeys = new Set<string>()
const quotaListeners = new Set<QuotaListener>()

/**
 * Duck-typed rather than `instanceof DOMException`: the error can cross a realm
 * (iframe, test environment) where the constructor identity no longer matches.
 */
export function isQuotaExceededError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false
	const { name, code } = error as { name?: unknown; code?: unknown }
	return (
		name === 'QuotaExceededError' ||
		name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
		code === 22 ||
		code === 1014
	)
}

function getStorage(): Storage | null {
	try {
		return typeof window === 'undefined' ? null : window.localStorage
	} catch {
		return null
	}
}

function reportOnce(key: string, label: string, recovered: boolean): void {
	if (reportedKeys.has(key)) return
	reportedKeys.add(key)

	if (recovered) {
		console.warn(
			`[storage] Local storage is full — trimmed older ${label} to make room. Further trims are silent.`
		)
	} else {
		console.warn(
			`[storage] Local storage is full — ${label} will not be saved this session. Clear query history or AI chats to free space.`
		)
	}

	quotaListeners.forEach(function (listener) {
		listener({ key, label, recovered })
	})
}

/**
 * Subscribes to the first quota failure per storage key. Used by the app shell
 * to raise a single toast instead of leaving persistence to fail silently.
 */
export function subscribeToStorageQuota(listener: QuotaListener): () => void {
	quotaListeners.add(listener)
	return function unsubscribe() {
		quotaListeners.delete(listener)
	}
}

export function readStorageItem(key: string): string | null {
	const storage = getStorage()
	if (!storage) return null
	try {
		return storage.getItem(key)
	} catch (error) {
		console.warn(`[storage] Could not read "${key}":`, error)
		return null
	}
}

export function removeStorageItem(key: string): void {
	const storage = getStorage()
	if (!storage) return
	try {
		storage.removeItem(key)
	} catch (error) {
		console.warn(`[storage] Could not remove "${key}":`, error)
	}
}

/**
 * Writes a value, shrinking it via `compact` when the quota is hit. Returns
 * what actually happened so callers can keep their in-memory state honest.
 */
export function writeStorageItem(
	key: string,
	value: string,
	options: WriteOptions = {}
): WriteOutcome {
	const storage = getStorage()
	if (!storage) return 'failed'

	const label = options.label ?? key

	try {
		storage.setItem(key, value)
		return 'ok'
	} catch (error) {
		if (!isQuotaExceededError(error)) {
			console.warn(`[storage] Could not save ${label}:`, error)
			return 'failed'
		}
	}

	// Reclaiming this key's own space first often makes room for the new value.
	removeStorageItem(key)

	for (let attempt = 0; attempt <= MAX_COMPACT_ATTEMPTS; attempt++) {
		const payload = attempt === 0 ? value : (options.compact?.(attempt) ?? null)
		if (payload === null) break
		try {
			storage.setItem(key, payload)
			const recovered = attempt > 0
			if (recovered) reportOnce(key, label, true)
			return recovered ? 'compacted' : 'ok'
		} catch (error) {
			if (!isQuotaExceededError(error)) {
				console.warn(`[storage] Could not save ${label}:`, error)
				return 'failed'
			}
		}
	}

	reportOnce(key, label, false)
	return 'failed'
}

/** Test seam: forgets which keys have already been reported. */
export function resetStorageQuotaReports(): void {
	reportedKeys.clear()
}
