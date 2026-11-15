import { noop } from '@studio/shared/utils/noop'

const FLUSH_DELAY_MS = 250
const RETRY_DELAY_MS = 2000

const pending = new Map<string, string | null>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let isListeningForExit = false

function hasWindow(): boolean {
	return typeof window !== 'undefined'
}

function scheduleFlush(delayMs: number): void {
	if (flushTimer) clearTimeout(flushTimer)
	flushTimer = setTimeout(flushUrlParams, delayMs)
}

function listenForExit(): void {
	if (isListeningForExit) return
	isListeningForExit = true
	window.addEventListener('pagehide', flushUrlParams)
}

/**
 * @name readUrlParam
 * @description Reads one query parameter from the address bar. A value passed
 * to `writeUrlParams` that has not been flushed yet wins over the address bar,
 * so a read after a write always sees the write.
 *
 * @example
 * const view = readUrlParam('view')
 */
export function readUrlParam(name: string): string | null {
	if (!hasWindow()) return null
	if (pending.has(name)) return pending.get(name) ?? null
	return new URLSearchParams(window.location.search).get(name)
}

/**
 * @name writeUrlParams
 * @description Merges query parameters into the address bar without going
 * through React Router, so no router consumer re-renders. `null` removes a
 * parameter. Writes are coalesced and applied with one `replaceState` after the
 * interaction that caused them has painted.
 *
 * @example
 * writeUrlParams({ table: 'public.users', selectedRow: null })
 */
export function writeUrlParams(patch: Record<string, string | null>): void {
	if (!hasWindow()) return
	let changed = false
	for (const [name, value] of Object.entries(patch)) {
		if (readUrlParam(name) === value) continue
		pending.set(name, value)
		changed = true
	}
	if (!changed) return
	listenForExit()
	scheduleFlush(FLUSH_DELAY_MS)
}

/**
 * @name flushUrlParams
 * @description Applies every pending `writeUrlParams` change to the address bar
 * now. Called on a timer and when the page is hidden; tests call it to assert
 * on `window.location`.
 *
 * @example
 * writeUrlParams({ view: 'sql-console' })
 * flushUrlParams()
 */
export function flushUrlParams(): void {
	if (flushTimer) {
		clearTimeout(flushTimer)
		flushTimer = null
	}
	if (!hasWindow() || pending.size === 0) return

	const params = new URLSearchParams(window.location.search)
	for (const [name, value] of pending) {
		if (value === null) params.delete(name)
		else params.set(name, value)
	}
	const search = params.toString()
	const current = window.location.search.replace(/^\?/, '')
	if (search === current) {
		pending.clear()
		return
	}

	const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
	try {
		window.history.replaceState(window.history.state, '', url)
		pending.clear()
	} catch {
		// WebKit throws once replaceState is called too often; keep the pending values and retry.
		noop()
		scheduleFlush(RETRY_DELAY_MS)
	}
}
