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
	type StudioUiAction,
} from '@studio/features/connections/ui-actions'
import { describe, expect, it } from 'vitest'

function connection(overrides: Partial<Connection> & Pick<Connection, 'type'>): Connection {
	return {
		id: 'test-id',
		name: 'Test',
		createdAt: 0,
		...overrides,
	}
}

function visibleActions(conn: Connection): StudioUiAction[] {
	return getVisibleUiActions(getSourceCaps(conn))
}

describe('ui-actions', function () {
	it('hides edit actions for readonly data-file sessions', function () {
		const conn = connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))
		const caps = getSourceCaps(conn)

		expect(isUiActionVisible('edit-rows', caps)).toBe(false)
		expect(isUiActionVisible('import-csv', caps)).toBe(false)
		expect(isUiActionVisible('live-monitor', caps)).toBe(false)
		expect(visibleActions(conn)).not.toContain('edit-rows')
		expect(visibleActions(conn)).not.toContain('import-csv')
	})

	it('hides import and edit for data-file sessions but keeps export', function () {
		const conn = connection(buildConnectionFromDataFiles(['/tmp/events.json']))
		const caps = getSourceCaps(conn)

		expect(caps.isReadonly).toBe(true)
		expect(isUiActionVisible('import-csv', caps)).toBe(false)
		expect(isUiActionVisible('edit-rows', caps)).toBe(false)
		expect(isUiActionVisible('export-data', caps)).toBe(true)
		expect(visibleActions(conn)).toContain('export-data')
	})

	it('shows local file actions for SQLite', function () {
		const conn = connection(buildConnectionFromDatabaseFile('/tmp/app.sqlite3', 'sqlite'))
		const caps = getSourceCaps(conn)

		expect(isUiActionVisible('local-file', caps)).toBe(true)
		expect(isUiActionVisible('remote-url', caps)).toBe(false)
		expect(isUiActionVisible('ssh-tunnel', caps)).toBe(false)
		expect(visibleActions(conn)).toContain('local-file')
		expect(visibleActions(conn)).not.toContain('remote-url')
	})

	it('shows local file actions for DuckDB database files', function () {
		const conn = connection(buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb'))
		const caps = getSourceCaps(conn)

		expect(isUiActionVisible('local-file', caps)).toBe(true)
		expect(isUiActionVisible('edit-rows', caps)).toBe(true)
		expect(visibleActions(conn)).toContain('local-file')
		expect(visibleActions(conn)).toContain('edit-rows')
	})

	it('shows remote URL actions for libSQL', function () {
		const conn = connection({
			type: 'libsql',
			url: 'libsql://my-db.turso.io',
			authToken: 'token',
		})
		const caps = getSourceCaps(conn)

		expect(isUiActionVisible('remote-url', caps)).toBe(true)
		expect(isUiActionVisible('local-file', caps)).toBe(true)
		expect(isUiActionVisible('ssh-tunnel', caps)).toBe(false)
		expect(visibleActions(conn)).toContain('remote-url')
		expect(visibleActions(conn)).not.toContain('ssh-tunnel')
	})

	it('shows SSH for supported SQL servers', function () {
		for (const type of ['postgres', 'cockroach', 'mysql', 'mariadb'] as const) {
			const conn = connection({ type, host: 'localhost' })
			const caps = getSourceCaps(conn)

			expect(isUiActionVisible('ssh-tunnel', caps)).toBe(true)
			expect(isUiActionVisible('remote-url', caps)).toBe(true)
			expect(visibleActions(conn)).toContain('ssh-tunnel')
		}
	})

	it('does not show SSH for embedded engines', function () {
		for (const conn of [
			connection(buildConnectionFromDatabaseFile('/tmp/app.sqlite3', 'sqlite')),
			connection(buildConnectionFromDatabaseFile('/tmp/app.duckdb', 'duckdb')),
			connection({ type: 'libsql', url: 'libsql://db.turso.io' }),
		]) {
			expect(isUiActionVisible('ssh-tunnel', getSourceCaps(conn))).toBe(false)
		}
	})

	it('shows attach-file for native DuckDB file connections', function () {
		const duckdbFile = connection(buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb'))
		const caps = getSourceCaps(duckdbFile)

		expect(ATTACH_FILE_UI_IMPLEMENTED).toBe(true)
		expect(caps.canAttachFiles).toBe(true)
		expect(isUiActionVisible('attach-file', caps)).toBe(true)
		expect(visibleActions(duckdbFile)).toContain('attach-file')
	})

	it('keeps attach-file hidden for data-file sessions even when UI is implemented', function () {
		const dataFile = connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))
		expect(isUiActionVisible('attach-file', getSourceCaps(dataFile))).toBe(false)
	})
})
