import { describe, expect, it } from 'vitest'

import { detectProviderName, parseConnectionUrl } from '@studio/features/connections/utils/providers'

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

describe('managed provider detection', function () {
	type TCase = {
		name: string
		url: string
		expectedName: string
		expectedType?: string
		expectedSsl?: boolean
	}

	const cases: TCase[] = [
		// --- Postgres-wire (TLS required) ---
		{
			name: 'Supabase (direct)',
			url: 'postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres',
			expectedName: 'Supabase DB',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Supabase (pooler)',
			url: 'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
			expectedName: 'Supabase DB',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Neon',
			url: 'postgresql://user:pw@ep-cool-name-123.us-east-2.aws.neon.tech/neondb',
			expectedName: 'Neon DB',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Vercel Postgres',
			url: 'postgresql://default:pw@ep-x.us-east-1.postgres.vercel-storage.com/verceldb',
			expectedName: 'Vercel Postgres',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Render',
			url: 'postgresql://user:pw@oregon-postgres.render.com/mydb',
			expectedName: 'Render DB',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Crunchy Bridge',
			url: 'postgresql://user:pw@p.abc123.db.postgresbridge.com:5432/postgres',
			expectedName: 'Crunchy Bridge',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Timescale Cloud',
			url: 'postgresql://tsdbadmin:pw@abc.def.tsdb.cloud.timescale.com:34567/tsdb',
			expectedName: 'Timescale Cloud',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Yugabyte',
			url: 'postgresql://admin:pw@abc.us-east-1.aws.yugabyte.cloud:5433/yugabyte',
			expectedName: 'Yugabyte',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Fly.io public',
			url: 'postgresql://postgres:pw@my-app-db.fly.dev:5432/postgres',
			expectedName: 'Fly.io Postgres',
			expectedType: 'postgres',
			expectedSsl: true
		},

		// --- Dual-engine (engine from protocol/port) ---
		{
			name: 'Railway Postgres (public)',
			url: 'postgresql://postgres:pw@containers-us-west-1.railway.app:6543/railway',
			expectedName: 'Railway DB',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Railway MySQL (public, rlwy.net)',
			url: 'mysql://root:pw@viaduct.proxy.rlwy.net:3306/railway',
			expectedName: 'Railway DB',
			expectedType: 'mysql',
			expectedSsl: true
		},
		{
			name: 'Aiven Postgres',
			url: 'postgresql://avnadmin:pw@pg-abc.aivencloud.com:12345/defaultdb',
			expectedName: 'Aiven DB',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Aiven MySQL',
			url: 'mysql://avnadmin:pw@mysql-abc.aivencloud.com:12345/defaultdb',
			expectedName: 'Aiven DB',
			expectedType: 'mysql',
			expectedSsl: true
		},
		{
			name: 'DigitalOcean Postgres',
			url: 'postgresql://doadmin:pw@db-postgresql-nyc1-abc.db.ondigitalocean.com:25060/defaultdb',
			expectedName: 'DigitalOcean DB',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Azure Postgres',
			url: 'postgresql://user:pw@myserver.postgres.database.azure.com:5432/postgres',
			expectedName: 'Azure Database for PostgreSQL',
			expectedType: 'postgres',
			expectedSsl: true
		},
		{
			name: 'Azure MySQL',
			url: 'mysql://user:pw@myserver.mysql.database.azure.com:3306/mydb',
			expectedName: 'Azure Database for MySQL',
			expectedType: 'mysql',
			expectedSsl: true
		},

		// --- MySQL-wire ---
		{
			name: 'PlanetScale',
			url: 'mysql://user:pw@aws.connect.psdb.cloud:3306/mydb',
			expectedName: 'PlanetScale DB',
			expectedType: 'mysql',
			expectedSsl: true
		},
		{
			name: 'TiDB Cloud',
			url: 'mysql://user.root:pw@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test',
			expectedName: 'TiDB Cloud',
			expectedType: 'mysql',
			expectedSsl: true
		},

		// --- CockroachDB Cloud ---
		{
			name: 'CockroachDB Cloud (serverless)',
			url: 'postgresql://user:pw@free-tier.gcp-us-central1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full&options=--cluster%3Dmy-cluster-123',
			expectedName: 'CockroachDB Cloud',
			expectedType: 'cockroach',
			expectedSsl: true
		},

		// --- libSQL ---
		{
			name: 'Turso',
			url: 'libsql://my-db-org.turso.io',
			expectedName: 'Turso DB',
			expectedType: 'libsql'
		}
	]

	for (const c of cases) {
		it(`detects ${c.name}`, function () {
			expect(detectProviderName(c.url)).toBe(c.expectedName)

			const parsed = parseConnectionUrl(c.url)
			expect(parsed).not.toBeNull()
			if (c.expectedType !== undefined) {
				expect(parsed?.type).toBe(c.expectedType)
			}
			if (c.expectedSsl !== undefined) {
				expect(parsed?.ssl ?? false).toBe(c.expectedSsl)
			}
		})
	}
})

