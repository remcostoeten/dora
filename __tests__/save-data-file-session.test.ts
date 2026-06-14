import {
	buildConnectionFromDataFiles,
	buildConnectionFromDatabaseFile,
} from '@studio/features/connections/utils/data-files'
import { getSourceCaps } from '@studio/features/connections/source-caps'
import { describeConnectionSource } from '@studio/features/connections/resolve-source'
import type { Connection } from '@studio/features/connections/types'
import {
	buildSavedDuckDbConnectionPayload,
	findExistingDuckDbFileConnection,
	formatSaveDataFileSessionToast,
	hasSkippedDataFileSources,
	isEditableDuckDbFileConnection,
} from '@studio/features/database-studio/utils/save-data-file-session'
import type { SaveDataFileSessionResult } from '@studio/lib/bindings'
import { describe, expect, it } from 'vitest'

function connection(overrides: Partial<Connection> & Pick<Connection, 'type'>): Connection {
	return {
		id: 'test-id',
		name: 'Test',
		createdAt: 0,
		...overrides,
	}
}

describe('save data-file session helpers', function () {
	it('finds an existing DuckDB file connection without fileSources', function () {
		const dataFile = connection(
			buildConnectionFromDataFiles(['/tmp/sales.csv'])
		)
		const duckdbFile = connection(
			buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb')
		)

		expect(findExistingDuckDbFileConnection([dataFile, duckdbFile], '/tmp/analytics.duckdb')).toBe(
			duckdbFile
		)
		expect(findExistingDuckDbFileConnection([dataFile], '/tmp/analytics.duckdb')).toBeUndefined()
	})

	it('builds a saved DuckDB connection payload with empty fileSources', function () {
		const payload = buildSavedDuckDbConnectionPayload('/tmp/analytics.duckdb')

		expect(payload.name).toBe('analytics')
		expect(payload.databaseType).toEqual({
			DuckDB: {
				db_path: '/tmp/analytics.duckdb',
				file_sources: [],
			},
		})
	})

	it('treats saved DuckDB file connections as editable through existing caps', function () {
		const dataFile = connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))
		const duckdbFile = connection(
			buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb')
		)

		expect(getSourceCaps(dataFile, describeConnectionSource(dataFile)).isReadonly).toBe(true)
		expect(isEditableDuckDbFileConnection(duckdbFile)).toBe(true)
		expect(getSourceCaps(duckdbFile, describeConnectionSource(duckdbFile)).isReadonly).toBe(false)
	})

	it('formats success toasts with skipped source details', function () {
		const result: SaveDataFileSessionResult = {
			path: '/tmp/analytics.duckdb',
			tables: [
				{ name: 'sales', sourcePath: '/tmp/sales.csv', rowCount: 10 },
				{ name: 'events', sourcePath: '/tmp/events.csv', rowCount: 4 },
				{ name: 'users', sourcePath: '/tmp/users.csv', rowCount: 2 },
			],
			skipped: [
				{
					path: '/tmp/missing.csv',
					viewName: 'missing',
					status: 'missing',
					error: 'File not found',
				},
			],
			warnings: ['Skipped 1 missing or failed source file(s)'],
		}

		const toast = formatSaveDataFileSessionToast(result)
		expect(toast.title).toBe('Saved 3 tables to analytics.duckdb')
		expect(toast.description).toContain('Skipped 1 missing or failed source file(s)')
	})

	it('detects skipped sources before save confirmation', function () {
		expect(
			hasSkippedDataFileSources([
				{
					path: '/tmp/a.csv',
					viewName: 'a',
					fileType: 'CSV',
					status: 'active',
					error: null,
				},
			])
		).toBe(false)
		expect(
			hasSkippedDataFileSources([
				{
					path: '/tmp/a.csv',
					viewName: 'a',
					fileType: 'CSV',
					status: 'missing',
					error: 'File not found',
				},
			])
		).toBe(true)
	})
})

describe('save data-file session expectations', function () {
	it('keeps the original data-file connection shape unchanged', function () {
		const original = connection(buildConnectionFromDataFiles(['/tmp/sales.csv', '/tmp/events.csv']))

		expect(original.fileSources).toEqual(['/tmp/sales.csv', '/tmp/events.csv'])
		expect(original.url).toBe(':memory:')
		expect(describeConnectionSource(original).kind).toBe('data-file')
	})
})
