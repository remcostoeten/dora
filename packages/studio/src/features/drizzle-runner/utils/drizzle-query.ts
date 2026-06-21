function trimTrailingSemicolon(value: string): string {
	return value.trim().replace(/;\s*$/, '').trim()
}

function extractBalancedParens(source: string, startIndex: number): string | undefined {
	if (source[startIndex] !== '(') return undefined
	let depth = 0
	let quote: string | null = null
	let escape = false
	for (let i = startIndex; i < source.length; i++) {
		const char = source[i]
		if (escape) {
			escape = false
			continue
		}
		if (quote) {
			if (char === '\\') {
				escape = true
			} else if (char === quote) {
				quote = null
			}
			continue
		}
		if (char === "'" || char === '"' || char === '`') {
			quote = char
			continue
		}
		if (char === '(') depth++
		else if (char === ')') {
			depth--
			if (depth === 0) return source.slice(startIndex + 1, i)
		}
	}
	return undefined
}

function splitArgsRespectingDepth(source: string): string[] {
	const parts: string[] = []
	let depth = 0
	let quote: string | null = null
	let escape = false
	let current = ''

	for (const char of source) {
		if (escape) {
			current += char
			escape = false
			continue
		}
		if (quote) {
			current += char
			if (char === '\\') escape = true
			else if (char === quote) quote = null
			continue
		}
		if (char === "'" || char === '"' || char === '`') {
			quote = char
			current += char
			continue
		}
		if (char === '(' || char === '[' || char === '{') {
			depth++
			current += char
			continue
		}
		if (char === ')' || char === ']' || char === '}') {
			depth--
			current += char
			continue
		}
		if (char === ',' && depth === 0) {
			parts.push(current.trim())
			current = ''
			continue
		}
		current += char
	}

	if (current.trim()) parts.push(current.trim())
	return parts
}

