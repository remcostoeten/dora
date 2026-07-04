/**
 * Curated HogQL queries powering the PostHog analytics dashboard. Each is built
 * from the active filters and runs over the read-only HogQL Query API via the
 * shared adapter's `executeQuery` (which, unlike table browsing, never appends
 * LIMIT/OFFSET — so these pass through verbatim and are safe with a personal
 * API key).
 */

export type AnalyticsFilters = {
	excludeLocalhost: boolean
}

const LOCALHOST_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']

/**
 * Extra WHERE predicate dropping local/dev traffic when enabled. `$host` carries
 * the port (e.g. `localhost:3000`), so each pattern matches as a prefix.
 */
function localhostPredicate(filters: AnalyticsFilters): string {
	if (!filters.excludeLocalhost) return ''
	const clauses = LOCALHOST_HOSTS.map(function (host) {
		return `properties.$host NOT LIKE '${host}%'`
	}).join(' AND ')
	return ` AND ${clauses}`
}

export function kpiQuery(filters: AnalyticsFilters): string {
	return `
SELECT
  count() AS events,
  count(DISTINCT person_id) AS users,
  countIf(event = '$pageview') AS pageviews
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY${localhostPredicate(filters)}
`.trim()
}

export function sitesQuery(filters: AnalyticsFilters): string {
	return `
SELECT
  properties.$host AS site,
  count() AS events,
  count(DISTINCT person_id) AS users,
  countIf(event = '$pageview') AS pageviews,
  max(timestamp) AS last_seen
FROM events
WHERE timestamp > now() - INTERVAL 30 DAY AND properties.$host != ''${localhostPredicate(filters)}
GROUP BY site
ORDER BY events DESC
LIMIT 30
`.trim()
}

export function activityQuery(filters: AnalyticsFilters): string {
	return `
SELECT
  toDate(timestamp) AS day,
  count() AS events,
  count(DISTINCT person_id) AS users
FROM events
WHERE timestamp > now() - INTERVAL 14 DAY${localhostPredicate(filters)}
GROUP BY day
ORDER BY day
`.trim()
}

export function topEventsQuery(filters: AnalyticsFilters): string {
	return `
SELECT event, count() AS count
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY${localhostPredicate(filters)}
GROUP BY event
ORDER BY count DESC
LIMIT 12
`.trim()
}

export function topPagesQuery(filters: AnalyticsFilters): string {
	return `
SELECT properties.$current_url AS url, count() AS views
FROM events
WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY${localhostPredicate(filters)}
GROUP BY url
ORDER BY views DESC
LIMIT 10
`.trim()
}

export function topBrowsersQuery(filters: AnalyticsFilters): string {
	return `
SELECT properties.$browser AS browser, count() AS count
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY AND properties.$browser != ''${localhostPredicate(filters)}
GROUP BY browser
ORDER BY count DESC
LIMIT 8
`.trim()
}

/** Coerces a HogQL cell (number or numeric string) into a finite number. */
export function toNumber(value: unknown): number {
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : 0
}

/** Coerces a HogQL cell into a display string, mapping empty/null to a label. */
export function toLabel(value: unknown, fallback: string): string {
	if (value === null || value === undefined) return fallback
	const text = String(value).trim()
	return text === '' || text === 'NULL' ? fallback : text
}