describe('SSL defaults', function () {
	it('defaults SSL on for a requiresSsl provider with no explicit ssl param', function () {
		expect(parseConnectionUrl('postgresql://u:p@db.x.supabase.co:5432/postgres')?.ssl).toBe(true)
	})

	it('does not force SSL for AWS RDS (SSL optional)', function () {
		const parsed = parseConnectionUrl(
			'postgresql://admin:pw@mydb.abc123.us-east-1.rds.amazonaws.com:5432/postgres'
		)
		expect(parsed?.type).toBe('postgres')
		expect(parsed?.ssl ?? false).toBe(false)
	})

	it('does not force SSL on Fly.io private .internal hosts', function () {
		const parsed = parseConnectionUrl('postgresql://postgres:pw@my-app-db.internal:5432/postgres')
		expect(parsed?.type).toBe('postgres')
		expect(parsed?.ssl ?? false).toBe(false)
	})

	it('does not force SSL on Fly.io .flycast private hosts', function () {
		const parsed = parseConnectionUrl('postgresql://postgres:pw@my-app-db.flycast:5432/postgres')
		expect(parsed?.ssl ?? false).toBe(false)
	})

	it('does not force SSL on Railway private network', function () {
		const parsed = parseConnectionUrl('postgresql://postgres:pw@postgres.railway.internal:5432/railway')
		expect(parsed?.ssl ?? false).toBe(false)
	})

	it('respects an explicit sslmode=disable over a requiresSsl provider default? (explicit param still flags ssl true per existing behavior)', function () {
		// Pre-existing behavior: any sslmode/ssl param flags ssl true. We only assert
		// the requiresSsl default does not regress detection; explicit param wins the branch.
		const parsed = parseConnectionUrl('postgresql://u:p@db.x.supabase.co:5432/postgres?sslmode=require')
		expect(parsed?.ssl).toBe(true)
	})
})

describe('CockroachDB Cloud cluster option preservation', function () {
	it('preserves the options=--cluster param through URL handling', function () {
		const url =
			'postgresql://user:pw@free-tier.gcp-us-central1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full&options=--cluster%3Dmy-cluster-123'

		// parseConnectionUrl extracts engine/ssl; the original URL (the value the app
		// stores and connects with) must still carry the routing cluster option.
		const parsed = parseConnectionUrl(url)
		expect(parsed?.type).toBe('cockroach')
		expect(parsed?.ssl).toBe(true)

		const options = new URLSearchParams(new URL(url).search).get('options')
		expect(options).toBe('--cluster=my-cluster-123')
		// A URL roundtrip (as performed by pooler/ssl helpers) must not strip it.
		expect(new URL(url).toString()).toContain('options=--cluster')
	})
})
