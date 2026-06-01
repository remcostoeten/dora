import { describe, expect, it } from 'vitest'
import { buildDryRunSql, getSqlStatementKind, splitSqlStatements, tokenizeSql } from './sql-code-utils'

describe('sql-code-utils', function () {
	it('splits statements without splitting semicolons inside strings', function () {
		expect(splitSqlStatements("SELECT 'a;b'; UPDATE users SET name = 'c';")).toEqual([
			"SELECT 'a;b'",
			"UPDATE users SET name = 'c'"
		])
	})

	it('builds non-mutating explain dry run SQL', function () {
		expect(buildDryRunSql("UPDATE users SET name = 'Quinten' WHERE id = 1;")).toBe(
			"EXPLAIN UPDATE users SET name = 'Quinten' WHERE id = 1"
		)
	})

	it('detects the leading statement kind', function () {
		expect(getSqlStatementKind('-- sample\nselect * from messages')).toBe('SELECT')
	})

	it('tokenizes keywords and strings for lightweight highlighting', function () {
		const tokens = tokenizeSql("SELECT * FROM messages WHERE message ILIKE '%quinten%'")
		expect(tokens.some((token) => token.kind === 'keyword' && token.text === 'SELECT')).toBe(true)
		expect(tokens.some((token) => token.kind === 'string' && token.text === "'%quinten%'")).toBe(true)
	})
})
