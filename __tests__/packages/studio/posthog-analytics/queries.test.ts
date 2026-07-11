import { describe, expect, it } from 'vitest'
import {
	kpiQuery,
	percentChange,
	topEventsQuery,
	topPagesQuery,
	type AnalyticsFilters
} from '@studio/features/posthog-analytics/queries'

function filters(overrides: Partial<AnalyticsFilters> = {}): AnalyticsFilters {
	return { excludeLocalhost: false, days: 7, drills: {}, ...overrides }
}

describe('drill-down predicates', () => {
	it('filters on the property behind each drill key', () => {
		const sql = topEventsQuery(filters({ drills: { site: 'dora.dev', browser: 'Firefox' } }))
		expect(sql).toContain("properties.$host = 'dora.dev'")
		expect(sql).toContain("properties.$browser = 'Firefox'")
	})

	it('escapes quotes in drill values so row data cannot break out of the literal', () => {
		const sql = topPagesQuery(filters({ drills: { path: "https://x.dev/o'brien" } }))
		expect(sql).toContain("properties.$current_url = 'https://x.dev/o\\'brien'")
	})

	it('escapes backslashes before quotes', () => {
		const sql = topEventsQuery(filters({ drills: { event: 'back\\slash' } }))
		expect(sql).toContain("event = 'back\\\\slash'")
	})

	it('adds no predicate when no drills are active', () => {
		expect(topEventsQuery(filters())).not.toContain(' AND ')
	})
})

describe('reporting window', () => {
	it('uses the selected range', () => {
		expect(topEventsQuery(filters({ days: 30 }))).toContain('INTERVAL 30 DAY')
	})

	it('scans double the window so the previous period can be compared', () => {
		const sql = kpiQuery(filters({ days: 14 }))
		expect(sql).toContain('INTERVAL 28 DAY')
		expect(sql).toContain('AS prev_events')
	})

	it('excludes localhost across all its hostname spellings when enabled', () => {
		const sql = topEventsQuery(filters({ excludeLocalhost: true }))
		expect(sql).toContain("properties.$host NOT LIKE 'localhost%'")
		expect(sql).toContain("properties.$host NOT LIKE '127.0.0.1%'")
	})
})

describe('percentChange', () => {
	it('reports growth and decline as a fraction', () => {
		expect(percentChange(150, 100)).toBeCloseTo(0.5)
		expect(percentChange(50, 100)).toBeCloseTo(-0.5)
	})

	it('has no baseline to compare against when the previous period is empty', () => {
		expect(percentChange(10, 0)).toBeNull()
	})
})
