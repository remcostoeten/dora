import {
	buildConnectionFromDataFiles,
	buildConnectionFromDatabaseFile
} from '@studio/features/connections/utils/data-files'
import {
	describeConnectionSource,
	resolvePresetToEngine
} from '@studio/features/connections/resolve-source'
import { getSourceCaps } from '@studio/features/connections/source-caps'
import type { Connection } from '@studio/features/connections/types'
import { describe, expect, it } from 'vitest'

function connection(overrides: Partial<Connection> & Pick<Connection, 'type'>): Connection {
	return {
		id: 'test-id',
		name: 'Test',
		createdAt: 0,
		...overrides
	}
}

describe('source capabilities', function () {
	it('marks DuckDB data-file sessions as readonly', function () {
		const conn = connection(buildConnectionFromDataFiles(['/tmp/sales.csv']))
		const caps = getSourceCaps(conn)

		expect(caps.isReadonly).toBe(true)
		expect(caps.canEditRows).toBe(false)
		expect(caps.canImportFile).toBe(false)
		expect(caps.canRunSql).toBe(true)
		expect(caps.canExportFile).toBe(true)
	})

	it('allows editing a native DuckDB database file', function () {
		const conn = connection(buildConnectionFromDatabaseFile('/tmp/analytics.duckdb', 'duckdb'))
		const caps = getSourceCaps(conn)

		expect(caps.isReadonly).toBe(false)
		expect(caps.canEditRows).toBe(true)
	})

	it('allows editing a SQLite database file', function () {
		const conn = connection(buildConnectionFromDatabaseFile('/tmp/app.sqlite3', 'sqlite'))
		const caps = getSourceCaps(conn)

		expect(caps.isReadonly).toBe(false)
		expect(caps.canEditRows).toBe(true)
		expect(caps.supportsLocalFile).toBe(true)
	})

	it('resolves Neon as a postgres preset', function () {
		const conn = connection({
			type: 'postgres',
			url: 'postgresql://user:pass@ep-cool-name.us-east-2.aws.neon.tech/neondb'
		})
		const meta = describeConnectionSource(conn)

		expect(meta.preset).toBe('neon')
		expect(meta.engine).toBe('postgres')
		expect(resolvePresetToEngine(meta.preset)).toBe('postgres')
	})

	it('resolves Supabase as a postgres preset', function () {
		const conn = connection({
			type: 'postgres',
			url: 'postgresql://postgres:pass@db.abcdefghijklmnop.supabase.co:5432/postgres'
		})
		const meta = describeConnectionSource(conn)

		expect(meta.preset).toBe('supabase')
		expect(meta.engine).toBe('postgres')
		expect(resolvePresetToEngine(meta.preset)).toBe('postgres')
	})

	it('keeps MariaDB engine label while mapping to mysql wire family', function () {
		const conn = connection({ type: 'mariadb', host: 'localhost' })
		const meta = describeConnectionSource(conn)

		expect(meta.engine).toBe('mariadb')
		expect(meta.preset).toBe('mariadb')
		expect(resolvePresetToEngine(meta.preset)).toBe('mysql')
	})

	it('keeps CockroachDB engine label while mapping to postgres wire family', function () {
		const conn = connection({ type: 'cockroach', host: 'localhost' })
		const meta = describeConnectionSource(conn)

		expect(meta.engine).toBe('cockroach')
		expect(meta.preset).toBe('cockroach')
		expect(resolvePresetToEngine(meta.preset)).toBe('postgres')
	})

	it('treats CSV, JSON, and Parquet as DuckDB data-file sessions', function () {
		for (const path of ['/tmp/sales.csv', '/tmp/events.json', '/tmp/metrics.parquet']) {
			const conn = connection(buildConnectionFromDataFiles([path]))
			const meta = describeConnectionSource(conn)

			expect(meta.kind).toBe('data-file')
			expect(meta.isDataFileSession).toBe(true)
			expect(meta.engine).toBe('duckdb')
			expect(getSourceCaps(conn).isReadonly).toBe(true)
		}
	})
})
