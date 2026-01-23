import { describe, it, expect } from "vitest";
import { parseConnectionUrl } from "@/features/connections/utils/providers";

describe('Connection URL Parser - Typo Detection', () => {
	describe('Exact Matches', () => {
		it('should parse postgres protocol correctly', () => {
			const result = parseConnectionUrl('postgres://user:pass@localhost:5432/db')
			expect(result?.type).toBe('postgres')
		})

		it('should parse postgresql protocol correctly', () => {
			const result = parseConnectionUrl('postgresql://user:pass@localhost:5432/db')
			expect(result?.type).toBe('postgres')
		})

		it('should parse mysql protocol correctly', () => {
			const result = parseConnectionUrl('mysql://user:pass@localhost:3306/db')
			expect(result?.type).toBe('mysql')
		})

		it('should parse sqlite protocol correctly', () => {
			const result = parseConnectionUrl('sqlite://user:pass@localhost/db')
			expect(result?.type).toBe('sqlite')
		})

		it('should parse libsql protocol correctly', () => {
			const result = parseConnectionUrl('libsql://db.turso.io')
			expect(result?.type).toBe('libsql')
		})
	})

	describe('Typo Detection - Postgres', () => {
		it('should detect postttgr as postgres (shares prefix)', () => {
			const result = parseConnectionUrl('postttgr://user:pass@localhost:5432/db')
			expect(result?.type).toBe('postgres')
		})

		it('should detect postgress as postgres (1 extra char)', () => {
			const result = parseConnectionUrl('postgress://user:pass@localhost:5432/db')
			expect(result?.type).toBe('postgres')
		})

		it('should detect postgrse as postgres (transposition)', () => {
			const result = parseConnectionUrl('postgrse://user:pass@localhost:5432/db')
			expect(result?.type).toBe('postgres')
		})
	})

	describe('Typo Detection - MySQL', () => {
		it('should detect myyql as mysql (1 sub, shares prefix)', () => {
			const result = parseConnectionUrl('myyql://user:pass@localhost:3306/db')
			expect(result?.type).toBe('mysql')
		})

		it('should detect mysq as mysql (missing char)', () => {
			const result = parseConnectionUrl('mysq://user:pass@localhost:3306/db')
			expect(result?.type).toBe('mysql')
		})
	})

	describe('Typo Detection - SQLite', () => {
		it('should detect sqlit as sqlite (missing char)', () => {
			const result = parseConnectionUrl('sqlit://user:pass@localhost/db')
			expect(result?.type).toBe('sqlite')
		})
	})

	describe('Typo Detection - LibSQL', () => {
		it('should detect libslq as libsql (transposition)', () => {
			const result = parseConnectionUrl('libslq://db.turso.io')
			expect(result?.type).toBe('libsql')
		})
	})

	describe('Unsupported Protocols', () => {
		it('should return null for redis (no match)', () => {
			const result = parseConnectionUrl('redis://user:pass@localhost:6379/db')
			expect(result).toBeNull()
		})

		it('should return null for mongodb (no match)', () => {
			const result = parseConnectionUrl('mongodb://user:pass@localhost/db')
			expect(result).toBeNull()
		})

		it('should return null for very short protocol (min 4 chars)', () => {
			const result = parseConnectionUrl('po://user:pass@localhost/db')
			expect(result).toBeNull()
		})

		it('should return null for wildly different protocol', () => {
			const result = parseConnectionUrl('verywrongprotocol://user:pass@localhost:5432/db')
			expect(result).toBeNull()
		})
	})

	describe('Case Insensitivity', () => {
		it('should handle POSTGRES in uppercase', () => {
			const result = parseConnectionUrl('POSTGRES://user:pass@localhost:5432/db')
			expect(result?.type).toBe('postgres')
		})

		it('should handle PostgreSQL in mixed case', () => {
			const result = parseConnectionUrl('PostgreSQL://user:pass@localhost:5432/db')
			expect(result?.type).toBe('postgres')
		})
	})
})
