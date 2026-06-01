function unquoteIdentifierPart(part: string): string {
	const trimmed = part.trim()
	if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
		return trimmed.slice(1, -1).replace(/""/g, '"')
	}
	return trimmed
}

function normalizeIdentifier(identifier: string): string | undefined {
	const trimmed = identifier.trim()
	if (!trimmed) return undefined

	const parts = trimmed.split('.').map(unquoteIdentifierPart).filter(Boolean)
	if (parts.length === 0 || parts.length > 2) return undefined

	return parts.join('.')
}

function matchLeadingIdentifier(segment: string): string | undefined {
	const match = segment.match(
		/^\s*((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][\w$]*))?)/
	)
	if (!match) return undefined
	return normalizeIdentifier(match[1])
}

function trimSqlSegment(segment: string): string {
	return segment.replace(/\s+/g, ' ').trim()
}

function extractFromClauseSegment(query: string): string | undefined {
	const fromMatch = query.match(/\bfrom\b([\s\S]*)/i)
	if (!fromMatch) return undefined

	const afterFrom = fromMatch[1]
	const boundaryMatch = afterFrom.match(
		/\b(where|group\s+by|order\s+by|limit|offset|returning|union|intersect|except|having|for)\b/i
	)

	if (!boundaryMatch || boundaryMatch.index === undefined) {
		return trimSqlSegment(afterFrom)
	}

	return trimSqlSegment(afterFrom.slice(0, boundaryMatch.index))
}

function extractSingleSelectTable(query: string): string | undefined {
	const fromSegment = extractFromClauseSegment(query)
	if (!fromSegment) return undefined
	if (fromSegment.startsWith('(')) return undefined
	if (/\bjoin\b/i.test(fromSegment) || fromSegment.includes(',')) return undefined

	return matchLeadingIdentifier(fromSegment)
}

function extractSingleDmlTable(query: string, pattern: RegExp): string | undefined {
	const match = query.match(pattern)
	if (!match) return undefined
	return normalizeIdentifier(match[1])
}

function extractSingleDrizzleTable(query: string): string | undefined {
	const match = query.match(/\.from\(\s*([^)]+?)\s*\)/)
	if (!match) return undefined

	const candidate = trimSqlSegment(match[1])
	if (!candidate || candidate.startsWith('(') || candidate.includes(',')) return undefined
	if (/\bjoin\b/i.test(candidate)) return undefined

	return normalizeIdentifier(candidate)
}

export function extractMutationSourceTable(query: string): string | undefined {
	const trimmed = query.trim()
	if (!trimmed) return undefined

	const drizzleTable = extractSingleDrizzleTable(trimmed)
	if (drizzleTable) return drizzleTable

	const upper = trimmed.toUpperCase()
	if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
		return extractSingleSelectTable(trimmed)
	}
	if (upper.startsWith('UPDATE')) {
		return extractSingleDmlTable(
			trimmed,
			/^update\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][\w$]*))?)/i
		)
	}
	if (upper.startsWith('DELETE')) {
		return extractSingleDmlTable(
			trimmed,
			/^delete\s+from\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][\w$]*))?)/i
		)
	}
	if (upper.startsWith('INSERT')) {
		return extractSingleDmlTable(
			trimmed,
			/^insert\s+into\s+((?:"[^"]+"|[A-Za-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][\w$]*))?)/i
		)
	}

	return undefined
}
