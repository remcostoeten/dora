import {
	buildConnectionFromDataFiles,
	buildConnectionFromDatabaseFile,
} from '@studio/features/connections/utils/data-files'
import { describeConnectionSource } from '@studio/features/connections/resolve-source'
import { getSourceCaps } from '@studio/features/connections/source-caps'
import {
	DATA_FILE_READONLY_MESSAGE,
	resolveConnectionSubtitle,
	resolveProviderLabel,
	resolveSourceKindBadge,
	shouldShowDataFileReadonlyMessage,
	shouldShowSourceKindBadge,
} from '@studio/features/connections/source-labels'
import type { Connection } from '@studio/features/connections/types'
import { describe, expect, it } from 'vitest'

function connection(overrides: Partial<Connection> & Pick<Connection, 'type'>): Connection {
	return {
		id: 'test-id',
		name: 'Test',
		createdAt: 0,
		...overrides,
	}
}

describe('source-labels', function () {
	it('resolves Neon and Supabase provider labels', function () {
		const neon = describeConnectionSource(
			connection({
				type: 'postgres',
				url: 'postgresql://user:pass@ep-cool-name.us-east-2.aws.neon.tech/neondb',
			})
		)
		const supabase = describeConnectionSource(
			connection({
				type: 'postgres',
				url: 'postgresql://postgres:pass@db.abcdefghijklmnop.supabase.co:5432/postgres',
			})
		)

		expect(resolveProviderLabel(neon)).toBe('Neon')
		expect(resolveSourceKindBadge(neon)).toBe('Cloud')
		expect(resolveProviderLabel(supabase)).toBe('Supabase')
		expect(resolveSourceKindBadge(supabase)).toBe('Cloud')
	})

	it('keeps generic Postgres as PostgreSQL with a Server badge', function () {
		const meta = describeConnectionSource(
			connection({ type: 'postgres', host: 'localhost', database: 'app' })
		)

		expect(meta.preset).toBe('postgres')
		expect(resolveProviderLabel(meta)).toBe('PostgreSQL')
		expect(resolveSourceKindBadge(meta)).toBe('Server')
		expect(shouldShowSourceKindBadge(meta)).toBe(true)
	})

	it('resolves engine-specific provider labels', function () {
		expect(
			resolveProviderLabel(describeConnectionSource(connection({ type: 'mysql', host: 'localhost' })))
		).toBe('MySQL')
		expect(
			resolveProviderLabel(describeConnectionSource(connection({ type: 'mariadb', host: 'localhost' })))
		).toBe('MariaDB')
		expect(
			resolveProviderLabel(describeConnectionSource(connection({ type: 'cockroach', host: 'localhost' })))
		).toBe('CockroachDB')
		expect(
			resolveProviderLabel(
				describeConnectionSource(connection({ type: 'libsql', url: 'libsql://db.turso.io' }))
			)
		).toBe('Turso')
		expect(
			resolveProviderLabel(
				describeConnectionSource(buildConnectionFromDatabaseFile('/tmp/app.sqlite3', 'sqlite'))
			)
		).toBe('SQLite')
	})

	it('labels DuckDB database files separately from data-file sessions', function () {
		const duckdbFile = describeConnectionSource(
			connection(buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb'))
		)
		const dataFiles = describeConnectionSource(
			connection(buildConnectionFromDataFiles(['/tmp/sales.csv', '/tmp/events.json']))
		)

		expect(resolveProviderLabel(duckdbFile)).toBe('DuckDB')
		expect(resolveSourceKindBadge(duckdbFile)).toBe('Local database')
		expect(resolveProviderLabel(dataFiles)).toBe('Data files')
		expect(resolveSourceKindBadge(dataFiles)).toBe('Data files')
		expect(shouldShowSourceKindBadge(dataFiles)).toBe(false)
	})

	it('builds connection subtitles from provider and location', function () {
		const neon = connection({
			type: 'postgres',
			url: 'postgresql://user:pass@ep-cool-name.us-east-2.aws.neon.tech/neondb',
		})
		const dataFiles = connection(buildConnectionFromDataFiles(['/tmp/sales.csv', '/tmp/events.json']))

		expect(resolveConnectionSubtitle(neon)).toBe('Neon · Cloud')
		expect(resolveConnectionSubtitle(dataFiles)).toBe('Data files · 2 files')
	})

	it('shows the data-file readonly message only for data-file sessions', function () {
		const dataFileMeta = describeConnectionSource(
			connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))
		)
		const duckdbMeta = describeConnectionSource(
			connection(buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb'))
		)

		expect(shouldShowDataFileReadonlyMessage(dataFileMeta)).toBe(true)
		expect(shouldShowDataFileReadonlyMessage(duckdbMeta)).toBe(false)
		expect(DATA_FILE_READONLY_MESSAGE).toContain('readonly DuckDB views')
		expect(getSourceCaps(connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))).isReadonly).toBe(
			true
		)
	})
})
