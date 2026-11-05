/**
 * Source-aware context helpers for the Drizzle LSP completion provider.
 *
 * The completion provider matches query context with regexes that assume a
 * single logical line. Real Drizzle queries are multi-line method chains, and
 * the editor buffer also contains comments and strings the provider must not
 * fire inside. These helpers normalise the buffer so the existing matchers see
 * the whole statement, and report whether the cursor sits in code.
 *
 * Every function here is pure so it can be unit-tested without Monaco.
 *
 * @see ./lsp-patterns.ts
 * @see ../components/code-editor.tsx
 */

export type EditorScope = 'code' | 'string' | 'comment'

type ScanResult = {
	masked: string
	endScope: EditorScope
}

/**
 * Single pass over the text that both masks strings/comments (replacing their
 * contents with spaces while preserving length and newlines) and reports the
 * scope the text ends in. Index alignment is preserved so marker positions
 * computed against the masked text map back to the original buffer.
 */
export function scanCode(text: string): ScanResult {
	type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'
	let state: State = 'code'
	let masked = ''

	for (let i = 0; i < text.length; i++) {
		const char = text.charAt(i)
		const next = i + 1 < text.length ? text.charAt(i + 1) : ''

		if (state === 'code') {
			if (char === '/' && next === '/') {
				state = 'line'
				masked += '  '
				i++
				continue
			}
			if (char === '/' && next === '*') {
				state = 'block'
				masked += '  '
				i++
				continue
			}
			if (char === '"') {
				state = 'double'
				masked += ' '
				continue
			}
			if (char === "'") {
				state = 'single'
				masked += ' '
				continue
			}
			if (char === '`') {
				state = 'template'
				masked += ' '
				continue
			}
			masked += char
			continue
		}

		if (state === 'line') {
			if (char === '\n') {
				state = 'code'
				masked += '\n'
			} else {
				masked += ' '
			}
			continue
		}

		if (state === 'block') {
			if (char === '*' && next === '/') {
				state = 'code'
				masked += '  '
				i++
			} else {
				masked += char === '\n' ? '\n' : ' '
			}
			continue
		}

		if (state === 'single' || state === 'double') {
			if (char === '\\') {
				masked += '  '
				i++
			} else if (
				(state === 'single' && char === "'") ||
				(state === 'double' && char === '"')
			) {
				state = 'code'
				masked += ' '
			} else if (char === '\n') {
				state = 'code'
				masked += '\n'
			} else {
				masked += ' '
			}
			continue
		}

		if (char === '\\') {
			masked += '  '
			i++
		} else if (char === '`') {
			state = 'code'
			masked += ' '
		} else {
			masked += char === '\n' ? '\n' : ' '
		}
	}

	let endScope: EditorScope = 'code'
	if (state === 'line' || state === 'block') endScope = 'comment'
	else if (state === 'single' || state === 'double' || state === 'template') endScope = 'string'

	return { masked, endScope }
}

/**
 * Replaces the contents of strings and comments with spaces, preserving the
 * length and newlines of the original text.
 */
export function maskStringsAndComments(text: string): string {
	return scanCode(text).masked
}

/**
 * Reports the scope the cursor sits in, given the buffer text up to the cursor.
 */
export function getScopeAtEnd(textUntilCursor: string): EditorScope {
	return scanCode(textUntilCursor).endScope
}

const CONTINUATION_START = /^[).,\]};?:]/
const OPEN_END = /[([{,.+\-*/%&|=<>?:]$/

/**
 * Collapses the current statement — the method chain the cursor belongs to,
 * which may span several physical lines — into a single logical line ending at
 * the cursor, so the single-line context matchers can see the full chain.
 *
 * Expects the masked buffer text from the document start up to the cursor.
 */
export function getStatementPrefix(maskedTextUntilCursor: string): string {
	const lines = maskedTextUntilCursor.split('\n')
	let start = lines.length - 1

	while (start > 0) {
		const prev = lines[start - 1].trim()
		const current = lines[start].trim()
		if (prev === '') break
		if (prev.endsWith(';')) break
		const currentIsContinuation = CONTINUATION_START.test(current)
		const prevIsOpen = OPEN_END.test(prev) || prev.endsWith('=>')
		if (!currentIsContinuation && !prevIsOpen) break
		start--
	}

	let result = lines[start].replace(/^\s+/, '')
	for (let i = start + 1; i < lines.length; i++) {
		const segment = lines[i].replace(/^\s+/, '')
		if (CONTINUATION_START.test(segment)) {
			result += segment
		} else {
			result += ' ' + segment
		}
	}
	return result
}

/** True when the name can be written as a bare JavaScript identifier. */
export function isSafeIdentifier(name: string): boolean {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)
}

const DECLARATION_KEYWORDS = new Set([
	'const',
	'let',
	'var',
	'function',
	'async',
	'await',
	'return',
	'if',
	'else',
	'for',
	'while',
	'new',
	'of',
	'in',
	'true',
	'false',
	'null',
	'undefined'
])

function addIdentifiersFromGroup(group: string, into: Set<string>): void {
	const tokens = group.match(/[A-Za-z_$][\w$]*/g)
	if (!tokens) return
	for (const token of tokens) {
		if (!DECLARATION_KEYWORDS.has(token)) into.add(token)
	}
}

/**
 * Best-effort collection of identifiers the user has bound in the buffer
 * (variable declarations, function and arrow parameters). Used to suppress
 * typo warnings on names that are legitimately defined locally.
 */
export function collectDeclaredIdentifiers(text: string): string[] {
	const names = new Set<string>()

	const declaration = /\b(?:const|let|var)\s+([^=;\n]+?)\s*=/g
	let match: RegExpExecArray | null
	while ((match = declaration.exec(text)) !== null) {
		addIdentifiersFromGroup(match[1], names)
	}

	const arrow = /(?:\basync\s+)?(?:\(([^)]*)\)|([A-Za-z_$][\w$]*))\s*=>/g
	while ((match = arrow.exec(text)) !== null) {
		addIdentifiersFromGroup(match[1] ?? match[2] ?? '', names)
	}

	const fn = /\bfunction\b[^(]*\(([^)]*)\)/g
	while ((match = fn.exec(text)) !== null) {
		addIdentifiersFromGroup(match[1], names)
	}

	return Array.from(names)
}
