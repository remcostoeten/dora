import { describe, expect, it } from 'vitest'

import { sanitizeConnectionUrl } from '@/features/connections/utils/providers'

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
})
