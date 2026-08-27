export const QUERY_POLL_INTERVAL_MS = 100
export const QUERY_POLL_INITIAL_MS = 20

/**
 * Poll delay backoff: 20 → 40 → 80 → 100 → 100… A fixed 100ms start added up
 * to ~100ms of pure waiting on every fast local query; backing off keeps the
 * fast path fast without hammering the backend on slow queries.
 */
export function nextPollDelay(previous: number): number {
	return Math.min(previous * 2, QUERY_POLL_INTERVAL_MS)
}
