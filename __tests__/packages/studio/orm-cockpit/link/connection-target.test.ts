import { describe, expect, it } from 'vitest'
import {
	targetFromUrl,
	targetFromConnection,
	extractUrlReference,
	parseEnvVar,
	compareTargets,
	resolveProjectTarget,
	type DbTarget,
} from '@studio/features/orm-cockpit/link/connection-target'
import type { ProjectReader } from '@studio/features/orm-cockpit/link/detect-orm'

function reader(files: Record<string, string>): ProjectReader {
	return {
		async readFile(path) {
			return Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null
		},
		async listDir() {
			return []
		},
	}
}

describe('targetFromUrl', function () {
	it('parses a postgres url into host/port/database', function () {
		expect(targetFromUrl('postgres://user:pass@db.example.com:5432/remcostoeten?sslmode=require')).toEqual({
			engine: 'postgres',
			host: 'db.example.com',
			port: 5432,
			database: 'remcostoeten',
		})
	})

	it('parses a mysql url', function () {
		const t = targetFromUrl('mysql://root@127.0.0.1:3306/app')
		expect(t?.engine).toBe('mysql')
		expect(t?.database).toBe('app')
	})

	it('parses a file/sqlite url', function () {
		expect(targetFromUrl('file:./local.db')?.engine).toBe('sqlite')
	})

	it('parses an ecto url as a postgres target', function () {
		expect(targetFromUrl('ecto://postgres:postgres@127.0.0.1:5433/phoenix_app')).toEqual({
			engine: 'postgres',
			host: '127.0.0.1',
			port: 5433,
			database: 'phoenix_app',
		})
	})

	it('returns null for garbage', function () {
		expect(targetFromUrl('not a url')).toBeNull()
	})
})

describe('targetFromConnection', function () {
	it('builds a postgres target from the frontend connection model', function () {
		expect(
			targetFromConnection({ type: 'postgres', host: 'DB.Example.com', port: 5432, database: 'whatsapp' })
		).toEqual({ engine: 'postgres', host: 'db.example.com', port: 5432, database: 'whatsapp' })
	})

	it('treats sqlite/duckdb as file targets', function () {
		expect(targetFromConnection({ type: 'duckdb', url: '/data/warehouse.duckdb' })).toEqual({
			engine: 'sqlite',
			file: '/data/warehouse.duckdb',
		})
	})
})

describe('extractUrlReference', function () {
	it('reads a drizzle env reference', function () {
		expect(extractUrlReference("dbCredentials: { url: env.DATABASE_URL }")).toEqual({
			kind: 'env',
			value: 'DATABASE_URL',
		})
	})

	it('reads a prisma env() reference', function () {
		expect(extractUrlReference('datasource db {\n  url = env("DATABASE_URL")\n}')).toEqual({
			kind: 'env',
			value: 'DATABASE_URL',
		})
	})

	it('reads a literal url', function () {
		expect(extractUrlReference("url: 'postgres://u@h:5432/db'")).toEqual({
			kind: 'literal',
			value: 'postgres://u@h:5432/db',
		})
	})

	it('reads process.env.X', function () {
		expect(extractUrlReference('url: process.env.MY_DB_URL')).toEqual({
			kind: 'env',
			value: 'MY_DB_URL',
		})
	})
})

describe('parseEnvVar', function () {
	it('reads a quoted value', function () {
		expect(parseEnvVar('DATABASE_URL="postgres://u@h/db"\nOTHER=1', 'DATABASE_URL')).toBe(
			'postgres://u@h/db'
		)
	})

	it('strips an inline comment from an unquoted value', function () {
		expect(parseEnvVar('DATABASE_URL=postgres://u@h/db # prod', 'DATABASE_URL')).toBe(
			'postgres://u@h/db'
		)
	})

	it('honors export prefixes', function () {
		expect(parseEnvVar('export DATABASE_URL=postgres://x/y', 'DATABASE_URL')).toBe(
			'postgres://x/y'
		)
	})
})

describe('compareTargets', function () {
	const pg = (database: string, host = 'db.example.com'): DbTarget => ({
		engine: 'postgres',
		host,
		port: 5432,
		database,
	})

	it('matches identical host + database', function () {
		expect(compareTargets(pg('app'), pg('app'))).toBe('match')
	})

	it('flags a different database name as mismatch', function () {
		expect(compareTargets(pg('remcostoeten'), pg('whatsapp'))).toBe('mismatch')
	})

	it('flags different engines as mismatch', function () {
		expect(compareTargets(pg('app'), { engine: 'mysql', database: 'app' })).toBe('mismatch')
	})

	it('stays silent when a side is unresolved', function () {
		expect(compareTargets(null, pg('app'))).toBe('unknown')
		expect(compareTargets({ engine: 'postgres' }, pg('app'))).toBe('unknown')
	})

	it('does not flag same-database-different-host (pooler vs direct)', function () {
		expect(compareTargets(pg('app', 'pooler.example.com'), pg('app', 'db.example.com'))).toBe(
			'unknown'
		)
	})

	it('compares sqlite by file path', function () {
		expect(
			compareTargets({ engine: 'sqlite', file: '/a/x.db' }, { engine: 'sqlite', file: '/a/x.db' })
		).toBe('match')
		expect(
			compareTargets({ engine: 'sqlite', file: '/a/x.db' }, { engine: 'sqlite', file: '/a/y.db' })
		).toBe('mismatch')
	})
})

describe('resolveProjectTarget', function () {
	it('resolves a drizzle env reference against the project .env', async function () {
		const r = reader({
			'/proj/.env': 'DATABASE_URL=postgres://u@host:5432/remcostoeten\n',
		})
		const target = await resolveProjectTarget(
			'/proj',
			'export default { dbCredentials: { url: env.DATABASE_URL } }',
			'drizzle',
			r
		)
		expect(target).toEqual({
			engine: 'postgres',
			host: 'host',
			port: 5432,
			database: 'remcostoeten',
		})
	})

	it('prefers .env.local over .env', async function () {
		const r = reader({
			'/proj/.env': 'DATABASE_URL=postgres://u@host/prod\n',
			'/proj/.env.local': 'DATABASE_URL=postgres://u@host/local\n',
		})
		const target = await resolveProjectTarget(
			'/proj',
			'url: env.DATABASE_URL',
			'drizzle',
			r
		)
		expect(target?.database).toBe('local')
	})

	it('returns null when the url cannot be resolved', async function () {
		const target = await resolveProjectTarget('/proj', 'no url here', 'drizzle', reader({}))
		expect(target).toBeNull()
	})
})
