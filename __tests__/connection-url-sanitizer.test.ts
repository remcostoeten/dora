import { describe, expect, it } from 'vitest'

import {
	buildConnectionString,
	isValidConnectionUrl,
	parseConnectionUrl,
	sanitizeConnectionUrl
} from '@/features/connections/utils/providers'

describe('sanitizeConnectionUrl', () => {
	it('keeps a psql-wrapped postgres URL', () => {
		expect(
			sanitizeConnectionUrl(
				'psql "postgresql://user:pass@example.com:6543/postgres?sslmode=require"'
			)
		).toBe('postgresql://user:pass@example.com:6543/postgres?sslmode=require')
	})

	it('converts common psql flags to a postgres URL', () => {
		expect(
			sanitizeConnectionUrl(
				"PGPASSWORD='secret' psql -h aws-0-eu-west-1.pooler.supabase.com -p 6543 -U whatsapp_history_app.tbpvgbsarwqbcvfvlbnv -d postgres sslmode=require"
			)
		).toBe(
			'postgresql://whatsapp_history_app.tbpvgbsarwqbcvfvlbnv:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require'
		)
	})

	it('supports long psql flags', () => {
		expect(
			sanitizeConnectionUrl(
				'psql --host=db.example.com --port=5432 --username=app --dbname=main'
			)
		).toBe('postgresql://app@db.example.com:5432/main')
	})

	it('strips inline comments from env-style URL values', () => {
		expect(
			sanitizeConnectionUrl(
				'DATABASE_URL=postgresql://auth_drawer:secret@localhost:5433/auth_drawer  # Better Auth secret note'
			)
		).toBe('postgresql://auth_drawer:secret@localhost:5433/auth_drawer')
	})

	it('strips inline comments from structured database fields', () => {
		expect(
			buildConnectionString({
				type: 'postgres',
				host: 'localhost',
				port: 5433,
				user: 'auth_drawer',
				password: 'secret',
				database: 'auth_drawer  # Better Auth secret note'
			})
		).toBe('postgresql://auth_drawer:secret@localhost:5433/auth_drawer')
	})
})

describe('ecto:// scheme', () => {
	const ECTO_URL = 'ecto://postgres:postgres@127.0.0.1:5433/phoenix_app'

	it('accepts an ecto URL as a connection URL', () => {
		expect(isValidConnectionUrl(ECTO_URL)).toBe(true)
		expect(isValidConnectionUrl('ECTO://user@host/db')).toBe(true)
	})

	it('survives an env-var assignment through the sanitizer', () => {
		expect(sanitizeConnectionUrl(`DATABASE_URL="${ECTO_URL}"`)).toBe(ECTO_URL)
		expect(sanitizeConnectionUrl(`DATABASE_URL=${ECTO_URL}`)).toBe(ECTO_URL)
	})

	it('parses as a postgres connection', () => {
		expect(parseConnectionUrl(ECTO_URL)).toMatchObject({
			type: 'postgres',
			host: '127.0.0.1',
			port: 5433,
			user: 'postgres',
			password: 'postgres',
			database: 'phoenix_app'
		})
	})

	it('still resolves cockroach hosts/ports to cockroach', () => {
		expect(parseConnectionUrl('ecto://root@127.0.0.1:26257/defaultdb')?.type).toBe('cockroach')
	})

	it('never becomes the scheme postgres URLs are built with', () => {
		expect(
			buildConnectionString({
				type: 'postgres',
				host: 'localhost',
				port: 5432,
				user: 'postgres',
				database: 'app'
			})
		).toBe('postgresql://postgres@localhost:5432/app')
	})

	it('leaves protocol typo detection intact', () => {
		expect(parseConnectionUrl('postgre://user@host:5432/db')?.type).toBe('postgres')
		expect(parseConnectionUrl('postgesql://user@host:5432/db')?.type).toBe('postgres')
		expect(parseConnectionUrl('mysq://root@host:3306/db')?.type).toBe('mysql')
	})
})
