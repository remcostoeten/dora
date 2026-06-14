import {
	listDataFileEntries,
	viewNameForPath,
} from '@studio/features/connections/utils/data-file-views'
import { describe, expect, it } from 'vitest'

describe('data-file-views', function () {
	it('derives SQL-safe view names and deduplicates collisions', function () {
		const taken = new Set<string>()
		const first = viewNameForPath('/data/My Sales-2024.csv', taken)
		taken.add(first)
		const second = viewNameForPath('/other/My Sales-2024.csv', taken)
		taken.add(second)

		expect(first).toBe('my_sales_2024')
		expect(second).toBe('my_sales_2024_2')
		expect(viewNameForPath('/x/123.csv', taken)).toBe('t_123')
	})

	it('lists data file entries with friendly file types', function () {
		const entries = listDataFileEntries([
			'/tmp/sales.csv',
			'/tmp/events.json',
			'/tmp/metrics.parquet',
		])

		expect(entries).toHaveLength(3)
		expect(entries[0]).toMatchObject({
			path: '/tmp/sales.csv',
			fileType: 'CSV',
			viewName: 'sales',
		})
		expect(entries[1]).toMatchObject({
			path: '/tmp/events.json',
			fileType: 'JSON',
			viewName: 'events',
		})
		expect(entries[2]).toMatchObject({
			path: '/tmp/metrics.parquet',
			fileType: 'Parquet',
			viewName: 'metrics',
		})
	})
})
