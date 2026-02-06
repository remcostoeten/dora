import { useMemo } from 'react'
import type { SnippetLanguage } from '../utilities/connection-snippet-generator'

type Token = {
	text: string
	type: 'keyword' | 'string' | 'comment' | 'function' | 'number' | 'operator' | 'property' | 'variable' | 'flag' | 'plain'
}

const TOKEN_COLORS: Record<Token['type'], string> = {
	keyword: 'text-purple-400',
	string: 'text-amber-300',
	comment: 'text-zinc-500 italic',
	function: 'text-blue-400',
	number: 'text-orange-300',
	operator: 'text-zinc-400',
	property: 'text-cyan-300',
	variable: 'text-red-300',
	flag: 'text-zinc-400',
	plain: 'text-zinc-300',
}

function tokenizeLine(line: string, language: SnippetLanguage): Token[] {
	switch (language) {
		case 'terminal':
			return tokenizeShell(line)
		case 'nodejs':
			return tokenizeJS(line)
		case 'python':
			return tokenizePython(line)
		case 'prisma':
			return tokenizePrisma(line)
		default:
			return [{ text: line, type: 'plain' }]
	}
}

function tokenizeShell(line: string): Token[] {
	const tokens: Token[] = []
	// Pattern: ENVVAR='value' command -flags args
	const regex = /([A-Z_]+=)('[^']*'|"[^"]*")|('[^']*'|"[^"]*")|(-[a-zA-Z]\b)|(\b(?:psql|docker|pg_dump|pg_restore)\b)|([A-Z_]{2,}\b)|(\S+)/g
	let match: RegExpExecArray | null

	let lastIndex = 0
	while ((match = regex.exec(line)) !== null) {
		if (match.index > lastIndex) {
			tokens.push({ text: line.slice(lastIndex, match.index), type: 'plain' })
		}

		if (match[1] && match[2]) {
			// ENV_VAR='value'
			tokens.push({ text: match[1], type: 'variable' })
			tokens.push({ text: match[2], type: 'string' })
		} else if (match[3]) {
			// Quoted string
			tokens.push({ text: match[3], type: 'string' })
		} else if (match[4]) {
			// Flag like -h, -p, -U, -d
			tokens.push({ text: match[4], type: 'flag' })
		} else if (match[5]) {
			// Command
			tokens.push({ text: match[5], type: 'function' })
		} else if (match[6]) {
			// ENV variable reference
			tokens.push({ text: match[6], type: 'variable' })
		} else if (match[7]) {
			tokens.push({ text: match[7], type: 'plain' })
		}

		lastIndex = regex.lastIndex
	}

	if (lastIndex < line.length) {
		tokens.push({ text: line.slice(lastIndex), type: 'plain' })
	}

	return tokens
}

function tokenizeJS(line: string): Token[] {
	const tokens: Token[] = []
	const regex = /(\/\/.*$)|('[^']*'|"[^"]*"|`[^`]*`)|\b(import|from|const|let|var|await|async|function|new|return)\b|\b(console)\b\.(log|error|warn)\b|(\.\w+)\s*(?=\()|(\b\d+\b)|([{}();,=])|(\w+)/g
	let match: RegExpExecArray | null

	let lastIndex = 0
	while ((match = regex.exec(line)) !== null) {
		if (match.index > lastIndex) {
			tokens.push({ text: line.slice(lastIndex, match.index), type: 'plain' })
		}

		if (match[1]) {
			tokens.push({ text: match[1], type: 'comment' })
		} else if (match[2]) {
			tokens.push({ text: match[2], type: 'string' })
		} else if (match[3]) {
			tokens.push({ text: match[3], type: 'keyword' })
		} else if (match[4] && match[5]) {
			tokens.push({ text: match[4], type: 'function' })
			tokens.push({ text: '.', type: 'operator' })
			tokens.push({ text: match[5], type: 'function' })
		} else if (match[6]) {
			// .method before (
			tokens.push({ text: match[6], type: 'function' })
		} else if (match[7]) {
			tokens.push({ text: match[7], type: 'number' })
		} else if (match[8]) {
			tokens.push({ text: match[8], type: 'operator' })
		} else if (match[9]) {
			tokens.push({ text: match[9], type: 'plain' })
		}

		lastIndex = regex.lastIndex
	}

	if (lastIndex < line.length) {
		tokens.push({ text: line.slice(lastIndex), type: 'plain' })
	}

	return tokens
}

