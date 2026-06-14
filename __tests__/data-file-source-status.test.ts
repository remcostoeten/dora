import {
	buildConnectionFromDataFiles,
} from '@studio/features/connections/utils/data-files'
import {
	dataFileSourceStatusLabel,
	hasActiveDataFileSources,
	isActiveDataFileSource,
} from '@studio/features/connections/types/data-file-source'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import { listDataFileEntries } from '@studio/features/connections/utils/data-file-views'
import { describe, expect, it } from 'vitest'

describe('data-file source status helpers', function () {
	it('labels active, missing, and failed statuses', function () {
		expect(dataFileSourceStatusLabel('active')).toBe('Active')
		expect(dataFileSourceStatusLabel('missing')).toBe('Missing')
		expect(dataFileSourceStatusLabel('failed')).toBe('Failed')
	})

	it('detects when at least one source is active', function () {
		const entries: DataFileSourceEntry[] = [
			{
				path: '/tmp/a.csv',
				viewName: 'a',
				fileType: 'CSV',
				status: 'active',
				error: null,
			},
			{
				path: '/tmp/b.csv',
				viewName: 'b',
				fileType: 'CSV',
				status: 'missing',
				error: 'File not found',
			},
		]

		expect(hasActiveDataFileSources(entries)).toBe(true)
		expect(isActiveDataFileSource(entries[0])).toBe(true)
		expect(isActiveDataFileSource(entries[1])).toBe(false)
	})

	it('falls back to client view names when backend entries are unavailable', function () {
		const paths = buildConnectionFromDataFiles(['/tmp/sales.csv', '/tmp/events.json']).fileSources ?? []
		const guessed = listDataFileEntries(paths)

		expect(guessed).toHaveLength(2)
		expect(guessed[0].viewName).toBe('sales')
		expect(guessed[1].viewName).toBe('events')
	})

	it('keeps duplicate stems stable in fallback view names', function () {
		const guessed = listDataFileEntries([
			'/data/My Sales-2024.csv',
			'/other/My Sales-2024.csv',
		])

		expect(guessed[0].viewName).toBe('my_sales_2024')
		expect(guessed[1].viewName).toBe('my_sales_2024_2')
	})
})
