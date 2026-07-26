/** Identifier + literal helpers shared by the schema and query emitters. */

const RESERVED = new Set([
	'break',
	'case',
	'catch',
	'class',
	'const',
	'continue',
	'debugger',
	'default',
	'delete',
	'do',
	'else',
	'enum',
	'export',
	'extends',
	'false',
	'finally',
	'for',
	'function',
	'if',
	'import',
	'in',
	'instanceof',
	'new',
	'null',
	'return',
	'super',
	'switch',
	'this',
	'throw',
	'true',
	'try',
	'typeof',
	'var',
	'void',
	'while',
	'with',
	'yield'
])

/** `user_roles` → `userRoles`; already-camel names are left alone. */
export function camelCase(name: string): string {
	const parts = name.split(/[^A-Za-z0-9]+/).filter(function (part) {
		return part.length > 0
	})
	if (parts.length === 0) {
		return '_'
	}
	const head = normalizePart(parts[0])
	const tail = parts.slice(1).map(function (part) {
		const lower = normalizePart(part)
		return lower.charAt(0).toUpperCase() + lower.slice(1)
	})
	const joined = head.charAt(0).toLowerCase() + head.slice(1) + tail.join('')
	return /^[0-9]/.test(joined) ? `_${joined}` : joined
}

function normalizePart(part: string): string {
	return /^[A-Z0-9]+$/.test(part) ? part.toLowerCase() : part
}

/** A JS variable name for a table, guaranteed not to collide with a keyword. */
export function tableVarName(tableName: string): string {
	const base = camelCase(tableName)
	return RESERVED.has(base) ? `${base}Table` : base
}

export function isSafeIdentifier(name: string): boolean {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !RESERVED.has(name)
}

/** An object-literal key: bare when it is a safe identifier, quoted otherwise. */
export function propertyKey(name: string): string {
	return isSafeIdentifier(name) ? name : quoteString(name)
}

export function quoteString(value: string): string {
	const escaped = value
		.replace(/\\/g, '\\\\')
		.replace(/'/g, "\\'")
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t')
	return `'${escaped}'`
}

/** Escape for a `sql\`…\`` template body. */
export function quoteTemplate(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

export function sortedImportList(names: Iterable<string>): string[] {
	return Array.from(new Set(names)).sort(function (a, b) {
		return a.localeCompare(b)
	})
}