function tokenizePython(line: string): Token[] {
	const tokens: Token[] = []
	const regex = /(#.*$)|("[^"]*"|'[^']*')|\b(import|from|as|def|class|return|if|else|elif|with|for|in|not|and|or|True|False|None)\b|\b(print|connect|cursor|execute|fetchall|fetchone)\b(?=\s*\()|(\b\d+\b)|([().,=:])|(\w+)/g
	let match: RegExpExecArray | null

	let lastIndex = 0
	while ((match = regex.exec(line)) !== null) {
		if (match.index > lastIndex) {
			tokens.push({ text: line.slice(lastIndex, match.index), type: 'plain' })
		}

		if (match[1]) {
			tokens.push({ text: match[1], type: 'comment' })
		} else if (match[2]) {
			tokens.push({ text: match[2], type: 'string' })
		} else if (match[3]) {
			tokens.push({ text: match[3], type: 'keyword' })
		} else if (match[4]) {
			tokens.push({ text: match[4], type: 'function' })
		} else if (match[5]) {
			tokens.push({ text: match[5], type: 'number' })
		} else if (match[6]) {
			tokens.push({ text: match[6], type: 'operator' })
		} else if (match[7]) {
			tokens.push({ text: match[7], type: 'plain' })
		}

		lastIndex = regex.lastIndex
	}

	if (lastIndex < line.length) {
		tokens.push({ text: line.slice(lastIndex), type: 'plain' })
	}

	return tokens
}

function tokenizePrisma(line: string): Token[] {
	const tokens: Token[] = []
	const regex = /(\/\/.*$)|("[^"]*")|\b(datasource|generator|model|enum)\b|\b(provider|url|output|db)\b|([={}])|(\w+)/g
	let match: RegExpExecArray | null

	let lastIndex = 0
	while ((match = regex.exec(line)) !== null) {
		if (match.index > lastIndex) {
			tokens.push({ text: line.slice(lastIndex, match.index), type: 'plain' })
		}

		if (match[1]) {
			tokens.push({ text: match[1], type: 'comment' })
		} else if (match[2]) {
			tokens.push({ text: match[2], type: 'string' })
		} else if (match[3]) {
			tokens.push({ text: match[3], type: 'keyword' })
		} else if (match[4]) {
			tokens.push({ text: match[4], type: 'property' })
		} else if (match[5]) {
			tokens.push({ text: match[5], type: 'operator' })
		} else if (match[6]) {
			tokens.push({ text: match[6], type: 'plain' })
		}

		lastIndex = regex.lastIndex
	}

	if (lastIndex < line.length) {
		tokens.push({ text: line.slice(lastIndex), type: 'plain' })
	}

	return tokens
}

type Props = {
	code: string
	language: SnippetLanguage
}

export function SnippetHighlight({ code, language }: Props) {
	const highlighted = useMemo(function () {
		return code.split('\n').map(function (line, i) {
			return {
				key: i,
				tokens: tokenizeLine(line, language)
			}
		})
	}, [code, language])

	return (
		<>
			{highlighted.map(function (line) {
				return (
					<div key={line.key} className='leading-5'>
						{line.tokens.length === 0 ? (
							<span>{'\n'}</span>
						) : (
							line.tokens.map(function (token, j) {
								return (
									<span key={j} className={TOKEN_COLORS[token.type]}>
										{token.text}
									</span>
								)
							})
						)}
					</div>
				)
			})}
		</>
	)
}
