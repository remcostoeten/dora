import { describe, expect, it } from 'vitest'

import { detectProviderName, isFlyPublicHost, parseConnectionUrl } from '@studio/features/connections/utils/providers'

describe('isFlyPublicHost', function () {
	it('returns true for fly.dev hostnames', function () {
		expect(isFlyPublicHost('postgresql://postgres:pw@my-app-db.fly.dev:5432/postgres')).toBe(true)
	})

	it('returns true for flympg hostnames', function () {
		expect(isFlyPublicHost('postgresql://postgres:pw@my-db.flympg.com:5432/app')).toBe(true)
	})

	it('returns false for .internal private Fly hosts', function () {
		expect(isFlyPublicHost('postgresql://postgres:pw@my-app-db.internal:5432/postgres')).toBe(false)
	})

	it('returns false for .flycast private Fly hosts', function () {
		expect(isFlyPublicHost('postgresql://postgres:pw@my-app-db.flycast:5432/postgres')).toBe(false)
	})

	it('returns false for non-Fly hosts', function () {
		expect(isFlyPublicHost('postgresql://user:pw@db.example.com:5432/mydb')).toBe(false)
	})

	it('returns false for an invalid/empty URL', function () {
		expect(isFlyPublicHost('')).toBe(false)
		expect(isFlyPublicHost('not-a-url')).toBe(false)
	})
})

describe('detectProviderName', function () {
	it('detects MariaDB hosts as a MySQL-compatible provider', function () {
		expect(
			detectProviderName('mysql://user:pass@mariadb.internal:3306/app')
		).toBe('MariaDB DB')
	})

	it('detects CockroachDB hosts as a Postgres-compatible provider', function () {
		expect(
			detectProviderName('postgresql://user:pass@cockroach.example.com:26257/defaultdb')
		).toBe('CockroachDB')
	})

	it('detects CRDB shorthand hosts', function () {
		expect(detectProviderName('postgresql://user:pass@crdb.prod.local/db')).toBe(
			'CockroachDB'
		)
	})

	it('detects CockroachDB from its default SQL port even with a postgres scheme', function () {
		expect(
			parseConnectionUrl('postgresql://root@127.0.0.1:26257/defaultdb?sslmode=disable')?.type
		).toBe('cockroach')
	})

	it('detects CockroachDB from its default SQL port name', function () {
		expect(detectProviderName('postgresql://root@127.0.0.1:26257/defaultdb')).toBe(
			'CockroachDB'
		)
	})
})
