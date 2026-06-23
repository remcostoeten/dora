import { describe, expect, it } from 'vitest'
import {
	tokenizePrismaLine,
	tokenizePrisma,
	type PrismaToken
} from '@/features/prisma-runner/utils/highlight-prisma'

function kindOf(tokens: PrismaToken[], text: string): string | undefined {
	return tokens.find((token) => token.text === text)?.kind
}

describe('tokenizePrismaLine', function () {
	it('classifies keywords and model references', function () {
		const tokens = tokenizePrismaLine('model User {')
		expect(kindOf(tokens, 'model')).toBe('keyword')
		expect(kindOf(tokens, 'User')).toBe('type')
		expect(kindOf(tokens, '{')).toBe('punctuation')
	})

	it('classifies scalar types, attributes, and functions', function () {
		const tokens = tokenizePrismaLine('  id Int  @id @default(autoincrement())')
		expect(kindOf(tokens, 'Int')).toBe('type')
		expect(kindOf(tokens, '@id')).toBe('attribute')
		expect(kindOf(tokens, '@default')).toBe('attribute')
		expect(kindOf(tokens, 'autoincrement')).toBe('function')
	})

	it('treats a bare type-name not followed by ( as a type, not a function', function () {
		const tokens = tokenizePrismaLine('  role String?')
		expect(kindOf(tokens, 'String')).toBe('type')
	})

	it('classifies comments and strings', function () {
		expect(kindOf(tokenizePrismaLine('  // a note'), '// a note')).toBe('comment')
		const env = tokenizePrismaLine('  url      = env("DATABASE_URL")')
		expect(kindOf(env, 'env')).toBe('function')
		expect(kindOf(env, '"DATABASE_URL"')).toBe('string')
	})

	it('preserves the full text of a line across its tokens', function () {
		const line = '  user User @relation(fields: [user_id], references: [id])'
		const joined = tokenizePrismaLine(line)
			.map((token) => token.text)
			.join('')
		expect(joined).toBe(line)
	})
})

describe('tokenizePrisma', function () {
	it('returns one token array per line, including blank lines', function () {
		const lines = tokenizePrisma('model A {\n\n}')
		expect(lines).toHaveLength(3)
		expect(lines[1]).toEqual([])
	})
})
