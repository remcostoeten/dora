/**
 * Signature-help and hover metadata for the Drizzle condition operators the
 * runner's Monaco LSP understands. Pure data + parsing so the providers in
 * code-editor.tsx stay thin and this logic is unit-testable without Monaco.
 */

type OperatorParameter = {
	label: string
	documentation: string
}

export type OperatorSignature = {
	name: string
	signature: string
	documentation: string
	parameters: OperatorParameter[]
}

function comparison(name: string, verb: string): OperatorSignature {
	return {
		name,
		signature: `${name}(column, value)`,
		documentation: `SQL condition: column ${verb} value.`,
		parameters: [
			{ label: 'column', documentation: 'Column reference, e.g. users.id' },
			{ label: 'value', documentation: 'Value or column to compare against' }
		]
	}
}

export const DRIZZLE_OPERATOR_SIGNATURES: Record<string, OperatorSignature> = {
	eq: comparison('eq', '='),
	ne: comparison('ne', '<>'),
	gt: comparison('gt', '>'),
	gte: comparison('gte', '>='),
	lt: comparison('lt', '<'),
	lte: comparison('lte', '<='),
	like: {
		name: 'like',
		signature: 'like(column, pattern)',
		documentation: 'SQL LIKE — case-sensitive pattern match. Use % and _ as wildcards.',
		parameters: [
			{ label: 'column', documentation: 'Column reference, e.g. users.name' },
			{ label: 'pattern', documentation: "Pattern string, e.g. '%alice%'" }
		]
	},
	ilike: {
		name: 'ilike',
		signature: 'ilike(column, pattern)',
		documentation: 'Case-insensitive LIKE (Postgres). Use % and _ as wildcards.',
		parameters: [
			{ label: 'column', documentation: 'Column reference, e.g. users.name' },
			{ label: 'pattern', documentation: "Pattern string, e.g. '%alice%'" }
		]
	},
	inArray: {
		name: 'inArray',
		signature: 'inArray(column, values)',
		documentation: 'SQL IN — matches rows whose column equals any of the values.',
		parameters: [
			{ label: 'column', documentation: 'Column reference, e.g. users.id' },
			{ label: 'values', documentation: 'Array of values, e.g. [1, 2, 3]' }
		]
	},
	notInArray: {
		name: 'notInArray',
		signature: 'notInArray(column, values)',
		documentation: 'SQL NOT IN — matches rows whose column equals none of the values.',
		parameters: [
			{ label: 'column', documentation: 'Column reference, e.g. users.id' },
			{ label: 'values', documentation: 'Array of values, e.g. [1, 2, 3]' }
		]
	},
	between: {
		name: 'between',
		signature: 'between(column, min, max)',
		documentation: 'SQL BETWEEN — matches rows whose column is within [min, max].',
		parameters: [
			{ label: 'column', documentation: 'Column reference, e.g. orders.total' },
			{ label: 'min', documentation: 'Inclusive lower bound' },
			{ label: 'max', documentation: 'Inclusive upper bound' }
		]
	},
	and: {
		name: 'and',
		signature: 'and(...conditions)',
		documentation: 'Combines conditions with SQL AND.',
		parameters: [{ label: '...conditions', documentation: 'Conditions to AND together' }]
	},
	or: {
		name: 'or',
		signature: 'or(...conditions)',
		documentation: 'Combines conditions with SQL OR.',
		parameters: [{ label: '...conditions', documentation: 'Conditions to OR together' }]
	},
	not: {
		name: 'not',
		signature: 'not(condition)',
		documentation: 'Negates a condition with SQL NOT.',
		parameters: [{ label: 'condition', documentation: 'Condition to negate' }]
	},
	isNull: {
		name: 'isNull',
		signature: 'isNull(column)',
		documentation: 'SQL IS NULL.',
		parameters: [{ label: 'column', documentation: 'Column reference, e.g. users.deleted_at' }]
	},
	isNotNull: {
		name: 'isNotNull',
		signature: 'isNotNull(column)',
		documentation: 'SQL IS NOT NULL.',
		parameters: [{ label: 'column', documentation: 'Column reference, e.g. users.deleted_at' }]
	}
}

export type EnclosingOperatorCall = {
	name: string
	activeParameter: number
}

type CallFrame = {
	name: string | null
	commas: number
}

/**
 * Finds the innermost unclosed Drizzle operator call the cursor sits inside,
 * and which argument the cursor is on. Parses the text before the cursor
 * forward, keeping a stack of open call/bracket frames so commas inside
 * nested arrays, objects, strings, and completed calls are attributed to the
 * right level. Returns null when the cursor is not inside a known operator
 * call.
 */
export function findEnclosingOperatorCall(textUntilPosition: string): EnclosingOperatorCall | null {
	const stack: CallFrame[] = []
	const length = textUntilPosition.length

	let i = 0
	while (i < length) {
		const char = textUntilPosition[i]

		if (char === "'" || char === '"' || char === '`') {
			i++
			while (i < length) {
				if (textUntilPosition[i] === '\\') {
					i += 2
					continue
				}
				if (textUntilPosition[i] === char) break
				i++
			}
			i++
			continue
		}

		if (char === '(') {
			const head = textUntilPosition.slice(0, i)
			const nameMatch = head.match(/([A-Za-z_$][\w$]*)\s*$/)
			stack.push({ name: nameMatch ? nameMatch[1] : null, commas: 0 })
		} else if (char === '[' || char === '{') {
			stack.push({ name: null, commas: 0 })
		} else if (char === ')' || char === ']' || char === '}') {
			stack.pop()
		} else if (char === ',' && stack.length > 0) {
			stack[stack.length - 1].commas++
		}
		i++
	}

	for (let frame = stack.length - 1; frame >= 0; frame--) {
		const { name, commas } = stack[frame]
		if (name && DRIZZLE_OPERATOR_SIGNATURES[name]) {
			return { name, activeParameter: commas }
		}
		// A deeper unknown frame (array/object literal, user function) doesn't
		// change which operator argument the cursor is in — keep walking out.
	}

	return null
}
