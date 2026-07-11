export function fuzzyMatchScore(query: string, text: string): number | null {
	const q = query.toLowerCase()
	const t = text.toLowerCase()
	if (!q) return 0
	if (!t) return null

	const substringIndex = t.indexOf(q)
	if (substringIndex >= 0) {
		const boundaryBonus = isWordBoundary(t, substringIndex) ? 20 : 0
		return 100 - Math.min(substringIndex, 40) + boundaryBonus
	}

	let score = 0
	let searchFrom = 0
	let previousMatch = -2

	for (const char of q) {
		const found = t.indexOf(char, searchFrom)
		if (found === -1) return null

		if (found === previousMatch + 1) {
			score += 6
		} else if (isWordBoundary(t, found)) {
			score += 8
		} else {
			score += 1
		}
		score -= Math.min(found - searchFrom, 10) * 0.5

		previousMatch = found
		searchFrom = found + 1
	}

	return score
}

function isWordBoundary(text: string, index: number): boolean {
	if (index === 0) return true
	return /[\s\-_/.:]/.test(text[index - 1])
}
