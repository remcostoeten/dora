export type SqlTokenKind =
	| 'keyword'
	| 'function'
	| 'string'
	| 'number'
	| 'comment'
	| 'operator'
	| 'identifier'
	| 'plain'

export type SqlToken = {
	text: string
	kind: SqlTokenKind
}

const SQL_KEYWORDS = new Set([
	'add',
	'alter',
	'and',
	'as',
	'asc',
	'begin',
	'between',
	'by',
	'case',
	'commit',
	'create',
	'delete',
	'desc',
	'distinct',
	'drop',
	'else',
	'end',
	'exists',
	'explain',
	'from',
	'group',
	'having',
	'ilike',
	'in',
	'inner',
	'insert',
	'into',
	'is',
	'join',
	'left',
	'like',
	'limit',
	'not',
	'null',
	'on',
	'or',
	'order',
	'outer',
	'returning',
	'right',
	'rollback',
	'select',
	'set',
	'table',
	'then',
	'truncate',
	'union',
	'update',
	'values',
	'when',
	'where',
	'with'
])

const SQL_FUNCTIONS = new Set([
	'avg',
	'coalesce',
	'count',
	'current_date',
	'date_trunc',
	'lower',
	'max',
	'min',
	'now',
	'round',
	'strftime',
	'sum',
	'upper'
])

export function splitSqlStatements(sql: string): string[] {
	const statements: string[] = []
	let current = ''
	let quote: '"' | "'" | '`' | null = null
	let lineComment = false
	let blockComment = false

	for (let i = 0; i < sql.length; i += 1) {
		const char = sql[i]
		const next = sql[i + 1]

		if (lineComment) {
			current += char
			if (char === '\n') lineComment = false
			continue
		}

		if (blockComment) {
			current += char
			if (char === '*' && next === '/') {
				current += next
				i += 1
				blockComment = false
			}
			continue
		}

		if (quote) {
			current += char
			if (char === quote) {
				if (next === quote) {
					current += next
					i += 1
				} else {
					quote = null
				}
			}
			continue
		}

		if (char === '-' && next === '-') {
			current += char + next
			i += 1
			lineComment = true
			continue
		}

		if (char === '/' && next === '*') {
			current += char + next
			i += 1
			blockComment = true
			continue
		}

		if (char === '"' || char === "'" || char === '`') {
			current += char
			quote = char
			continue
		}

		if (char === ';') {
			const statement = current.trim()
			if (statement) statements.push(statement)
			current = ''
			continue
		}

		current += char
	}

	const tail = current.trim()
	if (tail) statements.push(tail)
	return statements
}

export function getSqlStatementKind(sql: string): string {
	const firstStatement = splitSqlStatements(sql)[0] ?? sql
	const withoutComments = firstStatement
		.replace(/^\s*--.*$/gm, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.trim()
	const match = withoutComments.match(/^[a-z_]+/i)
	return match ? match[0].toUpperCase() : 'SQL'
}

export function buildDryRunSql(sql: string): string {
	const statements = splitSqlStatements(sql)
	if (statements.length === 0) return ''

	return statements
		.map(function (statement) {
			const kind = getSqlStatementKind(statement)
			if (kind === 'EXPLAIN') return statement
			return `EXPLAIN ${statement}`
		})
		.join(';\n')
}

export function tokenizeSql(sql: string): SqlToken[] {
	const tokens: SqlToken[] = []
	const pattern =
		/(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:[^"]|"")*"|`[^`]*`|\b\d+(?:\.\d+)?\b|[<>=!~]+|[(),.;*+-/])|([a-z_][a-z0-9_$]*)/gi
	let cursor = 0
	let match: RegExpExecArray | null

	while ((match = pattern.exec(sql)) !== null) {
		if (match.index > cursor) {
			tokens.push({ text: sql.slice(cursor, match.index), kind: 'plain' })
		}

		const token = match[0]
		const word = match[2]?.toLowerCase()
		if (token.startsWith('--') || token.startsWith('/*')) {
			tokens.push({ text: token, kind: 'comment' })
		} else if (token.startsWith("'") || token.startsWith('"') || token.startsWith('`')) {
			tokens.push({ text: token, kind: 'string' })
		} else if (/^\d/.test(token)) {
			tokens.push({ text: token, kind: 'number' })
		} else if (word && SQL_KEYWORDS.has(word)) {
			tokens.push({ text: token, kind: 'keyword' })
		} else if (word && SQL_FUNCTIONS.has(word)) {
			tokens.push({ text: token, kind: 'function' })
		} else if (word) {
			tokens.push({ text: token, kind: 'identifier' })
		} else if (/^[<>=!~(),.;*+\-/]+$/.test(token)) {
			tokens.push({ text: token, kind: 'operator' })
		} else {
			tokens.push({ text: token, kind: 'plain' })
		}

		cursor = pattern.lastIndex
	}

	if (cursor < sql.length) {
		tokens.push({ text: sql.slice(cursor), kind: 'plain' })
	}

	return tokens
}
