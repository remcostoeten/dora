export function areValuesEqual(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true
	if (typeof a !== typeof b) return false
	if (a === null || b === null) return false
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b)) return false
		if (a.length !== b.length) return false
		return a.every(function (value, index) {
			return areValuesEqual(value, b[index])
		})
	}
	if (typeof a === 'object' && typeof b === 'object') {
		const aRecord = a as Record<string, unknown>
		const bRecord = b as Record<string, unknown>
		const aKeys = Object.keys(aRecord).sort()
		const bKeys = Object.keys(bRecord).sort()
		if (aKeys.length !== bKeys.length) return false
		return aKeys.every(function (key, index) {
			return key === bKeys[index] && areValuesEqual(aRecord[key], bRecord[key])
		})
	}
	return false
}
