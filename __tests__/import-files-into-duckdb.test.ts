import {
	buildConnectionFromDataFiles,
	buildConnectionFromDatabaseFile,
} from '@studio/features/connections/utils/data-files'
import { getSourceCaps } from '@studio/features/connections/source-caps'
import type { Connection } from '@studio/features/connections/types'
import {
	ATTACH_FILE_UI_IMPLEMENTED,
	getVisibleUiActions,
	isUiActionVisible,
} from '@studio/features/connections/ui-actions'
import {
	detectImportNameCollisions,
	formatImportFilesIntoDuckDbToast,
	refreshStudioSchema,
} from '@studio/features/database-studio/utils/import-files-into-duckdb'
import { viewNameForPath } from '@studio/features/connections/utils/data-file-views'
import type { ImportFilesIntoDuckDbResult } from '@studio/lib/bindings'
import { describe, expect, it, vi } from 'vitest'

function connection(overrides: Partial<Connection> & Pick<Connection, 'type'>): Connection {
	return {
		id: 'test-id',
		name: 'Test',
		createdAt: 0,
		...overrides,
	}
}

describe('attach-file ui visibility', function () {
	it('hides attach-file for non-DuckDB engines', function () {
		const postgres = connection({ type: 'postgres', host: 'localhost', database: 'app' })
		const sqlite = connection(buildConnectionFromDatabaseFile('/tmp/app.sqlite3', 'sqlite'))

		expect(isUiActionVisible('attach-file', getSourceCaps(postgres))).toBe(false)
		expect(isUiActionVisible('attach-file', getSourceCaps(sqlite))).toBe(false)
	})

	it('hides attach-file for data-file sessions', function () {
		const dataFile = connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))

		expect(getSourceCaps(dataFile).canAttachFiles).toBe(false)
		expect(isUiActionVisible('attach-file', getSourceCaps(dataFile))).toBe(false)
	})

	it('shows attach-file for native DuckDB file connections', function () {
		const duckdbFile = connection(buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb'))
		const caps = getSourceCaps(duckdbFile)

		expect(ATTACH_FILE_UI_IMPLEMENTED).toBe(true)
		expect(caps.canAttachFiles).toBe(true)
		expect(isUiActionVisible('attach-file', caps)).toBe(true)
		expect(getVisibleUiActions(caps)).toContain('attach-file')
	})
})

describe('import files into DuckDB helpers', function () {
	it('detects table name collisions against existing schema tables', function () {
		const collisions = detectImportNameCollisions(
			['/tmp/sales.csv', '/tmp/events.csv'],
			['sales', 'users']
		)

		expect(collisions).toEqual(['sales'])
	})

	it('formats success and partial failure toasts', function () {
		const result: ImportFilesIntoDuckDbResult = {
			tables: [
				{
					name: 'sales',
					sourcePath: '/tmp/sales.csv',
					fileType: 'CSV',
					rowCount: 10,
				},
				{
					name: 'events',
					sourcePath: '/tmp/events.csv',
					fileType: 'CSV',
					rowCount: 4,
				},
				{
					name: 'users',
					sourcePath: '/tmp/users.csv',
					fileType: 'CSV',
					rowCount: 2,
				},
			],
			failed: [{ path: '/tmp/bad.json', fileType: 'JSON', error: 'Invalid JSON' }],
			warnings: ['Failed to import 1 file(s)'],
		}

		const toast = formatImportFilesIntoDuckDbToast(result, 'analytics.duckdb')
		expect(toast.title).toBe('Imported 3 files into analytics.duckdb')
		expect(toast.description).toContain('3 file')
		expect(toast.description).toContain('1 failed')
	})

	it('uses the same sanitized table names as data-file sessions', function () {
		expect(viewNameForPath('/data/My Sales-2024.csv')).toBe('my_sales_2024')
	})

	it('dispatches a schema refresh event after import', function () {
		const handler = vi.fn()
		window.addEventListener('dora-schema-refresh', handler as EventListener)
		refreshStudioSchema('conn-123')
		expect(handler).toHaveBeenCalledTimes(1)
		window.removeEventListener('dora-schema-refresh', handler as EventListener)
	})
})
