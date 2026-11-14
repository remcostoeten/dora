import { describe, expect, it } from 'vitest'
import { detect, isActionable } from './detect'

describe('detect', () => {
	it('reads a Neon URL into engine, provider, account and SSL reason', () => {
		const found = detect(
			'postgres://app:secret@ep-cool-123.us-east-2.aws.neon.tech/shop?sslmode=require'
		)
		expect(found).toMatchObject({
			kind: 'url',
			engine: 'postgres',
			provider: 'Neon',
			account: 'neon',
			host: 'ep-cool-123.us-east-2.aws.neon.tech',
			user: 'app',
			password: 'secret',
			database: 'shop',
			ssl: true,
			sslWhy: 'from sslmode=require'
		})
	})

	it('strips an env var assignment and quotes', () => {
		const found = detect(
			'DATABASE_URL="mysql://rw:pw@aws.connect.psdb.cloud/orders?sslaccept=strict"'
		)
		expect(found).toMatchObject({
			kind: 'url',
			engine: 'mysql',
			provider: 'PlanetScale',
			account: 'planetscale',
			ssl: true
		})
	})

	it('decodes percent-encoded credentials', () => {
		const found = detect('postgres://us%40er:p%23ss@db.internal:5433/app')
		expect(found).toMatchObject({ user: 'us@er', password: 'p#ss', port: '5433' })
	})

	it('flags a transaction pooler port', () => {
		const found = detect(
			'postgresql://postgres.abc:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres'
		)
		expect(found).toMatchObject({
			kind: 'url',
			pooler: true,
			provider: 'Supabase',
			account: 'supabase'
		})
	})

	it('flags public Fly.io hosts', () => {
		expect(detect('postgres://postgres:pw@acme-db.fly.dev:5432/acme')).toMatchObject({
			fly: true
		})
		expect(detect('postgres://postgres:pw@acme-db.internal:5432/acme')).toMatchObject({
			fly: false
		})
	})

	it('treats an explicit sslmode=disable as off', () => {
		const found = detect('postgres://u:p@localhost/db?sslmode=disable')
		expect(found).toMatchObject({ kind: 'url', ssl: false })
	})

	it('reads a libSQL URL and its token', () => {
		const found = detect('libsql://shop-edge-acme.turso.io?authToken=abc')
		expect(found).toMatchObject({
			kind: 'url',
			engine: 'libsql',
			token: 'abc',
			account: 'turso'
		})
	})

	it('notes a mistyped scheme', () => {
		const found = detect('postgress://u:p@host/db')
		expect(found).toMatchObject({ kind: 'url', engine: 'postgres' })
		expect(found?.kind === 'url' && found.typo).toEqual({ from: 'postgress', to: 'postgresql' })
	})

	it('detects database and data file paths', () => {
		expect(detect('~/dev/app/dev.sqlite')).toEqual({
			kind: 'file',
			engine: 'sqlite',
			path: '~/dev/app/dev.sqlite'
		})
		expect(detect('/data/warehouse.duckdb')).toMatchObject({ kind: 'file', engine: 'duckdb' })
		expect(detect('./events.parquet')).toEqual({ kind: 'datafile', path: './events.parquet' })
		expect(detect('/etc/hosts')).toEqual({ kind: 'badpath', path: '/etc/hosts' })
	})

	it('reports unknown schemes and ignores plain search text', () => {
		expect(detect('foo://bar')).toEqual({ kind: 'unknown', scheme: 'foo' })
		expect(detect('neon')).toBeNull()
		expect(detect('')).toBeNull()
	})

	it('only treats readable detections as actionable', () => {
		expect(isActionable(detect('foo://bar'))).toBe(false)
		expect(isActionable(detect('/etc/hosts'))).toBe(false)
		expect(isActionable(detect('postgres://u:p@h/db'))).toBe(true)
		expect(isActionable(null)).toBe(false)
	})
})
