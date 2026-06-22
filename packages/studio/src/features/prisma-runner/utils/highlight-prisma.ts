export type PrismaTokenKind =
	| 'keyword'
	| 'type'
	| 'attribute'
	| 'function'
	| 'comment'
	| 'punctuation'
	| 'string'
	| 'plain'

export type PrismaToken = { text: string; kind: PrismaTokenKind }

const KEYWORDS = new Set(['datasource', 'generator', 'model', 'enum', 'type', 'view'])
const SCALAR_TYPES = new Set([
	'String',
	'Boolean',
	'Int',
	'BigInt',
	'Float',
	'Decimal',
	'DateTime',
	'Json',
	'Bytes'
])
const FUNCTIONS = new Set(['autoincrement', 'now', 'uuid', 'cuid', 'env', 'dbgenerated'])

const TOKEN_PATTERN = /(\/\/[^\n]*|@@?\w+|"[^"]*"|\w+|\s+|[^\s\w])/g

function classify(token: string, nextNonSpace: string | undefined): PrismaTokenKind {
	if (token.startsWith('//')) return 'comment'
	if (token.startsWith('@')) return 'attribute'
	if (token.startsWith('"')) return 'string'
	if (/^\s+$/.test(token)) return 'plain'
	if (/^[^\s\w]$/.test(token)) return 'punctuation'
	if (KEYWORDS.has(token)) return 'keyword'
	if (SCALAR_TYPES.has(token)) return 'type'
	if (FUNCTIONS.has(token) && nextNonSpace === '(') return 'function'
	// A capitalized identifier that isn't a scalar is almost always a model
	// reference (relation target) — surface it as a type for readability.
	if (/^[A-Z]/.test(token)) return 'type'
	return 'plain'
}

/**
 * Tokenizes a single line of Prisma DSL into typed spans for syntax
 * highlighting. Pure and deterministic — safe to unit test and to render.
 */
export function tokenizePrismaLine(line: string): PrismaToken[] {
	const matches = line.match(TOKEN_PATTERN)
	if (!matches) return line ? [{ text: line, kind: 'plain' }] : []

	const tokens: PrismaToken[] = []
	for (let i = 0; i < matches.length; i++) {
		const text = matches[i]
		let nextNonSpace: string | undefined
		for (let j = i + 1; j < matches.length; j++) {
			if (!/^\s+$/.test(matches[j])) {
				nextNonSpace = matches[j]
				break
			}
		}
		tokens.push({ text, kind: classify(text, nextNonSpace) })
	}
	return tokens
}

export function tokenizePrisma(code: string): PrismaToken[][] {
	return code.split('\n').map(tokenizePrismaLine)
}
