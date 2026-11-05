import { describe, it, expect } from 'vitest'
import {
	scanCode,
	maskStringsAndComments,
	getScopeAtEnd,
	getStatementPrefix,
	isSafeIdentifier,
	collectDeclaredIdentifiers
} from '@/features/drizzle-runner/utils/lsp-context'
import {
	getTableMatch,
	getChainMode,
	isInsideFromParens
} from '@/features/drizzle-runner/utils/lsp-patterns'

function statementOf(prefix: string): string {
	return getStatementPrefix(maskStringsAndComments(prefix))
}

describe('lsp-context', () => {
	describe('isSafeIdentifier', () => {
		it('accepts valid JS identifiers', () => {
			expect(isSafeIdentifier('users')).toBe(true)
			expect(isSafeIdentifier('_private$1')).toBe(true)
		})

		it('rejects names that are not bare identifiers', () => {
			expect(isSafeIdentifier('user-profiles')).toBe(false)
			expect(isSafeIdentifier('2fa_tokens')).toBe(false)
			expect(isSafeIdentifier('order items')).toBe(false)
		})
	})

	describe('maskStringsAndComments', () => {
		it('preserves length and masks string contents', () => {
			const input = 'eq(users.id, "hello")'
			const masked = maskStringsAndComments(input)
			expect(masked.length).toBe(input.length)
			expect(masked).toContain('users.id')
			expect(masked).not.toContain('hello')
		})

		it('masks line comments but keeps code', () => {
			const input = 'db.select() // from users table'
			const masked = maskStringsAndComments(input)
			expect(masked).toContain('db.select()')
			expect(masked).not.toContain('users table')
			expect(masked.length).toBe(input.length)
		})

		it('masks template literals and preserves newlines', () => {
			const input = 'db.execute(sql`SELECT *\nFROM users`)'
			const masked = maskStringsAndComments(input)
			expect(masked).not.toContain('SELECT')
			expect(masked.split('\n').length).toBe(2)
			expect(masked.length).toBe(input.length)
		})

		it('masks block comments across lines', () => {
			const input = 'a\n/* users\nposts */\nb'
			const masked = maskStringsAndComments(input)
			expect(masked).not.toContain('users')
			expect(masked).not.toContain('posts')
			expect(masked.startsWith('a')).toBe(true)
			expect(masked.endsWith('b')).toBe(true)
		})
	})

	describe('getScopeAtEnd', () => {
		it('detects code scope', () => {
			expect(getScopeAtEnd('db.select().from(')).toBe('code')
			expect(getScopeAtEnd('eq(users.id, "abc")')).toBe('code')
		})

		it('detects string scope', () => {
			expect(getScopeAtEnd('eq(users.email, "')).toBe('string')
			expect(getScopeAtEnd('db.execute(sql`SELECT ')).toBe('string')
		})

		it('detects comment scope', () => {
			expect(getScopeAtEnd('db.select() // pick a ')).toBe('comment')
			expect(getScopeAtEnd('/* todo ')).toBe('comment')
		})
	})

	describe('getStatementPrefix', () => {
		it('returns a single line unchanged (trimmed)', () => {
			expect(getStatementPrefix('db.select().from(users).where(')).toBe(
				'db.select().from(users).where('
			)
		})

		it('collapses a multi-line method chain', () => {
			const prefix = 'db.select()\n  .from(users)\n  .where('
			expect(getStatementPrefix(prefix)).toBe('db.select().from(users).where(')
		})

		it('does not merge separate statements', () => {
			const prefix = 'const a = db.select().from(users)\ndb.insert(posts).values('
			expect(getStatementPrefix(prefix)).toBe('db.insert(posts).values(')
		})

		it('keeps an assignment that continues onto the next line', () => {
			const prefix = 'const rows = await db\n  .select()'
			expect(getStatementPrefix(prefix)).toBe('const rows = await db.select()')
		})

		it('reaches the chain table inside a transaction body', () => {
			const prefix = 'db.transaction(async tx => {\n  tx.select().from(users).where('
			const stmt = getStatementPrefix(prefix)
			expect(stmt).toContain('from(users)')
			expect(stmt.endsWith('.where(')).toBe(true)
		})
	})

	describe('multi-line context feeds the single-line matchers', () => {
		it('recovers the table for column completion across lines', () => {
			const stmt = statementOf('db\n  .select()\n  .from(users)\n  .where(eq(users.')
			const match = getTableMatch(stmt)
			expect(match?.[1]).toBe('users')
		})

		it('recovers select chain mode across lines', () => {
			const stmt = statementOf('db.select()\n  .from(users)\n  .')
			expect(getChainMode(stmt)).toBe('select')
		})

		it('detects from-parens context across lines', () => {
			const stmt = statementOf('db\n  .select()\n  .from(')
			expect(isInsideFromParens(stmt)).toBe(true)
		})
	})

	describe('collectDeclaredIdentifiers', () => {
		it('collects const/let/var bindings', () => {
			const ids = collectDeclaredIdentifiers('const userId = 5\nlet name = "x"')
			expect(ids).toContain('userId')
			expect(ids).toContain('name')
		})

		it('collects destructured bindings', () => {
			const ids = collectDeclaredIdentifiers('const { rows } = await db.select().from(users)')
			expect(ids).toContain('rows')
		})

		it('collects arrow and function parameters', () => {
			const arrow = collectDeclaredIdentifiers('db.transaction(async tx => tx.select())')
			expect(arrow).toContain('tx')
			const mapped = collectDeclaredIdentifiers('rows.map((row) => row.id)')
			expect(mapped).toContain('row')
			const fn = collectDeclaredIdentifiers('function run(a, b) { return a }')
			expect(fn).toContain('a')
			expect(fn).toContain('b')
		})
	})

	describe('scanCode', () => {
		it('reports the ending scope and masks together', () => {
			const result = scanCode('eq(users.id, "abc')
			expect(result.endScope).toBe('string')
			expect(result.masked.length).toBe('eq(users.id, "abc'.length)
		})
	})
})
