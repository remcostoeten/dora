/**
 * Hand-rolled SQL lexer + token cursor backing the SQL→Drizzle converter.
 *
 * The supported SQL surface is small and closed (see `sql-to-drizzle.ts`), so a
 * dedicated tokenizer beats a general SQL parser dependency: it keeps the studio
 * bundle free of another runtime package, and — more importantly — it gives us
 * total control over error shape (`parse-error` vs `unsupported-construct`, with
 * a 1-based line) which is what the converter contract actually promises.
 */

import type { Dialect } from '@studio/features/orm-cockpit/ir/types'

export type TTokenKind = 'ident' | 'quoted' | 'string' | 'number' | 'punct' | 'param' | 'eof'

export type TToken = {
	kind: TTokenKind
	/** Source text for idents/puncts, decoded contents for strings/quoted idents. */
	value: string
	/** 1-based line the token starts on. */
	line: number
}

export type TFailureCode = 'parse-error' | 'unsupported-construct'

/** The only error the SQL→Drizzle internals throw; the entry point converts it. */
export class SqlConvertError extends Error {
	readonly code: TFailureCode
	readonly line: number

	constructor(code: TFailureCode, message: string, line: number) {
		super(message)
		this.name = 'SqlConvertError'
		this.code = code
		this.line = line
	}
}

/** Throw a `parse-error` at `line`. */
export function parseError(message: string, line: number): never {
	throw new SqlConvertError('parse-error', message, line)
}

/** Throw an `unsupported-construct` error at `line`. */
export function unsupported(message: string, line: number): never {
	throw new SqlConvertError('unsupported-construct', message, line)
}

const TWO_CHAR_PUNCT = ['<>', '<=', '>=', '!=', '||', '::']
const ONE_CHAR_PUNCT = '(),;.*+-/%<>=[]{}'

export function tokenize(source: string, dialect: Dialect): TToken[] {
	const tokens: TToken[] = []
	let i = 0
	let line = 1
	let positional = 0

	while (i < source.length) {
		const ch = source[i]

		if (ch === '\n') {
			line += 1
			i += 1
			continue
		}
		if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f' || ch === '\v') {
			i += 1
			continue
		}
		if (ch === '-' && source[i + 1] === '-') {
			while (i < source.length && source[i] !== '\n') {
				i += 1
			}
			continue
		}
		if (ch === '#' && dialect === 'mysql') {
			while (i < source.length && source[i] !== '\n') {
				i += 1
			}
			continue
		}
		if (ch === '/' && source[i + 1] === '*') {
			const start = line
			i += 2
			while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
				if (source[i] === '\n') {
					line += 1
				}
				i += 1
			}
			if (i >= source.length) {
				parseError('unterminated block comment', start)
			}
			i += 2
			continue
		}
		if (ch === "'") {
			const start = line
			let value = ''
			i += 1
			while (i < source.length) {
				if (source[i] === "'") {
					if (source[i + 1] === "'") {
						value += "'"
						i += 2
						continue
					}
					break
				}
				if (source[i] === '\\' && dialect === 'mysql' && i + 1 < source.length) {
					value += unescapeMysql(source[i + 1])
					i += 2
					continue
				}
				if (source[i] === '\n') {
					line += 1
				}
				value += source[i]
				i += 1
			}
			if (i >= source.length) {
				parseError('unterminated string literal', start)
			}
			i += 1
			tokens.push({ kind: 'string', value, line: start })
			continue
		}
		if (ch === '"' || ch === '`') {
			const closer = ch
			const start = line
			let value = ''
			i += 1
			while (i < source.length) {
				if (source[i] === closer) {
					if (source[i + 1] === closer) {
						value += closer
						i += 2
						continue
					}
					break
				}
				if (source[i] === '\n') {
					line += 1
				}
				value += source[i]
				i += 1
			}
			if (i >= source.length) {
				parseError('unterminated quoted identifier', start)
			}
			i += 1
			tokens.push({ kind: 'quoted', value, line: start })
			continue
		}
		if (ch === '$' && isDigit(source[i + 1])) {
			let digits = ''
			i += 1
			while (i < source.length && isDigit(source[i])) {
				digits += source[i]
				i += 1
			}
			// Keep `?` numbering past any `$n` already seen so mixed styles can't collide.
			positional = Math.max(positional, Number(digits))
			tokens.push({ kind: 'param', value: `p${digits}`, line })
			continue
		}
		if (ch === '?') {
			positional += 1
			tokens.push({ kind: 'param', value: `p${positional}`, line })
			i += 1
			continue
		}
		if ((ch === ':' || ch === '@') && isIdentStart(source[i + 1])) {
			let name = ''
			i += 1
			while (i < source.length && isIdentPart(source[i])) {
				name += source[i]
				i += 1
			}
			tokens.push({ kind: 'param', value: name, line })
			continue
		}
		if (isDigit(ch) || (ch === '.' && isDigit(source[i + 1]))) {
			let value = ''
			while (i < source.length && isDigit(source[i])) {
				value += source[i]
				i += 1
			}
			if (source[i] === '.') {
				value += '.'
				i += 1
				while (i < source.length && isDigit(source[i])) {
					value += source[i]
					i += 1
				}
			}
			if (source[i] === 'e' || source[i] === 'E') {
				let exponent = source[i]
				let j = i + 1
				if (source[j] === '+' || source[j] === '-') {
					exponent += source[j]
					j += 1
				}
				if (isDigit(source[j])) {
					while (j < source.length && isDigit(source[j])) {
						exponent += source[j]
						j += 1
					}
					value += exponent
					i = j
				}
			}
			tokens.push({ kind: 'number', value, line })
			continue
		}
		if (isIdentStart(ch)) {
			let value = ''
			while (i < source.length && isIdentPart(source[i])) {
				value += source[i]
				i += 1
			}
			tokens.push({ kind: 'ident', value, line })
			continue
		}

		const two = source.slice(i, i + 2)
		if (TWO_CHAR_PUNCT.includes(two)) {
			tokens.push({ kind: 'punct', value: two, line })
			i += 2
			continue
		}
		if (ONE_CHAR_PUNCT.includes(ch)) {
			tokens.push({ kind: 'punct', value: ch, line })
			i += 1
			continue
		}

		parseError(`unexpected character "${ch}"`, line)
	}

	tokens.push({ kind: 'eof', value: '', line })
	return tokens
}

