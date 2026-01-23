import { describe, it, expect } from "vitest";
import { getDbName, getChainMode, isInsideSelectParens, isInsideInsertParens, isInsideUpdateParens, isInsideDeleteParens, isInsideFromParens, isInsideWhereParens, isInsideJoinParens, getTableMatch, getColumnMatch } from "@/features/drizzle-runner/utils/lsp-patterns";

describe('Drizzle LSP Patterns', () => {
	describe('getDbName', () => {
		it('detects db context', () => {
			expect(getDbName('const x = db.')).toBe('db')
			expect(getDbName('db.')).toBe('db')
		})

		it('detects tx context', () => {
			expect(getDbName('await tx.')).toBe('tx')
		})

		it('returns null for unrelated text', () => {
			expect(getDbName('const x = ')).toBeNull()
		})
	})

	describe('getChainMode', () => {
		it('detects select chain', () => {
			expect(getChainMode('db.select(')).toBe('select')
			expect(getChainMode('db.select().from(')).toBe('select')
			expect(getChainMode('db.select().from(users).where(')).toBe('select')
		})

		it('detects insert chain', () => {
			expect(getChainMode('db.insert(')).toBe('insert')
			expect(getChainMode('db.insert(users).values(')).toBe('insert')
		})

		it('detects update chain', () => {
			expect(getChainMode('db.update(')).toBe('update')
			expect(getChainMode('db.update(users).set(')).toBe('update')
		})

		it('detects delete chain', () => {
			expect(getChainMode('db.delete(')).toBe('delete')
			expect(getChainMode('db.delete(users).where(')).toBe('delete')
		})
	})

	describe('isInside...Parens (Partial Matching)', () => {
		describe('isInsideSelectParens', () => {
			it('matches empty parens', () => {
				expect(isInsideSelectParens('db.select(')).toBe(true)
				expect(isInsideSelectParens('db.select(  ')).toBe(true)
			})

			it('matches partial text', () => {
				expect(isInsideSelectParens('db.select(us')).toBe(true)
				expect(isInsideSelectParens('db.select(user')).toBe(true)
			})

			it('does not match closed parens', () => {
				expect(isInsideSelectParens('db.select(users)')).toBe(false)
			})
		})

		describe('isInsideFromParens', () => {
			it('matches empty parens', () => {
				expect(isInsideFromParens('.from(')).toBe(true)
			})

			it('matches partial text', () => {
				expect(isInsideFromParens('.from(tab')).toBe(true)
			})
		})

		describe('isInsideWhereParens', () => {
			it('matches empty parens', () => {
				expect(isInsideWhereParens('.where(')).toBe(true)
			})

			it('matches partial text', () => {
				expect(isInsideWhereParens('.where(eq')).toBe(true)
			})
		})

		describe('isInsideJoinParens', () => {
			it('matches leftJoin', () => {
				expect(isInsideJoinParens('.leftJoin(')).toBe(true)
				expect(isInsideJoinParens('.leftJoin(cus')).toBe(true)
			})

			it('matches innerJoin', () => {
				expect(isInsideJoinParens('.innerJoin(')).toBe(true)
				expect(isInsideJoinParens('.innerJoin(ord')).toBe(true)
			})
		})
	})

	describe('getTableMatch', () => {
		it('matches simple table name with dot', () => {
			const match = getTableMatch('select * from users.')
			expect(match?.[1]).toBe('users')
		})

		it('matches table.column', () => {
			const match = getTableMatch('users.na')
			expect(match?.[1]).toBe('users')
			expect(match?.[2]).toBe('na')
		})
	})
})
