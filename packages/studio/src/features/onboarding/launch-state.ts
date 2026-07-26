const LAUNCH_COUNT_KEY = 'dora_launch_count'
const TOUR_COMPLETED_KEY = 'dora_onboarding_tour_completed'

/**
 * Launches within which the tour keeps offering itself when it was neither
 * completed nor skipped (e.g. the user closed the app mid-first-run). After
 * that it never appears again on its own.
 */
const TOUR_OFFER_LAUNCH_LIMIT = 3

function safeStorage(storage?: Storage): Storage | null {
	if (storage) return storage
	try {
		return window.localStorage
	} catch {
		return null
	}
}

/**
 * Increments and returns the launch counter. Call exactly once per app
 * session; the counter (rather than a boolean) leaves room to gate other
 * "first N launches" behavior later.
 */
export function recordLaunch(storage?: Storage): number {
	const store = safeStorage(storage)
	if (!store) return 0
	const current = Number.parseInt(store.getItem(LAUNCH_COUNT_KEY) ?? '0', 10)
	const next = (Number.isFinite(current) && current >= 0 ? current : 0) + 1
	store.setItem(LAUNCH_COUNT_KEY, String(next))
	return next
}

export function isTourCompleted(storage?: Storage): boolean {
	const store = safeStorage(storage)
	return store?.getItem(TOUR_COMPLETED_KEY) === '1'
}

export function markTourCompleted(storage?: Storage): void {
	safeStorage(storage)?.setItem(TOUR_COMPLETED_KEY, '1')
}

export function shouldShowTour(launchCount: number, storage?: Storage): boolean {
	if (isTourCompleted(storage)) return false
	return launchCount >= 1 && launchCount <= TOUR_OFFER_LAUNCH_LIMIT
}
