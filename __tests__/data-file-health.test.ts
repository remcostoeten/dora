import {
	DATA_FILE_HELP_ITEMS,
	dataFileHealthLabel,
	formatDataFileSourceSummary,
	resolveDataFileHealth
} from '@studio/features/connections/data-file-health'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import { describe, expect, it } from 'vitest'

function entry(path: string, status: DataFileSourceEntry['status']): DataFileSourceEntry {
	return {
		path,
		viewName: 'view',
		fileType: 'CSV',
		status,
		error: status === 'active' ? null : 'Source unavailable'
	}
}

describe('data-file health', function () {
	it('reports active when every source is registered', function () {
		const entries = [entry('/tmp/a.csv', 'active'), entry('/tmp/b.csv', 'active')]

		expect(resolveDataFileHealth({ entries, connectionStatus: 'connected' })).toBe('active')
		expect(dataFileHealthLabel('active')).toBe('Active')
	})

	it('reports connected with issues when some sources are missing or failed', function () {
		const entries = [
			entry('/tmp/a.csv', 'active'),
			entry('/tmp/b.csv', 'missing'),
			entry('/tmp/c.csv', 'failed')
		]

		expect(resolveDataFileHealth({ entries, connectionStatus: 'connected' })).toBe(
			'connected-with-issues'
		)
		expect(dataFileHealthLabel('connected-with-issues')).toBe('Connected with issues')
	})

	it('reports unavailable when the connection failed or no sources are active', function () {
		const entries = [entry('/tmp/a.csv', 'missing'), entry('/tmp/b.csv', 'failed')]

		expect(resolveDataFileHealth({ entries, connectionStatus: 'connected' })).toBe(
			'unavailable'
		)
		expect(
			resolveDataFileHealth({
				entries: [entry('/tmp/a.csv', 'active')],
				connectionStatus: 'error'
			})
		).toBe('unavailable')
		expect(dataFileHealthLabel('unavailable')).toBe('Unavailable')
	})

	it('returns null health until backend entries are loaded', function () {
		expect(resolveDataFileHealth({ entries: null, connectionStatus: 'connected' })).toBe(null)
		expect(resolveDataFileHealth({ entries: [], connectionStatus: 'connected' })).toBe(null)
	})
})

describe('data-file source summary', function () {
	it('formats healthy multi-file sessions', function () {
		const entries = [entry('/tmp/a.csv', 'active'), entry('/tmp/b.csv', 'active')]

		expect(formatDataFileSourceSummary(entries, ['/tmp/a.csv', '/tmp/b.csv'])).toBe(
			'Data files · 2 files'
		)
		expect(formatDataFileSourceSummary(entries, undefined)).toBe('Data files · 2 files')
	})

	it('formats partial sessions with active and missing counts', function () {
		const entries = [
			entry('/tmp/a.csv', 'active'),
			entry('/tmp/b.csv', 'active'),
			entry('/tmp/c.csv', 'missing')
		]

		expect(formatDataFileSourceSummary(entries, undefined)).toBe(
			'Data files · 2 active, 1 missing'
		)
	})

	it('falls back to path counts when backend entries are unavailable', function () {
		expect(formatDataFileSourceSummary(null, ['/tmp/a.csv', '/tmp/b.csv', '/tmp/c.csv'])).toBe(
			'Data files · 3 files'
		)
		expect(formatDataFileSourceSummary(undefined, ['/tmp/a.csv'])).toBe('Data files · 1 file')
		expect(formatDataFileSourceSummary(null, [])).toBe('Data files · Local')
	})
})

describe('data-file help items', function () {
	it('describes the data-file model', function () {
		expect(DATA_FILE_HELP_ITEMS).toHaveLength(5)
		expect(DATA_FILE_HELP_ITEMS[0]).toContain('SQLite and DuckDB')
		expect(DATA_FILE_HELP_ITEMS[1]).toContain('readonly data files')
	})
})