function unescapeMysql(ch: string): string {
	switch (ch) {
		case 'n':
			return '\n'
		case 't':
			return '\t'
		case 'r':
			return '\r'
		case '0':
			return '\0'
		default:
			return ch
	}
}

function isDigit(ch: string | undefined): boolean {
	return ch !== undefined && ch >= '0' && ch <= '9'
}

function isIdentStart(ch: string | undefined): boolean {
	if (ch === undefined) {
		return false
	}
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_'
}

function isIdentPart(ch: string | undefined): boolean {
	return isIdentStart(ch) || isDigit(ch) || ch === '$'
}

/**
 * Cursor over a token array with the keyword/punctuation helpers every parser in
 * this converter needs. All keyword matching is case-insensitive.
 */
export class TokenStream {
	private readonly tokens: TToken[]
	private index = 0

	constructor(tokens: TToken[]) {
		this.tokens = tokens
	}

	peek(offset = 0): TToken {
		const at = this.index + offset
		return this.tokens[at < this.tokens.length ? at : this.tokens.length - 1]
	}

	next(): TToken {
		const token = this.peek()
		if (token.kind !== 'eof') {
			this.index += 1
		}
		return token
	}

	get line(): number {
		return this.peek().line
	}

	get position(): number {
		return this.index
	}

	reset(position: number): void {
		this.index = position
	}

	atEof(): boolean {
		return this.peek().kind === 'eof'
	}

	isKeyword(word: string, offset = 0): boolean {
		const token = this.peek(offset)
		return token.kind === 'ident' && token.value.toUpperCase() === word
	}

	isAnyKeyword(words: readonly string[], offset = 0): boolean {
		return words.some((word) => this.isKeyword(word, offset))
	}

	matchKeyword(word: string): boolean {
		if (this.isKeyword(word)) {
			this.next()
			return true
		}
		return false
	}

	/** Match a whole keyword sequence atomically (`NOT NULL`, `ON DELETE`, …). */
	matchKeywordSequence(...words: string[]): boolean {
		for (let offset = 0; offset < words.length; offset += 1) {
			if (!this.isKeyword(words[offset], offset)) {
				return false
			}
		}
		for (const _ of words) {
			this.next()
		}
		return true
	}

	expectKeyword(word: string): void {
		if (!this.matchKeyword(word)) {
			parseError(`expected ${word} but found ${describe(this.peek())}`, this.line)
		}
	}

	isPunct(value: string, offset = 0): boolean {
		const token = this.peek(offset)
		return token.kind === 'punct' && token.value === value
	}

	isAnyPunct(values: readonly string[], offset = 0): boolean {
		return values.some((value) => this.isPunct(value, offset))
	}

	matchPunct(value: string): boolean {
		if (this.isPunct(value)) {
			this.next()
			return true
		}
		return false
	}

	expectPunct(value: string): void {
		if (!this.matchPunct(value)) {
			parseError(`expected "${value}" but found ${describe(this.peek())}`, this.line)
		}
	}

	/** Consume an identifier (bare or quoted) and return its bare text. */
	identifier(): string {
		const token = this.peek()
		if (token.kind === 'ident' || token.kind === 'quoted') {
			this.next()
			return token.value
		}
		return parseError(`expected an identifier but found ${describe(token)}`, token.line)
	}

	isIdentifier(offset = 0): boolean {
		const kind = this.peek(offset).kind
		return kind === 'ident' || kind === 'quoted'
	}
}

export function describe(token: TToken): string {
	if (token.kind === 'eof') {
		return 'end of input'
	}
	return `"${token.value}"`
}