function stripLeadingComments(value: string): string {
	let next = value.trim()
	let changed = true

	while (changed) {
		changed = false
		const withoutLineComment = next.replace(/^\/\/[^\n]*(?:\n|$)/, '').trim()
		if (withoutLineComment !== next) {
			next = withoutLineComment
			changed = true
			continue
		}

		const withoutBlockComment = next.replace(/^\/\*[\s\S]*?\*\//, '').trim()
		if (withoutBlockComment !== next) {
			next = withoutBlockComment
			changed = true
		}
	}

	return next
}

function normalizeTableExpression(expression: string): string | undefined {
	const trimmed = expression.trim()
	const unwrapped =
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'")) ||
		(trimmed.startsWith('`') && trimmed.endsWith('`'))
			? trimmed.slice(1, -1)
			: trimmed

	const parts = unwrapped.split('.').map(function (part) {
		return part.trim()
	})

	if (
		parts.length === 0 ||
		parts.length > 2 ||
		parts.some(function (part) {
			return !/^[A-Za-z_][\w$]*$/.test(part)
		})
	) {
		return undefined
	}

	return parts.join('.')
}

function sqlIdentifier(identifier: string): string {
	const reserved = new Set(['user', 'order', 'group', 'select', 'table'])
	return identifier
		.split('.')
		.map(function (part) {
			if (reserved.has(part.toLowerCase())) return `"${part.replace(/"/g, '""')}"`
			return part
		})
		.join('.')
}

function parseSqlLiteral(source: string): string | undefined {
	const value = source.trim()
	const quoted = value.match(/^(['"`])([\s\S]*)\1$/)
	if (quoted) {
		return `'${quoted[2].replace(/'/g, "''")}'`
	}
	if (/^-?\d+(?:\.\d+)?$/.test(value)) return value
	if (/^(true|false)$/i.test(value)) return value.toLowerCase()
	if (/^null$/i.test(value)) return 'NULL'
	return undefined
}

function parseColumnRef(source: string): string | undefined {
	const match = source.trim().match(/^([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?$/)
	if (!match) return undefined
	const column = match[2] ?? match[1]
	return sqlIdentifier(column)
}

function parseArrayLiteral(source: string): string[] | undefined {
	const trimmed = source.trim()
	if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return undefined
	const body = trimmed.slice(1, -1).trim()
	if (!body) return []
	const items = splitArgsRespectingDepth(body).map(parseSqlLiteral)
	if (items.some((item) => item === undefined)) return undefined
	return items as string[]
}

const COMPARISON_OPERATORS: Record<string, string> = {
	eq: '=',
	ne: '!=',
	gt: '>',
	gte: '>=',
	lt: '<',
	lte: '<=',
	like: 'LIKE',
	ilike: 'ILIKE'
}

function extractCall(source: string): { name: string; args: string[] } | undefined {
	const trimmed = source.trim()
	const head = trimmed.match(/^([A-Za-z_$][\w$]*)\s*\(/)
	if (!head) return undefined
	const open = head[0].length - 1
	const inner = extractBalancedParens(trimmed, open)
	if (inner === undefined) return undefined
	if (trimmed.slice(open + inner.length + 2).trim() !== '') return undefined
	return { name: head[1], args: splitArgsRespectingDepth(inner) }
}

/**
 * Recursively converts a Drizzle filter expression (eq/ne/.../and/or/not/
 * inArray/isNull/between, arbitrarily nested) into a SQL boolean expression.
 * Returns undefined when any leaf falls outside the supported literal grammar.
 */
function parseConditionExpression(source: string): string | undefined {
	const call = extractCall(source)
	if (!call) return undefined
	const { name, args } = call

	if (name === 'and' || name === 'or') {
		if (args.length === 0) return undefined
		const parts = args.map(parseConditionExpression)
		if (parts.some((part) => part === undefined)) return undefined
		return `(${parts.join(name === 'and' ? ' AND ' : ' OR ')})`
	}

	if (name === 'not') {
		if (args.length !== 1) return undefined
		const inner = parseConditionExpression(args[0])
		if (!inner) return undefined
		return `(NOT ${inner})`
	}

	if (name in COMPARISON_OPERATORS) {
		if (args.length !== 2) return undefined
		const column = parseColumnRef(args[0])
		const value = parseSqlLiteral(args[1])
		if (!column || value === undefined) return undefined
		return `${column} ${COMPARISON_OPERATORS[name]} ${value}`
	}

	if (name === 'isNull' || name === 'isNotNull') {
		if (args.length !== 1) return undefined
		const column = parseColumnRef(args[0])
		if (!column) return undefined
		return `${column} IS ${name === 'isNull' ? 'NULL' : 'NOT NULL'}`
	}

	if (name === 'inArray' || name === 'notInArray') {
		if (args.length !== 2) return undefined
		const column = parseColumnRef(args[0])
		const list = parseArrayLiteral(args[1])
		if (!column || !list || list.length === 0) return undefined
		return `${column} ${name === 'inArray' ? 'IN' : 'NOT IN'} (${list.join(', ')})`
	}

	if (name === 'between') {
		if (args.length !== 3) return undefined
		const column = parseColumnRef(args[0])
		const low = parseSqlLiteral(args[1])
		const high = parseSqlLiteral(args[2])
		if (!column || low === undefined || high === undefined) return undefined
		return `${column} BETWEEN ${low} AND ${high}`
	}

	return undefined
}

function parseOrderTerm(source: string): string | undefined {
	const call = extractCall(source)
	if (call && (call.name === 'asc' || call.name === 'desc')) {
		if (call.args.length !== 1) return undefined
		const column = parseColumnRef(call.args[0])
		if (!column) return undefined
		return `${column} ${call.name.toUpperCase()}`
	}
	return parseColumnRef(source)
}

function parseOrderByTerms(source: string): string[] | undefined {
	let body = source.trim()
	if (body.startsWith('[') && body.endsWith(']')) body = body.slice(1, -1).trim()
	if (!body) return undefined
	const terms = splitArgsRespectingDepth(body).map(parseOrderTerm)
	if (terms.some((term) => term === undefined)) return undefined
	return terms as string[]
}

function parseObjectLiteral(source: string): { keys: string[]; values: string[] } | undefined {
	const trimmed = source.trim()
	if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return undefined
	const body = trimmed.slice(1, -1).trim()
	if (!body) return undefined

	const keys: string[] = []
	const values: string[] = []
	for (const entry of splitArgsRespectingDepth(body)) {
		const match = entry.match(/^([A-Za-z_$][\w$]*|['"`][^'"`]+['"`])\s*:\s*([\s\S]+)$/)
		if (!match) return undefined
		const key = match[1].replace(/^['"`]|['"`]$/g, '')
		const value = parseSqlLiteral(match[2])
		if (value === undefined) return undefined
		keys.push(key)
		values.push(value)
	}

	return { keys, values }
}

function parseObjectAssignments(source: string): string[] | undefined {
	const object = parseObjectLiteral(source)
	if (!object) return undefined
	return object.keys.map((key, index) => `${sqlIdentifier(key)} = ${object.values[index]}`)
}

function parseValuesRows(source: string): { columns: string[]; tuples: string[][] } | undefined {
	const trimmed = source.trim()
	let objectSources: string[]
	if (trimmed.startsWith('[')) {
		if (!trimmed.endsWith(']')) return undefined
		const body = trimmed.slice(1, -1).trim()
		if (!body) return undefined
		objectSources = splitArgsRespectingDepth(body)
	} else {
		objectSources = [trimmed]
	}

	const parsed = objectSources.map(parseObjectLiteral)
	if (parsed.some((object) => object === undefined)) return undefined

	const rows = parsed as { keys: string[]; values: string[] }[]
	const columns = rows[0].keys
	for (const row of rows) {
		if (row.keys.length !== columns.length) return undefined
		for (let i = 0; i < columns.length; i++) {
			if (row.keys[i] !== columns[i]) return undefined
		}
	}

	return { columns, tuples: rows.map((row) => row.values) }
}

type ChainCall = { inner: string; full: string }

function extractChainCall(chain: string, method: string): ChainCall | undefined {
	const match = chain.match(new RegExp(`\\.${method}\\s*\\(`))
	if (!match || match.index === undefined) return undefined
	const open = match.index + match[0].length - 1
	const inner = extractBalancedParens(chain, open)
	if (inner === undefined) return undefined
	return { inner, full: chain.slice(match.index, open + inner.length + 2) }
}

function parseTrailingReturning(rest: string): boolean {
	const trimmed = rest.trim()
	if (!trimmed) return false
	if (/^\.returning\s*\(\s*\)$/.test(trimmed)) return true
	throw new Error(
		'Unsupported chain segment. Only an optional .returning() may follow. ' +
		'For onConflict / upsert / RETURNING projections, use db.execute(sql`...`).'
	)
}

/**
 * Converts a Drizzle ORM query expression to a plain SQL string.
 *
 * Supported patterns:
 *   - sql`SELECT ...`, (db|tx).execute(sql`SELECT ...`), (db|tx).execute('SELECT ...')
 *   - (db|tx).select().from(table) with optional .where(...), .orderBy(...), .limit(n), .offset(n)
 *   - (db|tx).insert(table).values({ ... } | [{ ... }]) with optional .returning()
 *   - (db|tx).update(table).set({ ... }).where(...) with optional .returning()
 *   - (db|tx).delete(table).where(...) with optional .returning()
 *   - (db|tx).$count(table[, condition])
 *   - Any of the above with a trailing .toSQL() call
 *
 * .where()/conditions accept eq/ne/gt/gte/lt/lte/like/ilike/inArray/notInArray/
 * isNull/isNotNull/between combined with and/or/not, over literal values.
 *
 * update()/delete() require a .where() — unguarded whole-table mutations are
 * rejected. Joins, groupBy/having, set operations (union/…), and column
 * projections are not auto-translated; use db.execute(sql`...`) for those.
 */
export function drizzleQueryToSql(source: string): string {
	const stripped = trimTrailingSemicolon(stripLeadingComments(source))
	const query = stripped.replace(/\.toSQL\s*\(\s*\)\s*$/, '').trimEnd()
	if (!query) {
		throw new Error('Enter a Drizzle query to execute.')
	}

	const rawSqlMatch = query.match(
		/^(?:await\s+)?(?:(?:db|tx)\.execute\s*\(\s*)?sql`([\s\S]*)`\s*\)?$/
	)
	if (rawSqlMatch) {
		return rawSqlMatch[1].trim()
	}

	const executePlainSqlMatch = query.match(
		/^(?:await\s+)?(?:db|tx)\.execute\s*\(\s*(['"`])([\s\S]*)\1\s*\)$/
	)
	if (executePlainSqlMatch) {
		return executePlainSqlMatch[2].trim()
	}

	const simpleSelectMatch = query.match(
		/^(?:await\s+)?(?:db|tx)\.select\s*\(\s*\)\s*\.from\s*\(\s*([^)]+?)\s*\)([\s\S]*)$/
	)
	if (simpleSelectMatch) {
		const tableName = normalizeTableExpression(simpleSelectMatch[1])
		if (!tableName) {
			throw new Error(
				'Unsupported Drizzle table expression. Use a simple table name ' +
				'(e.g. users, schema.users). For quoted or multi-part names, ' +
				'use db.execute(sql`...`).'
			)
		}

		const chain = simpleSelectMatch[2].trim()

		const hardMethod = chain.match(
			/\.(leftJoin|rightJoin|innerJoin|fullJoin|join|groupBy|having|unionAll|union|intersect|except)\s*\(/
		)
		if (hardMethod) {
			throw new Error(
				`.${hardMethod[1]}() is not auto-translated. Use db.execute(sql\`...\`) ` +
				'for joins, grouping, and set operations.'
			)
		}

		let strippedChain = chain
		let whereClause: string | undefined
		let orderByClause: string | undefined

		const whereCall = extractChainCall(chain, 'where')
		if (whereCall) {
			whereClause = parseConditionExpression(whereCall.inner.trim())
			if (!whereClause) {
				throw new Error(
					'Unsupported .where() expression. Use eq/ne/gt/gte/lt/lte/like/ilike/' +
					'inArray/notInArray/isNull/isNotNull/between combined with and/or/not, ' +
					'or db.execute(sql`...`).'
				)
			}
			strippedChain = strippedChain.replace(whereCall.full, '')
		}

		const orderCall = extractChainCall(chain, 'orderBy')
		if (orderCall) {
			const terms = parseOrderByTerms(orderCall.inner)
			if (!terms) {
				throw new Error(
					'Unsupported .orderBy() expression. Use column references or ' +
					'asc()/desc(), or db.execute(sql`...`).'
				)
			}
			orderByClause = terms.join(', ')
			strippedChain = strippedChain.replace(orderCall.full, '')
		}

		const unsupportedChain = strippedChain
			.replace(/\.limit\s*\(\s*\d+\s*\)/g, '')
			.replace(/\.offset\s*\(\s*\d+\s*\)/g, '')
			.trim()

		if (unsupportedChain) {
			throw new Error(
				'Unsupported Drizzle query. select().from(table) supports ' +
				'.where(...), .orderBy(...), .limit(n), and .offset(n). ' +
				'For more complex queries, use db.execute(sql`...`).'
			)
		}

		const limitMatch = chain.match(/\.limit\s*\(\s*(\d+)\s*\)/)
		const offsetMatch = chain.match(/\.offset\s*\(\s*(\d+)\s*\)/)
		let sql = `SELECT * FROM ${tableName}`
		if (whereClause) sql += ` WHERE ${whereClause}`
		if (orderByClause) sql += ` ORDER BY ${orderByClause}`
		if (limitMatch) sql += ` LIMIT ${limitMatch[1]}`
		if (offsetMatch) sql += ` OFFSET ${offsetMatch[1]}`
		return sql
	}

	const insertHead = query.match(
		/^(?:await\s+)?(?:db|tx)\.insert\s*\(\s*([^)]+?)\s*\)\s*\.values\s*\(/
	)
	if (insertHead) {
		const tableName = normalizeTableExpression(insertHead[1])
		if (!tableName) {
			throw new Error(
				'Unsupported insert table expression. Use a simple table name, ' +
				'or db.execute(sql`...`).'
			)
		}
		const open = query.indexOf('(', insertHead[0].length - 1)
		const inner = extractBalancedParens(query, open)
		if (inner === undefined) {
			throw new Error('Malformed .values() call.')
		}
		const returning = parseTrailingReturning(query.slice(open + inner.length + 2))
		const rows = parseValuesRows(inner.trim())
		if (!rows) {
			throw new Error(
				'Unsupported .values() payload. Use an object literal { column: value } ' +
				'(or an array of them) with literal values. For expressions, use db.execute(sql`...`).'
			)
		}
		const columnsSql = rows.columns.map(sqlIdentifier).join(', ')
		const valuesSql = rows.tuples.map((tuple) => `(${tuple.join(', ')})`).join(', ')
		let sql = `INSERT INTO ${sqlIdentifier(tableName)} (${columnsSql}) VALUES ${valuesSql}`
		if (returning) sql += ' RETURNING *'
		return sql
	}

	const deleteHead = query.match(
		/^(?:await\s+)?(?:db|tx)\.delete\s*\(\s*([^)]+?)\s*\)([\s\S]*)$/
	)
	if (deleteHead) {
		const tableName = normalizeTableExpression(deleteHead[1])
		if (!tableName) {
			throw new Error(
				'Unsupported delete table expression. Use a simple table name, ' +
				'or db.execute(sql`...`).'
			)
		}
		const rest = deleteHead[2].trim()
		const whereCall = rest ? extractChainCall(rest, 'where') : undefined
		if (!whereCall) {
			throw new Error(
				'db.delete(table) without .where() is rejected to avoid deleting every row. ' +
				'Add .where(...), or use db.execute(sql`DELETE FROM ...`).'
			)
		}
		const condition = parseConditionExpression(whereCall.inner.trim())
		if (!condition) {
			throw new Error(
				'Unsupported .where() expression in delete. Use eq/ne/.../and/or/not over ' +
				'literal values, or db.execute(sql`...`).'
			)
		}
		const returning = parseTrailingReturning(rest.replace(whereCall.full, ''))
		let sql = `DELETE FROM ${sqlIdentifier(tableName)} WHERE ${condition}`
		if (returning) sql += ' RETURNING *'
		return sql
	}

	const updateHead = query.match(
		/^(?:await\s+)?(?:db|tx)\.update\s*\(\s*([^)]+?)\s*\)\s*\.set\s*\(/
	)
	if (updateHead) {
		const tableName = normalizeTableExpression(updateHead[1])
		if (!tableName) {
			throw new Error(
				'Unsupported update table expression. Use a simple table name, ' +
				'or db.execute(sql`...`).'
			)
		}
		const open = query.indexOf('(', updateHead[0].length - 1)
		const setInner = extractBalancedParens(query, open)
		if (setInner === undefined) {
			throw new Error('Malformed .set() call.')
		}
		const assignments = parseObjectAssignments(setInner.trim())
		if (!assignments) {
			throw new Error(
				'Unsupported .set() payload. Use { column: value } with literal values, ' +
				'or db.execute(sql`...`).'
			)
		}
		const rest = query.slice(open + setInner.length + 2).trim()
		const whereCall = rest ? extractChainCall(rest, 'where') : undefined
		if (!whereCall) {
			throw new Error(
				'db.update(table).set({...}) without .where() is rejected to avoid updating ' +
				'every row. Add .where(...), or use db.execute(sql`...`).'
			)
		}
		const condition = parseConditionExpression(whereCall.inner.trim())
		if (!condition) {
			throw new Error(
				'Unsupported .where() expression in update. Use eq/ne/.../and/or/not over ' +
				'literal values, or db.execute(sql`...`).'
			)
		}
		const returning = parseTrailingReturning(rest.replace(whereCall.full, ''))
		let sql = `UPDATE ${sqlIdentifier(tableName)} SET ${assignments.join(', ')} WHERE ${condition}`
		if (returning) sql += ' RETURNING *'
		return sql
	}

	const countCallMatch = query.match(/^(?:await\s+)?(?:db|tx)\.\$count\s*\(/)
	if (countCallMatch) {
		const parenStart = query.indexOf('(', countCallMatch[0].length - 1)
		const inner = extractBalancedParens(query, parenStart)
		if (inner === undefined) {
			throw new Error('Malformed db.$count() call.')
		}
		const args = splitArgsRespectingDepth(inner)
		const tableName = normalizeTableExpression(args[0] ?? '')
		if (!tableName) {
			throw new Error(
				'Unsupported db.$count() table expression. Use a simple table name ' +
				'(e.g. db.$count(users) or db.$count(users, eq(users.active, true))).'
			)
		}
		let sql = `SELECT count(*) FROM ${tableName}`
		if (args.length > 1) {
			const condition = parseConditionExpression(args.slice(1).join(', '))
			if (!condition) {
				throw new Error(
					'Unsupported db.$count() condition. Use eq/ne/.../and/or/not over ' +
					'literal values, or db.execute(sql`...`).'
				)
			}
			sql += ` WHERE ${condition}`
		}
		return sql
	}

	throw new Error(
		'Unsupported Drizzle query. Supported: sql`...`, (db|tx).execute(sql`...`), ' +
		'select().from(table) (+ .where/.orderBy/.limit/.offset), ' +
		'insert(table).values({...}), update(table).set({...}).where(...), ' +
		'delete(table).where(...), and $count(table). ' +
		'Append .toSQL() to any of these. For everything else, use db.execute(sql`...`).'
	)
}
