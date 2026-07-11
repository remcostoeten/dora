/**
 * Curated HogQL queries powering the PostHog analytics dashboard. Each is built
 * from the active filters and runs over the read-only HogQL Query API via the
 * shared adapter's `executeQuery` (which, unlike table browsing, never appends
 * LIMIT/OFFSET — so these pass through verbatim and are safe with a personal
 * API key).
 */

/** A property the dashboard can drill into by clicking a row, bar, or slice. */
export type DrillKey = 'site' | 'event' | 'path' | 'browser' | 'referrer' | 'country' | 'device'

export type AnalyticsFilters = {
	excludeLocalhost: boolean
	/** Size of the reporting window, in days. */
	days: number
	/** Active drill-downs, e.g. `{ site: 'dora.dev', event: '$pageview' }`. */
	drills: Partial<Record<DrillKey, string>>
}

export const DAY_RANGES = [7, 14, 30, 90] as const

/** The HogQL expression each drill-down filters on. */
const DRILL_EXPRESSIONS: Record<DrillKey, string> = {
	site: 'properties.$host',
	event: 'event',
	path: 'properties.$current_url',
	browser: 'properties.$browser',
	referrer: 'properties.$referring_domain',
	country: 'properties.$geoip_country_name',
	device: 'properties.$device_type'
}

export const DRILL_LABELS: Record<DrillKey, string> = {
	site: 'Site',
	event: 'Event',
	path: 'Page',
	browser: 'Browser',
	referrer: 'Referrer',
	country: 'Country',
	device: 'Device'
}

const LOCALHOST_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']

/**
 * Escapes a value for a single-quoted HogQL string. Drill values come from row
 * data (hostnames, URLs, event names), so they are never interpolated raw.
 */
function quote(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * The WHERE clauses shared by every panel: the localhost cut plus one equality
 * per active drill-down. Returned without a leading `AND` so callers can append
 * it to their own time predicate.
 */
function filterPredicate(filters: AnalyticsFilters): string {
	const clauses: string[] = []

	if (filters.excludeLocalhost) {
		// `$host` carries the port (e.g. `localhost:3000`), so each pattern
		// matches as a prefix.
		for (const host of LOCALHOST_HOSTS) {
			clauses.push(`properties.$host NOT LIKE ${quote(`${host}%`)}`)
		}
	}

	for (const [key, value] of Object.entries(filters.drills)) {
		if (!value) continue
		clauses.push(`${DRILL_EXPRESSIONS[key as DrillKey]} = ${quote(value)}`)
	}

	return clauses.length === 0 ? '' : ` AND ${clauses.join(' AND ')}`
}

/** `SELECT … FROM events WHERE <window> <filters>` — the spine of every panel. */
function withinWindow(filters: AnalyticsFilters, extra = ''): string {
	return `WHERE timestamp > now() - INTERVAL ${filters.days} DAY${extra}${filterPredicate(filters)}`
}

/**
 * Headline counters for the window *and* the window immediately before it, so
 * each tile can show a period-over-period delta. Both halves come from one scan
 * of a double-length window: `countIf` splits current from previous, and
 * `count(DISTINCT if(…, NULL))` does the same for the distinct counters, since
 * ClickHouse's uniq ignores NULLs.
 */
export function kpiQuery(filters: AnalyticsFilters): string {
	const current = `timestamp > now() - INTERVAL ${filters.days} DAY`
	const previous = `timestamp <= now() - INTERVAL ${filters.days} DAY`

	return `
SELECT
  countIf(${current}) AS events,
  count(DISTINCT if(${current}, person_id, NULL)) AS users,
  countIf(event = '$pageview' AND ${current}) AS pageviews,
  count(DISTINCT if(${current}, properties.$session_id, NULL)) AS sessions,
  countIf(${previous}) AS prev_events,
  count(DISTINCT if(${previous}, person_id, NULL)) AS prev_users,
  countIf(event = '$pageview' AND ${previous}) AS prev_pageviews,
  count(DISTINCT if(${previous}, properties.$session_id, NULL)) AS prev_sessions
FROM events
WHERE timestamp > now() - INTERVAL ${filters.days * 2} DAY${filterPredicate(filters)}
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
${withinWindow(filters, " AND properties.$host != ''")}
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
${withinWindow(filters)}
GROUP BY day
ORDER BY day
`.trim()
}

/**
 * A generic "top values of one property" breakdown, shared by the events,
 * pages, browsers, referrers, countries, and devices panels.
 */
function breakdownQuery(
	filters: AnalyticsFilters,
	expression: string,
	limit: number,
	extra = ''
): string {
	return `
SELECT ${expression} AS label, count() AS count, count(DISTINCT person_id) AS users
FROM events
${withinWindow(filters, extra)}
GROUP BY label
ORDER BY count DESC
LIMIT ${limit}
`.trim()
}

export function topEventsQuery(filters: AnalyticsFilters): string {
	return breakdownQuery(filters, 'event', 12)
}

export function topPagesQuery(filters: AnalyticsFilters): string {
	return breakdownQuery(filters, 'properties.$current_url', 10, " AND event = '$pageview'")
}

export function topBrowsersQuery(filters: AnalyticsFilters): string {
	return breakdownQuery(filters, 'properties.$browser', 8, " AND properties.$browser != ''")
}

export function topReferrersQuery(filters: AnalyticsFilters): string {
	return breakdownQuery(filters, 'properties.$referring_domain', 10)
}

export function topCountriesQuery(filters: AnalyticsFilters): string {
	return breakdownQuery(filters, 'properties.$geoip_country_name', 10)
}

export function topDevicesQuery(filters: AnalyticsFilters): string {
	return breakdownQuery(filters, 'properties.$device_type', 6)
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

/**
 * Period-over-period change as a fraction (0.25 → +25%). `null` when there's no
 * previous baseline to compare against, so the UI can omit the delta instead of
 * claiming a meaningless +100%.
 */
export function percentChange(current: number, previous: number): number | null {
	if (previous === 0) return null
	return (current - previous) / previous
}
