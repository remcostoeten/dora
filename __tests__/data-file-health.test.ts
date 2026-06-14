import {
	buildConnectionFromDataFiles,
	buildConnectionFromDatabaseFile,
} from '@studio/features/connections/utils/data-files'
import { describeConnectionSource } from '@studio/features/connections/resolve-source'
import {
	DATA_FILE_HELP_ITEMS,
	dataFileHealthLabel,
	formatDataFileSourceSummary,
	resolveDataFileHealth,
	shouldShowDataFileHelpPanel,
} from '@studio/features/connections/data-file-health'
import type { DataFileSourceEntry } from '@studio/features/connections/types/data-file-source'
import type { Connection } from '@studio/features/connections/types'
import { describe, expect, it } from 'vitest'

function entry(
	path: string,
	status: DataFileSourceEntry['status']
): DataFileSourceEntry {
	return {
		path,
		viewName: 'view',
		fileType: 'CSV',
		status,
		error: status === 'active' ? null : 'Source unavailable',
	}
}

function connection(overrides: Partial<Connection> & Pick<Connection, 'type'>): Connection {
	return {
		id: 'test-id',
		name: 'Test',
		createdAt: 0,
		...overrides,
	}
}

describe('data-file health', function () {
	it('reports active when every source is registered', function () {
		const entries = [entry('/tmp/a.csv', 'active'), entry('/tmp/b.csv', 'active')]

		expect(
			resolveDataFileHealth({ entries, connectionStatus: 'connected' })
		).toBe('active')
		expect(dataFileHealthLabel('active')).toBe('Active')
	})

	it('reports connected with issues when some sources are missing or failed', function () {
		const entries = [
			entry('/tmp/a.csv', 'active'),
			entry('/tmp/b.csv', 'missing'),
			entry('/tmp/c.csv', 'failed'),
		]

		expect(
			resolveDataFileHealth({ entries, connectionStatus: 'connected' })
		).toBe('connected-with-issues')
		expect(dataFileHealthLabel('connected-with-issues')).toBe('Connected with issues')
	})

	it('reports unavailable when the connection failed or no sources are active', function () {
		const entries = [entry('/tmp/a.csv', 'missing'), entry('/tmp/b.csv', 'failed')]

		expect(
			resolveDataFileHealth({ entries, connectionStatus: 'connected' })
		).toBe('unavailable')
		expect(
			resolveDataFileHealth({
				entries: [entry('/tmp/a.csv', 'active')],
				connectionStatus: 'error',
			})
		).toBe('unavailable')
		expect(dataFileHealthLabel('unavailable')).toBe('Unavailable')
	})

	it('returns null health until backend entries are loaded', function () {
		expect(resolveDataFileHealth({ entries: null, connectionStatus: 'connected' })).toBe(
			null
		)
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
			entry('/tmp/c.csv', 'missing'),
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

describe('data-file help panel visibility', function () {
	it('shows help only for data-file sessions', function () {
		const dataFileMeta = describeConnectionSource(
			connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))
		)
		const duckdbMeta = describeConnectionSource(
			connection(buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb'))
		)
		const postgresMeta = describeConnectionSource(
			connection({ type: 'postgres', host: 'localhost', database: 'app' })
		)

		expect(shouldShowDataFileHelpPanel(dataFileMeta)).toBe(true)
		expect(shouldShowDataFileHelpPanel(duckdbMeta)).toBe(false)
		expect(shouldShowDataFileHelpPanel(postgresMeta)).toBe(false)
		expect(DATA_FILE_HELP_ITEMS).toHaveLength(5)
		expect(DATA_FILE_HELP_ITEMS[0]).toContain('SQLite and DuckDB')
		expect(DATA_FILE_HELP_ITEMS[1]).toContain('readonly data files')
	})
})
