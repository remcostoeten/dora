import { NextResponse } from 'next/server'
import { queryHogql } from '@/lib/posthog-server'

// Powers the analytics feature showcase with real numbers from this site's
// own PostHog project — the marketing site becomes its own demo. Returns
// `{ unavailable: true }` when the project isn't configured for querying
// (no POSTHOG_PROJECT_ID / POSTHOG_PERSONAL_API_KEY) so the client falls
// back to static copy instead of erroring.

// A showcase that boasts "2 events / 1 visitor" argues against the product it
// is selling, so hold the static copy until the numbers are worth showing.
// The card upgrades itself once real traffic clears this bar.
const MIN_EVENTS_TO_SHOW = 100

export async function GET() {
	const [events, visitors] = await Promise.all([
		queryHogql('SELECT count() FROM events WHERE timestamp > now() - INTERVAL 7 DAY'),
		queryHogql(
			'SELECT count(DISTINCT person_id) FROM events WHERE timestamp > now() - INTERVAL 7 DAY'
		)
	])

	const eventsCount = events?.rows[0]?.[0]
	const visitorsCount = visitors?.rows[0]?.[0]

	if (typeof eventsCount !== 'number' || typeof visitorsCount !== 'number') {
		return NextResponse.json({ unavailable: true })
	}

	if (eventsCount < MIN_EVENTS_TO_SHOW) {
		return NextResponse.json({ unavailable: true })
	}

	return NextResponse.json({
		unavailable: false,
		events: eventsCount,
		visitors: visitorsCount
	})
}
