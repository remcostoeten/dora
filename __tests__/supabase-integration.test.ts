import { describe, expect, it } from 'vitest'
import type { SupabaseProject } from '@studio/lib/bindings'
import { describeConnectionSource } from '@studio/features/connections/resolve-source'
import { buildSupabaseConnectionUrl } from '@studio/features/integrations/supabase/supabase-api'

const PROJECT: SupabaseProject = {
	id: 'abcdefghijklmnopqrst',
	name: 'my-saas-app',
	region: 'eu-west-2',
	status: 'ACTIVE_HEALTHY',
	dbHost: 'db.abcdefghijklmnopqrst.supabase.co',
	dbVersion: '15.1.0.147',
}

describe('buildSupabaseConnectionUrl', function () {
	it('builds a direct connection using the reported database host', function () {
		expect(buildSupabaseConnectionUrl(PROJECT, 'pw', 'direct')).toBe(
			'postgresql://postgres:pw@db.abcdefghijklmnopqrst.supabase.co:5432/postgres'
		)
	})

	it('falls back to db.<ref>.supabase.co when the host is missing', function () {
		const noHost = { ...PROJECT, dbHost: '' }
		expect(buildSupabaseConnectionUrl(noHost, 'pw', 'direct')).toBe(
			'postgresql://postgres:pw@db.abcdefghijklmnopqrst.supabase.co:5432/postgres'
		)
	})

	it('builds a session pooler URL on port 5432 with the tenant-qualified user', function () {
		expect(buildSupabaseConnectionUrl(PROJECT, 'pw', 'session')).toBe(
			'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-eu-west-2.pooler.supabase.com:5432/postgres?pgbouncer=true'
		)
	})

	it('builds a transaction pooler URL on port 6543', function () {
		expect(buildSupabaseConnectionUrl(PROJECT, 'pw', 'transaction')).toBe(
			'postgresql://postgres.abcdefghijklmnopqrst:pw@aws-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true'
		)
	})

	it('percent-encodes special characters in the password', function () {
		const url = buildSupabaseConnectionUrl(PROJECT, 'p@ss:w/rd?#', 'session')
		expect(url).toContain(':p%40ss%3Aw%2Frd%3F%23@')
		expect(url).not.toContain('p@ss')
	})
})

describe('Supabase connection is recognized in the sidebar', function () {
	it('detects the supabase preset from a direct connection URL', function () {
		const meta = describeConnectionSource({
			type: 'postgres',
			url: buildSupabaseConnectionUrl(PROJECT, 'pw', 'direct'),
		})
		expect(meta.preset).toBe('supabase')
		expect(meta.kind).toBe('cloud-preset')
	})

	it('detects the supabase preset from a pooler connection URL', function () {
		const meta = describeConnectionSource({
			type: 'postgres',
			url: buildSupabaseConnectionUrl(PROJECT, 'pw', 'transaction'),
		})
		expect(meta.preset).toBe('supabase')
		expect(meta.kind).toBe('cloud-preset')
	})
})
