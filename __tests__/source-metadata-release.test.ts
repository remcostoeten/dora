import {
	buildConnectionFromDataFiles,
	buildConnectionFromDatabaseFile,
} from '@studio/features/connections/utils/data-files'
import {
	isDataFileSessionConnection,
	isNativeDuckDbFileConnection,
} from '@studio/features/connections/source-caps'
import {
	LOCAL_FILE_ERRORS,
	mapImportFilesIntoDuckDbError,
	mapSaveDataFileSessionError,
} from '@studio/features/connections/local-file-errors'
import { isUiActionVisible } from '@studio/features/connections/ui-actions'
import { getSourceCaps } from '@studio/features/connections/source-caps'
import type { Connection } from '@studio/features/connections/types'
import { formatImportFilesIntoDuckDbToast } from '@studio/features/database-studio/utils/import-files-into-duckdb'
import type { ImportFilesIntoDuckDbResult } from '@studio/lib/bindings'
import { describe, expect, it } from 'vitest'

function connection(overrides: Partial<Connection> & Pick<Connection, 'type'>): Connection {
	return {
		id: 'test-id',
		name: 'Test',
		createdAt: 0,
		...overrides,
	}
}

describe('source metadata release helpers', function () {
	it('identifies data-file sessions and native DuckDB files via caps', function () {
		const dataFile = connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))
		const duckdbFile = connection(
			buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb')
		)
		const sqlite = connection(buildConnectionFromDatabaseFile('/tmp/app.sqlite3', 'sqlite'))

		expect(isDataFileSessionConnection(dataFile)).toBe(true)
		expect(isNativeDuckDbFileConnection(dataFile)).toBe(false)
		expect(isNativeDuckDbFileConnection(duckdbFile)).toBe(true)
		expect(isDataFileSessionConnection(duckdbFile)).toBe(false)
		expect(isNativeDuckDbFileConnection(sqlite)).toBe(false)
	})

	it('keeps attach-file visibility on caps only', function () {
		const dataFile = connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))
		const duckdbFile = connection(
			buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb')
		)

		expect(isUiActionVisible('attach-file', getSourceCaps(dataFile))).toBe(false)
		expect(isUiActionVisible('attach-file', getSourceCaps(duckdbFile))).toBe(true)
	})
})

describe('local file error copy', function () {
	it('maps save errors to user-facing messages', function () {
		expect(mapSaveDataFileSessionError('No active data files to save')).toBe(
			LOCAL_FILE_ERRORS.noActiveFilesToSave
		)
		expect(mapSaveDataFileSessionError('Destination already exists: /tmp/out.duckdb')).toBe(
			LOCAL_FILE_ERRORS.destinationExists
		)
		expect(
			mapSaveDataFileSessionError('Destination directory does not exist: /no/such/dir')
		).toBe(LOCAL_FILE_ERRORS.destinationParentMissing)
	})

	it('maps import errors', function () {
		expect(mapImportFilesIntoDuckDbError('No files were imported (2 failed)')).toContain(
			'Could not import files'
		)
	})

	it('formats partial import toasts with centralized copy', function () {
		const result: ImportFilesIntoDuckDbResult = {
			tables: [
				{
					name: 'sales',
					sourcePath: '/tmp/sales.csv',
					fileType: 'CSV',
					rowCount: 1,
				},
			],
			failed: [{ path: '/tmp/bad.json', fileType: 'JSON', error: 'Invalid JSON' }],
			warnings: [],
		}

		const toast = formatImportFilesIntoDuckDbToast(result, 'analytics.duckdb')
		expect(toast.description).toBe(LOCAL_FILE_ERRORS.partialImportCompleted(1, 1))
	})
})
